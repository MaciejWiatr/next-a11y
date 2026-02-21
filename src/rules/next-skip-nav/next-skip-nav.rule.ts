import { SyntaxKind } from "ts-morph";
import type {
  SourceFile,
  JsxOpeningElement,
  JsxSelfClosingElement,
} from "ts-morph";
import type { Rule, Violation } from "../../scan/types.js";

const LAYOUT_FILE_PATTERN = /\blayout\.(tsx|jsx)$/;

function getAttributeStringValue(
  element: JsxOpeningElement | JsxSelfClosingElement,
  name: string,
): string | undefined {
  const attr = element.getAttribute(name);
  if (!attr || !attr.isKind(SyntaxKind.JsxAttribute)) return undefined;

  const init = (attr as import("ts-morph").JsxAttribute).getInitializer();
  if (!init) return undefined;

  if (init.isKind(SyntaxKind.StringLiteral)) {
    return (init as import("ts-morph").StringLiteral).getLiteralValue();
  }

  return undefined;
}

function getJsxChildrenText(element: JsxOpeningElement): string {
  const parent = element.getParentIfKind(SyntaxKind.JsxElement);
  if (!parent) return "";
  return parent.getJsxChildren().map((child) => child.getText()).join(" ");
}

export const nextSkipNavRule: Rule = {
  id: "next-skip-nav",
  type: "deterministic",

  scan(file: SourceFile): Violation[] {
    const filePath = file.getFilePath();

    // Only check layout files
    if (!LAYOUT_FILE_PATTERN.test(filePath)) {
      return [];
    }

    // Search for an <a> element with href="#main-content" or text containing "skip"
    const openingElements = file.getDescendantsOfKind(
      SyntaxKind.JsxOpeningElement,
    );
    for (const el of openingElements) {
      const tagName = el.getTagNameNode().getText();
      if (tagName !== "a") continue;

      const href = getAttributeStringValue(el, "href");
      if (href === "#main-content") return [];

      const childrenText = getJsxChildrenText(el);
      if (/skip/i.test(childrenText)) return [];
    }

    const selfClosingElements = file.getDescendantsOfKind(
      SyntaxKind.JsxSelfClosingElement,
    );
    for (const el of selfClosingElements) {
      const tagName = el.getTagNameNode().getText();
      if (tagName !== "a") continue;

      const href = getAttributeStringValue(el, "href");
      if (href === "#main-content") return [];
    }

    return [
      {
        rule: "next-skip-nav",
        filePath,
        line: 1,
        column: 1,
        element: "layout",
        message: "Root layout is missing a skip navigation link",
      },
    ];
  },
};
