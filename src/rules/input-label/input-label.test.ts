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

  it("detects multiple unlabeled inputs", () => {
    const file = createFile(`<div><input type="text" /><input type="email" /><select><option>A</option></select></div>`);
    const violations = inputLabelRule.scan(file);
    expect(violations).toHaveLength(3);
  });

  it("skips input with type=submit", () => {
    const file = createFile(`<input type="submit" value="Submit" />`);
    const violations = inputLabelRule.scan(file);
    expect(violations).toHaveLength(1);
    // submit inputs still need labeling
  });

  it("skips select with aria-label", () => {
    const file = createFile(`<select aria-label="Choose country"><option>US</option></select>`);
    const violations = inputLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("skips textarea with aria-label", () => {
    const file = createFile(`<textarea aria-label="Message body" />`);
    const violations = inputLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("skips textarea wrapped in label", () => {
    const file = createFile(`<label>Message<textarea /></label>`);
    const violations = inputLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("skips select wrapped in label", () => {
    const file = createFile(`<label>Country<select><option>US</option></select></label>`);
    const violations = inputLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("detects input with label referencing wrong id", () => {
    const file = createFile(`<><label htmlFor="name">Name</label><input id="email" type="text" /></>`);
    const violations = inputLabelRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("skips input wrapped in deeply nested label", () => {
    const file = createFile(`<label><div><span><input type="text" /></span></div></label>`);
    const violations = inputLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("detects input with dynamic id (not string literal)", () => {
    const file = createFile(`<input id={inputId} type="text" />`);
    const violations = inputLabelRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("provides placeholder as fallback fix value", async () => {
    const file = createFile(`<input type="text" placeholder="Search products" />`);
    const violations = inputLabelRule.scan(file);
    expect(violations).toHaveLength(1);
    const value = await (violations[0].fix!.value as Function)();
    expect(value).toBe("Search products");
  });

  it("provides name as fallback fix value (camelCase to words)", async () => {
    const file = createFile(`<input type="text" name="firstName" />`);
    const violations = inputLabelRule.scan(file);
    expect(violations).toHaveLength(1);
    const value = await (violations[0].fix!.value as Function)();
    expect(value).toBe("First Name");
  });

  it("provides name as fallback fix value (snake_case to words)", async () => {
    const file = createFile(`<input type="text" name="last_name" />`);
    const violations = inputLabelRule.scan(file);
    expect(violations).toHaveLength(1);
    const value = await (violations[0].fix!.value as Function)();
    expect(value).toBe("Last name");
  });

  it("provides generic fallback for select without context", async () => {
    const file = createFile(`<select><option>A</option></select>`);
    const violations = inputLabelRule.scan(file);
    expect(violations).toHaveLength(1);
    const value = await (violations[0].fix!.value as Function)();
    expect(value).toBe("Select option");
  });

  it("provides generic fallback for textarea without context", async () => {
    const file = createFile(`<textarea />`);
    const violations = inputLabelRule.scan(file);
    expect(violations).toHaveLength(1);
    const value = await (violations[0].fix!.value as Function)();
    expect(value).toBe("Text input");
  });

  it("ignores non-form elements", () => {
    const file = createFile(`<div><span>Not a form element</span></div>`);
    const violations = inputLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("has correct violation message per element type", () => {
    const file = createFile(`<div><input type="text" /><select /><textarea /></div>`);
    const violations = inputLabelRule.scan(file);
    expect(violations).toHaveLength(3);
    expect(violations[0].message).toContain("<input>");
    expect(violations[1].message).toContain("<select>");
    expect(violations[2].message).toContain("<textarea>");
  });

  it("uses variable in scope when input is inside map", async () => {
    const file = createFile(`
      {fields.map((field) => (
        <input key={field.id} type="text" placeholder={field.placeholder} />
      ))}
    `);
    const violations = inputLabelRule.scan(file);
    expect(violations).toHaveLength(1);
    const value = await (violations[0].fix!.value as Function)();
    expect(value).toContain("field.");
  });
});
