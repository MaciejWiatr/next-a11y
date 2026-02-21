import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";
import { nextMetadataTitleRule } from "./next-metadata-title.rule.js";
import { applyFix } from "../../apply/apply.js";

function createSourceFile(code: string, filePath = "/app/page.tsx") {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { jsx: 2 /* JsxEmit.React */ },
  });
  return project.createSourceFile(filePath, code);
}

describe("nextMetadataTitleRule", () => {
  it("reports a violation for page.tsx without metadata export", async () => {
    const file = createSourceFile(`
      export default function Home() {
        return <div>Hello</div>;
      }
    `);

    const violations = nextMetadataTitleRule.scan(file);

    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("next-metadata-title");
    expect(violations[0].message).toContain("metadata.title");
    expect(violations[0].fix).toBeDefined();
    expect(violations[0].fix!.type).toBe("insert-metadata");
    const value = await (violations[0].fix!.value as () => Promise<string>)();
    expect(value).toBe("Home");
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

  it("does not report when metadata has title with type annotation", () => {
    const file = createSourceFile(`
      import type { Metadata } from "next";
      export const metadata: Metadata = { title: 'Home', description: 'Welcome' };
      export default function Home() { return <div>Hello</div>; }
    `);
    const violations = nextMetadataTitleRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("reports violation when generateMetadata is not exported", () => {
    const file = createSourceFile(`
      function generateMetadata() { return { title: 'Home' }; }
      export default function Home() { return <div>Hello</div>; }
    `);
    const violations = nextMetadataTitleRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("reports violation when metadata is not exported", () => {
    const file = createSourceFile(`
      const metadata = { title: 'Home' };
      export default function Home() { return <div>Hello</div>; }
    `);
    const violations = nextMetadataTitleRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("does not check route group page files like (auth)/page.tsx", () => {
    const file = createSourceFile(`
      export default function Login() { return <div>Login</div>; }
    `, "/app/(auth)/page.tsx");
    const violations = nextMetadataTitleRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("does not check dynamic route page files like [id]/page.tsx", () => {
    const file = createSourceFile(`
      export default function Detail() { return <div>Detail</div>; }
    `, "/app/posts/[id]/page.tsx");
    const violations = nextMetadataTitleRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("provides heuristic fix from route for about page", async () => {
    const file = createSourceFile(
      `export default function About() { return <div>About</div>; }`,
      "/app/about/page.tsx"
    );
    const violations = nextMetadataTitleRule.scan(file);
    expect(violations).toHaveLength(1);
    const value = await (violations[0].fix!.value as () => Promise<string>)();
    expect(value).toBe("About");
  });

  it("provides heuristic fix for metadata without title", async () => {
    const file = createSourceFile(`
      export const metadata = { description: 'A page' };
      export default function Contact() { return <div>Contact</div>; }
    `, "/app/contact/page.tsx");
    const violations = nextMetadataTitleRule.scan(file);
    expect(violations).toHaveLength(1);
    const value = await (violations[0].fix!.value as () => Promise<string>)();
    expect(value).toBe("Contact");
  });

  it("applies fix by inserting metadata export when none exists", async () => {
    const file = createSourceFile(`
      export default function Home() {
        return <div>Hello</div>;
      }
    `);
    const violations = nextMetadataTitleRule.scan(file);
    expect(violations).toHaveLength(1);
    violations[0].fix!.value = "Home";
    const applied = await applyFix(file, violations[0]);
    expect(applied).toBe(true);
    const text = file.getFullText();
    expect(text).toContain("export const metadata = { title: \"Home\" }");
    const postFixViolations = nextMetadataTitleRule.scan(file);
    expect(postFixViolations).toHaveLength(0);
  });

  it("applies fix by adding title to existing metadata object", async () => {
    const file = createSourceFile(`
      export const metadata = { description: 'A page' };
      export default function Settings() { return <div>Settings</div>; }
    `, "/app/settings/page.tsx");
    const violations = nextMetadataTitleRule.scan(file);
    expect(violations).toHaveLength(1);
    violations[0].fix!.value = "Settings";
    const applied = await applyFix(file, violations[0]);
    expect(applied).toBe(true);
    const text = file.getFullText();
    expect(text).toContain("title: \"Settings\"");
    expect(text).toContain("description: 'A page'");
    const postFixViolations = nextMetadataTitleRule.scan(file);
    expect(postFixViolations).toHaveLength(0);
  });
});
