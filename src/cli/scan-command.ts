import type { Command } from "commander";
import { loadConfigFile, resolveConfig } from "../config/resolve.js";
import { scan } from "../scan/scan.js";
import { formatReport } from "./format.js";

export function registerScanCommand(program: Command): void {
  program
    .command("scan")
    .description("Scan files for accessibility issues")
    .argument("<path>", "Path to scan")
    .option("--fix", "Auto-fix issues")
    .option("-i, --interactive", "Review each fix interactively")
    .option("--no-ai", "Skip AI-powered fixes")
    .option("--provider <provider>", "Override AI provider")
    .option("--model <model>", "Override AI model")
    .option("--min-score <score>", "Minimum score threshold (exit code 1 if below)", parseInt)
    .action(async (targetPath: string, options: any) => {
      const fileConfig = await loadConfigFile(process.cwd());
      const config = resolveConfig(fileConfig, {
        fix: options.fix,
        interactive: options.interactive,
        noAi: !options.ai, // commander inverts --no-ai to options.ai = false
        provider: options.provider,
        model: options.model,
        minScore: options.minScore,
      });

      const result = await scan(targetPath, config);
      console.log(formatReport(result, config.fix));

      // CI gate
      if (config.minScore !== undefined && result.score < config.minScore) {
        console.error(
          `  Score ${result.score} is below minimum threshold ${config.minScore}`
        );
        process.exit(1);
      }
    });
}
