import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type {
  FirthConfig,
  StackChoices,
  BackendFramework,
} from "../schema.js";
import { renderConfig } from "./init.js";

export const configCommand = defineCommand({
  meta: {
    name: "config",
    description:
      "View or update the stack configuration in firth.config.ts.",
  },
  args: {
    frontend: {
      type: "string",
      description: "Set frontend framework (nextjs)",
    },
    backend: {
      type: "string",
      description: "Set backend framework (hono | express | none)",
    },
    db: {
      type: "string",
      description:
        "Set database provider (neon | railway-postgres | none)",
    },
    "frontend-host": {
      type: "string",
      description: "Set frontend host (vercel | none)",
    },
    "backend-host": {
      type: "string",
      description: "Set backend host (railway | none)",
    },
  },
  async run({ args }) {
    const configPath = resolve(process.cwd(), "firth.config.ts");

    if (!existsSync(configPath)) {
      p.cancel(
        [
          "ERROR: firth.config.ts not found.",
          `EXPECTED AT: ${configPath}`,
          "SUGGESTED ACTION: Run `firth init` first to scaffold the project.",
        ].join("\n"),
      );
      process.exit(1);
    }

    const config = await loadConfig(configPath);

    p.intro("firth config");

    const hasOverrides =
      args.frontend ||
      args.backend ||
      args.db ||
      args["frontend-host"] ||
      args["backend-host"];

    const result = hasOverrides
      ? applyOverrides(config.stack, args)
      : await promptConfig(config.stack);

    if (!result) {
      p.cancel("Cancelled.");
      process.exit(0);
    }

    const stack: StackChoices = result;

    config.stack = stack;
    await writeFile(configPath, renderConfig(config), "utf8");

    p.outro(
      [
        "OK: updated firth.config.ts",
        "",
        `  frontend:      ${stack.frontend}`,
        `  backend:       ${stack.backend}`,
        `  db:            ${stack.db}`,
        `  frontendHost:  ${stack.frontendHost}`,
        `  backendHost:   ${stack.backendHost}`,
      ].join("\n"),
    );
  },
});

/**
 * Load the config from a firth.config.ts file.
 * Extracts the JSON object from the `export default { ... };` pattern.
 */
export async function loadConfig(configPath: string): Promise<FirthConfig> {
  const raw = await readFile(configPath, "utf8");
  const match = raw.match(/export\s+default\s+({[\s\S]*?});/);
  if (!match) {
    throw new Error(
      `Could not parse firth.config.ts. Expected \`export default { ... };\` pattern.\nFile: ${configPath}`,
    );
  }
  return JSON.parse(match[1]) as FirthConfig;
}

function applyOverrides(
  current: StackChoices,
  args: Record<string, unknown>,
): StackChoices {
  return {
    frontend: (args.frontend as StackChoices["frontend"]) ?? current.frontend,
    backend: (args.backend as BackendFramework) ?? current.backend,
    db: (args.db as StackChoices["db"]) ?? current.db,
    frontendHost:
      (args["frontend-host"] as StackChoices["frontendHost"]) ??
      current.frontendHost,
    backendHost:
      (args["backend-host"] as StackChoices["backendHost"]) ??
      current.backendHost,
  };
}

async function promptConfig(
  current: StackChoices,
): Promise<StackChoices | null> {
  const frontend = await p.select({
    message: "Frontend framework?",
    options: [{ value: "nextjs", label: "Next.js" }],
    initialValue: current.frontend,
  });
  if (p.isCancel(frontend)) return null;

  const backend = await p.select({
    message: "Backend framework?",
    options: [
      { value: "hono", label: "Hono (recommended)" },
      { value: "express", label: "Express" },
      { value: "none", label: "None (frontend-only)" },
    ],
    initialValue: current.backend,
  });
  if (p.isCancel(backend)) return null;

  const db = await p.select({
    message: "Database?",
    options: [
      { value: "neon", label: "Neon Postgres" },
      { value: "railway-postgres", label: "Railway Postgres" },
      { value: "none", label: "None" },
    ],
    initialValue: current.db,
  });
  if (p.isCancel(db)) return null;

  const frontendHost = await p.select({
    message: "Frontend hosting?",
    options: [
      { value: "vercel", label: "Vercel" },
      { value: "none", label: "Not yet" },
    ],
    initialValue: current.frontendHost,
  });
  if (p.isCancel(frontendHost)) return null;

  let backendHost: string;
  if (backend === "none") {
    backendHost = "none";
  } else {
    const result = await p.select({
      message: "Backend hosting?",
      options: [
        { value: "railway", label: "Railway" },
        { value: "none", label: "Not yet" },
      ],
      initialValue: current.backendHost,
    });
    if (p.isCancel(result)) return null;
    backendHost = String(result);
  }

  return {
    frontend: String(frontend) as StackChoices["frontend"],
    backend: String(backend) as BackendFramework,
    db: String(db) as StackChoices["db"],
    frontendHost: String(frontendHost) as StackChoices["frontendHost"],
    backendHost: backendHost as StackChoices["backendHost"],
  };
}
