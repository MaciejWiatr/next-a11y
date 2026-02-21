import { SyntaxKind } from "ts-morph";
import type { SourceFile, JsxOpeningElement, JsxSelfClosingElement } from "ts-morph";
import type { Rule, Violation, Fix, FixType } from "../../scan/types.js";

function getAttributeValue(
  element: JsxOpeningElement | JsxSelfClosingElement,
  name: string,
): string | undefined {
  const attr = element.getAttribute(name);
  if (!attr || attr.getKind() !== SyntaxKind.JsxAttribute) return undefined;

  const init = (attr as import("ts-morph").JsxAttribute).getInitializer();
  if (!init) return undefined;

  if (init.getKind() === SyntaxKind.StringLiteral) {
    return (init as import("ts-morph").StringLiteral).getLiteralValue();
  }

  return undefined;
}

function isNextLinkImported(file: SourceFile): boolean {
  const importDecls = file.getImportDeclarations();
  return importDecls.some(
    (decl) => decl.getModuleSpecifierValue() === "next/link",
  );
}

function checkElement(
  element: JsxOpeningElement | JsxSelfClosingElement,
  file: SourceFile,
): Violation | null {
  const tagName = element.getTagNameNode().getText();

  if (tagName !== "a" && tagName !== "Link") return null;
  if (tagName === "Link" && !isNextLinkImported(file)) return null;

  const targetValue = getAttributeValue(element, "target");
  if (targetValue !== "_blank") return null;

  const relValue = getAttributeValue(element, "rel");
  const hasNoopener = relValue?.includes("noopener") ?? false;
  const hasNoreferrer = relValue?.includes("noreferrer") ?? false;

  if (hasNoopener && hasNoreferrer) return null;

  const fixType: FixType = relValue === undefined ? "insert-attr" : "replace-attr";

  const fix: Fix = {
    type: fixType,
    attribute: "rel",
    value: "noopener noreferrer",
  };

  const line = element.getStartLineNumber();
  const column = element.getStartLinePos() + 1;

  return {
    rule: "link-noopener",
    filePath: file.getFilePath(),
    line,
    column,
    element: element.getText(),
    message: `<${tagName} target="_blank"> is missing rel="noopener noreferrer". This is a security risk.`,
    fix,
  };
}

export const linkNoopenerRule: Rule = {
  id: "link-noopener",
  type: "deterministic",

  scan(file: SourceFile): Violation[] {
    const violations: Violation[] = [];

    const openingElements = file.getDescendantsOfKind(
      SyntaxKind.JsxOpeningElement,
    );
    for (const el of openingElements) {
      const violation = checkElement(el, file);
      if (violation) violations.push(violation);
    }

    const selfClosingElements = file.getDescendantsOfKind(
      SyntaxKind.JsxSelfClosingElement,
    );
    for (const el of selfClosingElements) {
      const violation = checkElement(el, file);
      if (violation) violations.push(violation);
    }

    return violations;
  },
};
