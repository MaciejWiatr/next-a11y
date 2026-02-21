import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";
import { buttonLabelRule } from "./button-label.rule.js";

function createFile(code: string) {
  const project = new Project({ useInMemoryFileSystem: true });
  return project.createSourceFile("test.tsx", code);
}

describe("button-label rule", () => {
  it("detects button with only icon child", () => {
    const file = createFile(
      `<button onClick={toggle}><MenuIcon /></button>`
    );
    const violations = buttonLabelRule.scan(file);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("button-label");
  });

  it("detects button with only svg child", () => {
    const file = createFile(
      `<button><svg viewBox="0 0 24 24"><path d="M..." /></svg></button>`
    );
    const violations = buttonLabelRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("skips button with text content", () => {
    const file = createFile(`<button>Click me</button>`);
    const violations = buttonLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("skips button with aria-label", () => {
    const file = createFile(
      `<button aria-label="Toggle menu"><MenuIcon /></button>`
    );
    const violations = buttonLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("skips button with aria-labelledby", () => {
    const file = createFile(
      `<button aria-labelledby="label-id"><MenuIcon /></button>`
    );
    const violations = buttonLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("detects self-closing button", () => {
    const file = createFile(`<button />`);
    const violations = buttonLabelRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("skips button with text in nested span", () => {
    const file = createFile(`<button><span>Click me</span></button>`);
    const violations = buttonLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("skips button with JSX expression content", () => {
    const file = createFile(`<button>{t("submit")}</button>`);
    const violations = buttonLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("skips button with ternary expression content", () => {
    const file = createFile(`<button>{isOpen ? "Close" : "Open"}</button>`);
    const violations = buttonLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("detects button with only onClick (expression is attribute, not content)", () => {
    const file = createFile(`<button onClick={handleClick}><ChevronLeft /></button>`);
    const violations = buttonLabelRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("detects multiple icon-only buttons", () => {
    const file = createFile(`<div><button><XIcon /></button><button><MenuIcon /></button></div>`);
    const violations = buttonLabelRule.scan(file);
    expect(violations).toHaveLength(2);
  });

  it("flags button with icon AND text, fix uses content", async () => {
    const file = createFile(`<button><SearchIcon /> Search</button>`);
    const violations = buttonLabelRule.scan(file);
    expect(violations).toHaveLength(1);
    expect(violations[0].fix).toBeDefined();
    const value = await (violations[0].fix!.value as Function)();
    expect(value).toBe("Search");
  });

  it("detects PascalCase icon components (non-Icon suffix)", () => {
    const file = createFile(`<button><ChevronLeft /></button>`);
    const violations = buttonLabelRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("does not flag button with only whitespace as having text", () => {
    const file = createFile(`<button>   </button>`);
    const violations = buttonLabelRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("skips button with dynamic aria-label", () => {
    const file = createFile(`<button aria-label={label}><MenuIcon /></button>`);
    const violations = buttonLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("ignores non-button elements", () => {
    const file = createFile(`<div><span><MenuIcon /></span></div>`);
    const violations = buttonLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("provides fix with correct icon name mapping", async () => {
    const file = createFile(`<button><TrashIcon /></button>`);
    const violations = buttonLabelRule.scan(file);
    expect(violations).toHaveLength(1);
    expect(violations[0].fix).toBeDefined();
    const value = await (violations[0].fix!.value as Function)();
    expect(value).toBe("Delete");
  });

  it("provides generic fix for unmapped icon names", async () => {
    const file = createFile(`<button><CustomSettingsGear /></button>`);
    const violations = buttonLabelRule.scan(file);
    expect(violations).toHaveLength(1);
    const value = await (violations[0].fix!.value as Function)();
    expect(value).toBe("Custom settings gear");
  });

  it("provides fallback fix when no icon detected", async () => {
    const file = createFile(`<button />`);
    const violations = buttonLabelRule.scan(file);
    expect(violations).toHaveLength(1);
    const value = await (violations[0].fix!.value as Function)();
    expect(value).toBe("Button");
  });
});
