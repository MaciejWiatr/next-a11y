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

export function formatReport(result: ScanResult, fix: boolean): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(pc.bold(`  next-a11y v0.1.0`));
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
    `  ${pc.bold("Accessibility Score:")}  ${colorFn(pc.bold(`${result.score} / 100`))}  ${colorFn(badge.label)}`
  );
  lines.push("");

  if (result.violations.length === 0) {
    lines.push(pc.green("  No accessibility issues found!"));
    lines.push("");
    return lines.join("\n");
  }

  // Group violations by category
  const aiViolations = result.violations.filter((v) =>
    ["img-alt", "button-label", "link-label", "input-label"].includes(v.rule)
  );
  const deterministicViolations = result.violations.filter((v) =>
    [
      "html-lang",
      "emoji-alt",
      "no-positive-tabindex",
      "button-type",
      "link-noopener",
    ].includes(v.rule)
  );
  const nextViolations = result.violations.filter((v) =>
    [
      "next-metadata-title",
      "next-image-sizes",
      "next-link-no-nested-a",
      "next-skip-nav",
    ].includes(v.rule)
  );
  const detectOnlyViolations = result.violations.filter((v) =>
    ["heading-order", "no-div-interactive"].includes(v.rule)
  );

  if (aiViolations.length > 0) {
    lines.push(pc.bold("  AI fixes available:"));
    formatViolationGroup(lines, aiViolations);
    lines.push("");
  }

  if (deterministicViolations.length > 0) {
    lines.push(pc.bold("  Auto fixes available:"));
    formatViolationGroup(lines, deterministicViolations);
    lines.push("");
  }

  if (nextViolations.length > 0) {
    lines.push(pc.bold("  Next.js-specific:"));
    formatViolationGroup(lines, nextViolations);
    lines.push("");
  }

  if (detectOnlyViolations.length > 0) {
    lines.push(pc.bold("  Warnings (manual review needed):"));
    formatViolationGroup(lines, detectOnlyViolations);
    lines.push("");
  }

  // Summary line
  const fixable = result.violations.filter((v) => v.fix).length;
  const warnings = result.violations.filter((v) => !v.fix).length;
  lines.push(pc.dim("  " + "-".repeat(40)));

  if (fix && result.fixedCount > 0) {
    lines.push(`  ${pc.green(`${result.fixedCount} fixed`)} · ${warnings} warnings`);
  } else {
    lines.push(
      `  ${fixable} fixable · ${warnings} warnings${fixable > 0 ? ` · Run ${pc.bold("--fix")} to apply` : ""}`
    );
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

  for (const [rule, ruleViolations] of byRule) {
    const count = ruleViolations.length;
    const weight = WEIGHT_TABLE[rule] ?? 1;
    const totalPts = count * weight;
    const icon = RULE_ICONS[rule] ?? "???";

    lines.push(
      `    [${icon}] ${pc.bold(String(count).padStart(2))} ${formatRuleDescription(rule)}${totalPts > 0 ? pc.dim(` -${totalPts} pts`) : ""}`
    );
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

export function formatViolationDetail(v: Violation, index: number, total: number): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(pc.bold(`[${index + 1}/${total}] ${v.filePath}:${v.line}`));
  lines.push(`  Rule:     ${v.rule}`);
  lines.push(`  Element:  ${pc.dim(v.element)}`);
  lines.push(`  ${v.message}`);
  return lines.join("\n");
}
