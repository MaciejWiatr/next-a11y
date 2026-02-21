import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";
import { noDivInteractiveRule } from "./no-div-interactive.rule.js";

function scanCode(code: string) {
  const project = new Project({ useInMemoryFileSystem: true });
  const file = project.createSourceFile("test.tsx", code);
  return noDivInteractiveRule.scan(file);
}

describe("no-div-interactive", () => {
  it("reports a violation for <div onClick> without role and tabIndex", () => {
    const violations = scanCode(
      `<div onClick={handler}>Click</div>`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("no-div-interactive");
    expect(violations[0].element).toBe("<div>");
    expect(violations[0].message).toContain("Interactive <div> should be");
    expect(violations[0].message).toContain("Click");
    expect(violations[0].fix).toBeUndefined();
  });

  it("does not report a violation for <div onClick> with role and tabIndex", () => {
    const violations = scanCode(
      `<div onClick={handler} role="button" tabIndex={0}>Click</div>`,
    );
    expect(violations).toHaveLength(0);
  });

  it("does not report a violation for <button onClick>", () => {
    const violations = scanCode(
      `<button onClick={handler}>Click</button>`,
    );
    expect(violations).toHaveLength(0);
  });

  it("does not report a violation for a non-interactive <div>", () => {
    const violations = scanCode(
      `<div>Not interactive</div>`,
    );
    expect(violations).toHaveLength(0);
  });

  it("reports a violation for <span onClick> without role and tabIndex", () => {
    const violations = scanCode(
      `<span onClick={handler}>Click</span>`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].element).toBe("<span>");
  });

  it("does not report a violation for <span onClick> with role and tabIndex", () => {
    const violations = scanCode(
      `<span onClick={handler} role="button" tabIndex={0}>Click</span>`,
    );
    expect(violations).toHaveLength(0);
  });

  it("reports a violation for <div onClick> with only role but no tabIndex", () => {
    const violations = scanCode(
      `<div onClick={handler} role="button">Click</div>`,
    );
    expect(violations).toHaveLength(1);
  });

  it("reports a violation for <div onClick> with only tabIndex but no role", () => {
    const violations = scanCode(
      `<div onClick={handler} tabIndex={0}>Click</div>`,
    );
    expect(violations).toHaveLength(1);
  });

  it("handles self-closing elements", () => {
    const violations = scanCode(
      `<div onClick={handler} />`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].element).toBe("<div>");
  });

  it("does not flag div with only onMouseEnter (not onClick)", () => {
    const violations = scanCode(
      `<div onMouseEnter={handler}>Hover</div>`,
    );
    expect(violations).toHaveLength(0);
  });

  it("reports multiple interactive divs", () => {
    const violations = scanCode(
      `<div><div onClick={a}>A</div><div onClick={b}>B</div><span onClick={c}>C</span></div>`,
    );
    expect(violations).toHaveLength(3);
  });

  it("does not flag sections, articles, or other semantic elements", () => {
    const violations = scanCode(
      `<section onClick={handler}>Content</section>`,
    );
    expect(violations).toHaveLength(0);
  });

  it("does not flag div without any event handlers", () => {
    const violations = scanCode(
      `<div className="container" id="main" role="region">Content</div>`,
    );
    expect(violations).toHaveLength(0);
  });

  it("does not report for <div onClick> with both role and tabIndex as expressions", () => {
    const violations = scanCode(
      `<div onClick={handler} role={role} tabIndex={idx}>Click</div>`,
    );
    expect(violations).toHaveLength(0);
  });
});
