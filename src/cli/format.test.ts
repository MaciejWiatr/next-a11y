import { describe, it, expect } from "vitest";
import { formatReport } from "./format.js";
import type { ScanResult, Violation } from "../scan/types.js";

function makeResult(violations: Violation[], overrides?: Partial<ScanResult>): ScanResult {
  return {
    violations,
    filesScanned: 1,
    elementsScanned: 10,
    score: 50,
    fixedCount: 0,
    ...overrides,
  };
}

function violation(rule: Violation["rule"], hasFix = true): Violation {
  const v: Violation = {
    rule,
    filePath: "/app/page.tsx",
    line: 1,
    column: 1,
    element: "<button>",
    message: "test",
  };
  if (hasFix) {
    v.fix = { type: "insert-attr", attribute: "type", value: "button" };
  }
  return v;
}

describe("formatReport", () => {
  it("fixable count matches Auto fixes available when all violations have fix", () => {
    const result = makeResult([
      violation("button-type", true),
      violation("button-type", true),
      violation("html-lang", true),
    ]);
    const report = formatReport(result, false);
    const fixableMatch = report.match(/(\d+)\s+fixable/);
    const fixableCount = fixableMatch ? parseInt(fixableMatch[1], 10) : -1;
    expect(fixableCount).toBe(3);
    expect(report).toContain("Auto fixes available:");
    expect(report).toContain("3 fixable");
  });

  it("fixable count is 0 when Auto fixes section shows 0 (violations without fix)", () => {
    // heading-order and no-div-interactive never have fix
    const result = makeResult([
      violation("heading-order", false),
      violation("no-div-interactive", false),
    ]);
    const report = formatReport(result, false);
    const fixableMatch = report.match(/(\d+)\s+fixable/);
    const fixableCount = fixableMatch ? parseInt(fixableMatch[1], 10) : -1;
    expect(fixableCount).toBe(0);
    expect(report).not.toContain("Auto fixes available:");
    expect(report).toContain("Warnings (manual review needed):");
    expect(report).toContain("0 fixable");
  });

  it("fixable count equals sum of AI + Auto + Next fixes (with fix)", () => {
    const result = makeResult([
      violation("button-type", true),
      violation("button-type", true),
      violation("img-alt", true),
    ]);
    const report = formatReport(result, false);
    const fixableMatch = report.match(/(\d+)\s+fixable/);
    const fixableCount = fixableMatch ? parseInt(fixableMatch[1], 10) : -1;
    expect(fixableCount).toBe(3);
    expect(report).toContain("Auto fixes available:");
    expect(report).toContain("[AI]");
  });

  it("displays file path list for warnings in summary", () => {
    const v1 = violation("heading-order", false);
    const v2 = { ...violation("no-div-interactive", false), filePath: "/app/components/Modal.tsx" };
    const result = makeResult([v1, v2]);
    const report = formatReport(result, false);
    expect(report).toContain("Files with warnings:");
    expect(report).toContain("/app/page.tsx");
    expect(report).toContain("/app/components/Modal.tsx");
  });
});
