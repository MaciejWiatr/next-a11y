import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";
import { emojiAltRule } from "./emoji-alt.rule.js";
import { applyEmojiAltFix } from "./emoji-alt.fix.js";
import { getEmojiName, EMOJI_NAMES } from "./emoji-names.js";

function createSourceFile(code: string) {
  const project = new Project({ useInMemoryFileSystem: true });
  return project.createSourceFile("test.tsx", code, { overwrite: true });
}

// ---------------------------------------------------------------------------
// emoji-names.ts
// ---------------------------------------------------------------------------
describe("getEmojiName", () => {
  it("returns the correct name for a known emoji", () => {
    expect(getEmojiName("\u{1F525}")).toBe("fire");
    expect(getEmojiName("\u{1F680}")).toBe("rocket");
    expect(getEmojiName("\u{1F44D}")).toBe("thumbs up");
    expect(getEmojiName("\u{2B50}")).toBe("star");
    expect(getEmojiName("\u{2705}")).toBe("check mark");
    expect(getEmojiName("\u{26A0}\uFE0F")).toBe("warning");
  });

  it("falls back to 'emoji' for an unknown emoji", () => {
    expect(getEmojiName("\u{1F9FF}")).toBe("emoji");
    expect(getEmojiName("X")).toBe("emoji");
  });

  it("has at least 50 entries in the lookup table", () => {
    expect(Object.keys(EMOJI_NAMES).length).toBeGreaterThanOrEqual(50);
  });
});

// ---------------------------------------------------------------------------
// emoji-alt.rule.ts — violations
// ---------------------------------------------------------------------------
describe("emojiAltRule", () => {
  it("reports a violation for bare emoji in JSX text", () => {
    const file = createSourceFile(`
      export default function Page() {
        return <p>Hello \u{1F525} world</p>;
      }
    `);

    const violations = emojiAltRule.scan(file);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("emoji-alt");
    expect(violations[0].element).toBe("\u{1F525}");
    expect(violations[0].fix?.type).toBe("wrap-element");
    expect(violations[0].fix?.value).toBe("fire");
  });

  it("reports no violation when emoji is in an accessible span", () => {
    const file = createSourceFile(`
      export default function Page() {
        return <p><span role="img" aria-label="fire">\u{1F525}</span></p>;
      }
    `);

    const violations = emojiAltRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("reports violations for multiple emojis in the same text", () => {
    const file = createSourceFile(`
      export default function Page() {
        return <p>\u{1F525}\u{1F680}\u{2B50}</p>;
      }
    `);

    const violations = emojiAltRule.scan(file);
    expect(violations).toHaveLength(3);
    expect(violations[0].element).toBe("\u{1F525}");
    expect(violations[1].element).toBe("\u{1F680}");
    expect(violations[2].element).toBe("\u{2B50}");
  });

  it("reports a violation for an unknown emoji with a generic label", () => {
    const file = createSourceFile(`
      export default function Page() {
        return <p>\u{1F9FF}</p>;
      }
    `);

    const violations = emojiAltRule.scan(file);
    expect(violations).toHaveLength(1);
    expect(violations[0].fix?.value).toBe("emoji");
  });

  it("does not report violations for plain text", () => {
    const file = createSourceFile(`
      export default function Page() {
        return <p>Hello world</p>;
      }
    `);

    const violations = emojiAltRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("still reports if span has role='img' but no aria-label", () => {
    const file = createSourceFile(`
      export default function Page() {
        return <p><span role="img">\u{1F525}</span></p>;
      }
    `);

    const violations = emojiAltRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("still reports if span has aria-label but no role='img'", () => {
    const file = createSourceFile(`
      export default function Page() {
        return <p><span aria-label="fire">\u{1F525}</span></p>;
      }
    `);

    const violations = emojiAltRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("has id 'emoji-alt' and type 'deterministic'", () => {
    expect(emojiAltRule.id).toBe("emoji-alt");
    expect(emojiAltRule.type).toBe("deterministic");
  });
});

// ---------------------------------------------------------------------------
// emoji-alt.fix.ts
// ---------------------------------------------------------------------------
describe("applyEmojiAltFix", () => {
  it("wraps a bare emoji with an accessible span", () => {
    const file = createSourceFile(`
      export default function Page() {
        return <p>Hello \u{1F525} world</p>;
      }
    `);

    const violations = emojiAltRule.scan(file);
    expect(violations).toHaveLength(1);

    applyEmojiAltFix(file, violations[0]);

    const updatedText = file.getFullText();
    expect(updatedText).toContain('<span role="img" aria-label="fire">\u{1F525}</span>');
    expect(updatedText).toContain("Hello ");
    expect(updatedText).toContain(" world");
  });

  it("does nothing when violation has no fix", () => {
    const file = createSourceFile(`
      export default function Page() {
        return <p>Hello \u{1F525} world</p>;
      }
    `);

    const originalText = file.getFullText();

    applyEmojiAltFix(file, {
      rule: "emoji-alt",
      filePath: "test.tsx",
      line: 3,
      column: 1,
      element: "\u{1F525}",
      message: "test",
    });

    expect(file.getFullText()).toBe(originalText);
  });

  it("produces no violations after fix is applied", () => {
    const file = createSourceFile(`
      export default function Page() {
        return <p>Hello \u{1F525} world</p>;
      }
    `);

    const violations = emojiAltRule.scan(file);
    expect(violations).toHaveLength(1);

    applyEmojiAltFix(file, violations[0]);

    const postFixViolations = emojiAltRule.scan(file);
    expect(postFixViolations).toHaveLength(0);
  });
});
