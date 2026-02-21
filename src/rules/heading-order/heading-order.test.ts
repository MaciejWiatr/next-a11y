import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";
import { headingOrderRule } from "./heading-order.rule.js";

function scanCode(code: string) {
  const project = new Project({ useInMemoryFileSystem: true });
  const file = project.createSourceFile("test.tsx", code);
  return headingOrderRule.scan(file);
}

describe("heading-order", () => {
  it("reports a violation when heading level is skipped (h1 -> h3)", () => {
    const violations = scanCode(
      `const App = () => <div><h1>Title</h1><h3>Sub</h3></div>;`,
    );

    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("heading-order");
    expect(violations[0].element).toBe("<h3>");
    expect(violations[0].message).toContain("Expected h2 after h1, found h3");
    expect(violations[0].message).toContain("Sub");
    expect(violations[0].fix).toBeUndefined();
  });

  it("reports no violation for consecutive heading levels (h1 -> h2)", () => {
    const violations = scanCode(
      `const App = () => <div><h1>Title</h1><h2>Sub</h2></div>;`,
    );

    expect(violations).toHaveLength(0);
  });

  it("reports no violation when headings do not start at h1 (h2 -> h3)", () => {
    const violations = scanCode(
      `const App = () => <div><h2>Sub</h2><h3>SubSub</h3></div>;`,
    );

    expect(violations).toHaveLength(0);
  });

  it("reports no violation for a single heading", () => {
    const violations = scanCode(
      `const App = () => <div><h3>Only heading</h3></div>;`,
    );

    expect(violations).toHaveLength(0);
  });

  it("reports multiple violations when multiple levels are skipped", () => {
    const violations = scanCode(
      `const App = () => <div><h1>Title</h1><h3>Skip1</h3><h6>Skip2</h6></div>;`,
    );

    expect(violations).toHaveLength(2);
    expect(violations[0].element).toBe("<h3>");
    expect(violations[0].message).toContain("Expected h2 after h1, found h3");
    expect(violations[0].message).toContain("Skip1");
    expect(violations[1].element).toBe("<h6>");
    expect(violations[1].message).toContain("Expected h4 after h3, found h6");
    expect(violations[1].message).toContain("Skip2");
  });

  it("allows going back to a lower heading level without violation", () => {
    const violations = scanCode(
      `const App = () => <div><h1>Title</h1><h2>Sub</h2><h1>New section</h1></div>;`,
    );

    expect(violations).toHaveLength(0);
  });

  it("reports no violation when there are no headings", () => {
    const violations = scanCode(
      `const App = () => <div><p>No headings here</p></div>;`,
    );

    expect(violations).toHaveLength(0);
  });

  it("reports h2 -> h4 skip", () => {
    const violations = scanCode(
      `const App = () => <div><h2>Sub</h2><h4>Deep</h4></div>;`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain("Expected h3 after h2, found h4");
    expect(violations[0].message).toContain("Deep");
  });

  it("allows h1 -> h2 -> h1 -> h2 pattern (resetting sections)", () => {
    const violations = scanCode(
      `const App = () => <div><h1>A</h1><h2>A1</h2><h1>B</h1><h2>B1</h2></div>;`,
    );
    expect(violations).toHaveLength(0);
  });

  it("handles h1 -> h2 -> h3 -> h4 -> h5 -> h6 (all valid)", () => {
    const violations = scanCode(
      `const App = () => <div><h1>1</h1><h2>2</h2><h3>3</h3><h4>4</h4><h5>5</h5><h6>6</h6></div>;`,
    );
    expect(violations).toHaveLength(0);
  });

  it("reports h1 -> h6 as a skip", () => {
    const violations = scanCode(
      `const App = () => <div><h1>Title</h1><h6>Skip all</h6></div>;`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain("Expected h2 after h1, found h6");
    expect(violations[0].message).toContain("Skip all");
  });

  it("has no fix (detect-only rule)", () => {
    const violations = scanCode(
      `const App = () => <div><h1>Title</h1><h3>Sub</h3></div>;`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].fix).toBeUndefined();
  });
});
