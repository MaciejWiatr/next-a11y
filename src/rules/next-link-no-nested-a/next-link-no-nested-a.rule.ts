import { SyntaxKind } from "ts-morph";
import type { SourceFile, JsxOpeningElement } from "ts-morph";
import type { Rule, Violation } from "../../scan/types.js";

function isNextLinkImported(file: SourceFile): boolean {
  const importDecls = file.getImportDeclarations();
  return importDecls.some(
    (decl) => decl.getModuleSpecifierValue() === "next/link",
  );
}

function hasNestedAnchor(linkElement: JsxOpeningElement): boolean {
  const parent = linkElement.getParentIfKind(SyntaxKind.JsxElement);
  if (!parent) return false;

  const children = parent.getJsxChildren();
  for (const child of children) {
    // <a>...</a> inside Link
    if (child.isKind(SyntaxKind.JsxElement)) {
      const opening = child.getOpeningElement();
      if (opening.getTagNameNode().getText() === "a") return true;
    }
    // <a ... /> inside Link
    if (child.isKind(SyntaxKind.JsxSelfClosingElement)) {
      if (child.getTagNameNode().getText() === "a") return true;
    }
  }

  return false;
}

export const nextLinkNoNestedARule: Rule = {
  id: "next-link-no-nested-a",
  type: "deterministic",

  scan(file: SourceFile): Violation[] {
    if (!isNextLinkImported(file)) return [];

    const violations: Violation[] = [];

    const openingElements = file.getDescendantsOfKind(
      SyntaxKind.JsxOpeningElement,
    );

    for (const el of openingElements) {
      const tagName = el.getTagNameNode().getText();
      if (tagName !== "Link") continue;

      if (!hasNestedAnchor(el)) continue;

      const { line, column } = file.getLineAndColumnAtPos(el.getStart());

      violations.push({
        rule: "next-link-no-nested-a",
        filePath: file.getFilePath(),
        line,
        column,
        element: "<Link>",
        message:
          "<Link> from next/link should not contain a nested <a> element. Since Next.js 13, <Link> renders an <a> automatically.",
        fix: {
          type: "remove-element",
          value: "nested-a",
        },
      });
    }

    return violations;
  },
};
