import { describe, it, expect } from "vitest";
import { initCommand } from "../src/commands/init.js";

describe("init command", () => {
  it("exposes citty meta with name 'init'", () => {
    expect(initCommand.meta).toBeDefined();
    // citty's meta can be a function or object; here it is an object literal.
    const meta =
      typeof initCommand.meta === "function"
        ? initCommand.meta()
        : initCommand.meta;
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
  });
});
