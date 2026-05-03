import { describe, it, expect } from "vitest";
import { initCommand, buildInstallCommands } from "../src/commands/init.js";
import type { StackChoices } from "../src/schema.js";

describe("init command", () => {
  it("exposes citty meta with name 'init'", async () => {
    expect(initCommand.meta).toBeDefined();
    const meta = await initCommand.meta;
    expect(meta?.name).toBe("init");
  });

  it("declares the expected args", () => {
    const args = initCommand.args ?? {};
    expect(args).toHaveProperty("name");
    expect(args).toHaveProperty("yes");
    expect(args).toHaveProperty("frontend");
    expect(args).toHaveProperty("backend");
    expect(args).toHaveProperty("db");
    expect(args).toHaveProperty("frontend-host");
    expect(args).toHaveProperty("backend-host");
    expect(args).toHaveProperty("skip-install");
  });
});

describe("buildInstallCommands", () => {
  const stack = (overrides: Partial<StackChoices> = {}): StackChoices => ({
    frontend: "nextjs",
    backend: "hono",
    db: "neon",
    frontendHost: "vercel",
    backendHost: "railway",
    ...overrides,
  });

  it("emits Vercel skills + CLI when frontendHost is vercel", () => {
    const cmds = buildInstallCommands(
      stack({ backendHost: "none" }),
      "/tmp/proj",
    );
    const flat = cmds.map((c) => `${c.cmd} ${c.args.join(" ")}`);

    expect(flat).toEqual([
      "npx -y skills add vercel-labs/next-skills --skill next-best-practices --skill next-cache-components --skill next-upgrade",
      "npx -y skills add vercel/vercel --skill vercel-cli",
      "npx -y skills add vercel-labs/agent-skills --skill vercel-deploy",
      "npx -y skills add vercel-labs/autoship --skill autoship",
      "npm i -g vercel",
    ]);

    // skill installs run in target dir; global npm install does not need a cwd.
    for (const c of cmds) {
      if (c.cmd === "npx") expect(c.cwd).toBe("/tmp/proj");
      if (c.cmd === "npm") expect(c.cwd).toBeUndefined();
    }
  });

  it("emits Railway skills + CLI when backendHost is railway", () => {
    const cmds = buildInstallCommands(
      stack({ frontendHost: "none" }),
      "/tmp/proj",
    );
    const flat = cmds.map((c) => `${c.cmd} ${c.args.join(" ")}`);

    expect(flat).toEqual([
      "npx -y skills add railwayapp/railway-skills",
      "npm i -g @railway/cli",
    ]);
  });

  it("emits both stacks combined", () => {
    const cmds = buildInstallCommands(stack(), "/tmp/proj");
    expect(cmds).toHaveLength(7);
  });

  it("emits nothing when both hosts are 'none'", () => {
    const cmds = buildInstallCommands(
      stack({ frontendHost: "none", backendHost: "none" }),
      "/tmp/proj",
    );
    expect(cmds).toEqual([]);
  });
});
