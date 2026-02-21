import { SyntaxKind } from "ts-morph";
import type { SourceFile } from "ts-morph";
import type { Rule, Violation } from "../../scan/types.js";

export const noPositiveTabindexRule: Rule = {
  id: "no-positive-tabindex",
  type: "deterministic",

  scan(file: SourceFile): Violation[] {
    const violations: Violation[] = [];
    const filePath = file.getFilePath();

    const jsxAttributes = file.getDescendantsOfKind(SyntaxKind.JsxAttribute);

    for (const attr of jsxAttributes) {
      const name = attr.getNameNode().getText();
      if (name !== "tabIndex") continue;

      const initializer = attr.getInitializer();
      if (!initializer) continue;

      // Handle tabIndex={N} (JsxExpression wrapping a NumericLiteral)
      if (initializer.isKind(SyntaxKind.JsxExpression)) {
        const expression = initializer.getExpression();
        if (!expression) continue;

        if (expression.isKind(SyntaxKind.NumericLiteral)) {
          const value = expression.getLiteralValue();
          if (value > 0) {
            const jsxElement = attr.getFirstAncestorByKind(SyntaxKind.JsxOpeningElement)
              ?? attr.getFirstAncestorByKind(SyntaxKind.JsxSelfClosingElement);

            const tagName = jsxElement
              ? jsxElement.getTagNameNode().getText()
              : "unknown";

            violations.push({
              rule: "no-positive-tabindex",
              filePath,
              line: attr.getStartLineNumber(),
              column: attr.getStart() - attr.getStartLinePos() + 1,
              element: tagName,
              message: `Avoid using positive tabIndex value (${value}). Use tabIndex={0} or tabIndex={-1} instead.`,
              fix: {
                type: "replace-attr",
                attribute: "tabIndex",
                value: "0",
              },
            });
          }
        }
      }
    }

    return violations;
  },
};
