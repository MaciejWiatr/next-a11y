import * as fs from "node:fs";
import * as path from "node:path";
import { Project } from "ts-morph";
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
 * Resolve and validate the target path. Returns absolute path to a directory.
 */
function resolveTargetPath(targetPath: string): string {
  const absPath = path.resolve(targetPath);

  if (!fs.existsSync(absPath)) {
    throw new Error(`Path does not exist: ${absPath}`);
  }

  const stat = fs.statSync(absPath);
  if (stat.isFile()) {
    return path.dirname(absPath);
  }

  return absPath;
}

/**
 * Phase 1: Discover files, parse AST, detect violations.
 * Does NOT apply any fixes — returns context for the caller to handle.
 */
export async function detect(
  targetPath: string,
  config: ResolvedConfig
): Promise<ScanContext> {
  const absPath = resolveTargetPath(targetPath);

  const files = await discoverFiles(
    absPath,
    config.scanner.include,
    config.scanner.exclude
  );

  const tsconfigPath = path.join(absPath, "tsconfig.json");
  const project = new Project({
    tsConfigFilePath: fs.existsSync(tsconfigPath) ? tsconfigPath : undefined,
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

  const rules = getRulesForConfig(config.rules, config.noAi, {
    locale: config.locale,
  });
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
  if (ctx.config.noAi) return;

  await resolveAiFixes({
    config: ctx.config,
    project: ctx.project,
    violations: ctx.violations,
    onProgress,
  });
}

export type FixedViolation = {
  filePath: string;
  line: number;
  rule: string;
  message: string;
  fixAttribute?: string;
  fixType?: string;
  fixValue?: string;
  fixElement?: string;
};

/**
 * Apply fixes concurrently (per-file parallel, sequential within file).
 * Groups violations by file, applies bottom-to-top within each file to avoid
 * position shifts, runs file groups in parallel via Promise.all.
 */
export async function applyAllFixes(
  ctx: ScanContext,
  violations: Violation[]
): Promise<{ fixedCount: number; fixed: FixedViolation[] }> {
  const byFile = new Map<string, Violation[]>();
  for (const v of violations) {
    if (!v.fix) continue;
    const list = byFile.get(v.filePath) ?? [];
    list.push(v);
    byFile.set(v.filePath, list);
  }

  const results = await Promise.all(
    Array.from(byFile.values()).map(async (viols) => {
      // Sort by line descending so edits don't invalidate positions
      viols.sort((a, b) => b.line - a.line);
      const applied: FixedViolation[] = [];
      for (const v of viols) {
        const ok = await fixViolation(ctx, v);
        if (ok) {
          const value =
            typeof v.fix?.value === "string" ? v.fix.value : undefined;
          applied.push({
            filePath: v.filePath,
            line: v.line,
            rule: v.rule,
            message: v.message,
            fixAttribute: v.fix?.attribute,
            fixType: v.fix?.type,
            fixValue: value,
            fixElement: v.element,
          });
        }
      }
      return applied;
    })
  );

  const fixed = results.flat();
  return { fixedCount: fixed.length, fixed };
}

/**
 * Phase 2: Apply a single fix. Returns true if successful.
 */
export async function fixViolation(
  ctx: ScanContext,
  violation: Violation
): Promise<boolean> {
  if (!violation.fix) return false;

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
  fixedCount: number,
  fixed?: FixedViolation[]
): Promise<ScanResult> {
  if (fixedCount > 0) {
    await ctx.project.save();
  }

  const fixedSet = new Set(
    (fixed ?? []).map((f) => `${f.filePath}:${f.line}:${f.rule}`)
  );

  const remainingViolations = ctx.config.fix
    ? ctx.violations.filter((v) => {
        if (fixedSet.has(`${v.filePath}:${v.line}:${v.rule}`)) return false;
        if (!v.fix) return true;
        if (ctx.config.noAi && ctx.rules.find((r) => r.id === v.rule)?.type === "ai") return true;
        return false;
      })
    : ctx.violations;

  const score = computeScore(remainingViolations);
  const previousScore = loadPreviousScore(ctx.config.cache);
  savePreviousScore(ctx.config.cache, score);

  return {
    violations: remainingViolations,
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
  let fixed: FixedViolation[] = [];
  if (config.fix) {
    const result = await applyAllFixes(ctx, ctx.violations);
    fixedCount = result.fixedCount;
    fixed = result.fixed;
  }

  return finalize(ctx, fixedCount, fixed);
}
