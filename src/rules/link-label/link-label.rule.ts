import type { SourceFile } from "ts-morph";
import { SyntaxKind } from "ts-morph";
import type { Rule, Violation } from "../../scan/types.js";
import { getIconLabel, getGenericLabel } from "../button-label/icon-name-map.js";
import {
  findLabelVariableInScope,
  wrapLabelWithVariable,
} from "../../utils/find-label-variable.js";

export function createLinkLabelRule(options: { locale?: string }): Rule {
  const locale = options.locale ?? "en";

  return {
  id: "link-label",
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

      // Check <a> and <Link> (from next/link)
      if (tagName !== "a" && tagName !== "Link") continue;
      if (tagName === "Link" && !isNextLink(file)) continue;

      const ariaLabelAttr = el.getAttribute("aria-label");
      if (el.getAttribute("aria-labelledby")) continue;

      // Generic aria-label in map: suggest using variable
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
              rule: "link-label",
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

      // Check if there's visible text content
      if (el.getKind() === SyntaxKind.JsxOpeningElement) {
        const parent = el.getParent();
        if (parent) {
          const hasTextContent = parent
            .getDescendantsOfKind(SyntaxKind.JsxText)
            .some((t) => t.getText().trim().length > 0);

          if (hasTextContent) continue;

          // Check for JSX expression children like {t("key")}, {variable}, {cond ? "a" : "b"}
          // Filter out expressions that are attribute values (e.g., onClick={...}, href={...})
          const hasExpressionContent = parent
            .getDescendantsOfKind(SyntaxKind.JsxExpression)
            .some((expr) => {
              if (!expr.getExpression()) return false;
              return expr.getParent()?.getKind() !== SyntaxKind.JsxAttribute;
            });

          if (hasExpressionContent) continue;

          // Check for img/Image with alt text
          const images = [
            ...parent.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
            ...parent.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
          ];
          const hasAltImage = images.some((img) => {
            const imgTag = img.getTagNameNode().getText();
            if (imgTag !== "img" && imgTag !== "Image") return false;
            const alt = img.getAttribute("alt");
            if (!alt) return false;
            const jsxAttr = alt.asKind(SyntaxKind.JsxAttribute);
            const init = jsxAttr?.getInitializer();
            if (!init) return false;
            if (init.getKind() === SyntaxKind.StringLiteral) {
              return (init.asKind(SyntaxKind.StringLiteral)?.getLiteralValue() ?? "").length > 0;
            }
            return true;
          });

          if (hasAltImage) continue;
        }
      }

      const iconName = getIconName(el);
      const line = el.getStartLineNumber();

      violations.push({
        rule: "link-label",
        filePath,
        line,
        column: el.getStart() - el.getStartLinePos(),
        element: el.getText().slice(0, 80),
        message: "Link has no accessible name",
        fix: {
          type: "insert-attr",
          attribute: "aria-label",
          value: async () => {
            const base = iconName
              ? getIconLabel(iconName, locale)
              : getGenericLabel("Link", locale);
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

function isNextLink(file: SourceFile): boolean {
  const imports = file.getImportDeclarations();
  return imports.some(
    (imp) =>
      imp.getModuleSpecifierValue() === "next/link" &&
      (imp.getDefaultImport()?.getText() === "Link" ||
        imp.getNamedImports().some((n) => n.getName() === "Link"))
  );
}

function getIconName(
  el: ReturnType<SourceFile["getDescendantsOfKind"]>[number]
): string | undefined {
  const parent = el.getParent();
  if (!parent) return undefined;

  const selfClosingChildren = parent.getDescendantsOfKind(
    SyntaxKind.JsxSelfClosingElement
  );
  for (const child of selfClosingChildren) {
    const tag = child.getTagNameNode().getText();
    if (tag.endsWith("Icon") || tag === "svg" || isUpperCase(tag[0])) {
      return tag;
    }
  }

  return undefined;
}

function isUpperCase(ch: string): boolean {
  return ch === ch.toUpperCase() && ch !== ch.toLowerCase();
}

