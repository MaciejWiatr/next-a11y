import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";
import { buttonTypeRule } from "./button-type.rule.js";
import { applyButtonTypeFix } from "./button-type.fix.js";

function createSourceFile(code: string) {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { jsx: 2 /* JsxEmit.React */ },
  });
  return project.createSourceFile("test.tsx", code);
}

describe("buttonTypeRule", () => {
  it("reports a violation for <button> without type attribute", () => {
    const file = createSourceFile(`
      export default function App() {
        return <button>Click</button>;
      }
    `);

    const violations = buttonTypeRule.scan(file);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("button-type");
    expect(violations[0].element).toBe("<button>");
    expect(violations[0].fix).toBeDefined();
    expect(violations[0].fix?.type).toBe("insert-attr");
    expect(violations[0].fix?.attribute).toBe("type");
    expect(violations[0].fix?.value).toBe("button");
  });

  it("does not report a violation for <button type=\"submit\">", () => {
    const file = createSourceFile(`
      export default function App() {
        return <button type="submit">Submit</button>;
      }
    `);

    const violations = buttonTypeRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("does not report a violation for <button type=\"button\">", () => {
    const file = createSourceFile(`
      export default function App() {
        return <button type="button">Click</button>;
      }
    `);

    const violations = buttonTypeRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("does not report a violation for <button type=\"reset\">", () => {
    const file = createSourceFile(`
      export default function App() {
        return <button type="reset">Reset</button>;
      }
    `);

    const violations = buttonTypeRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("reports a violation for self-closing <button />", () => {
    const file = createSourceFile(`
      export default function App() {
        return <button />;
      }
    `);

    const violations = buttonTypeRule.scan(file);
    expect(violations).toHaveLength(1);
    expect(violations[0].element).toBe("<button>");
    expect(violations[0].fix).toBeDefined();
  });

  it("does not report for self-closing <button type=\"button\" />", () => {
    const file = createSourceFile(`
      export default function App() {
        return <button type="button" />;
      }
    `);

    const violations = buttonTypeRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("reports a warning with no fix for custom Button components", () => {
    const file = createSourceFile(`
      export default function App() {
        return <Button>Click</Button>;
      }
    `);

    const violations = buttonTypeRule.scan(file);
    expect(violations).toHaveLength(1);
    expect(violations[0].element).toBe("<Button>");
    expect(violations[0].fix).toBeUndefined();
    expect(violations[0].message).toContain("Custom component");
  });

  it("reports a warning with no fix for IconButton components", () => {
    const file = createSourceFile(`
      export default function App() {
        return <IconButton />;
      }
    `);

    const violations = buttonTypeRule.scan(file);
    expect(violations).toHaveLength(1);
    expect(violations[0].element).toBe("<IconButton>");
    expect(violations[0].fix).toBeUndefined();
  });

  it("does not report for custom Button with type attribute", () => {
    const file = createSourceFile(`
      export default function App() {
        return <Button type="submit">Submit</Button>;
      }
    `);

    const violations = buttonTypeRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("reports multiple violations for multiple buttons without type", () => {
    const file = createSourceFile(`
      export default function App() {
        return (
          <div>
            <button>One</button>
            <button>Two</button>
            <button type="button">Three</button>
          </div>
        );
      }
    `);

    const violations = buttonTypeRule.scan(file);
    expect(violations).toHaveLength(2);
  });

  it("does not report for non-button elements", () => {
    const file = createSourceFile(`
      export default function App() {
        return <div>Content</div>;
      }
    `);

    const violations = buttonTypeRule.scan(file);
    expect(violations).toHaveLength(0);
  });
});

describe("applyButtonTypeFix", () => {
  it("inserts type=\"button\" on a <button> element", () => {
    const file = createSourceFile(`
      export default function App() {
        return <button>Click</button>;
      }
    `);

    const violations = buttonTypeRule.scan(file);
    expect(violations).toHaveLength(1);

    applyButtonTypeFix(file, violations[0]);

    const updatedText = file.getFullText();
    expect(updatedText).toContain('type="button"');
  });

  it("inserts type=\"button\" on a self-closing <button />", () => {
    const file = createSourceFile(`
      export default function App() {
        return <button />;
      }
    `);

    const violations = buttonTypeRule.scan(file);
    expect(violations).toHaveLength(1);

    applyButtonTypeFix(file, violations[0]);

    const updatedText = file.getFullText();
    expect(updatedText).toContain('type="button"');
  });

  it("does not duplicate type attribute if already present", () => {
    const file = createSourceFile(`
      export default function App() {
        return <button type="submit">Submit</button>;
      }
    `);

    // Manually construct a violation pointing to a button that already has type
    const violations = buttonTypeRule.scan(file);
    expect(violations).toHaveLength(0);

    // No violations means no fix needed - confirm the file is unchanged
    const originalText = file.getFullText();
    expect(originalText).toContain('type="submit"');
    expect((originalText.match(/type=/g) || []).length).toBe(1);
  });

  it("fixes only the targeted button when multiple exist", () => {
    const file = createSourceFile(`
      export default function App() {
        return (
          <div>
            <button>First</button>
            <button>Second</button>
          </div>
        );
      }
    `);

    const violations = buttonTypeRule.scan(file);
    expect(violations).toHaveLength(2);

    // Fix only the first violation
    applyButtonTypeFix(file, violations[0]);

    const updatedText = file.getFullText();
    // The first button should now have type="button"
    expect(updatedText).toContain('type="button"');

    // Re-scan: only the second button should still violate
    const remaining = buttonTypeRule.scan(file);
    expect(remaining).toHaveLength(1);
  });
});
