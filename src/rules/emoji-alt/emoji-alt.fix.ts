import { SyntaxKind } from "ts-morph";
import type { SourceFile } from "ts-morph";
import type { Violation } from "../../scan/types.js";

/**
 * Applies the emoji-alt fix by finding the JsxText node at the violation
 * location and replacing the bare emoji with an accessible span wrapper:
 *
 *   Before: Hello 🔥 world
 *   After:  Hello <span role="img" aria-label="fire">🔥</span> world
 *
 * The aria-label value comes from `violation.fix.value`, which is populated
 * by the emoji name lookup during scanning.
 */
export function applyEmojiAltFix(file: SourceFile, violation: Violation): void {
  if (!violation.fix) return;

  const ariaLabel = typeof violation.fix.value === "string"
    ? violation.fix.value
    : undefined;

  if (!ariaLabel) return;

  const emoji = violation.element;
  const jsxTextNodes = file.getDescendantsOfKind(SyntaxKind.JsxText);

  for (const textNode of jsxTextNodes) {
    const nodeStart = textNode.getStart();
    const nodeEndLine = textNode.getEndLineNumber();
    const nodeStartLine = textNode.getStartLineNumber();

    // Check if this text node spans the violation line
    if (violation.line < nodeStartLine || violation.line > nodeEndLine) continue;

    const text = textNode.getText();
    if (!text.includes(emoji)) continue;

    // Verify this is the correct node by checking position
    const sourceFile = textNode.getSourceFile();
    const emojiIndex = text.indexOf(emoji);
    const emojiPos = nodeStart + emojiIndex;
    const lineAndCol = sourceFile.getLineAndColumnAtPos(emojiPos);

    if (lineAndCol.line !== violation.line || lineAndCol.column !== violation.column) {
      continue;
    }

    // Replace the emoji occurrence in this text node with the accessible wrapper.
    // We only replace the first occurrence that matches the violation position.
    const before = text.substring(0, emojiIndex);
    const after = text.substring(emojiIndex + emoji.length);
    const replacement = `${before}<span role="img" aria-label="${ariaLabel}">${emoji}</span>${after}`;

    textNode.replaceWithText(replacement);
    return;
  }
}
