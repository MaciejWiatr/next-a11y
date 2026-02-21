import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";
import { createImgAltRule } from "./img-alt.rule.js";

const imgAltRule = createImgAltRule({ fillAlt: false });
import { classifyAlt } from "./img-alt.classify.js";

function createFile(code: string, fileName = "test.tsx") {
  const project = new Project({ useInMemoryFileSystem: true });
  return project.createSourceFile(fileName, code);
}

describe("img-alt rule", () => {
  it("detects missing alt on <img>", () => {
    const file = createFile(`<img src="/hero.png" />`);
    const violations = imgAltRule.scan(file);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("img-alt");
    expect(violations[0].message).toContain("missing");
  });

  it("detects meaningless alt on <img>", () => {
    const file = createFile(`<img src="/hero.png" alt="image" />`);
    const violations = imgAltRule.scan(file);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain("meaningless");
  });

  it("detects filename as alt", () => {
    const file = createFile(`<img src="/hero.png" alt="IMG_4232.jpg" />`);
    const violations = imgAltRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("skips decorative images (alt='')", () => {
    const file = createFile(`<img src="/spacer.png" alt="" />`);
    const violations = imgAltRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("skips valid alt text", () => {
    const file = createFile(
      `<img src="/hero.png" alt="Dashboard showing active tenders" />`
    );
    const violations = imgAltRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("skips dynamic function call expressions (i18n)", () => {
    const file = createFile(`<img src="/hero.png" alt={t('hero.alt')} />`);
    const violations = imgAltRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("skips dynamic ternary expressions", () => {
    const file = createFile(`<img src="/hero.png" alt={isActive ? "Active" : "Inactive"} />`);
    const violations = imgAltRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("skips dynamic alt in array render (.map)", () => {
    const file = createFile([
      "const items = [{ src: '/a.png', alt: 'A' }];",
      "<div>{items.map((item) => <img src={item.src} alt={item.alt} />)}</div>",
    ].join("\n"));
    const violations = imgAltRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("flags standalone dynamic variable alt as warning", () => {
    const file = createFile(`<img src="/hero.png" alt={heroAlt} />`);
    const violations = imgAltRule.scan(file);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain("unverifiable");
    expect(violations[0].fix).toBeUndefined();
  });

  it("flags standalone dynamic property access alt as warning", () => {
    const file = createFile(`<img src="/hero.png" alt={data.title} />`);
    const violations = imgAltRule.scan(file);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain("unverifiable");
    expect(violations[0].fix).toBeUndefined();
  });

  it("detects missing alt on next/image Image", () => {
    const file = createFile(
      `import Image from "next/image";\n<Image src="/hero.png" />`
    );
    const violations = imgAltRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("skips Image not from next/image", () => {
    const file = createFile(
      `import { Image } from "my-ui-lib";\n<Image src="/hero.png" />`
    );
    const violations = imgAltRule.scan(file);
    expect(violations).toHaveLength(0);
  });
});

describe("classifyAlt", () => {
  it("classifies missing alt", () => {
    expect(classifyAlt(undefined, false)).toBe("missing");
    expect(classifyAlt(null, false)).toBe("missing");
  });

  it("classifies empty alt as decorative", () => {
    expect(classifyAlt("", false)).toBe("decorative");
  });

  it("classifies dynamic expressions", () => {
    expect(classifyAlt("someVar", true)).toBe("dynamic");
  });

  it("classifies meaningless alt", () => {
    expect(classifyAlt("image", false)).toBe("meaningless");
    expect(classifyAlt("photo", false)).toBe("meaningless");
    expect(classifyAlt("IMG_4232.jpg", false)).toBe("meaningless");
    expect(classifyAlt("screenshot.png", false)).toBe("meaningless");
  });

  it("classifies valid alt", () => {
    expect(classifyAlt("Dashboard showing active tenders", false)).toBe("valid");
    expect(classifyAlt("Company logo", false)).toBe("valid");
  });
});
