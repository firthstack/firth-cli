import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  splitting: false,
  shims: false,
  dts: false,
  banner: {
    // Make the bin file directly executable on POSIX systems.
    js: "#!/usr/bin/env node",
  },
});
