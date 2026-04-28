import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, basename } from "node:path";
import type {
  FirthConfig,
  FirthLock,
  StackChoices,
  BackendFramework,
} from "../schema.js";

export const initCommand = defineCommand({
  meta: {
    name: "init",
    description:
      "Scaffold Firth project files (firth.config.ts + firth.lock.json) in the target directory.",
  },
  args: {
    name: {
      type: "positional",
      description: "Project directory (use '.' for current directory)",
      required: false,
      default: ".",
    },
    yes: {
      type: "boolean",
      alias: "y",
      description:
        "Skip all prompts; use defaults (Next.js + Hono + Neon + Vercel + Railway). Safe for non-interactive agent runs.",
      default: false,
    },
    frontend: {
      type: "string",
      description: "Frontend framework override (nextjs)",
    },
    backend: {
      type: "string",
      description: "Backend framework override (hono | express | none)",
    },
    db: {
      type: "string",
      description: "Database provider override (neon | none)",
    },
    "frontend-host": {
      type: "string",
      description: "Frontend host override (vercel | none)",
    },
    "backend-host": {
      type: "string",
      description: "Backend host override (railway | none)",
    },
  },
  async run({ args }) {
    const rawName = String(args.name);
    const targetDir = resolve(process.cwd(), rawName);
    const projectName =
      rawName === "." ? basename(targetDir) : basename(targetDir);

    p.intro("firth init");

    // Refuse to overwrite — agent-friendly: name the file, name the fix.
    const configPath = resolve(targetDir, "firth.config.ts");
    if (existsSync(configPath)) {
      p.cancel(
        [
          "ERROR: firth.config.ts already exists.",
          `LOCATION: ${configPath}`,
          "SUGGESTED ACTIONS:",
          "  1. Edit firth.config.ts by hand to change the stack.",
          "  2. Or delete firth.config.ts and re-run `firth init`.",
        ].join("\n"),
      );
      process.exit(1);
    }

    const stack = args.yes ? defaultStack() : await promptStack(args);
    if (!stack) {
      p.cancel("Cancelled.");
      process.exit(0);
    }

    const config: FirthConfig = { project: projectName, stack };
    const lock: FirthLock = { version: 1, resources: {} };

    if (!existsSync(targetDir)) {
      await mkdir(targetDir, { recursive: true });
    }

    await writeFile(configPath, renderConfig(config), "utf8");
    await writeFile(
      resolve(targetDir, "firth.lock.json"),
      JSON.stringify(lock, null, 2) + "\n",
      "utf8",
    );

    p.outro(
      [
        `OK: wrote firth.config.ts and firth.lock.json to ${targetDir}`,
        "",
        "NEXT STEPS:",
        "  1. Review firth.config.ts and adjust the stack if needed.",
        "  2. Run `firth deploy` to provision and ship (coming soon).",
      ].join("\n"),
    );
  },
});

function defaultStack(): StackChoices {
  return {
    frontend: "nextjs",
    backend: "hono",
    db: "neon",
    frontendHost: "vercel",
    backendHost: "railway",
  };
}

/** Interactive prompts, with each step honoring an explicit CLI override flag. */
async function promptStack(
  args: Record<string, unknown>,
): Promise<StackChoices | null> {
  const frontend =
    (args.frontend as string | undefined) ??
    (await p.select({
      message: "Frontend framework?",
      options: [{ value: "nextjs", label: "Next.js" }],
      initialValue: "nextjs",
    }));
  if (p.isCancel(frontend)) return null;

  const backend =
    (args.backend as string | undefined) ??
    (await p.select({
      message: "Backend framework?",
      options: [
        { value: "hono", label: "Hono (recommended)" },
        { value: "express", label: "Express" },
        { value: "none", label: "None (frontend-only)" },
      ],
      initialValue: "hono",
    }));
  if (p.isCancel(backend)) return null;

  const db =
    (args.db as string | undefined) ??
    (await p.select({
      message: "Database?",
      options: [
        { value: "neon", label: "Neon Postgres" },
        { value: "none", label: "None" },
      ],
      initialValue: "neon",
    }));
  if (p.isCancel(db)) return null;

  const frontendHost =
    (args["frontend-host"] as string | undefined) ??
    (await p.select({
      message: "Frontend hosting?",
      options: [
        { value: "vercel", label: "Vercel" },
        { value: "none", label: "Not yet" },
      ],
      initialValue: "vercel",
    }));
  if (p.isCancel(frontendHost)) return null;

  let backendHost: string;
  if (backend === "none") {
    backendHost = "none";
  } else {
    const result =
      (args["backend-host"] as string | undefined) ??
      (await p.select({
        message: "Backend hosting?",
        options: [
          { value: "railway", label: "Railway" },
          { value: "none", label: "Not yet" },
        ],
        initialValue: "railway",
      }));
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

function renderConfig(config: FirthConfig): string {
  // For v0.0.1 we emit a plain default-export object so the project doesn't
  // need to install `firth` as a dev dep yet. Once we ship a typed
  // `defineConfig` helper, switch this to import-based output.
  return `// firth.config.ts
// Generated by \`firth init\`. Source-of-truth for this project's stack.
// Hand-edit, then run \`firth deploy\` to apply changes.

export default ${JSON.stringify(config, null, 2)};
`;
}
