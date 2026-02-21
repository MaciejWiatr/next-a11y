import * as fs from "node:fs";
import * as path from "node:path";
import { config } from "dotenv";
import { Command } from "commander";
import { registerScanCommand } from "./scan-command.js";
import { registerInitCommand } from "./init-command.js";
import { registerCacheCommand } from "./cache-command.js";

const pkgPath = path.resolve(__dirname, "../../package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

config({ path: ".env", override: false, quiet: true });
config({ path: ".env.local", override: true, quiet: true });
config({ path: ".env.development", override: true, quiet: true });
config({ path: ".env.development.local", override: true, quiet: true });

const program = new Command();

program
  .name("next-a11y")
  .description("AI-powered accessibility codemod for Next.js")
  .version(pkg.version);

registerScanCommand(program);
registerInitCommand(program);
registerCacheCommand(program);

program.parse();
