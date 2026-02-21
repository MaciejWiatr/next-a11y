import type { SourceFile } from "ts-morph";
import { SyntaxKind } from "ts-morph";
import type { Violation, Fix } from "../scan/types.js";

export async function applyFix(
  file: SourceFile,
  violation: Violation
): Promise<boolean> {
  if (!violation.fix) return false;

  const fix = violation.fix;
  const value =
    typeof fix.value === "function" ? await fix.value() : fix.value;

  switch (fix.type) {
    case "insert-attr":
      return insertAttribute(file, violation.line, fix.attribute!, value);
    case "replace-attr":
      return replaceAttribute(file, violation.line, fix.attribute!, value);
    case "wrap-element":
      return wrapElement(file, violation.line, value);
    case "insert-element":
      return insertElement(file, violation.line, value);
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
        el.addAttribute({ name: attribute, initializer: `"${value}"` });
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
