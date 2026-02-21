import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Project } from "ts-morph";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  resolveImageSource,
  resolveStaticImportPath,
  _isImagePath,
  _findProjectRootFromFile,
  _resolvePathAlias,
  _followReExport,
  _resolveModulePath,
  _resolveModuleToImage,
} from "./img-alt.resolve.js";

// ── Test fixtures ──────────────────────────────────────────

let tmpDir: string;
let publicDir: string;
let dataDir: string;
let sharedProject: Project;
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "a11y-resolve-test-"));
  publicDir = path.join(tmpDir, "public");
  dataDir = path.join(tmpDir, "data");

  fs.mkdirSync(publicDir);
  fs.mkdirSync(dataDir);
  fs.mkdirSync(path.join(tmpDir, "components"));

  // Create test image files
  fs.writeFileSync(path.join(publicDir, "hero.jpg"), PNG_HEADER);
  fs.writeFileSync(path.join(publicDir, "product.png"), PNG_HEADER);
  fs.writeFileSync(path.join(publicDir, "logo.svg"), "<svg></svg>");

  // Create barrel re-export file
  fs.writeFileSync(
    path.join(dataDir, "images.ts"),
    [
      'export { default as img_hero } from "../public/hero.jpg"',
      'export { default as img_product } from "../public/product.png"',
      'export { default as img_logo } from "../public/logo.svg"',
    ].join("\n")
  );

  // Create package.json (so findProjectRoot stops here)
  fs.writeFileSync(path.join(tmpDir, "package.json"), "{}");

  // Create tsconfig with path aliases
  fs.writeFileSync(
    path.join(tmpDir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        paths: {
          "@/*": ["./*"],
          "~/images": ["./public"],
        },
      },
    })
  );

  // Shared project that loads the tsconfig (used by resolvePathAlias tests)
  sharedProject = new Project({
    tsConfigFilePath: path.join(tmpDir, "tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { jsx: 4, allowJs: true, noEmit: true },
  });
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function createFile(code: string, filePath?: string) {
  if (filePath) {
    // Use sharedProject so the file inherits tsconfig paths
    return sharedProject.createSourceFile(filePath, code, { overwrite: true });
  }
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { jsx: 4, allowJs: true, noEmit: true },
  });
  return project.createSourceFile("test.tsx", code);
}

// ── isImagePath ────────────────────────────────────────────

describe("isImagePath", () => {
  it("recognizes image extensions", () => {
    expect(_isImagePath("hero.jpg")).toBe(true);
    expect(_isImagePath("hero.jpeg")).toBe(true);
    expect(_isImagePath("hero.png")).toBe(true);
    expect(_isImagePath("hero.webp")).toBe(true);
    expect(_isImagePath("hero.gif")).toBe(true);
    expect(_isImagePath("hero.svg")).toBe(true);
    expect(_isImagePath("hero.avif")).toBe(true);
  });

  it("rejects non-image extensions", () => {
    expect(_isImagePath("data.json")).toBe(false);
    expect(_isImagePath("module.ts")).toBe(false);
    expect(_isImagePath("index.tsx")).toBe(false);
    expect(_isImagePath("styles.css")).toBe(false);
    expect(_isImagePath("noextension")).toBe(false);
  });

  it("works with full paths", () => {
    expect(_isImagePath("/Users/me/project/public/hero.jpg")).toBe(true);
    expect(_isImagePath("./images/hero.png")).toBe(true);
    expect(_isImagePath("../public/logo.svg")).toBe(true);
  });
});

// ── findProjectRootFromFile ────────────────────────────────

describe("findProjectRootFromFile", () => {
  it("finds project root by package.json", () => {
    const filePath = path.join(tmpDir, "components", "Gallery.tsx");
    const root = _findProjectRootFromFile(filePath);
    expect(root).toBe(tmpDir);
  });

  it("returns file dir when no package.json found", () => {
    const filePath = "/nonexistent/deep/path/file.tsx";
    const root = _findProjectRootFromFile(filePath);
    expect(root).toBe("/nonexistent/deep/path");
  });
});

// ── resolvePathAlias ───────────────────────────────────────
// Note: tsconfig parsing edge cases (comments, trailing commas) are handled
// by ts-morph/TypeScript internally and no longer need dedicated tests.

describe("resolvePathAlias", () => {
  it("resolves wildcard path alias @/*", () => {
    const result = _resolvePathAlias("@/data/images", tmpDir, sharedProject);
    expect(result).toBe(path.join(tmpDir, "data/images"));
  });

  it("resolves exact-match path alias", () => {
    const result = _resolvePathAlias("~/images", tmpDir, sharedProject);
    expect(result).toBe(path.join(tmpDir, "public"));
  });

  it("returns undefined for unmatched specifier", () => {
    const result = _resolvePathAlias("lodash/merge", tmpDir, sharedProject);
    expect(result).toBeUndefined();
  });

  it("returns undefined when no project provided", () => {
    const result = _resolvePathAlias("@/foo", tmpDir);
    expect(result).toBeUndefined();
  });

  it("respects baseUrl", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "a11y-alias-base-"));
    fs.mkdirSync(path.join(dir, "src"));
    fs.writeFileSync(
      path.join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          baseUrl: "./src",
          paths: { "@/*": ["./*"] },
        },
      })
    );
    const project = new Project({
      tsConfigFilePath: path.join(dir, "tsconfig.json"),
      skipAddingFilesFromTsConfig: true,
    });
    const result = _resolvePathAlias("@/utils", dir, project);
    expect(result).toBe(path.join(dir, "src", "utils"));
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ── followReExport ─────────────────────────────────────────

describe("followReExport", () => {
  it("follows default-as re-export", () => {
    const barrelPath = path.join(dataDir, "images.ts");
    const result = _followReExport(barrelPath, "img_hero");
    expect(result).toBe(path.join(publicDir, "hero.jpg"));
  });

  it("follows another named re-export", () => {
    const barrelPath = path.join(dataDir, "images.ts");
    const result = _followReExport(barrelPath, "img_product");
    expect(result).toBe(path.join(publicDir, "product.png"));
  });

  it("returns undefined for unmatched export name", () => {
    const barrelPath = path.join(dataDir, "images.ts");
    const result = _followReExport(barrelPath, "img_missing");
    expect(result).toBeUndefined();
  });

  it("returns undefined for non-image re-export", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "a11y-barrel-"));
    fs.writeFileSync(
      path.join(dir, "barrel.ts"),
      'export { default as myUtil } from "./util"'
    );
    const result = _followReExport(path.join(dir, "barrel.ts"), "myUtil");
    expect(result).toBeUndefined();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("returns undefined when barrel file does not exist", () => {
    const result = _followReExport("/nonexistent/barrel.ts", "img_hero");
    expect(result).toBeUndefined();
  });

  it("handles plain named re-export (without default as)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "a11y-barrel-plain-"));
    fs.writeFileSync(
      path.join(dir, "barrel.ts"),
      'export { heroImage } from "./hero.jpg"'
    );
    const result = _followReExport(path.join(dir, "barrel.ts"), "heroImage");
    expect(result).toBe(path.join(dir, "hero.jpg"));
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ── resolveModulePath ──────────────────────────────────────

describe("resolveModulePath", () => {
  it("resolves relative path to existing image", () => {
    const fromFile = path.join(tmpDir, "components", "Gallery.tsx");
    const result = _resolveModulePath("../public/hero.jpg", fromFile, tmpDir, sharedProject);
    expect(result).toBe(path.join(publicDir, "hero.jpg"));
  });

  it("resolves relative path with extension probing (.ts)", () => {
    const fromFile = path.join(tmpDir, "components", "Gallery.tsx");
    const result = _resolveModulePath("../data/images", fromFile, tmpDir, sharedProject);
    expect(result).toBe(path.join(dataDir, "images.ts"));
  });

  it("resolves path alias to file", () => {
    const fromFile = path.join(tmpDir, "components", "Gallery.tsx");
    const result = _resolveModulePath("@/data/images", fromFile, tmpDir, sharedProject);
    expect(result).toBe(path.join(dataDir, "images.ts"));
  });

  it("resolves directory with index file", () => {
    const indexDir = path.join(tmpDir, "lib");
    fs.mkdirSync(indexDir, { recursive: true });
    fs.writeFileSync(path.join(indexDir, "index.ts"), "export {}");

    const fromFile = path.join(tmpDir, "components", "Gallery.tsx");
    const result = _resolveModulePath("../lib", fromFile, tmpDir, sharedProject);
    expect(result).toBe(path.join(indexDir, "index.ts"));

    fs.rmSync(indexDir, { recursive: true, force: true });
  });

  it("returns undefined for unresolvable module", () => {
    const fromFile = path.join(tmpDir, "components", "Gallery.tsx");
    const result = _resolveModulePath("react", fromFile, tmpDir, sharedProject);
    expect(result).toBeUndefined();
  });
});

// ── resolveModuleToImage ───────────────────────────────────

describe("resolveModuleToImage", () => {
  it("resolves direct image import", () => {
    const fromFile = path.join(tmpDir, "components", "Gallery.tsx");
    const result = _resolveModuleToImage("../public/hero.jpg", fromFile, tmpDir, undefined, sharedProject);
    expect(result).toBe(path.join(publicDir, "hero.jpg"));
  });

  it("follows barrel re-export for named import", () => {
    const fromFile = path.join(tmpDir, "components", "Gallery.tsx");
    const result = _resolveModuleToImage("../data/images", fromFile, tmpDir, "img_hero", sharedProject);
    expect(result).toBe(path.join(publicDir, "hero.jpg"));
  });

  it("follows barrel re-export with path alias", () => {
    const fromFile = path.join(tmpDir, "components", "Gallery.tsx");
    const result = _resolveModuleToImage("@/data/images", fromFile, tmpDir, "img_product", sharedProject);
    expect(result).toBe(path.join(publicDir, "product.png"));
  });

  it("returns undefined for non-image module without namedExport", () => {
    const fromFile = path.join(tmpDir, "components", "Gallery.tsx");
    const result = _resolveModuleToImage("../data/images", fromFile, tmpDir, undefined, sharedProject);
    expect(result).toBeUndefined();
  });

  it("returns undefined when barrel has no matching export", () => {
    const fromFile = path.join(tmpDir, "components", "Gallery.tsx");
    const result = _resolveModuleToImage("@/data/images", fromFile, tmpDir, "img_missing", sharedProject);
    expect(result).toBeUndefined();
  });
});

// ── resolveStaticImportPath ────────────────────────────────

describe("resolveStaticImportPath", () => {
  it("resolves default import of image file", () => {
    const file = createFile(
      `import heroImg from "../public/hero.jpg";\n<img src={heroImg} />`,
      path.join(tmpDir, "components", "Test.tsx")
    );
    const result = resolveStaticImportPath("heroImg", file, tmpDir);
    expect(result).toBe(path.join(publicDir, "hero.jpg"));
  });

  it("strips .src suffix before resolving", () => {
    const file = createFile(
      `import heroImg from "../public/hero.jpg";\n<img src={heroImg.src} />`,
      path.join(tmpDir, "components", "Test.tsx")
    );
    const result = resolveStaticImportPath("heroImg.src", file, tmpDir);
    expect(result).toBe(path.join(publicDir, "hero.jpg"));
  });

  it("resolves named import from barrel file", () => {
    const file = createFile(
      `import { img_hero } from "../data/images";\n<img src={img_hero.src} />`,
      path.join(tmpDir, "components", "Test.tsx")
    );
    const result = resolveStaticImportPath("img_hero.src", file, tmpDir);
    expect(result).toBe(path.join(publicDir, "hero.jpg"));
  });

  it("resolves named import via path alias", () => {
    const file = createFile(
      `import { img_product } from "@/data/images";\n<img src={img_product.src} />`,
      path.join(tmpDir, "components", "Test.tsx")
    );
    const result = resolveStaticImportPath("img_product.src", file, tmpDir);
    expect(result).toBe(path.join(publicDir, "product.png"));
  });

  it("resolves aliased named import", () => {
    const file = createFile(
      `import { img_hero as hero } from "../data/images";\n<img src={hero.src} />`,
      path.join(tmpDir, "components", "Test.tsx")
    );
    const result = resolveStaticImportPath("hero.src", file, tmpDir);
    expect(result).toBe(path.join(publicDir, "hero.jpg"));
  });

  it("returns undefined for dynamic patterns with brackets", () => {
    const file = createFile(
      `import { imgs } from "./data";\n<img src={imgs[key].src} />`,
      path.join(tmpDir, "components", "Test.tsx")
    );
    const result = resolveStaticImportPath("imgs[key].src", file, tmpDir);
    expect(result).toBeUndefined();
  });

  it("returns undefined for function calls", () => {
    const file = createFile(
      `import { getImage } from "./utils";\n<img src={getImage().src} />`,
      path.join(tmpDir, "components", "Test.tsx")
    );
    const result = resolveStaticImportPath("getImage().src", file, tmpDir);
    expect(result).toBeUndefined();
  });

  it("returns undefined for unmatched import name", () => {
    const file = createFile(
      `import heroImg from "../public/hero.jpg";\n<img src={otherImg} />`,
      path.join(tmpDir, "components", "Test.tsx")
    );
    const result = resolveStaticImportPath("otherImg", file, tmpDir);
    expect(result).toBeUndefined();
  });
});

// ── resolveImageSource ─────────────────────────────────────

describe("resolveImageSource", () => {
  it("resolves absolute path to existing image", async () => {
    const absPath = path.join(publicDir, "hero.jpg");
    const file = createFile("<img />", path.join(tmpDir, "components", "Test.tsx"));
    const result = await resolveImageSource(absPath, file, tmpDir);
    expect(result.type).toBe("file");
    if (result.type === "file") {
      expect(result.path).toBe(absPath);
      expect(result.buffer.length).toBe(PNG_HEADER.length);
    }
  });

  it("resolves public-relative path /hero.jpg", async () => {
    const file = createFile("<img />", path.join(tmpDir, "components", "Test.tsx"));
    const result = await resolveImageSource("/hero.jpg", file, tmpDir);
    expect(result.type).toBe("file");
    if (result.type === "file") {
      expect(result.path).toBe(path.join(publicDir, "hero.jpg"));
    }
  });

  it("falls back to public path for short absolute-looking paths", async () => {
    // /hero.jpg is technically path.isAbsolute but doesn't exist as an abs file
    // so it falls through to the public path check
    const file = createFile("<img />", path.join(tmpDir, "components", "Test.tsx"));
    const result = await resolveImageSource("/product.png", file, tmpDir);
    expect(result.type).toBe("file");
    if (result.type === "file") {
      expect(result.path).toBe(path.join(publicDir, "product.png"));
    }
  });

  it("returns unresolvable for missing public path", async () => {
    const file = createFile("<img />", path.join(tmpDir, "components", "Test.tsx"));
    const result = await resolveImageSource("/missing.jpg", file, tmpDir);
    expect(result.type).toBe("unresolvable");
  });

  it("resolves relative path ./hero.jpg", async () => {
    const file = createFile("<img />", path.join(publicDir, "Test.tsx"));
    const result = await resolveImageSource("./hero.jpg", file, tmpDir);
    expect(result.type).toBe("file");
    if (result.type === "file") {
      expect(result.path).toBe(path.join(publicDir, "hero.jpg"));
    }
  });

  it("returns unresolvable for missing relative path", async () => {
    const file = createFile("<img />", path.join(publicDir, "Test.tsx"));
    const result = await resolveImageSource("./missing.jpg", file, tmpDir);
    expect(result.type).toBe("unresolvable");
    if (result.type === "unresolvable") {
      expect(result.reason).toContain("File not found");
    }
  });

  it("returns unresolvable for dynamic source", async () => {
    const file = createFile("<img />", path.join(tmpDir, "components", "Test.tsx"));
    const result = await resolveImageSource("someVariable", file, tmpDir);
    expect(result.type).toBe("unresolvable");
    if (result.type === "unresolvable") {
      expect(result.reason).toBe("Dynamic image source");
    }
  });

  it("prioritizes absolute path over public path", async () => {
    // When resolveStaticImportPath returns an absolute path that exists,
    // it should be used directly (not joined under public/)
    const absPath = path.join(publicDir, "hero.jpg");
    const file = createFile("<img />", path.join(tmpDir, "components", "Test.tsx"));
    const result = await resolveImageSource(absPath, file, tmpDir);
    expect(result.type).toBe("file");
    if (result.type === "file") {
      expect(result.path).toBe(absPath);
    }
  });
});

// ── End-to-end: barrel import + path alias + .src ──────────

describe("end-to-end barrel import resolution", () => {
  it("resolves img_hero.src through @/ alias → barrel → image", () => {
    const file = createFile(
      [
        'import Image from "next/image";',
        'import { img_hero, img_product } from "@/data/images";',
        "",
        "export function Gallery() {",
        "  return <Image src={img_hero.src} />;",
        "}",
      ].join("\n"),
      path.join(tmpDir, "components", "Gallery.tsx")
    );
    const result = resolveStaticImportPath("img_hero.src", file, tmpDir);
    expect(result).toBe(path.join(publicDir, "hero.jpg"));
  });

  it("resolves img_product.src through @/ alias → barrel → image", () => {
    const file = createFile(
      [
        'import { img_product } from "@/data/images";',
        "export function Card() {",
        "  return <img src={img_product.src} />;",
        "}",
      ].join("\n"),
      path.join(tmpDir, "components", "Card.tsx")
    );
    const result = resolveStaticImportPath("img_product.src", file, tmpDir);
    expect(result).toBe(path.join(publicDir, "product.png"));
  });

  it("correctly identifies dynamic access as unresolvable", () => {
    const file = createFile(
      [
        'import { img_hero } from "@/data/images";',
        "const items = { hero: img_hero };",
        "export function G() {",
        '  return <img src={items["hero"].src} />;',
        "}",
      ].join("\n"),
      path.join(tmpDir, "components", "G.tsx")
    );
    const result = resolveStaticImportPath('items["hero"].src', file, tmpDir);
    expect(result).toBeUndefined();
  });
});
