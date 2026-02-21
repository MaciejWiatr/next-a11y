import { SyntaxKind } from "ts-morph";
import type { SourceFile } from "ts-morph";
import type { Rule, Violation } from "../../scan/types.js";
import { extractContext } from "../../scan/context.js";

const PAGE_FILE_PATTERN = /\bpage\.(tsx|jsx|ts|js)$/;

export const nextMetadataTitleRule: Rule = {
  id: "next-metadata-title",
  type: "ai",

  scan(file: SourceFile): Violation[] {
    const filePath = file.getFilePath();

    // Only check App Router page files
    if (!PAGE_FILE_PATTERN.test(filePath)) {
      return [];
    }

    // Look for `export const metadata` with a `title` property
    const variableStatements = file.getDescendantsOfKind(
      SyntaxKind.VariableStatement,
    );

    for (const stmt of variableStatements) {
      // Check if the statement has an export modifier
      const hasExport = stmt.getModifiers().some(
        (mod) => mod.getKind() === SyntaxKind.ExportKeyword,
      );
      if (!hasExport) continue;

      const declarations = stmt.getDeclarationList().getDeclarations();
      for (const decl of declarations) {
        if (decl.getName() !== "metadata") continue;

        const initializer = decl.getInitializer();
        if (!initializer) continue;

        // Check if the object has a `title` property
        if (initializer.isKind(SyntaxKind.ObjectLiteralExpression)) {
          const hasTitleProp = initializer
            .getProperties()
            .some(
              (prop) =>
                prop.isKind(SyntaxKind.PropertyAssignment) &&
                prop.getNameNode().getText() === "title",
            );

          if (hasTitleProp) {
            return [];
          }
        }

        // If we found `export const metadata` but it has no title,
        // we still consider it a violation (metadata without title)
      }
    }

    // Look for `export function generateMetadata` or `export async function generateMetadata`
    const functionDeclarations = file.getDescendantsOfKind(
      SyntaxKind.FunctionDeclaration,
    );

    for (const func of functionDeclarations) {
      if (func.getName() !== "generateMetadata") continue;

      const hasExport = func.getModifiers().some(
        (mod) => mod.getKind() === SyntaxKind.ExportKeyword,
      );
      if (hasExport) {
        return [];
      }
    }

    // Neither found — produce a violation with AI fix
    const context = extractContext(file);
    const heuristicTitle = context.route === "/" ? context.componentName : (context.route?.slice(1).split("/").pop() ?? context.componentName);

    return [
      {
        rule: "next-metadata-title",
        filePath,
        line: 1,
        column: 1,
        element: "page",
        message:
          "Page is missing metadata.title \u2014 Next.js route announcer will be silent",
        fix: {
          type: "insert-metadata",
          attribute: "title",
          value: async () => {
            // Heuristic: use route segment or component name (e.g. /about → "About", Home → "Home")
            const segment = heuristicTitle;
            return segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : "Page";
          },
        },
      },
    ];
  },
};
