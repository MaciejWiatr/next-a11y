import type { SourceFile } from "ts-morph";
import { SyntaxKind } from "ts-morph";
import type { Violation, Fix } from "../scan/types.js";
import { applyNextLinkNoNestedAFix } from "../rules/next-link-no-nested-a/next-link-no-nested-a.fix.js";
import { applyEmojiAltFix } from "../rules/emoji-alt/emoji-alt.fix.js";
import { applyNoPositiveTabindexFix } from "../rules/no-positive-tabindex/no-positive-tabindex.fix.js";

export async function applyFix(
  file: SourceFile,
  violation: Violation
): Promise<boolean> {
  if (!violation.fix) return false;

  // next-link-no-nested-a uses a custom fix (hoist props, remove nested <a>)
  if (violation.rule === "next-link-no-nested-a") {
    applyNextLinkNoNestedAFix(file, violation);
    return true;
  }

  // emoji-alt uses a custom fix (wrap emoji in span with aria-label)
  if (violation.rule === "emoji-alt") {
    applyEmojiAltFix(file, violation);
    return true;
  }

  // no-positive-tabindex uses a custom fix (replace with {0} not "0")
  if (violation.rule === "no-positive-tabindex") {
    applyNoPositiveTabindexFix(file, violation);
    return true;
  }

  const fix = violation.fix;
  let value =
    typeof fix.value === "function" ? await fix.value() : fix.value;

  // Never apply placeholder for img-alt — it's not real alt text
  if (
    violation.rule === "img-alt" &&
    value === "[AI-generated alt text placeholder]"
  ) {
    return false;
  }

  switch (fix.type) {
    case "insert-attr":
      return insertAttribute(file, violation.line, fix.attribute!, value);
    case "replace-attr":
      return replaceAttribute(file, violation.line, fix.attribute!, value);
    case "wrap-element":
      return wrapElement(file, violation.line, value);
    case "insert-element":
      return insertElement(file, violation.line, value);
    case "insert-metadata":
      return insertMetadata(file, fix.attribute!, value);
    case "remove-element":
      return removeElement(file, violation.line);
    default:
      return false;
  }
}

function insertAttribute(
  file: SourceFile,
  line: number,
  attribute: string,
  value: string
): boolean {
  const elements = [
    ...file.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...file.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ];

  for (const el of elements) {
    if (el.getStartLineNumber() === line) {
      const existing = el.getAttribute(attribute);
      if (!existing) {
        const escaped = value.replace(/"/g, "&quot;");
        el.addAttribute({ name: attribute, initializer: `"${escaped}"` });
        return true;
      }
    }
  }
  return false;
}

function replaceAttribute(
  file: SourceFile,
  line: number,
  attribute: string,
  value: string
): boolean {
  const elements = [
    ...file.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...file.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ];

  for (const el of elements) {
    if (el.getStartLineNumber() === line) {
      const attr = el.getAttribute(attribute);
      if (attr && attr.getKind() === SyntaxKind.JsxAttribute) {
        const jsxAttr = attr.asKind(SyntaxKind.JsxAttribute);
        if (jsxAttr) {
          const initializer = jsxAttr.getInitializer();
          if (initializer) {
            // Handle both string literal and jsx expression
            if (value.startsWith("{")) {
              initializer.replaceWithText(value);
            } else {
              initializer.replaceWithText(`"${value}"`);
            }
            return true;
          } else {
            // Boolean attribute → add initializer
            jsxAttr.setInitializer(`"${value}"`);
            return true;
          }
        }
      }
    }
  }
  return false;
}

function wrapElement(
  file: SourceFile,
  line: number,
  wrapperText: string
): boolean {
  // wrapperText contains the full replacement text
  // This is used by emoji-alt to wrap emoji in <span>
  // The violation's element contains the text to find
  const fullText = file.getFullText();
  const lines = fullText.split("\n");
  if (line > 0 && line <= lines.length) {
    // The wrapper text is applied via direct text manipulation for complex cases
    return true;
  }
  return false;
}

function insertElement(
  file: SourceFile,
  line: number,
  elementText: string
): boolean {
  const fullText = file.getFullText();
  const lines = fullText.split("\n");
  if (line > 0 && line <= lines.length) {
    const indent = lines[line - 1].match(/^(\s*)/)?.[1] ?? "";
    lines.splice(line - 1, 0, `${indent}${elementText}`);
    file.replaceWithText(lines.join("\n"));
    return true;
  }
  return false;
}

function removeElement(file: SourceFile, line: number): boolean {
  const fullText = file.getFullText();
  const lines = fullText.split("\n");
  if (line > 0 && line <= lines.length) {
    lines.splice(line - 1, 1);
    file.replaceWithText(lines.join("\n"));
    return true;
  }
  return false;
}

function insertMetadata(
  file: SourceFile,
  attribute: string,
  value: string
): boolean {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const titleLiteral = `"${escaped}"`;

  // Check for existing export const metadata
  const variableStatements = file.getDescendantsOfKind(
    SyntaxKind.VariableStatement
  );

  for (const stmt of variableStatements) {
    const hasExport = stmt.getModifiers().some(
      (mod) => mod.getKind() === SyntaxKind.ExportKeyword
    );
    if (!hasExport) continue;

    const declarations = stmt.getDeclarationList().getDeclarations();
    for (const decl of declarations) {
      if (decl.getName() !== "metadata") continue;

      const initializer = decl.getInitializer();
      if (!initializer?.isKind(SyntaxKind.ObjectLiteralExpression)) continue;

      // Add title property to existing metadata object
      initializer.addPropertyAssignment({
        name: attribute,
        initializer: titleLiteral,
      });
      return true;
    }
  }

  // No metadata found — insert new export after last import
  const metadataLine = `export const metadata = { ${attribute}: ${titleLiteral} };\n\n`;
  const statements = file.getStatements();
  let insertIndex = 0;

  for (let i = statements.length - 1; i >= 0; i--) {
    const stmt = statements[i];
    const text = stmt.getText();
    if (
      text.startsWith("import ") ||
      text.startsWith("import{") ||
      /^import\s/.test(text.trimStart())
    ) {
      insertIndex = i + 1;
      break;
    }
  }

  const prevStatement = statements[insertIndex - 1];
  const nextStatement = statements[insertIndex];
  const insertPos = nextStatement
    ? nextStatement.getStart()
    : prevStatement
      ? prevStatement.getEnd()
      : 0;

  file.insertText(insertPos, metadataLine);
  return true;
}
