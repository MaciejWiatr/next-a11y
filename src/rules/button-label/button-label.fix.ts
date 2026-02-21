import type { SourceFile } from "ts-morph";
import { SyntaxKind } from "ts-morph";
import type { Violation } from "../../scan/types.js";

export function applyButtonLabelFix(
  file: SourceFile,
  violation: Violation,
  label: string
): void {
  const elements = [
    ...file.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...file.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ];

  for (const el of elements) {
    if (el.getStartLineNumber() === violation.line) {
      const existing = el.getAttribute("aria-label");
      if (!existing) {
        el.addAttribute({
          name: "aria-label",
          initializer: `"${label.replace(/"/g, "&quot;")}"`,
        });
      }
      break;
    }
  }
}
