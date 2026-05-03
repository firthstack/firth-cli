import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, basename } from "node:path";
import { spawn } from "node:child_process";
import type {
  FirthConfig,
  FirthLock,
  StackChoices,
  BackendFramework,
} from "../schema.js";

export interface InstallCommand {
  cmd: string;
  args: string[];
  cwd?: string;
  description: string;
}

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
    "skip-install": {
      type: "boolean",
      description:
        "Skip installing host skills (npx skills add ...) and host CLIs (npm i -g ...). Useful in CI or when running offline.",
      default: false,
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

    const skipInstall = !!args["skip-install"];
    const installResult = skipInstall
      ? { ran: false, commands: buildInstallCommands(stack, targetDir) }
      : await runInstalls(stack, targetDir, !!args.yes);

    p.outro(
      [
        `OK: wrote firth.config.ts and firth.lock.json to ${targetDir}`,
        "",
        "NEXT STEPS:",
        "  1. Review firth.config.ts and adjust the stack if needed.",
        ...(installResult.ran
          ? []
          : installResult.commands.length > 0
            ? [
                "  2. Install host skills + CLIs (skipped this run):",
                ...installResult.commands.map(
                  (c) => `       ${c.cmd} ${c.args.join(" ")}`,
                ),
                "  3. Run `firth deploy` to provision and ship (coming soon).",
              ]
            : []),
        ...(installResult.ran
          ? ["  2. Run `firth deploy` to provision and ship (coming soon)."]
          : []),
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

/**
 * Build the list of skill + CLI install commands implied by the stack choices.
 * Pure: no I/O. Exported so tests can pin the exact command shapes.
 */
export function buildInstallCommands(
  stack: StackChoices,
  targetDir: string,
): InstallCommand[] {
  const cmds: InstallCommand[] = [];

  if (stack.frontendHost === "vercel") {
    cmds.push(
      {
        cmd: "npx",
        args: [
          "-y",
          "skills",
          "add",
          "vercel-labs/next-skills",
          "--skill",
          "next-best-practices",
          "--skill",
          "next-cache-components",
          "--skill",
          "next-upgrade",
        ],
        cwd: targetDir,
        description: "Next.js skills (vercel-labs/next-skills)",
      },
      {
        cmd: "npx",
        args: ["-y", "skills", "add", "vercel/vercel", "--skill", "vercel-cli"],
        cwd: targetDir,
        description: "Vercel CLI skill (vercel/vercel)",
      },
      {
        cmd: "npx",
        args: [
          "-y",
          "skills",
          "add",
          "vercel-labs/agent-skills",
          "--skill",
          "vercel-deploy",
        ],
        cwd: targetDir,
        description: "Vercel deploy skill (vercel-labs/agent-skills)",
      },
      {
        cmd: "npx",
        args: [
          "-y",
          "skills",
          "add",
          "vercel-labs/autoship",
          "--skill",
          "autoship",
        ],
        cwd: targetDir,
        description: "Autoship skill (vercel-labs/autoship)",
      },
      {
        cmd: "npm",
        args: ["i", "-g", "vercel"],
        description: "Vercel CLI (global)",
      },
    );
  }

  if (stack.backendHost === "railway") {
    cmds.push(
      {
        cmd: "npx",
        args: ["-y", "skills", "add", "railwayapp/railway-skills"],
        cwd: targetDir,
        description: "Railway skills (railwayapp/railway-skills)",
      },
      {
        cmd: "npm",
        args: ["i", "-g", "@railway/cli"],
        description: "Railway CLI (global)",
      },
    );
  }

  return cmds;
}

interface InstallOutcome {
  ran: boolean;
  commands: InstallCommand[];
}

async function runInstalls(
  stack: StackChoices,
  targetDir: string,
  yes: boolean,
): Promise<InstallOutcome> {
  const cmds = buildInstallCommands(stack, targetDir);
  if (cmds.length === 0) return { ran: true, commands: [] };

  p.log.info(
    [
      "Will install host skills + CLIs:",
      ...cmds.map((c) => `  - ${c.description}`),
      "",
      "Note: `npm i -g ...` may require admin/sudo on system Node installs.",
    ].join("\n"),
  );

  if (!yes) {
    const proceed = await p.confirm({
      message: "Run install now?",
      initialValue: true,
    });
    if (p.isCancel(proceed) || !proceed) {
      return { ran: false, commands: cmds };
    }
  }

  for (const c of cmds) {
    p.log.step(`$ ${c.cmd} ${c.args.join(" ")}`);
    const result = await runCmd(c);
    if (!result.ok) {
      p.log.warn(
        `FAILED (exit ${result.code ?? "?"}): ${c.description}. Continuing.`,
      );
    }
  }

  return { ran: true, commands: cmds };
}

function runCmd(
  c: InstallCommand,
): Promise<{ ok: boolean; code: number | null }> {
  return new Promise((done) => {
    const child = spawn(c.cmd, c.args, {
      cwd: c.cwd,
      stdio: "inherit",
      shell: true,
    });
    child.on("close", (code) => done({ ok: code === 0, code }));
    child.on("error", () => done({ ok: false, code: null }));
  });
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
