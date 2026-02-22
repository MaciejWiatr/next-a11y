/**
 * Integration / smoke tests for the full scan pipeline.
 * Runs detect → applyAllFixes → finalize on real fixtures.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { detect, applyAllFixes, finalize, scan } from "../../src/scan/scan.js";
import { resolveConfig } from "../../src/config/resolve.js";

const FIXTURES = {
  "IconButton.tsx": `
export function IconButton() {
  return (
    <button onClick={() => {}}>
      <MenuIcon />
    </button>
  );
}
function MenuIcon() {
  return <svg viewBox="0 0 24 24"><path d="M3 12h18" /></svg>;
}
`,
  "EmojiText.tsx": `
export function EmojiText() {
  return <p>Hello 🔥 world</p>;
}
`,
  "LinkNoRel.tsx": `
export function LinkNoRel() {
  return <a href="https://x.com" target="_blank">Twitter</a>;
}
`,
  "ButtonNoType.tsx": `
export function ButtonNoType() {
  return <button>Submit</button>;
}
`,
  "TableOfContents.tsx": `
const sections = [{ id: "a", label: "Intro" }];
export function TOC() {
  return (
    <nav>
      {sections.map((section) => (
        <button aria-label="Go to section" type="button">
          <span>{section.label}</span>
        </button>
      ))}
    </nav>
  );
}
`,
};

let tmpDir: string;
let cacheDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "next-a11y-integration-"));
  cacheDir = path.join(tmpDir, ".a11y-cache");
  fs.mkdirSync(cacheDir, { recursive: true });

  for (const [name, content] of Object.entries(FIXTURES)) {
    const filePath = path.join(tmpDir, name);
    fs.writeFileSync(filePath, content.trim(), "utf-8");
  }
});

afterAll(() => {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

function getConfig() {
  const base = resolveConfig({}, {
    fix: true,
    noAi: true,
    locale: "en",
  });
  return { ...base, cache: cacheDir };
}

describe("scan integration", () => {
  it("detects violations across fixture files", async () => {
    const ctx = await detect(tmpDir, getConfig());
    expect(ctx.filesScanned).toBeGreaterThanOrEqual(5);
    expect(ctx.violations.length).toBeGreaterThan(0);

    const rules = new Set(ctx.violations.map((v) => v.rule));
    expect(rules.has("button-label")).toBe(true);
    expect(rules.has("emoji-alt")).toBe(true);
    expect(rules.has("link-noopener")).toBe(true);
    expect(rules.has("button-type")).toBe(true);
  });

  it("applies fixes and modifies files", async () => {
    const ctx = await detect(tmpDir, getConfig());
    const { fixedCount, fixed } = await applyAllFixes(ctx, ctx.violations);
    const result = await finalize(ctx, fixedCount, fixed);

    expect(fixedCount).toBeGreaterThan(0);
    expect(result.fixedCount).toBe(fixedCount);

    const iconButtonPath = path.join(tmpDir, "IconButton.tsx");
    const content = fs.readFileSync(iconButtonPath, "utf-8");
    expect(content).toContain('aria-label="Menu"');
  });

  it("scan() end-to-end completes successfully", async () => {
    const result = await scan(tmpDir, getConfig());
    expect(result.filesScanned).toBeGreaterThanOrEqual(5);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("fixes TableOfContents generic aria-label with variable", () => {
    const tocPath = path.join(tmpDir, "TableOfContents.tsx");
    const content = fs.readFileSync(tocPath, "utf-8");
    expect(content).toContain("section.label");
    expect(content).toMatch(/aria-label=\{[`'"].*section\.label/);
  });

  it("fixes emoji with role and aria-label", () => {
    const emojiPath = path.join(tmpDir, "EmojiText.tsx");
    const content = fs.readFileSync(emojiPath, "utf-8");
    expect(content).toContain('role="img"');
    expect(content).toContain('aria-label="fire"');
  });

  it("fixes link with rel noopener noreferrer", () => {
    const linkPath = path.join(tmpDir, "LinkNoRel.tsx");
    const content = fs.readFileSync(linkPath, "utf-8");
    expect(content).toContain('rel="noopener noreferrer"');
  });

  it("fixes button with type attribute", () => {
    const btnPath = path.join(tmpDir, "ButtonNoType.tsx");
    const content = fs.readFileSync(btnPath, "utf-8");
    expect(content).toContain('type="button"');
  });
});
