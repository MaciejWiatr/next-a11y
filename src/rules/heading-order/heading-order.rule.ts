import { SyntaxKind } from "ts-morph";
import type { SourceFile } from "ts-morph";
import type { Rule, Violation } from "../../scan/types.js";

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

function headingLevel(tag: string): number {
  return Number(tag[1]);
}

export const headingOrderRule: Rule = {
  id: "heading-order",
  type: "detect",

  scan(file: SourceFile): Violation[] {
    const violations: Violation[] = [];
    const filePath = file.getFilePath();

    // Collect all heading elements in document order
    const headings: { tag: string; line: number; column: number }[] = [];

    const openingElements = file.getDescendantsOfKind(
      SyntaxKind.JsxOpeningElement,
    );
    for (const element of openingElements) {
      const tagName = element.getTagNameNode().getText();
      if (!HEADING_TAGS.has(tagName)) continue;

      const { line, column } = file.getLineAndColumnAtPos(element.getStart());
      headings.push({ tag: tagName, line, column });
    }

    const selfClosingElements = file.getDescendantsOfKind(
      SyntaxKind.JsxSelfClosingElement,
    );
    for (const element of selfClosingElements) {
      const tagName = element.getTagNameNode().getText();
      if (!HEADING_TAGS.has(tagName)) continue;

      const { line, column } = file.getLineAndColumnAtPos(element.getStart());
      headings.push({ tag: tagName, line, column });
    }

    // Sort by document position (line, then column)
    headings.sort((a, b) => a.line - b.line || a.column - b.column);

    // Check for heading level skips
    for (let i = 1; i < headings.length; i++) {
      const prev = headings[i - 1];
      const curr = headings[i];
      const prevLevel = headingLevel(prev.tag);
      const currLevel = headingLevel(curr.tag);

      // A skip occurs when the current heading jumps forward by more than 1 level
      if (currLevel > prevLevel + 1) {
        const expectedTag = `h${prevLevel + 1}`;
        violations.push({
          rule: "heading-order",
          filePath,
          line: curr.line,
          column: curr.column,
          element: `<${curr.tag}>`,
          message: `Heading level skipped: expected ${expectedTag} but found ${curr.tag}`,
        });
      }
    }

    return violations;
  },
};
