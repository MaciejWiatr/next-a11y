import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";
import { nextLinkNoNestedARule } from "./next-link-no-nested-a.rule.js";
import { applyNextLinkNoNestedAFix } from "./next-link-no-nested-a.fix.js";

function createSourceFile(code: string, filePath = "/app/page.tsx") {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { jsx: 2 /* JsxEmit.React */ },
  });
  return project.createSourceFile(filePath, code);
}

describe("nextLinkNoNestedARule", () => {
  it("reports a violation for <Link><a>...</a></Link>", () => {
    const file = createSourceFile(`
      import Link from "next/link";

      export default function Nav() {
        return <Link href="/about"><a className="nav">About</a></Link>;
      }
    `);

    const violations = nextLinkNoNestedARule.scan(file);

    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("next-link-no-nested-a");
    expect(violations[0].element).toBe("<Link>");
    expect(violations[0].message).toContain("nested <a>");
    expect(violations[0].fix).toBeDefined();
    expect(violations[0].fix!.type).toBe("remove-element");
  });

  it("does not report a violation for <Link>text</Link>", () => {
    const file = createSourceFile(`
      import Link from "next/link";

      export default function Nav() {
        return <Link href="/about">About</Link>;
      }
    `);

    const violations = nextLinkNoNestedARule.scan(file);

    expect(violations).toHaveLength(0);
  });

  it("does not report when Link is not imported from next/link", () => {
    const file = createSourceFile(`
      import Link from "my-custom-link";

      export default function Nav() {
        return <Link href="/about"><a>About</a></Link>;
      }
    `);

    const violations = nextLinkNoNestedARule.scan(file);

    expect(violations).toHaveLength(0);
  });

  it("reports multiple violations for multiple Links with nested <a>", () => {
    const file = createSourceFile(`
      import Link from "next/link";

      export default function Nav() {
        return (
          <nav>
            <Link href="/about"><a>About</a></Link>
            <Link href="/contact"><a>Contact</a></Link>
            <Link href="/home">Home</Link>
          </nav>
        );
      }
    `);

    const violations = nextLinkNoNestedARule.scan(file);

    expect(violations).toHaveLength(2);
  });

  it("does not report for <Link> with non-anchor children", () => {
    const file = createSourceFile(`
      import Link from "next/link";

      export default function Nav() {
        return <Link href="/about"><span>About</span></Link>;
      }
    `);

    const violations = nextLinkNoNestedARule.scan(file);

    expect(violations).toHaveLength(0);
  });
});

describe("applyNextLinkNoNestedAFix", () => {
  it("removes nested <a> and hoists className to Link", () => {
    const file = createSourceFile(`
      import Link from "next/link";

      export default function Nav() {
        return <Link href="/about"><a className="nav">About</a></Link>;
      }
    `);

    const violations = nextLinkNoNestedARule.scan(file);
    expect(violations).toHaveLength(1);

    applyNextLinkNoNestedAFix(file, violations[0]);

    const updatedText = file.getFullText();
    // The <a> should be removed
    expect(updatedText).not.toContain("<a");
    expect(updatedText).not.toContain("</a>");
    // className should be hoisted to Link
    expect(updatedText).toContain('className="nav"');
    // The text content should remain
    expect(updatedText).toContain("About");
    // Link should still have href
    expect(updatedText).toContain('href="/about"');
  });

  it("removes nested <a> without props", () => {
    const file = createSourceFile(`
      import Link from "next/link";

      export default function Nav() {
        return <Link href="/about"><a>About</a></Link>;
      }
    `);

    const violations = nextLinkNoNestedARule.scan(file);
    expect(violations).toHaveLength(1);

    applyNextLinkNoNestedAFix(file, violations[0]);

    const updatedText = file.getFullText();
    expect(updatedText).not.toContain("<a>");
    expect(updatedText).not.toContain("</a>");
    expect(updatedText).toContain("About");
  });

  it("does not hoist href from <a> to Link", () => {
    const file = createSourceFile(`
      import Link from "next/link";

      export default function Nav() {
        return <Link href="/about"><a href="/other" className="link">About</a></Link>;
      }
    `);

    const violations = nextLinkNoNestedARule.scan(file);
    expect(violations).toHaveLength(1);

    applyNextLinkNoNestedAFix(file, violations[0]);

    const updatedText = file.getFullText();
    // href should remain as "/about" on Link, not get "/other" added
    expect(updatedText).toContain('href="/about"');
    expect(updatedText).not.toContain('href="/other"');
    // className should be hoisted
    expect(updatedText).toContain('className="link"');
  });

  it("produces no violations after fix is applied", () => {
    const file = createSourceFile(`
      import Link from "next/link";

      export default function Nav() {
        return <Link href="/about"><a className="nav">About</a></Link>;
      }
    `);

    const violations = nextLinkNoNestedARule.scan(file);
    expect(violations).toHaveLength(1);

    applyNextLinkNoNestedAFix(file, violations[0]);

    const postFixViolations = nextLinkNoNestedARule.scan(file);
    expect(postFixViolations).toHaveLength(0);
  });

  it("hoists multiple props from <a> to Link", () => {
    const file = createSourceFile(`
      import Link from "next/link";

      export default function Nav() {
        return <Link href="/about"><a className="nav" id="about-link">About</a></Link>;
      }
    `);

    const violations = nextLinkNoNestedARule.scan(file);
    expect(violations).toHaveLength(1);

    applyNextLinkNoNestedAFix(file, violations[0]);

    const updatedText = file.getFullText();
    expect(updatedText).toContain('className="nav"');
    expect(updatedText).toContain('id="about-link"');
    expect(updatedText).not.toContain("<a");
  });
});
