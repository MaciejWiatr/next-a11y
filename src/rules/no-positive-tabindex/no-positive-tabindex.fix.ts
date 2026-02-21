import { SyntaxKind } from "ts-morph";
import type { SourceFile } from "ts-morph";
import type { Violation } from "../../scan/types.js";

export function applyNoPositiveTabindexFix(
  file: SourceFile,
  violation: Violation,
): void {
  const targetLine = violation.line;

  // Find JSX elements on the violation line
  const jsxOpeningElements = file.getDescendantsOfKind(SyntaxKind.JsxOpeningElement);
  const jsxSelfClosingElements = file.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement);
  const allJsxElements = [...jsxOpeningElements, ...jsxSelfClosingElements];

  for (const element of allJsxElements) {
    const attributes = element.getDescendantsOfKind(SyntaxKind.JsxAttribute);

    for (const attr of attributes) {
      if (attr.getStartLineNumber() !== targetLine) continue;
      if (attr.getNameNode().getText() !== "tabIndex") continue;

      const initializer = attr.getInitializer();
      if (!initializer) continue;

      if (initializer.isKind(SyntaxKind.JsxExpression)) {
        const expression = initializer.getExpression();
        if (!expression) continue;

        if (expression.isKind(SyntaxKind.NumericLiteral)) {
          const value = expression.getLiteralValue();
          if (value > 0) {
            initializer.replaceWithText("{0}");
            return;
          }
        }
      }
    }
  }
}
