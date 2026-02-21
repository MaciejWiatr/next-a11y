import { SyntaxKind } from "ts-morph";
import type { SourceFile, JsxOpeningElement, JsxSelfClosingElement } from "ts-morph";
import type { Violation } from "../../scan/types.js";

function findElementAtLine(
  file: SourceFile,
  line: number,
): JsxOpeningElement | JsxSelfClosingElement | undefined {
  const openingElements = file.getDescendantsOfKind(
    SyntaxKind.JsxOpeningElement,
  );
  for (const el of openingElements) {
    if (el.getStartLineNumber() === line) return el;
  }

  const selfClosingElements = file.getDescendantsOfKind(
    SyntaxKind.JsxSelfClosingElement,
  );
  for (const el of selfClosingElements) {
    if (el.getStartLineNumber() === line) return el;
  }

  return undefined;
}

export function applyLinkNoopenerFix(
  file: SourceFile,
  violation: Violation,
): void {
  const element = findElementAtLine(file, violation.line);
  if (!element) return;

  const relAttr = element.getAttribute("rel");

  if (!relAttr) {
    element.addAttribute({
      name: "rel",
      initializer: `"noopener noreferrer"`,
    });
  } else if (relAttr.getKind() === SyntaxKind.JsxAttribute) {
    const jsxAttr = relAttr as import("ts-morph").JsxAttribute;
    const init = jsxAttr.getInitializer();

    if (init && init.getKind() === SyntaxKind.StringLiteral) {
      const strLiteral = init as import("ts-morph").StringLiteral;
      const currentValue = strLiteral.getLiteralValue();
      const parts = currentValue.split(/\s+/).filter(Boolean);

      if (!parts.includes("noopener")) parts.push("noopener");
      if (!parts.includes("noreferrer")) parts.push("noreferrer");

      strLiteral.setLiteralValue(parts.join(" "));
    }
  }
}
