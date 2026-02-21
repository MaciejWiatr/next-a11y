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
});
