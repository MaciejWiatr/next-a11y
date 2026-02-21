import { SyntaxKind } from "ts-morph";
import type { SourceFile } from "ts-morph";
import type { Violation } from "../../scan/types.js";

/**
 * Applies the button-type fix by inserting `type="button"` on the
 * `<button>` or custom Button component identified by the violation's line number.
 */
export function applyButtonTypeFix(
  file: SourceFile,
  violation: Violation,
): void {
  const targetLine = violation.line;

  // Search both opening and self-closing JSX elements
  const openingElements = file.getDescendantsOfKind(
    SyntaxKind.JsxOpeningElement,
  );
  const selfClosingElements = file.getDescendantsOfKind(
    SyntaxKind.JsxSelfClosingElement,
  );

  const allElements = [...openingElements, ...selfClosingElements];

  for (const element of allElements) {
    const tagName = element.getTagNameNode().getText();
    const isNativeButton = tagName === "button";
    const isCustomButton =
      tagName[0] === tagName[0].toUpperCase() && /button/i.test(tagName);
    if (!isNativeButton && !isCustomButton) continue;

    const { line } = file.getLineAndColumnAtPos(element.getStart());
    if (line !== targetLine) continue;

    // Verify the element does not already have a type attribute
    const hasType = element
      .getAttributes()
      .some(
        (attr) =>
          attr.isKind(SyntaxKind.JsxAttribute) &&
          attr.getNameNode().getText() === "type",
      );

    if (hasType) continue;

    // Insert the type="button" attribute
    element.addAttribute({
      name: "type",
      initializer: '"button"',
    });

    return;
  }
}
