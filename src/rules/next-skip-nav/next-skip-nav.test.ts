import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";
import { nextSkipNavRule } from "./next-skip-nav.rule.js";

function createSourceFile(code: string, filePath = "/app/layout.tsx") {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { jsx: 2 /* JsxEmit.React */ },
  });
  return project.createSourceFile(filePath, code);
}

describe("nextSkipNavRule", () => {
  it("reports a violation for layout.tsx without a skip link", () => {
    const file = createSourceFile(`
      export default function RootLayout({ children }: { children: React.ReactNode }) {
        return (
          <html lang="en">
            <body>{children}</body>
          </html>
        );
      }
    `);

    const violations = nextSkipNavRule.scan(file);

    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("next-skip-nav");
    expect(violations[0].message).toContain("skip navigation link");
    expect(violations[0].fix).toBeUndefined();
  });

  it("does not report a violation when <a href=\"#main-content\"> is present", () => {
    const file = createSourceFile(`
      export default function RootLayout({ children }: { children: React.ReactNode }) {
        return (
          <html lang="en">
            <body>
              <a href="#main-content">Skip to content</a>
              {children}
            </body>
          </html>
        );
      }
    `);

    const violations = nextSkipNavRule.scan(file);

    expect(violations).toHaveLength(0);
  });

  it("does not report a violation when an <a> element contains 'skip' in text", () => {
    const file = createSourceFile(`
      export default function RootLayout({ children }: { children: React.ReactNode }) {
        return (
          <html lang="en">
            <body>
              <a href="#content">Skip navigation</a>
              {children}
            </body>
          </html>
        );
      }
    `);

    const violations = nextSkipNavRule.scan(file);

    expect(violations).toHaveLength(0);
  });

  it("does not report a violation for non-layout files", () => {
    const file = createSourceFile(
      `
      export default function Page() {
        return <div>Hello</div>;
      }
    `,
      "/app/page.tsx",
    );

    const violations = nextSkipNavRule.scan(file);

    expect(violations).toHaveLength(0);
  });

  it("does not report a violation for non-layout component files", () => {
    const file = createSourceFile(
      `
      export default function Component() {
        return <div>Hello</div>;
      }
    `,
      "/app/components/header.tsx",
    );

    const violations = nextSkipNavRule.scan(file);

    expect(violations).toHaveLength(0);
  });

  it("works with layout.jsx files", () => {
    const file = createSourceFile(
      `
      export default function RootLayout({ children }) {
        return (
          <html lang="en">
            <body>{children}</body>
          </html>
        );
      }
    `,
      "/app/layout.jsx",
    );

    const violations = nextSkipNavRule.scan(file);

    expect(violations).toHaveLength(1);
  });

  it("handles case-insensitive 'Skip' text", () => {
    const file = createSourceFile(`
      export default function RootLayout({ children }: { children: React.ReactNode }) {
        return (
          <html lang="en">
            <body>
              <a href="#main">Skip to main content</a>
              {children}
            </body>
          </html>
        );
      }
    `);

    const violations = nextSkipNavRule.scan(file);

    expect(violations).toHaveLength(0);
  });

  it("reports violation for nested layout paths", () => {
    const file = createSourceFile(
      `
      export default function Layout({ children }: { children: React.ReactNode }) {
        return <div>{children}</div>;
      }
    `,
      "/app/dashboard/layout.tsx",
    );
    const violations = nextSkipNavRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("does not report for layout with self-closing skip link", () => {
    const file = createSourceFile(`
      export default function RootLayout({ children }: { children: React.ReactNode }) {
        return (
          <html lang="en">
            <body>
              <a href="#main-content" />
              {children}
            </body>
          </html>
        );
      }
    `);
    const violations = nextSkipNavRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("does not report for layout.ts files (not .tsx/.jsx)", () => {
    const file = createSourceFile(
      `export default function Layout() { return null; }`,
      "/app/layout.ts",
    );
    const violations = nextSkipNavRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("handles layout in locale segment path", () => {
    const file = createSourceFile(
      `
      export default function Layout({ children }: { children: React.ReactNode }) {
        return (
          <html lang="en">
            <body>{children}</body>
          </html>
        );
      }
    `,
      "/app/[locale]/layout.tsx",
    );
    const violations = nextSkipNavRule.scan(file);
    expect(violations).toHaveLength(1);
  });
});
