import { config } from "dotenv";
import { Command } from "commander";
import { registerScanCommand } from "./scan-command.js";
import { registerInitCommand } from "./init-command.js";
import { registerCacheCommand } from "./cache-command.js";

config({ path: ".env", override: false });
config({ path: ".env.local", override: true });
config({ path: ".env.development", override: true });
config({ path: ".env.development.local", override: true });

const program = new Command();

program
  .name("next-a11y")
  .description("AI-powered accessibility codemod for Next.js")
  .version("0.1.0");

registerScanCommand(program);
registerInitCommand(program);
registerCacheCommand(program);

program.parse();
