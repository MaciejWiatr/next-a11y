import { SyntaxKind } from "ts-morph";
import type { SourceFile } from "ts-morph";
import type { Rule, Violation } from "../../scan/types.js";

const INTERACTIVE_TAGS = ["div", "span"];

function getElementText(
  element: import("ts-morph").JsxOpeningElement | import("ts-morph").JsxSelfClosingElement
): string {
  if (element.getKind() === SyntaxKind.JsxSelfClosingElement) return "";
  const parent = element.getParentIfKind(SyntaxKind.JsxElement);
  if (!parent) return "";
  return parent
    .getJsxChildren()
    .map((c) => c.getText())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

function hasAttribute(
  element: { getAttributes(): import("ts-morph").JsxAttributeLike[] },
  name: string,
): boolean {
  return element.getAttributes().some(
    (attr) =>
      attr.isKind(SyntaxKind.JsxAttribute) &&
      attr.getNameNode().getText() === name,
  );
}

export const noDivInteractiveRule: Rule = {
  id: "no-div-interactive",
  type: "detect",

  scan(file: SourceFile): Violation[] {
    const violations: Violation[] = [];
    const filePath = file.getFilePath();

    // Scan JsxOpeningElement nodes (e.g. <div onClick={handler}>...</div>)
    const openingElements = file.getDescendantsOfKind(
      SyntaxKind.JsxOpeningElement,
    );
    for (const element of openingElements) {
      const tagName = element.getTagNameNode().getText();
      if (!INTERACTIVE_TAGS.includes(tagName)) continue;
      if (!hasAttribute(element, "onClick")) continue;
      if (hasAttribute(element, "role") && hasAttribute(element, "tabIndex")) continue;

      const { line, column } = file.getLineAndColumnAtPos(element.getStart());

      const text = getElementText(element);
      const textSuffix = text ? `: "${text}${text.length >= 40 ? "…" : ""}"` : "";
      violations.push({
        rule: "no-div-interactive",
        filePath,
        line,
        column,
        element: `<${tagName}>`,
        message: `Interactive <${tagName}> should be <button> or have role+tabIndex${textSuffix}`,
      });
    }

    // Scan JsxSelfClosingElement nodes (e.g. <div onClick={handler} />)
    const selfClosingElements = file.getDescendantsOfKind(
      SyntaxKind.JsxSelfClosingElement,
    );
    for (const element of selfClosingElements) {
      const tagName = element.getTagNameNode().getText();
      if (!INTERACTIVE_TAGS.includes(tagName)) continue;
      if (!hasAttribute(element, "onClick")) continue;
      if (hasAttribute(element, "role") && hasAttribute(element, "tabIndex")) continue;

      const { line, column } = file.getLineAndColumnAtPos(element.getStart());

      violations.push({
        rule: "no-div-interactive",
        filePath,
        line,
        column,
        element: `<${tagName}>`,
        message: `Interactive <${tagName}> should be <button> or have role+tabIndex`,
      });
    }

    return violations;
  },
};
