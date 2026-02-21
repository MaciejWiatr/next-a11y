import pc from "picocolors";
import type { Violation, RuleId } from "../scan/types.js";
import type { ScanResult } from "../scan/types.js";
import { getScoreBadge, WEIGHT_TABLE } from "../scan/score.js";

const RULE_ICONS: Record<RuleId, string> = {
  "img-alt": "img",
  "button-label": "btn",
  "link-label": "lnk",
  "input-label": "inp",
  "html-lang": "lng",
  "emoji-alt": "emj",
  "no-positive-tabindex": "tab",
  "button-type": "btn",
  "link-noopener": "rel",
  "next-metadata-title": "ttl",
  "next-image-sizes": "img",
  "next-link-no-nested-a": "lnk",
  "next-skip-nav": "nav",
  "heading-order": "hdg",
  "no-div-interactive": "div",
};

export function formatReport(result: ScanResult, fix: boolean, quiet?: boolean): string {
  if (quiet) {
    const badge = getScoreBadge(result.score);
    const colorFn =
      badge.color === "green"
        ? pc.green
        : badge.color === "yellow"
          ? pc.yellow
          : pc.red;
    const fixable = result.violations.filter((v) => v.fix).length;
    const warnings = result.violations.filter((v) => !v.fix).length;
    if (fix && result.fixedCount > 0) {
      return `${colorFn(result.score)}/100 (${result.fixedCount} fixed, ${warnings} warnings)\n`;
    }
    return `${colorFn(result.score)}/100 (${fixable} fixable, ${warnings} warnings)\n`;
  }

  const lines: string[] = [];

  lines.push("");
  lines.push(pc.bold(`  next-a11y v0.1.7`));
  lines.push(
    `  Scanned ${result.filesScanned} files`
  );
  lines.push("");

  // Score box
  const badge = getScoreBadge(result.score);
  const colorFn =
    badge.color === "green"
      ? pc.green
      : badge.color === "yellow"
        ? pc.yellow
        : pc.red;

  lines.push(
    `  ${pc.bold("Heuristic score:")}  ${colorFn(pc.bold(`${result.score} / 100`))}  ${colorFn(badge.label)}`
  );
  lines.push("");

  if (result.violations.length === 0) {
    lines.push(pc.green("  No accessibility issues found!"));
    lines.push("");
    return lines.join("\n");
  }

  // Group violations by category. Only show "fixes available" for violations that actually have v.fix.
  // Rules like button-type produce violations without fix for custom components (e.g. <Button>).
  const aiViolations = result.violations.filter(
    (v) =>
      ["img-alt", "button-label", "link-label", "input-label", "next-metadata-title"].includes(v.rule) &&
      v.fix
  );
  const deterministicViolations = result.violations.filter(
    (v) =>
      [
        "html-lang",
        "emoji-alt",
        "no-positive-tabindex",
        "button-type",
        "link-noopener",
      ].includes(v.rule) && v.fix
  );
  const nextViolations = result.violations.filter((v) =>
    ["next-image-sizes", "next-link-no-nested-a", "next-skip-nav"].includes(v.rule)
  );
  const detectOnlyViolations = result.violations.filter((v) =>
    ["heading-order", "no-div-interactive"].includes(v.rule)
  );
  const otherWarnings = result.violations.filter(
    (v) =>
      !v.fix &&
      !["heading-order", "no-div-interactive"].includes(v.rule) &&
      !["next-image-sizes", "next-link-no-nested-a", "next-skip-nav"].includes(v.rule)
  );

  if (aiViolations.length > 0) {
    lines.push(`  ${pc.blue("[AI]")} ${pc.bold("fixes available:")}`);
    formatViolationGroup(lines, aiViolations);
    lines.push("");
  }

  if (deterministicViolations.length > 0) {
    lines.push(pc.bold("  Auto fixes available:"));
    formatViolationGroup(lines, deterministicViolations);
    lines.push("");
  }

  const allWarnings = [...detectOnlyViolations, ...nextViolations, ...otherWarnings];
  if (allWarnings.length > 0) {
    lines.push(pc.yellow(pc.bold("  Warnings (manual review needed):")));
    formatViolationGroup(lines, allWarnings);
    lines.push("");
  }

  // Summary line
  const fixable = result.violations.filter((v) => v.fix).length;
  const warningViolations = result.violations.filter((v) => !v.fix);
  const warnings = warningViolations.length;
  lines.push(pc.dim("  " + "-".repeat(40)));

  if (fix && result.fixedCount > 0) {
    lines.push(`  ${pc.green(`[FIXED]`)} ${result.fixedCount} · ${warnings} warnings`);
  } else {
    lines.push(
      `  ${fixable} fixable · ${warnings} warnings${fixable > 0 ? ` · Run ${pc.bold("--fix")} to apply` : ""}`
    );
  }

  if (warningViolations.length > 0) {
    const cwd = process.cwd() + "/";
    const uniquePaths = [...new Set(warningViolations.map((v) => v.filePath.replace(cwd, "")))].sort();
    lines.push("");
    lines.push(pc.dim("  Files with warnings:"));
    for (const p of uniquePaths) {
      lines.push(pc.dim(`    ${p}`));
    }
  }

  // Delta
  if (result.previousScore !== undefined) {
    const delta = result.score - result.previousScore;
    if (delta !== 0) {
      const deltaStr =
        delta > 0 ? pc.green(`+${delta}`) : pc.red(`${delta}`);
      lines.push(
        `  Score: ${result.previousScore} -> ${result.score} (${deltaStr} pts)`
      );
    }
  }

  lines.push("");
  return lines.join("\n");
}

function formatViolationGroup(lines: string[], violations: Violation[]): void {
  // Group by rule
  const byRule = new Map<RuleId, Violation[]>();
  for (const v of violations) {
    const existing = byRule.get(v.rule) ?? [];
    existing.push(v);
    byRule.set(v.rule, existing);
  }

  const MAX_DISPLAY_PTS = 15;

  for (const [rule, ruleViolations] of byRule) {
    const count = ruleViolations.length;
    const weight = WEIGHT_TABLE[rule] ?? 1;
    const totalPts = count * weight;
    const displayPts = Math.min(totalPts, MAX_DISPLAY_PTS);
    const icon = RULE_ICONS[rule] ?? "???";

    const ptsSuffix =
      totalPts > 0
        ? pc.dim(` -${displayPts}${totalPts > MAX_DISPLAY_PTS ? "+" : ""} pts`)
        : "";

    lines.push(
      `    [${icon}] ${pc.bold(String(count).padStart(2))} ${formatRuleDescription(rule)}${ptsSuffix}`
    );

    const cwd = process.cwd() + "/";
    for (const v of ruleViolations) {
      const shortPath = v.filePath.replace(cwd, "");
      lines.push(pc.dim(`         ${shortPath}:${v.line} — ${v.message}`));
    }
  }
}

function formatRuleDescription(rule: RuleId): string {
  const descriptions: Record<RuleId, string> = {
    "img-alt": "images missing alt text",
    "button-label": "buttons without accessible name",
    "link-label": "links without accessible name",
    "input-label": "inputs without label",
    "html-lang": "missing lang on <html>",
    "emoji-alt": "emoji without role=\"img\"",
    "no-positive-tabindex": "positive tabIndex values",
    "button-type": "buttons without type",
    "link-noopener": "links target=\"_blank\" without rel",
    "next-metadata-title": "routes missing page title",
    "next-image-sizes": "next/image without sizes",
    "next-link-no-nested-a": "next/link wrapping nested <a>",
    "next-skip-nav": "missing skip navigation link",
    "heading-order": "heading hierarchy violations",
    "no-div-interactive": "div used as interactive element",
  };
  return descriptions[rule] ?? rule;
}

function getFixActionSummary(
  rule: string,
  fixValue?: string,
  fixElement?: string
): string {
  const quote = (s: string) => `"${s.replace(/"/g, '\\"')}"`;
  switch (rule) {
    case "img-alt":
      return fixValue ? `added alt text ${quote(fixValue)}` : "added alt text";
    case "button-label":
    case "link-label":
    case "input-label":
      return fixValue ? `added aria-label ${quote(fixValue)}` : "added aria-label";
    case "html-lang":
      return fixValue ? `added lang ${quote(fixValue)}` : "added lang attribute";
    case "emoji-alt":
      return fixValue && fixElement
        ? `wrapped emoji ${fixElement} with aria-label ${quote(fixValue)}`
        : "wrapped emoji with aria-label";
    case "no-positive-tabindex":
      return "fixed tabIndex";
    case "button-type":
      return fixValue ? `added type=${quote(fixValue)}` : "added type attribute";
    case "link-noopener":
      return "added rel=\"noopener noreferrer\"";
    case "next-metadata-title":
      return fixValue ? `added metadata.title ${quote(fixValue)}` : "added metadata.title";
    case "next-link-no-nested-a":
      return "removed nested <a>";
    default:
      return fixValue ? `added ${rule} ${quote(fixValue)}` : rule;
  }
}

export function formatFixApplied(
  filePath: string,
  line: number,
  rule: string,
  fixAttribute?: string,
  fixType?: string,
  fixValue?: string,
  fixElement?: string
): string {
  const shortPath = filePath.replace(process.cwd() + "/", "");
  const action = getFixActionSummary(rule, fixValue, fixElement);
  return `  ${pc.green("[FIXED]")}  ${pc.dim(shortPath + ":" + line)}  ${action}`;
}

export function formatViolationDetail(v: Violation, index: number, total: number): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(pc.bold(`[${index + 1}/${total}] ${v.filePath}:${v.line}`));
  lines.push(`  Rule:     ${v.rule}`);
  lines.push(`  Element:  ${pc.dim(v.element)}`);
  lines.push(`  ${v.message}`);
  return lines.join("\n");
}
