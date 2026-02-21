import type { SourceFile, JsxOpeningElement, JsxSelfClosingElement } from "ts-morph";

export type RuleId =
  | "img-alt"
  | "button-label"
  | "link-label"
  | "input-label"
  | "html-lang"
  | "emoji-alt"
  | "no-positive-tabindex"
  | "button-type"
  | "link-noopener"
  | "next-metadata-title"
  | "next-image-sizes"
  | "next-link-no-nested-a"
  | "next-skip-nav"
  | "heading-order"
  | "no-div-interactive";

export type RuleSetting = "fix" | "warn" | "off";

export type RuleType = "ai" | "deterministic" | "detect";

export type FixType =
  | "insert-attr"
  | "replace-attr"
  | "insert-element"
  | "wrap-element"
  | "remove-element";

export interface Fix {
  type: FixType;
  attribute?: string;
  value: string | (() => Promise<string>);
}

export interface Violation {
  rule: RuleId;
  filePath: string;
  line: number;
  column: number;
  element: string;
  message: string;
  fix?: Fix;
}

export type JsxElement = JsxOpeningElement | JsxSelfClosingElement;

export interface Rule {
  id: RuleId;
  type: RuleType;
  scan(file: SourceFile): Violation[];
}

export interface ScanResult {
  violations: Violation[];
  filesScanned: number;
  elementsScanned: number;
  score: number;
  previousScore?: number;
  fixedCount: number;
}
