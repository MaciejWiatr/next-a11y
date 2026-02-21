import { SyntaxKind } from "ts-morph";
import type { SourceFile } from "ts-morph";
import type { Violation } from "../../scan/types.js";

/**
 * Applies the html-lang fix by inserting a `lang` attribute
 * on the `<html>` element identified by the violation.
 */
export function applyHtmlLangFix(file: SourceFile, violation: Violation): void {
  const value =
    typeof violation.fix?.value === "string" ? violation.fix.value : "en";

  // Search JsxOpeningElement nodes
  const openingElements = file.getDescendantsOfKind(
    SyntaxKind.JsxOpeningElement,
  );
  for (const el of openingElements) {
    if (
      el.getTagNameNode().getText() === "html" &&
      el.getStartLineNumber() === violation.line
    ) {
      el.addAttribute({ name: "lang", initializer: `"${value}"` });
      return;
    }
  }

  // Search JsxSelfClosingElement nodes
  const selfClosingElements = file.getDescendantsOfKind(
    SyntaxKind.JsxSelfClosingElement,
  );
  for (const el of selfClosingElements) {
    if (
      el.getTagNameNode().getText() === "html" &&
      el.getStartLineNumber() === violation.line
    ) {
      el.addAttribute({ name: "lang", initializer: `"${value}"` });
      return;
    }
  }
}
