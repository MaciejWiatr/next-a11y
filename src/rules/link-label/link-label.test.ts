import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";
import { linkLabelRule } from "./link-label.rule.js";

function createFile(code: string) {
  const project = new Project({ useInMemoryFileSystem: true });
  return project.createSourceFile("test.tsx", code);
}

describe("link-label rule", () => {
  it("detects link with only icon child", () => {
    const file = createFile(
      `<a href="/settings"><SettingsIcon /></a>`
    );
    const violations = linkLabelRule.scan(file);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("link-label");
  });

  it("skips link with text content", () => {
    const file = createFile(`<a href="/about">About us</a>`);
    const violations = linkLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("skips link with aria-label", () => {
    const file = createFile(
      `<a href="/settings" aria-label="Settings"><SettingsIcon /></a>`
    );
    const violations = linkLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("detects next/link with only icon", () => {
    const file = createFile(
      `import Link from "next/link";\n<Link href="/settings"><SettingsIcon /></Link>`
    );
    const violations = linkLabelRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("skips non-next/link Link component", () => {
    const file = createFile(
      `import { Link } from "react-router";\n<Link to="/settings"><SettingsIcon /></Link>`
    );
    const violations = linkLabelRule.scan(file);
    expect(violations).toHaveLength(0);
  });
});
