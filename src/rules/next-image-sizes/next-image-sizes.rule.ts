import { SyntaxKind } from "ts-morph";
import type {
  SourceFile,
  JsxOpeningElement,
  JsxSelfClosingElement,
} from "ts-morph";
import type { Rule, Violation } from "../../scan/types.js";

function isNextImageImported(file: SourceFile): boolean {
  const importDecls = file.getImportDeclarations();
  return importDecls.some(
    (decl) => decl.getModuleSpecifierValue() === "next/image",
  );
}

function hasBooleanAttribute(
  element: JsxOpeningElement | JsxSelfClosingElement,
  name: string,
): boolean {
  const attrs = element.getAttributes();
  for (const attr of attrs) {
    if (!attr.isKind(SyntaxKind.JsxAttribute)) continue;
    if (attr.getNameNode().getText() !== name) continue;

    // Boolean prop: <Image fill /> (no initializer)
    const init = attr.getInitializer();
    if (!init) return true;

    // Explicit true: <Image fill={true} />
    if (init.isKind(SyntaxKind.JsxExpression)) {
      const expr = init.getExpression();
      if (expr && expr.getText() === "true") return true;
    }

    // String "true" is not considered a boolean true for fill
    return false;
  }
  return false;
}

function hasAttribute(
  element: JsxOpeningElement | JsxSelfClosingElement,
  name: string,
): boolean {
  return element.getAttributes().some(
    (attr) =>
      attr.isKind(SyntaxKind.JsxAttribute) &&
      attr.getNameNode().getText() === name,
  );
}

function checkElement(
  element: JsxOpeningElement | JsxSelfClosingElement,
  file: SourceFile,
): Violation | null {
  const tagName = element.getTagNameNode().getText();
  if (tagName !== "Image") return null;

  if (!hasBooleanAttribute(element, "fill")) return null;
  if (hasAttribute(element, "sizes")) return null;

  const { line, column } = file.getLineAndColumnAtPos(element.getStart());

  return {
    rule: "next-image-sizes",
    filePath: file.getFilePath(),
    line,
    column,
    element: "<Image>",
    message:
      "<Image fill> without sizes prop loads full-width image on all viewports",
  };
}

export const nextImageSizesRule: Rule = {
  id: "next-image-sizes",
  type: "deterministic",

  scan(file: SourceFile): Violation[] {
    if (!isNextImageImported(file)) return [];

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
