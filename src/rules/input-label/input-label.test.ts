import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";
import { inputLabelRule } from "./input-label.rule.js";

function createFile(code: string) {
  const project = new Project({ useInMemoryFileSystem: true });
  return project.createSourceFile("test.tsx", code);
}

describe("input-label rule", () => {
  it("detects input without label", () => {
    const file = createFile(`<input type="text" placeholder="Search" />`);
    const violations = inputLabelRule.scan(file);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("input-label");
  });

  it("detects select without label", () => {
    const file = createFile(
      `<select name="country"><option>US</option></select>`
    );
    const violations = inputLabelRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("detects textarea without label", () => {
    const file = createFile(`<textarea name="message" />`);
    const violations = inputLabelRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("skips input with aria-label", () => {
    const file = createFile(
      `<input type="text" aria-label="Search products" />`
    );
    const violations = inputLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("skips input with aria-labelledby", () => {
    const file = createFile(
      `<input type="text" aria-labelledby="search-label" />`
    );
    const violations = inputLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("skips input with associated label", () => {
    const file = createFile(
      `<><label htmlFor="email">Email</label><input id="email" type="email" /></>`
    );
    const violations = inputLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("skips input wrapped in label", () => {
    const file = createFile(
      `<label>Email<input type="email" /></label>`
    );
    const violations = inputLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("skips hidden inputs", () => {
    const file = createFile(`<input type="hidden" name="csrf" />`);
    const violations = inputLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });
});
