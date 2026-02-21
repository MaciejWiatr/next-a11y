import type { SourceFile, Node } from "ts-morph";
import { SyntaxKind } from "ts-morph";
import type { Rule, Violation } from "../../scan/types.js";
import { classifyAlt } from "./img-alt.classify.js";

export function createImgAltRule(options: { fillAlt: boolean }): Rule {
  return {
  id: "img-alt",
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

      // Only check <img> and <Image> (from next/image)
      if (tagName !== "img" && tagName !== "Image") continue;

      // If it's <Image>, verify it's from next/image
      if (tagName === "Image" && !isNextImage(file)) continue;

      const altAttr = el.getAttribute("alt");

      let altValue: string | undefined | null;
      let isExpression = false;

      if (!altAttr) {
        altValue = undefined;
      } else if (altAttr.getKind() === SyntaxKind.JsxAttribute) {
        const jsxAttr = altAttr.asKind(SyntaxKind.JsxAttribute);
        const init = jsxAttr?.getInitializer();
        if (!init) {
          // alt (boolean) — treat as empty
          altValue = "";
        } else if (init.getKind() === SyntaxKind.StringLiteral) {
          altValue = init.asKind(SyntaxKind.StringLiteral)?.getLiteralValue() ?? "";
        } else if (init.getKind() === SyntaxKind.JsxExpression) {
          const expr = init.asKind(SyntaxKind.JsxExpression);
          const exprText = expr?.getExpression()?.getText() ?? "";
          if (exprText === '""' || exprText === "''") {
            altValue = "";
          } else {
            altValue = exprText;
            isExpression = true;
          }
        }
      }

      const classification = classifyAlt(altValue, isExpression);

      // Dynamic expressions: only skip if inside array render (.map) or function call (i18n)
      if (classification === "dynamic") {
        const isTrustedDynamic =
          isInArrayRender(el) ||
          (altValue != null && isFunctionCallExpression(altValue));
        if (isTrustedDynamic) continue;

        // Standalone dynamic expression — flag as warning (no auto-fix)
        violations.push({
          rule: "img-alt",
          filePath,
          line: el.getStartLineNumber(),
          column: el.getStart() - el.getStartLinePos(),
          element: el.getText().slice(0, 80),
          message: `Image has unverifiable dynamic alt: {${altValue}}`,
        });
        continue;
      }

      const shouldFlag =
        classification === "missing" ||
        classification === "meaningless" ||
        (classification === "decorative" && options.fillAlt);

      if (shouldFlag) {
        violations.push({
          rule: "img-alt",
          filePath,
          line: el.getStartLineNumber(),
          column: el.getStart() - el.getStartLinePos(),
          element: el.getText().slice(0, 80),
          message:
            classification === "missing"
              ? "Image is missing alt text"
              : classification === "decorative"
                ? "Image has empty alt text (use --fill-alt to generate)"
                : `Image has meaningless alt text: "${altValue}"`,
          fix: {
            type: altAttr ? "replace-attr" : "insert-attr",
            attribute: "alt",
            value: async () => {
              return `[AI-generated alt text placeholder]`;
            },
          },
        });
      }
    }

    return violations;
  },
  };
}

/**
 * Check if a node is inside an array render callback (.map, .flatMap, .forEach).
 */
function isInArrayRender(node: Node): boolean {
  let current: Node | undefined = node.getParent();
  while (current) {
    if (current.getKind() === SyntaxKind.CallExpression) {
      const callExpr = current.asKind(SyntaxKind.CallExpression);
      const exprText = callExpr?.getExpression()?.getText() ?? "";
      if (
        exprText.endsWith(".map") ||
        exprText.endsWith(".flatMap") ||
        exprText.endsWith(".forEach")
      ) {
        return true;
      }
    }
    current = current.getParent();
  }
  return false;
}

/**
 * Check if expression text is a function call (e.g. t('key'), intl.formatMessage(...)).
 * Also matches ternaries and template literals as "intentional" expressions.
 */
function isFunctionCallExpression(exprText: string): boolean {
  return exprText.includes("(") || exprText.includes("?") || exprText.includes("`");
}

function isNextImage(file: SourceFile): boolean {
  const imports = file.getImportDeclarations();
  return imports.some(
    (imp) =>
      imp.getModuleSpecifierValue() === "next/image" &&
      (imp.getDefaultImport()?.getText() === "Image" ||
        imp.getNamedImports().some((n) => n.getName() === "Image"))
  );
}
