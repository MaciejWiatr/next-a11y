import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";
import { noPositiveTabindexRule } from "./no-positive-tabindex.rule.js";
import { applyNoPositiveTabindexFix } from "./no-positive-tabindex.fix.js";

function createSourceFile(code: string) {
  const project = new Project({ useInMemoryFileSystem: true });
  return project.createSourceFile("test.tsx", code);
}

describe("noPositiveTabindexRule", () => {
  it("should report a violation for tabIndex with a positive value", () => {
    const file = createSourceFile(`
      export default function App() {
        return <div tabIndex={5}>Content</div>;
      }
    `);

    const violations = noPositiveTabindexRule.scan(file);

    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("no-positive-tabindex");
    expect(violations[0].element).toBe("div");
    expect(violations[0].message).toContain("5");
    expect(violations[0].fix).toEqual({
      type: "replace-attr",
      attribute: "tabIndex",
      value: "0",
    });
  });

  it("should not report a violation for tabIndex={0}", () => {
    const file = createSourceFile(`
      export default function App() {
        return <div tabIndex={0}>Content</div>;
      }
    `);

    const violations = noPositiveTabindexRule.scan(file);

    expect(violations).toHaveLength(0);
  });

  it("should not report a violation for tabIndex={-1}", () => {
    const file = createSourceFile(`
      export default function App() {
        return <div tabIndex={-1}>Content</div>;
      }
    `);

    const violations = noPositiveTabindexRule.scan(file);

    expect(violations).toHaveLength(0);
  });

  it("should not report a violation when there is no tabIndex", () => {
    const file = createSourceFile(`
      export default function App() {
        return <div className="wrapper">Content</div>;
      }
    `);

    const violations = noPositiveTabindexRule.scan(file);

    expect(violations).toHaveLength(0);
  });

  it("should report multiple violations for multiple positive tabIndex values", () => {
    const file = createSourceFile(`
      export default function App() {
        return (
          <div>
            <button tabIndex={3}>First</button>
            <input tabIndex={10} />
            <span tabIndex={0}>OK</span>
          </div>
        );
      }
    `);

    const violations = noPositiveTabindexRule.scan(file);

    expect(violations).toHaveLength(2);
    expect(violations[0].element).toBe("button");
    expect(violations[1].element).toBe("input");
  });

  it("should handle self-closing JSX elements", () => {
    const file = createSourceFile(`
      export default function App() {
        return <input tabIndex={2} />;
      }
    `);

    const violations = noPositiveTabindexRule.scan(file);

    expect(violations).toHaveLength(1);
    expect(violations[0].element).toBe("input");
  });
});

describe("applyNoPositiveTabindexFix", () => {
  it("should replace a positive tabIndex value with 0", () => {
    const file = createSourceFile(`
      export default function App() {
        return <div tabIndex={5}>Content</div>;
      }
    `);

    const violations = noPositiveTabindexRule.scan(file);
    expect(violations).toHaveLength(1);

    applyNoPositiveTabindexFix(file, violations[0]);

    const updatedText = file.getFullText();
    expect(updatedText).toContain("tabIndex={0}");
    expect(updatedText).not.toContain("tabIndex={5}");
  });

  it("should not modify tabIndex={0}", () => {
    const file = createSourceFile(`
      export default function App() {
        return <div tabIndex={0}>Content</div>;
      }
    `);

    const originalText = file.getFullText();
    const violations = noPositiveTabindexRule.scan(file);
    expect(violations).toHaveLength(0);

    // No violation means no fix to apply, source stays the same
    expect(file.getFullText()).toBe(originalText);
  });

  it("should fix only the targeted violation when multiple exist", () => {
    const file = createSourceFile(`
      export default function App() {
        return (
          <div>
            <button tabIndex={3}>First</button>
            <input tabIndex={10} />
          </div>
        );
      }
    `);

    const violations = noPositiveTabindexRule.scan(file);
    expect(violations).toHaveLength(2);

    applyNoPositiveTabindexFix(file, violations[0]);

    const updatedText = file.getFullText();
    expect(updatedText).toContain("tabIndex={0}");
    expect(updatedText).toContain("tabIndex={10}");
  });
});
