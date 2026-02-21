import * as fs from "node:fs";
import * as path from "node:path";
import { config as dotenvConfig } from "dotenv";
import type { Command } from "commander";
import pc from "picocolors";
import { loadConfigFile, resolveConfig } from "../config/resolve.js";
import { detect, resolveAi, fixViolation, finalize, scan } from "../scan/scan.js";
import { formatReport, formatFixApplied } from "./format.js";
import { interactiveReview } from "./interactive.js";

export function registerScanCommand(program: Command): void {
  const version = program.version() as string | undefined;

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
      // Also load .env files from the scan target directory
      let envDir = path.resolve(targetPath);
      if (fs.existsSync(envDir) && fs.statSync(envDir).isFile()) {
        envDir = path.dirname(envDir);
      }
      // Walk up to find .env files (e.g., scanning a subdirectory of a project)
      let searchDir = envDir;
      while (searchDir !== path.dirname(searchDir)) {
        for (const envFile of [".env", ".env.local"]) {
          const envPath = path.join(searchDir, envFile);
          if (fs.existsSync(envPath)) {
            dotenvConfig({ path: envPath, override: false, quiet: true });
          }
        }
        if (fs.existsSync(path.join(searchDir, "package.json"))) break;
        searchDir = path.dirname(searchDir);
      }

      const fileConfig = await loadConfigFile(process.cwd());
      const config = resolveConfig(fileConfig, {
        fix: options.fix,
        interactive: options.interactive,
        noAi: !options.ai, // commander inverts --no-ai to options.ai = false
        provider: options.provider,
        model: options.model,
        minScore: options.minScore,
      });

      let result;

      try {

      if (config.interactive && config.fix) {
        // Interactive mode: detect → resolve AI → review each fix
        const ctx = await detect(targetPath, config);

        await resolveAi(ctx, (resolved, total, _violation, aiResult) => {
          console.log(pc.dim(`  AI: resolved ${resolved}/${total} → "${aiResult}"`));
        });

        const { applied } = await interactiveReview(
          ctx.violations,
          async (violation) => {
            await fixViolation(ctx, violation);
          }
        );

        result = await finalize(ctx, applied);
        console.log(formatReport(result, true, version));
      } else if (config.fix) {
        // Auto-fix mode: detect → resolve AI → fix all → list
        const ctx = await detect(targetPath, config);

        await resolveAi(ctx, (resolved, total, _violation, aiResult) => {
          console.log(pc.dim(`  AI: resolved ${resolved}/${total} → "${aiResult}"`));
        });

        let fixedCount = 0;
        const fixed: { filePath: string; line: number; rule: string; message: string }[] = [];

        for (const violation of ctx.violations) {
          const applied = await fixViolation(ctx, violation);
          if (applied) {
            fixedCount++;
            fixed.push({
              filePath: violation.filePath,
              line: violation.line,
              rule: violation.rule,
              message: violation.message,
            });
          }
        }

        result = await finalize(ctx, fixedCount);

        if (fixed.length > 0) {
          console.log(pc.bold("\n  Fixes applied:\n"));
          for (const f of fixed) {
            console.log(formatFixApplied(f.filePath, f.line, f.rule, f.message));
          }
        }

        console.log(formatReport(result, true, version));
      } else {
        // Report-only mode
        result = await scan(targetPath, config);
        console.log(formatReport(result, false, version));
      }

      // CI gate
      if (config.minScore !== undefined && result.score < config.minScore) {
        console.error(
          `  Score ${result.score} is below minimum threshold ${config.minScore}`
        );
        process.exit(1);
      }

      } catch (err: any) {
        console.error(pc.red(`\n  Error: ${err.message}\n`));
        process.exit(1);
      }
    });
}
