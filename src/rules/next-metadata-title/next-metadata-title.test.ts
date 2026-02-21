import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";
import { nextMetadataTitleRule } from "./next-metadata-title.rule.js";

function createSourceFile(code: string, filePath = "/app/page.tsx") {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { jsx: 2 /* JsxEmit.React */ },
  });
  return project.createSourceFile(filePath, code);
}

describe("nextMetadataTitleRule", () => {
  it("reports a violation for page.tsx without metadata export", () => {
    const file = createSourceFile(`
      export default function Home() {
        return <div>Hello</div>;
      }
    `);

    const violations = nextMetadataTitleRule.scan(file);

    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("next-metadata-title");
    expect(violations[0].message).toContain("metadata.title");
    expect(violations[0].fix).toBeUndefined();
  });

  it("does not report a violation when export const metadata has title", () => {
    const file = createSourceFile(`
      export const metadata = { title: 'Home' };

      export default function Home() {
        return <div>Hello</div>;
      }
    `);

    const violations = nextMetadataTitleRule.scan(file);

    expect(violations).toHaveLength(0);
  });

  it("does not report a violation when export function generateMetadata exists", () => {
    const file = createSourceFile(`
      export function generateMetadata() {
        return { title: 'Home' };
      }

      export default function Home() {
        return <div>Hello</div>;
      }
    `);

    const violations = nextMetadataTitleRule.scan(file);

    expect(violations).toHaveLength(0);
  });

  it("does not report a violation when export async function generateMetadata exists", () => {
    const file = createSourceFile(`
      export async function generateMetadata() {
        return { title: 'Home' };
      }

      export default function Home() {
        return <div>Hello</div>;
      }
    `);

    const violations = nextMetadataTitleRule.scan(file);

    expect(violations).toHaveLength(0);
  });

  it("does not report a violation for non-page files", () => {
    const file = createSourceFile(
      `
      export default function Component() {
        return <div>Hello</div>;
      }
    `,
      "/app/components/component.tsx",
    );

    const violations = nextMetadataTitleRule.scan(file);

    expect(violations).toHaveLength(0);
  });

  it("does not check layout files", () => {
    const file = createSourceFile(
      `
      export default function Layout({ children }: { children: React.ReactNode }) {
        return <div>{children}</div>;
      }
    `,
      "/app/layout.tsx",
    );

    const violations = nextMetadataTitleRule.scan(file);

    expect(violations).toHaveLength(0);
  });

  it("works with page.jsx files", () => {
    const file = createSourceFile(
      `
      export default function Home() {
        return <div>Hello</div>;
      }
    `,
      "/app/page.jsx",
    );

    const violations = nextMetadataTitleRule.scan(file);

    expect(violations).toHaveLength(1);
  });

  it("works with page.ts files", () => {
    const file = createSourceFile(
      `
      export default function Home() {
        return null;
      }
    `,
      "/app/page.ts",
    );

    const violations = nextMetadataTitleRule.scan(file);

    expect(violations).toHaveLength(1);
  });

  it("works with page.js files", () => {
    const file = createSourceFile(
      `
      export default function Home() {
        return null;
      }
    `,
      "/app/page.js",
    );

    const violations = nextMetadataTitleRule.scan(file);

    expect(violations).toHaveLength(1);
  });

  it("reports a violation when metadata export has no title property", () => {
    const file = createSourceFile(`
      export const metadata = { description: 'A page' };

      export default function Home() {
        return <div>Hello</div>;
      }
    `);

    const violations = nextMetadataTitleRule.scan(file);

    expect(violations).toHaveLength(1);
  });
});
