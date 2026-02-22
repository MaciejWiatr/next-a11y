import type { SourceFile } from "ts-morph";
import { SyntaxKind } from "ts-morph";
import type { Rule, Violation } from "../../scan/types.js";
import { getIconLabel, getGenericLabel } from "./icon-name-map.js";
import {
  findLabelVariableInScope,
  wrapLabelWithVariable,
} from "../../utils/find-label-variable.js";

export function createButtonLabelRule(options: { locale?: string }): Rule {
  const locale = options.locale ?? "en";

  return {
  id: "button-label",
  type: "ai",
  scan(file: SourceFile): Violation[] {
    const violations: Violation[] = [];
    const filePath = file.getFilePath();

    const elements = [
      ...file.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
      ...file.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
    ];

    for (const el of elements) {
      const tagName = el.getTagNameNode().getText();
      if (tagName !== "button") continue;

      const ariaLabelAttr = el.getAttribute("aria-label");
      if (el.getAttribute("aria-labelledby")) continue;

      // Generic aria-label in map: suggest using variable (e.g. section.label)
      if (ariaLabelAttr?.getKind() === SyntaxKind.JsxAttribute) {
        const init = ariaLabelAttr.asKind(SyntaxKind.JsxAttribute)?.getInitializer();
        if (init?.getKind() === SyntaxKind.StringLiteral) {
          const currentLabel =
            init.asKind(SyntaxKind.StringLiteral)?.getLiteralValue() ?? "";
          const line = el.getStartLineNumber();
          const varRef = findLabelVariableInScope(file, line, {
            usedInContent: true,
          });
          if (varRef && currentLabel.length > 0) {
            violations.push({
              rule: "button-label",
              filePath,
              line,
              column: el.getStart() - el.getStartLinePos(),
              element: el.getText().slice(0, 80),
              message: "Use variable in aria-label for better screen reader context",
              fix: {
                type: "replace-attr",
                attribute: "aria-label",
                value: wrapLabelWithVariable(currentLabel, varRef),
              },
            });
            continue;
          }
        }
      }

      if (ariaLabelAttr) continue;

      // Get icon and content context
      const iconName = getIconName(el);
      const buttonElement = el.getKind() === SyntaxKind.JsxOpeningElement ? el.getParent() : null;

      let hasTextContent = false;
      let hasExpressionContent = false;
      let hasAccessibleChild = false;

      if (el.getKind() === SyntaxKind.JsxOpeningElement && buttonElement) {
        hasTextContent = buttonElement
          .getDescendantsOfKind(SyntaxKind.JsxText)
          .some((t) => t.getText().trim().length > 0);

        hasExpressionContent = buttonElement
          .getDescendantsOfKind(SyntaxKind.JsxExpression)
          .some((expr) => {
            if (!expr.getExpression()) return false;
            return expr.getParent()?.getKind() !== SyntaxKind.JsxAttribute;
          });

        const nestedElements = buttonElement.getDescendantsOfKind(
          SyntaxKind.JsxOpeningElement
        );
        hasAccessibleChild = nestedElements.some((nested) => {
          const nestedTag = nested.getTagNameNode().getText();
          return (
            nestedTag !== "svg" &&
            !nestedTag.endsWith("Icon") &&
            nested
              .getParent()
              ?.getDescendantsOfKind(SyntaxKind.JsxText)
              .some((t) => t.getText().trim().length > 0)
          );
        });
      }

      const hasContent = hasTextContent || hasExpressionContent || hasAccessibleChild;

      // Skip buttons with text/content but no icon — they already have an accessible name
      if (hasContent && !iconName) continue;

      const line = el.getStartLineNumber();
      violations.push({
        rule: "button-label",
        filePath,
        line,
        column: el.getStart() - el.getStartLinePos(),
        element: el.getText().slice(0, 80),
        message: "Button has no accessible name",
        fix: {
          type: "insert-attr",
          attribute: "aria-label",
          value: async () => {
            // Prefer nested text content when available
            const nestedText = buttonElement
              ? getNestedTextContent(buttonElement)
              : "";
            let base: string;
            if (nestedText.trim().length > 0) {
              base = nestedText.trim();
            } else if (iconName) {
              base = getIconLabel(iconName, locale);
            } else {
              base = getGenericLabel("Button", locale);
            }
            const varRef = findLabelVariableInScope(file, line);
            if (varRef) return wrapLabelWithVariable(base, varRef);
            return base;
          },
        },
      });
    }

    return violations;
  },
};
}

function getNestedTextContent(buttonElement: { getDescendantsOfKind: (k: typeof SyntaxKind.JsxText) => { getText: () => string }[] }): string {
  const textNodes = buttonElement.getDescendantsOfKind(SyntaxKind.JsxText);
  return textNodes.map((t) => t.getText()).join("");
}

function getIconName(
  el: ReturnType<SourceFile["getDescendantsOfKind"]>[number]
): string | undefined {
  const parent = el.getParent();
  if (!parent) return undefined;

  // Look for self-closing components or SVGs in children.
  // If the element only contains a single self-closing component (no text),
  // it's likely an icon-only button — regardless of library (lucide, heroicons, etc.)
  const selfClosingChildren = parent.getDescendantsOfKind(
    SyntaxKind.JsxSelfClosingElement
  );
  for (const child of selfClosingChildren) {
    const tag = child.getTagNameNode().getText();
    if (tag.endsWith("Icon") || tag === "svg" || isUpperCase(tag[0])) {
      return tag;
    }
  }

  const openingChildren = parent.getDescendantsOfKind(
    SyntaxKind.JsxOpeningElement
  );
  for (const child of openingChildren) {
    const tag = child.getTagNameNode().getText();
    if (tag.endsWith("Icon") || tag === "svg") {
      return tag;
    }
  }

  return undefined;
}

function isUpperCase(ch: string): boolean {
  return ch === ch.toUpperCase() && ch !== ch.toLowerCase();
}

