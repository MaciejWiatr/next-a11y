import { SyntaxKind } from "ts-morph";
import type { SourceFile } from "ts-morph";
import type { Rule, Violation } from "../../scan/types.js";

export function createButtonTypeRule(options: {
  scanCustomComponents?: boolean;
}): Rule {
  const scanCustomComponents = options.scanCustomComponents ?? false;

  return {
    id: "button-type",
    type: "deterministic",

    scan(file: SourceFile): Violation[] {
    const violations: Violation[] = [];
    const filePath = file.getFilePath();

    // Scan JsxOpeningElement nodes (e.g. <button>...</button>)
    const openingElements = file.getDescendantsOfKind(
      SyntaxKind.JsxOpeningElement,
    );
    for (const element of openingElements) {
      const tagName = element.getTagNameNode().getText();
      if (tagName !== "button") continue;

      const typeAttr = element
        .getAttributes()
        .find(
          (attr) =>
            attr.isKind(SyntaxKind.JsxAttribute) &&
            attr.getNameNode().getText() === "type",
        );

      if (typeAttr) continue;

      const { line, column } = file.getLineAndColumnAtPos(element.getStart());

      violations.push({
        rule: "button-type",
        filePath,
        line,
        column,
        element: "<button>",
        message:
          'Native <button> elements should have an explicit "type" attribute to avoid unexpected form submissions.',
        fix: {
          type: "insert-attr",
          attribute: "type",
          value: "button",
        },
      });
    }

    // Scan JsxSelfClosingElement nodes (e.g. <button />)
    const selfClosingElements = file.getDescendantsOfKind(
      SyntaxKind.JsxSelfClosingElement,
    );
    for (const element of selfClosingElements) {
      const tagName = element.getTagNameNode().getText();

      // Custom components (uppercase first letter) — only when enabled
      if (scanCustomComponents && tagName !== "button" && tagName[0] === tagName[0].toUpperCase()) {
        const hasTypeAttr = element
          .getAttributes()
          .some(
            (attr) =>
              attr.isKind(SyntaxKind.JsxAttribute) &&
              attr.getNameNode().getText() === "type",
          );

        if (!hasTypeAttr && /button/i.test(tagName)) {
          const { line, column } = file.getLineAndColumnAtPos(
            element.getStart(),
          );
          violations.push({
            rule: "button-type",
            filePath,
            line,
            column,
            element: `<${tagName}>`,
            message: `Custom component <${tagName}> may render a <button> without an explicit "type" attribute. Consider passing type="button".`,
            fix: {
              type: "insert-attr",
              attribute: "type",
              value: "button",
            },
          });
        }
        continue;
      }

      if (tagName !== "button") continue;

      const typeAttr = element
        .getAttributes()
        .find(
          (attr) =>
            attr.isKind(SyntaxKind.JsxAttribute) &&
            attr.getNameNode().getText() === "type",
        );

      if (typeAttr) continue;

      const { line, column } = file.getLineAndColumnAtPos(element.getStart());

      violations.push({
        rule: "button-type",
        filePath,
        line,
        column,
        element: "<button>",
        message:
          'Native <button> elements should have an explicit "type" attribute to avoid unexpected form submissions.',
        fix: {
          type: "insert-attr",
          attribute: "type",
          value: "button",
        },
      });
    }

    // Also check opening elements for custom components (uppercase) — only when enabled
    if (scanCustomComponents) {
      for (const element of openingElements) {
        const tagName = element.getTagNameNode().getText();

        if (tagName[0] !== tagName[0].toUpperCase()) continue;
        if (!/button/i.test(tagName)) continue;

        const hasTypeAttr = element
          .getAttributes()
          .some(
            (attr) =>
              attr.isKind(SyntaxKind.JsxAttribute) &&
              attr.getNameNode().getText() === "type",
          );

        if (!hasTypeAttr) {
          const { line, column } = file.getLineAndColumnAtPos(
            element.getStart(),
          );
          violations.push({
            rule: "button-type",
            filePath,
            line,
            column,
            element: `<${tagName}>`,
            message: `Custom component <${tagName}> may render a <button> without an explicit "type" attribute. Consider passing type="button".`,
            fix: {
              type: "insert-attr",
              attribute: "type",
              value: "button",
            },
          });
        }
      }
    }

    return violations;
  },
};
}
