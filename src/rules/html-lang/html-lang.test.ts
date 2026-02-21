import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";
import { htmlLangRule } from "./html-lang.rule.js";
import { applyHtmlLangFix } from "./html-lang.fix.js";

function createSourceFile(code: string, filePath = "/app/layout.tsx") {
  const project = new Project({ useInMemoryFileSystem: true });
  return project.createSourceFile(filePath, code);
}

describe("htmlLangRule", () => {
  it("reports a violation when <html> has no lang attribute", () => {
    const file = createSourceFile(
      `export default function RootLayout() {
  return <html><body>Hello</body></html>;
}`,
    );

    const violations = htmlLangRule.scan(file);

    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("html-lang");
    expect(violations[0].element).toBe("<html>");
    expect(violations[0].fix).toEqual({
      type: "insert-attr",
      attribute: "lang",
      value: "en",
    });
  });

  it("reports no violation when <html> has a lang attribute", () => {
    const file = createSourceFile(
      `export default function RootLayout() {
  return <html lang="en"><body>Hello</body></html>;
}`,
    );

    const violations = htmlLangRule.scan(file);

    expect(violations).toHaveLength(0);
  });

  it("reports no violation for non-layout files", () => {
    const file = createSourceFile(
      `export default function Page() {
  return <html><body>Hello</body></html>;
}`,
      "/app/page.tsx",
    );

    const violations = htmlLangRule.scan(file);

    expect(violations).toHaveLength(0);
  });

  it("reports a violation in _document files", () => {
    const file = createSourceFile(
      `export default function Document() {
  return <html><body>Hello</body></html>;
}`,
      "/pages/_document.tsx",
    );

    const violations = htmlLangRule.scan(file);

    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("html-lang");
  });

  it("reports a violation for self-closing <html /> element", () => {
    const file = createSourceFile(
      `export default function RootLayout() {
  return <html />;
}`,
    );

    const violations = htmlLangRule.scan(file);

    expect(violations).toHaveLength(1);
    expect(violations[0].element).toBe("<html />");
  });

  it("reports no violation for self-closing <html /> with lang", () => {
    const file = createSourceFile(
      `export default function RootLayout() {
  return <html lang="fr" />;
}`,
    );

    const violations = htmlLangRule.scan(file);

    expect(violations).toHaveLength(0);
  });

  it("does not flag other elements without lang", () => {
    const file = createSourceFile(
      `export default function RootLayout() {
  return <html lang="en"><body><div>Content</div></body></html>;
}`,
    );

    const violations = htmlLangRule.scan(file);

    expect(violations).toHaveLength(0);
  });

  it("skips html with dynamic lang attribute", () => {
    const file = createSourceFile(
      `export default function RootLayout() {
  return <html lang={locale}><body>Hello</body></html>;
}`,
    );
    const violations = htmlLangRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("detects html with other attributes but no lang", () => {
    const file = createSourceFile(
      `export default function RootLayout() {
  return <html className="root" dir="ltr"><body>Hello</body></html>;
}`,
    );
    const violations = htmlLangRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("checks nested layout paths like app/[locale]/layout.tsx", () => {
    const file = createSourceFile(
      `export default function Layout() {
  return <html><body>Hello</body></html>;
}`,
      "/app/[locale]/layout.tsx",
    );
    const violations = htmlLangRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("does not flag other elements without lang in layout files", () => {
    const file = createSourceFile(
      `export default function Layout() {
  return <html lang="en"><body><div className="app"><main>Hello</main></div></body></html>;
}`,
    );
    const violations = htmlLangRule.scan(file);
    expect(violations).toHaveLength(0);
  });
});

describe("applyHtmlLangFix", () => {
  it("inserts lang attribute on <html> element", () => {
    const file = createSourceFile(
      `export default function RootLayout() {
  return <html><body>Hello</body></html>;
}`,
    );

    const violations = htmlLangRule.scan(file);
    expect(violations).toHaveLength(1);

    applyHtmlLangFix(file, violations[0]);

    const updatedText = file.getFullText();
    expect(updatedText).toContain('lang="en"');
  });

  it("inserts lang attribute on self-closing <html /> element", () => {
    const file = createSourceFile(
      `export default function RootLayout() {
  return <html />;
}`,
    );

    const violations = htmlLangRule.scan(file);
    expect(violations).toHaveLength(1);

    applyHtmlLangFix(file, violations[0]);

    const updatedText = file.getFullText();
    expect(updatedText).toContain('lang="en"');
  });

  it("uses the fix value from the violation", () => {
    const file = createSourceFile(
      `export default function RootLayout() {
  return <html><body>Hello</body></html>;
}`,
    );

    const violations = htmlLangRule.scan(file);
    expect(violations).toHaveLength(1);

    // Override the fix value to a different locale
    const violation = {
      ...violations[0],
      fix: { type: "insert-attr" as const, attribute: "lang", value: "fr" },
    };

    applyHtmlLangFix(file, violation);

    const updatedText = file.getFullText();
    expect(updatedText).toContain('lang="fr"');
  });

  it("produces valid JSX after fix is applied", () => {
    const file = createSourceFile(
      `export default function RootLayout() {
  return <html><body>Hello</body></html>;
}`,
    );

    const violations = htmlLangRule.scan(file);
    applyHtmlLangFix(file, violations[0]);

    // Re-scan should find no violations
    const postFixViolations = htmlLangRule.scan(file);
    expect(postFixViolations).toHaveLength(0);
  });
});
