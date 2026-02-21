import { describe, it, expect } from "vitest";
import { Project } from "ts-morph";
import { nextImageSizesRule } from "./next-image-sizes.rule.js";

function createSourceFile(code: string, filePath = "/app/page.tsx") {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { jsx: 2 /* JsxEmit.React */ },
  });
  return project.createSourceFile(filePath, code);
}

describe("nextImageSizesRule", () => {
  it("reports a violation for <Image fill> without sizes (imported from next/image)", () => {
    const file = createSourceFile(`
      import Image from "next/image";

      export default function Hero() {
        return <Image fill src="/hero.png" />;
      }
    `);

    const violations = nextImageSizesRule.scan(file);

    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("next-image-sizes");
    expect(violations[0].element).toBe("<Image>");
    expect(violations[0].message).toContain("sizes");
    expect(violations[0].fix).toBeUndefined();
  });

  it("does not report a violation for <Image fill sizes=...>", () => {
    const file = createSourceFile(`
      import Image from "next/image";

      export default function Hero() {
        return <Image fill sizes="100vw" src="/hero.png" />;
      }
    `);

    const violations = nextImageSizesRule.scan(file);

    expect(violations).toHaveLength(0);
  });

  it("does not report a violation for <Image> without fill (using width/height)", () => {
    const file = createSourceFile(`
      import Image from "next/image";

      export default function Hero() {
        return <Image src="/hero.png" width={500} height={300} />;
      }
    `);

    const violations = nextImageSizesRule.scan(file);

    expect(violations).toHaveLength(0);
  });

  it("does not report when Image is not imported from next/image", () => {
    const file = createSourceFile(`
      import Image from "my-custom-image";

      export default function Hero() {
        return <Image fill src="/hero.png" />;
      }
    `);

    const violations = nextImageSizesRule.scan(file);

    expect(violations).toHaveLength(0);
  });

  it("reports a violation for <Image fill={true}> without sizes", () => {
    const file = createSourceFile(`
      import Image from "next/image";

      export default function Hero() {
        return <Image fill={true} src="/hero.png" />;
      }
    `);

    const violations = nextImageSizesRule.scan(file);

    expect(violations).toHaveLength(1);
  });

  it("does not report for <Image fill={false}>", () => {
    const file = createSourceFile(`
      import Image from "next/image";

      export default function Hero() {
        return <Image fill={false} src="/hero.png" width={500} height={300} />;
      }
    `);

    const violations = nextImageSizesRule.scan(file);

    expect(violations).toHaveLength(0);
  });

  it("reports multiple violations for multiple <Image fill> without sizes", () => {
    const file = createSourceFile(`
      import Image from "next/image";

      export default function Gallery() {
        return (
          <div>
            <Image fill src="/a.png" />
            <Image fill src="/b.png" />
            <Image fill sizes="50vw" src="/c.png" />
          </div>
        );
      }
    `);

    const violations = nextImageSizesRule.scan(file);

    expect(violations).toHaveLength(2);
  });

  it("handles opening element <Image fill>...</Image>", () => {
    const file = createSourceFile(`
      import Image from "next/image";

      export default function Hero() {
        return <Image fill src="/hero.png">child</Image>;
      }
    `);

    const violations = nextImageSizesRule.scan(file);

    expect(violations).toHaveLength(1);
  });

  it("works with named import of Image", () => {
    const file = createSourceFile(`
      import { Image } from "next/image";
      export default function Hero() {
        return <Image fill src="/hero.png" />;
      }
    `);
    const violations = nextImageSizesRule.scan(file);
    expect(violations).toHaveLength(1);
  });

  it("does not report for Image without any import", () => {
    const file = createSourceFile(`
      export default function Hero() {
        return <Image fill src="/hero.png" />;
      }
    `);
    const violations = nextImageSizesRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("does not report for img element (lowercase)", () => {
    const file = createSourceFile(`
      import Image from "next/image";
      export default function Hero() {
        return <img src="/hero.png" />;
      }
    `);
    const violations = nextImageSizesRule.scan(file);
    expect(violations).toHaveLength(0);
  });

  it("does not report for Image with sizes as expression", () => {
    const file = createSourceFile(`
      import Image from "next/image";
      export default function Hero() {
        return <Image fill sizes={responsiveSizes} src="/hero.png" />;
      }
    `);
    const violations = nextImageSizesRule.scan(file);
    expect(violations).toHaveLength(0);
  });
});
