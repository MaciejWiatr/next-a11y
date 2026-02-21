import * as path from "node:path";
import { Project } from "ts-morph";
import type { ResolvedConfig } from "../config/schema.js";
import type { Violation, ScanResult } from "./types.js";
import { discoverFiles } from "./glob.js";
import { getRulesForConfig } from "../rules/index.js";
import { computeScore, loadPreviousScore, savePreviousScore } from "./score.js";
import { applyFix } from "../apply/apply.js";

export async function scan(
  targetPath: string,
  config: ResolvedConfig
): Promise<ScanResult> {
  const absPath = path.resolve(targetPath);

  // 1. Discover files
  const files = await discoverFiles(
    absPath,
    config.scanner.include,
    config.scanner.exclude
  );

  if (files.length === 0) {
    return {
      violations: [],
      filesScanned: 0,
      elementsScanned: 0,
      score: 100,
      fixedCount: 0,
    };
  }

  // 2. Create ts-morph project
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      jsx: 4, // JsxEmit.ReactJSX
      allowJs: true,
      noEmit: true,
    },
  });

  // Add discovered files
  for (const filePath of files) {
    try {
      project.addSourceFileAtPath(filePath);
    } catch {
      // Skip files that can't be parsed
    }
  }

  // 3. Get applicable rules
  const rules = getRulesForConfig(config.rules, config.noAi);

  // 4. Run rules on each file
  const allViolations: Violation[] = [];
  let elementsScanned = 0;

  for (const sourceFile of project.getSourceFiles()) {
    for (const rule of rules) {
      try {
        const violations = rule.scan(sourceFile);
        allViolations.push(...violations);
      } catch {
        // Skip rule errors for individual files
      }
    }
    // Rough element count
    elementsScanned += sourceFile.getDescendants().length;
  }

  // 5. Apply fixes if requested
  let fixedCount = 0;

  if (config.fix) {
    for (const violation of allViolations) {
      if (!violation.fix) continue;

      // Skip AI fixes when --no-ai
      const rule = rules.find((r) => r.id === violation.rule);
      if (config.noAi && rule?.type === "ai") continue;

      try {
        const sourceFile = project.getSourceFile(violation.filePath);
        if (!sourceFile) continue;

        const applied = await applyFix(sourceFile, violation);
        if (applied) fixedCount++;
      } catch {
        // Skip individual fix errors
      }
    }

    // Save modified files
    if (fixedCount > 0) {
      await project.save();
    }
  }

  // 6. Compute score
  const remainingViolations = config.fix
    ? allViolations.filter((v) => !v.fix || (config.noAi && rules.find((r) => r.id === v.rule)?.type === "ai"))
    : allViolations;

  const score = computeScore(remainingViolations);
  const previousScore = loadPreviousScore(config.cache);

  // Save current score
  savePreviousScore(config.cache, score);

  return {
    violations: allViolations,
    filesScanned: files.length,
    elementsScanned,
    score,
    previousScore,
    fixedCount,
  };
}
