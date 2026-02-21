import type { SourceFile } from "ts-morph";
import { SyntaxKind } from "ts-morph";
import type { Rule, Violation } from "../../scan/types.js";
import { classifyAlt } from "./img-alt.classify.js";

export const imgAltRule: Rule = {
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

      if (classification === "missing" || classification === "meaningless") {
        violations.push({
          rule: "img-alt",
          filePath,
          line: el.getStartLineNumber(),
          column: el.getStart() - el.getStartLinePos(),
          element: el.getText().slice(0, 80),
          message:
            classification === "missing"
              ? "Image is missing alt text"
              : `Image has meaningless alt text: "${altValue}"`,
          fix: {
            type: "insert-attr",
            attribute: "alt",
            value: async () => {
              // This will be replaced with AI-generated text during the scan pipeline
              return `[AI-generated alt text placeholder]`;
            },
          },
        });
      }
    }

    return violations;
  },
};

function isNextImage(file: SourceFile): boolean {
  const imports = file.getImportDeclarations();
  return imports.some(
    (imp) =>
      imp.getModuleSpecifierValue() === "next/image" &&
      (imp.getDefaultImport()?.getText() === "Image" ||
        imp.getNamedImports().some((n) => n.getName() === "Image"))
  );
}
