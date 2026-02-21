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
    expect(violations[0].message).toBe(
      "Heading level skipped: expected h2 but found h3",
    );
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
    expect(violations[0].message).toBe(
      "Heading level skipped: expected h2 but found h3",
    );
    expect(violations[1].element).toBe("<h6>");
    expect(violations[1].message).toBe(
      "Heading level skipped: expected h4 but found h6",
    );
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
});
