import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";
import { linkNoopenerRule } from "./link-noopener.rule.js";
import { applyLinkNoopenerFix } from "./link-noopener.fix.js";

function createSourceFile(code: string) {
  const project = new Project({ useInMemoryFileSystem: true });
  return project.createSourceFile("test.tsx", code);
}

describe("linkNoopenerRule", () => {
  it("reports violation for <a target=\"_blank\"> without rel", () => {
    const file = createSourceFile(`
      export default function Page() {
        return <a href="https://example.com" target="_blank">Link</a>;
      }
    `);

    const violations = linkNoopenerRule.scan(file);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("link-noopener");
    expect(violations[0].fix).toBeDefined();
    expect(violations[0].fix!.type).toBe("insert-attr");
    expect(violations[0].fix!.attribute).toBe("rel");
    expect(violations[0].fix!.value).toBe("noopener noreferrer");
  });

  it("does not report for <a target=\"_blank\" rel=\"noopener noreferrer\">", () => {
    const file = createSourceFile(`
      export default function Page() {
        return <a href="https://example.com" target="_blank" rel="noopener noreferrer">Link</a>;
      }
    `);

    const violations = linkNoopenerRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("does not report for <a> without target=\"_blank\"", () => {
    const file = createSourceFile(`
      export default function Page() {
        return <a href="https://example.com">Link</a>;
      }
    `);

    const violations = linkNoopenerRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("reports violation for <a> with partial rel (only noopener)", () => {
    const file = createSourceFile(`
      export default function Page() {
        return <a href="https://example.com" target="_blank" rel="noopener">Link</a>;
      }
    `);

    const violations = linkNoopenerRule.scan(file);
    expect(violations).toHaveLength(1);
    expect(violations[0].fix!.type).toBe("replace-attr");
  });

  it("reports violation for <a> with partial rel (only noreferrer)", () => {
    const file = createSourceFile(`
      export default function Page() {
        return <a href="https://example.com" target="_blank" rel="noreferrer">Link</a>;
      }
    `);

    const violations = linkNoopenerRule.scan(file);
    expect(violations).toHaveLength(1);
    expect(violations[0].fix!.type).toBe("replace-attr");
  });

  it("reports violation for next/link <Link target=\"_blank\"> without rel", () => {
    const file = createSourceFile(`
      import Link from "next/link";
      export default function Page() {
        return <Link href="/about" target="_blank">About</Link>;
      }
    `);

    const violations = linkNoopenerRule.scan(file);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("link-noopener");
    expect(violations[0].fix!.type).toBe("insert-attr");
  });

  it("does not report for <Link> that is not from next/link", () => {
    const file = createSourceFile(`
      import Link from "my-custom-lib";
      export default function Page() {
        return <Link href="/about" target="_blank">About</Link>;
      }
    `);

    const violations = linkNoopenerRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("does not report for next/link <Link> with correct rel", () => {
    const file = createSourceFile(`
      import Link from "next/link";
      export default function Page() {
        return <Link href="/about" target="_blank" rel="noopener noreferrer">About</Link>;
      }
    `);

    const violations = linkNoopenerRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("handles self-closing <a /> elements", () => {
    const file = createSourceFile(`
      export default function Page() {
        return <a href="https://example.com" target="_blank" />;
      }
    `);

    const violations = linkNoopenerRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("does not report for target other than _blank", () => {
    const file = createSourceFile(`
      export default function Page() {
        return <a href="https://example.com" target="_self">Link</a>;
      }
    `);

    const violations = linkNoopenerRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("reports multiple violations in a single file", () => {
    const file = createSourceFile(`
      export default function Page() {
        return (
          <div>
            <a href="https://a.com" target="_blank">A</a>
            <a href="https://b.com" target="_blank">B</a>
          </div>
        );
      }
    `);

    const violations = linkNoopenerRule.scan(file);
    expect(violations).toHaveLength(2);
  });
});

describe("applyLinkNoopenerFix", () => {
  it("adds rel attribute when missing", () => {
    const file = createSourceFile(`
      export default function Page() {
        return <a href="https://example.com" target="_blank">Link</a>;
      }
    `);

    const violations = linkNoopenerRule.scan(file);
    expect(violations).toHaveLength(1);

    applyLinkNoopenerFix(file, violations[0]);

    const text = file.getFullText();
    expect(text).toContain('rel="noopener noreferrer"');
  });

  it("updates rel attribute when partial (noopener only)", () => {
    const file = createSourceFile(`
      export default function Page() {
        return <a href="https://example.com" target="_blank" rel="noopener">Link</a>;
      }
    `);

    const violations = linkNoopenerRule.scan(file);
    expect(violations).toHaveLength(1);

    applyLinkNoopenerFix(file, violations[0]);

    const text = file.getFullText();
    expect(text).toContain("noopener");
    expect(text).toContain("noreferrer");
  });

  it("updates rel attribute when partial (noreferrer only)", () => {
    const file = createSourceFile(`
      export default function Page() {
        return <a href="https://example.com" target="_blank" rel="noreferrer">Link</a>;
      }
    `);

    const violations = linkNoopenerRule.scan(file);
    expect(violations).toHaveLength(1);

    applyLinkNoopenerFix(file, violations[0]);

    const text = file.getFullText();
    expect(text).toContain("noopener");
    expect(text).toContain("noreferrer");
  });

  it("fixes self-closing element", () => {
    const file = createSourceFile(`
      export default function Page() {
        return <a href="https://example.com" target="_blank" />;
      }
    `);

    const violations = linkNoopenerRule.scan(file);
    expect(violations).toHaveLength(1);

    applyLinkNoopenerFix(file, violations[0]);

    const text = file.getFullText();
    expect(text).toContain('rel="noopener noreferrer"');
  });

  it("results in no violations after fix is applied", () => {
    const file = createSourceFile(`
      export default function Page() {
        return <a href="https://example.com" target="_blank">Link</a>;
      }
    `);

    const violations = linkNoopenerRule.scan(file);
    expect(violations).toHaveLength(1);

    applyLinkNoopenerFix(file, violations[0]);

    const postFixViolations = linkNoopenerRule.scan(file);
    expect(postFixViolations).toHaveLength(0);
  });
});
