import { defineCommand, runMain } from "citty";
import { initCommand } from "./commands/init.js";

const main = defineCommand({
  meta: {
    name: "firth",
    version: "0.0.1",
    description: "Cloud platform SDK for AI coding agents.",
  },
  subCommands: {
    init: initCommand,
  },
});

runMain(main);
