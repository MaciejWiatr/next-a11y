import { SyntaxKind } from "ts-morph";
import type { Rule, Violation } from "../../scan/types.js";

export const htmlLangRule: Rule = {
  id: "html-lang",
  type: "deterministic",

  scan(file): Violation[] {
    const filePath = file.getFilePath();

    // Only check root layout files and _document files
    if (!isRootLayoutOrDocument(filePath)) {
      return [];
    }

    const violations: Violation[] = [];

    // Check JsxOpeningElement nodes (e.g. <html>)
    const openingElements = file.getDescendantsOfKind(
      SyntaxKind.JsxOpeningElement,
    );
    for (const el of openingElements) {
      const tagName = el.getTagNameNode().getText();
      if (tagName === "html") {
        const langAttr = el
          .getAttributes()
          .find(
            (attr) =>
              attr.getKind() === SyntaxKind.JsxAttribute &&
              attr.getChildAtIndex(0).getText() === "lang",
          );

        if (!langAttr) {
          violations.push({
            rule: "html-lang",
            filePath,
            line: el.getStartLineNumber(),
            column: el.getStartLinePos() + 1,
            element: "<html>",
            message:
              "The <html> element must have a `lang` attribute for accessibility (WCAG 3.1.1).",
            fix: {
              type: "insert-attr",
              attribute: "lang",
              value: "en",
            },
          });
        }
      }
    }

    // Check JsxSelfClosingElement nodes (e.g. <html />)
    const selfClosingElements = file.getDescendantsOfKind(
      SyntaxKind.JsxSelfClosingElement,
    );
    for (const el of selfClosingElements) {
      const tagName = el.getTagNameNode().getText();
      if (tagName === "html") {
        const langAttr = el
          .getAttributes()
          .find(
            (attr) =>
              attr.getKind() === SyntaxKind.JsxAttribute &&
              attr.getChildAtIndex(0).getText() === "lang",
          );

        if (!langAttr) {
          violations.push({
            rule: "html-lang",
            filePath,
            line: el.getStartLineNumber(),
            column: el.getStartLinePos() + 1,
            element: "<html />",
            message:
              "The <html> element must have a `lang` attribute for accessibility (WCAG 3.1.1).",
            fix: {
              type: "insert-attr",
              attribute: "lang",
              value: "en",
            },
          });
        }
      }
    }

    return violations;
  },
};

function isRootLayoutOrDocument(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.includes("layout") || normalized.includes("_document");
}
