import * as path from "node:path";
import { Project, type SourceFile } from "ts-morph";
import type { ResolvedConfig } from "../config/schema.js";
import type { Violation, ScanResult } from "./types.js";
import { discoverFiles } from "./glob.js";
import { getRulesForConfig } from "../rules/index.js";
import { computeScore, loadPreviousScore, savePreviousScore } from "./score.js";
import { applyFix } from "../apply/apply.js";
import { resolveAiFixes } from "../ai/resolve-fixes.js";

export interface ScanContext {
  project: Project;
  violations: Violation[];
  filesScanned: number;
  elementsScanned: number;
  rules: ReturnType<typeof getRulesForConfig>;
  config: ResolvedConfig;
}

/**
 * Phase 1: Discover files, parse AST, detect violations.
 * Does NOT apply any fixes — returns context for the caller to handle.
 */
export async function detect(
  targetPath: string,
  config: ResolvedConfig
): Promise<ScanContext> {
  const absPath = path.resolve(targetPath);

  const files = await discoverFiles(
    absPath,
    config.scanner.include,
    config.scanner.exclude
  );

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      jsx: 4, // JsxEmit.ReactJSX
      allowJs: true,
      noEmit: true,
    },
  });

  for (const filePath of files) {
    try {
      project.addSourceFileAtPath(filePath);
    } catch {
      // Skip files that can't be parsed
    }
  }

  const rules = getRulesForConfig(config.rules, config.noAi);
  const allViolations: Violation[] = [];
  let elementsScanned = 0;

  for (const sourceFile of project.getSourceFiles()) {
    for (const rule of rules) {
      try {
        const violations = rule.scan(sourceFile);
        allViolations.push(...violations);
      } catch {
        // Skip rule errors
      }
    }
    elementsScanned += sourceFile.getDescendants().length;
  }

  return {
    project,
    violations: allViolations,
    filesScanned: files.length,
    elementsScanned,
    rules,
    config,
  };
}

/**
 * Phase 1.5: Resolve AI fix values (call AI provider, check cache).
 * Mutates violation.fix.value from async function to resolved string.
 */
export async function resolveAi(
  ctx: ScanContext,
  onProgress?: (resolved: number, total: number, violation: Violation, result: string) => void
): Promise<void> {
  if (ctx.config.noAi || !ctx.config.provider) return;

  await resolveAiFixes({
    config: ctx.config,
    project: ctx.project,
    violations: ctx.violations,
    onProgress,
  });
}

/**
 * Phase 2: Apply a single fix. Returns true if successful.
 */
export async function fixViolation(
  ctx: ScanContext,
  violation: Violation
): Promise<boolean> {
  if (!violation.fix) return false;

  const rule = ctx.rules.find((r) => r.id === violation.rule);
  if (ctx.config.noAi && rule?.type === "ai") return false;

  try {
    const sourceFile = ctx.project.getSourceFile(violation.filePath);
    if (!sourceFile) return false;
    return await applyFix(sourceFile, violation);
  } catch {
    return false;
  }
}

/**
 * Phase 3: Save all modified files and compute final result.
 */
export async function finalize(
  ctx: ScanContext,
  fixedCount: number
): Promise<ScanResult> {
  if (fixedCount > 0) {
    await ctx.project.save();
  }

  const remainingViolations = ctx.config.fix
    ? ctx.violations.filter((v) => {
        if (!v.fix) return true;
        if (ctx.config.noAi && ctx.rules.find((r) => r.id === v.rule)?.type === "ai") return true;
        return false;
      })
    : ctx.violations;

  const score = computeScore(remainingViolations);
  const previousScore = loadPreviousScore(ctx.config.cache);
  savePreviousScore(ctx.config.cache, score);

  return {
    violations: ctx.violations,
    filesScanned: ctx.filesScanned,
    elementsScanned: ctx.elementsScanned,
    score,
    previousScore,
    fixedCount,
  };
}

/**
 * All-in-one scan (non-interactive). Detect + resolve AI + fix all + finalize.
 */
export async function scan(
  targetPath: string,
  config: ResolvedConfig
): Promise<ScanResult> {
  const ctx = await detect(targetPath, config);

  if (config.fix && !config.noAi) {
    await resolveAi(ctx);
  }

  let fixedCount = 0;
  if (config.fix) {
    for (const violation of ctx.violations) {
      const applied = await fixViolation(ctx, violation);
      if (applied) fixedCount++;
    }
  }

  return finalize(ctx, fixedCount);
}
