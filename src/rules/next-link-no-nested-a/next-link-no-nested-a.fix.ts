import { SyntaxKind } from "ts-morph";
import type {
  SourceFile,
  JsxOpeningElement,
  JsxElement,
  JsxAttribute,
} from "ts-morph";
import type { Violation } from "../../scan/types.js";

function findLinkElementAtLine(
  file: SourceFile,
  line: number,
): JsxOpeningElement | undefined {
  const openingElements = file.getDescendantsOfKind(
    SyntaxKind.JsxOpeningElement,
  );

  for (const el of openingElements) {
    const { line: elLine } = file.getLineAndColumnAtPos(el.getStart());
    if (elLine === line && el.getTagNameNode().getText() === "Link") {
      return el;
    }
  }

  return undefined;
}

function findNestedAnchorElement(linkOpening: JsxOpeningElement): JsxElement | undefined {
  const parent = linkOpening.getParentIfKind(SyntaxKind.JsxElement);
  if (!parent) return undefined;

  const children = parent.getJsxChildren();
  for (const child of children) {
    if (child.isKind(SyntaxKind.JsxElement)) {
      const opening = child.getOpeningElement();
      if (opening.getTagNameNode().getText() === "a") {
        return child;
      }
    }
  }

  return undefined;
}

/**
 * Applies the next-link-no-nested-a fix by:
 * 1. Moving props from the nested <a> to the parent <Link> (skipping href)
 * 2. Replacing the <a>children</a> with just the children inside <Link>
 */
export function applyNextLinkNoNestedAFix(
  file: SourceFile,
  violation: Violation,
): void {
  const linkOpening = findLinkElementAtLine(file, violation.line);
  if (!linkOpening) return;

  const anchorElement = findNestedAnchorElement(linkOpening);
  if (!anchorElement) return;

  const anchorOpening = anchorElement.getOpeningElement();

  // Collect props from <a> that should be hoisted to <Link> (skip href)
  const anchorAttrs = anchorOpening.getAttributes();
  const propsToHoist: Array<{ name: string; initializer: string | undefined }> = [];

  for (const attr of anchorAttrs) {
    if (!attr.isKind(SyntaxKind.JsxAttribute)) continue;
    const jsxAttr = attr as JsxAttribute;
    const attrName = jsxAttr.getNameNode().getText();

    // Skip href since Link already has it
    if (attrName === "href") continue;

    const init = jsxAttr.getInitializer();
    propsToHoist.push({
      name: attrName,
      initializer: init ? init.getText() : undefined,
    });
  }

  // Add the hoisted props to the <Link> element
  for (const prop of propsToHoist) {
    // Check if Link already has this prop
    const existing = linkOpening.getAttribute(prop.name);
    if (existing) continue;

    if (prop.initializer) {
      linkOpening.addAttribute({
        name: prop.name,
        initializer: prop.initializer,
      });
    } else {
      // Boolean attribute
      linkOpening.addAttribute({ name: prop.name });
    }
  }

  // Get the inner content of the <a> element (children text)
  const anchorChildren = anchorElement.getJsxChildren();
  const childrenText = anchorChildren.map((child) => child.getText()).join("");

  // Replace the entire <a>...</a> with just the children
  anchorElement.replaceWithText(childrenText);
}
