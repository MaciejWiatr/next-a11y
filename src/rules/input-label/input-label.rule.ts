import type { SourceFile } from "ts-morph";
import { SyntaxKind } from "ts-morph";
import type { Rule, Violation } from "../../scan/types.js";

const INPUT_TAGS = ["input", "select", "textarea"];

export const inputLabelRule: Rule = {
  id: "input-label",
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
      if (!INPUT_TAGS.includes(tagName)) continue;

      // Skip hidden inputs
      const typeAttr = el.getAttribute("type");
      if (typeAttr) {
        const jsxAttr = typeAttr.asKind(SyntaxKind.JsxAttribute);
        const init = jsxAttr?.getInitializer();
        if (init?.getKind() === SyntaxKind.StringLiteral) {
          const typeValue = init.asKind(SyntaxKind.StringLiteral)?.getLiteralValue();
          if (typeValue === "hidden") continue;
        }
      }

      // Check for aria-label or aria-labelledby
      if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")) {
        continue;
      }

      // Check for associated <label htmlFor> in the same file
      const idAttr = el.getAttribute("id");
      if (idAttr) {
        const jsxAttr = idAttr.asKind(SyntaxKind.JsxAttribute);
        const init = jsxAttr?.getInitializer();
        if (init?.getKind() === SyntaxKind.StringLiteral) {
          const idValue = init.asKind(SyntaxKind.StringLiteral)?.getLiteralValue();
          if (idValue && hasLabelFor(file, idValue)) continue;
        }
      }

      // Check if wrapped in <label>
      if (isWrappedInLabel(el)) continue;

      // Get context for AI prompt
      const placeholder = getStringAttribute(el, "placeholder");
      const name = getStringAttribute(el, "name");

      violations.push({
        rule: "input-label",
        filePath,
        line: el.getStartLineNumber(),
        column: el.getStart() - el.getStartLinePos(),
        element: el.getText().slice(0, 80),
        message: `<${tagName}> is missing an associated label`,
        fix: {
          type: "insert-attr",
          attribute: "aria-label",
          value: async () => {
            // Heuristic fallback
            if (placeholder) return placeholder;
            if (name) {
              return name
                .replace(/([a-z])([A-Z])/g, "$1 $2")
                .replace(/[_-]/g, " ")
                .replace(/^\w/, (c) => c.toUpperCase());
            }
            return tagName === "select"
              ? "Select option"
              : tagName === "textarea"
                ? "Text input"
                : "Input";
          },
        },
      });
    }

    return violations;
  },
};

function hasLabelFor(file: SourceFile, id: string): boolean {
  const allElements = [
    ...file.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...file.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ];

  return allElements.some((el) => {
    if (el.getTagNameNode().getText() !== "label") return false;
    const htmlFor = el.getAttribute("htmlFor");
    if (!htmlFor) return false;
    const jsxAttr = htmlFor.asKind(SyntaxKind.JsxAttribute);
    const init = jsxAttr?.getInitializer();
    if (init?.getKind() === SyntaxKind.StringLiteral) {
      return init.asKind(SyntaxKind.StringLiteral)?.getLiteralValue() === id;
    }
    return false;
  });
}

function isWrappedInLabel(el: any): boolean {
  let current = el.getParent();
  while (current) {
    if (current.getKind() === SyntaxKind.JsxElement) {
      const opening = current.getFirstChildByKind(SyntaxKind.JsxOpeningElement);
      if (opening?.getTagNameNode().getText() === "label") return true;
    }
    current = current.getParent();
  }
  return false;
}

function getStringAttribute(el: any, name: string): string | undefined {
  const attr = el.getAttribute(name);
  if (!attr) return undefined;
  const jsxAttr = attr.asKind(SyntaxKind.JsxAttribute);
  const init = jsxAttr?.getInitializer();
  if (init?.getKind() === SyntaxKind.StringLiteral) {
    return init.asKind(SyntaxKind.StringLiteral)?.getLiteralValue();
  }
  return undefined;
}
