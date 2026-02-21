import { SyntaxKind } from "ts-morph";
import type { SourceFile } from "ts-morph";
import type { Rule, Violation } from "../../scan/types.js";
import { getEmojiName } from "./emoji-names.js";

/**
 * Regex that matches emoji characters across common Unicode ranges.
 *
 * Covers:
 *   - Miscellaneous Symbols and Pictographs (U+1F300-1F5FF)
 *   - Emoticons (U+1F600-1F64F)
 *   - Transport and Map Symbols (U+1F680-1F6FF)
 *   - Supplemental Symbols and Pictographs (U+1F900-1F9FF)
 *   - Symbols and Pictographs Extended-A (U+1FA00-1FA6F, U+1FA70-1FAFF)
 *   - Dingbats (U+2702-27B0)
 *   - Miscellaneous Symbols (U+2600-26FF)
 *   - Variation selectors and Zero-Width Joiner sequences
 *   - Additional common symbols (U+2300-23FF, U+2B50, U+2B55, U+2705, U+274C, U+274E)
 *
 * The global flag ensures we find every emoji in a given text node.
 */
const EMOJI_REGEX =
  /(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*/gu;

/**
 * Checks whether a JsxText node containing an emoji is already wrapped in
 * a `<span role="img" aria-label="...">` element, which is the accessible
 * way to present decorative emoji.
 */
function isWrappedInAccessibleSpan(node: ReturnType<SourceFile["getDescendantsOfKind"]>[number]): boolean {
  const parent = node.getParent();
  if (!parent) return false;

  // The parent of JsxText inside <span role="img" aria-label="x">emoji</span>
  // is a JsxElement whose opening element is <span>.
  if (parent.getKind() !== SyntaxKind.JsxElement) return false;

  const jsxElement = parent;
  const openingElement = jsxElement.getChildrenOfKind(SyntaxKind.JsxOpeningElement)[0];
  if (!openingElement) return false;

  const tagName = openingElement.getTagNameNode().getText();
  if (tagName !== "span") return false;

  const attributes = openingElement.getAttributes();

  let hasRoleImg = false;
  let hasAriaLabel = false;

  for (const attr of attributes) {
    if (attr.getKind() !== SyntaxKind.JsxAttribute) continue;

    const jsxAttr = attr as import("ts-morph").JsxAttribute;
    const name = jsxAttr.getNameNode().getText();

    if (name === "role") {
      const init = jsxAttr.getInitializer();
      if (init && init.getKind() === SyntaxKind.StringLiteral) {
        const value = (init as import("ts-morph").StringLiteral).getLiteralValue();
        if (value === "img") hasRoleImg = true;
      }
    }

    if (name === "aria-label") {
      const init = jsxAttr.getInitializer();
      if (init) hasAriaLabel = true;
    }
  }

  return hasRoleImg && hasAriaLabel;
}

/**
 * Rule: emoji-alt
 *
 * Ensures that emoji characters in JSX text content are wrapped in an
 * accessible span element with role="img" and an aria-label describing
 * the emoji. Screen readers cannot meaningfully interpret raw emoji
 * characters, so this rule helps guarantee that emoji convey their
 * intended meaning to all users.
 */
export const emojiAltRule: Rule = {
  id: "emoji-alt",
  type: "deterministic",

  scan(file: SourceFile): Violation[] {
    const violations: Violation[] = [];
    const filePath = file.getFilePath();
    const jsxTextNodes = file.getDescendantsOfKind(SyntaxKind.JsxText);

    for (const textNode of jsxTextNodes) {
      const text = textNode.getText();
      // Reset the regex lastIndex before each use (global regex is stateful)
      EMOJI_REGEX.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = EMOJI_REGEX.exec(text)) !== null) {
        const emoji = match[0];

        // If the emoji is already wrapped in an accessible span, skip it
        if (isWrappedInAccessibleSpan(textNode)) continue;

        const nodeStart = textNode.getStart();
        const sourceFile = textNode.getSourceFile();
        const emojiPos = nodeStart + match.index;
        const lineAndCol = sourceFile.getLineAndColumnAtPos(emojiPos);
        const emojiName = getEmojiName(emoji);

        violations.push({
          rule: "emoji-alt",
          filePath,
          line: lineAndCol.line,
          column: lineAndCol.column,
          element: emoji,
          message: `Emoji "${emoji}" is missing accessible labeling. Wrap it in <span role="img" aria-label="${emojiName}">${emoji}</span> so screen readers can announce its meaning.`,
          fix: {
            type: "wrap-element",
            value: emojiName,
          },
        });
      }
    }

    return violations;
  },
};
