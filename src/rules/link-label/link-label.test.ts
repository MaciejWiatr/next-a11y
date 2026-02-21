import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";
import { linkLabelRule } from "./link-label.rule.js";

function createFile(code: string) {
  const project = new Project({ useInMemoryFileSystem: true });
  return project.createSourceFile("test.tsx", code);
}

describe("link-label rule", () => {
  it("detects link with only icon child", () => {
    const file = createFile(
      `<a href="/settings"><SettingsIcon /></a>`
    );
    const violations = linkLabelRule.scan(file);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("link-label");
  });

  it("skips link with text content", () => {
    const file = createFile(`<a href="/about">About us</a>`);
    const violations = linkLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("skips link with aria-label", () => {
    const file = createFile(
      `<a href="/settings" aria-label="Settings"><SettingsIcon /></a>`
    );
    const violations = linkLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("detects next/link with only icon", () => {
    const file = createFile(
      `import Link from "next/link";\n<Link href="/settings"><SettingsIcon /></Link>`
    );
    const violations = linkLabelRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("skips non-next/link Link component", () => {
    const file = createFile(
      `import { Link } from "react-router";\n<Link to="/settings"><SettingsIcon /></Link>`
    );
    const violations = linkLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("skips link with aria-labelledby", () => {
    const file = createFile(`<a href="/settings" aria-labelledby="nav-settings"><SettingsIcon /></a>`);
    const violations = linkLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("skips link with JSX expression content", () => {
    const file = createFile(`<a href="/">{t("home")}</a>`);
    const violations = linkLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("skips link with ternary expression content", () => {
    const file = createFile(`<a href="/">{isActive ? "Active" : "Inactive"}</a>`);
    const violations = linkLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("detects self-closing anchor without label", () => {
    const file = createFile(`<a href="/settings" />`);
    const violations = linkLabelRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("skips link containing img with alt text", () => {
    const file = createFile(`<a href="/"><img src="/logo.png" alt="Company Logo" /></a>`);
    const violations = linkLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("detects link containing img without alt", () => {
    const file = createFile(`<a href="/"><img src="/logo.png" /></a>`);
    const violations = linkLabelRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("detects link containing img with empty alt", () => {
    const file = createFile(`<a href="/"><img src="/logo.png" alt="" /></a>`);
    const violations = linkLabelRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("skips link with text in nested span", () => {
    const file = createFile(`<a href="/about"><span>About us</span></a>`);
    const violations = linkLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("detects multiple icon-only links", () => {
    const file = createFile(`<nav><a href="/a"><HomeIcon /></a><a href="/b"><SettingsIcon /></a></nav>`);
    const violations = linkLabelRule.scan(file);
    expect(violations).toHaveLength(2);
  });

  it("skips link with icon AND text", () => {
    const file = createFile(`<a href="/settings"><SettingsIcon /> Settings</a>`);
    const violations = linkLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("detects PascalCase icon components without Icon suffix", () => {
    const file = createFile(`<a href="/back"><ChevronLeft /></a>`);
    const violations = linkLabelRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("detects next/link with named import", () => {
    const file = createFile(
      `import { Link } from "next/link";\n<Link href="/settings"><SettingsIcon /></Link>`
    );
    const violations = linkLabelRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("provides fix with icon context", async () => {
    const file = createFile(`<a href="/settings"><SettingsIcon /></a>`);
    const violations = linkLabelRule.scan(file);
    expect(violations).toHaveLength(1);
    const value = await (violations[0].fix!.value as Function)();
    expect(value).toBe("Settings");
  });

  it("ignores non-link elements", () => {
    const file = createFile(`<div><span><SettingsIcon /></span></div>`);
    const violations = linkLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("skips link with dynamic aria-label", () => {
    const file = createFile(`<a href="/" aria-label={label}><HomeIcon /></a>`);
    const violations = linkLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });
});
