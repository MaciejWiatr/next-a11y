import * as fs from "node:fs";
import * as path from "node:path";
import * as https from "node:https";
import * as http from "node:http";
import { SyntaxKind } from "ts-morph";
import type { SourceFile, Project } from "ts-morph";

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif"];

function isImagePath(p: string): boolean {
  return IMAGE_EXTENSIONS.some((ext) => p.endsWith(ext));
}

export type ImageSource =
  | { type: "file"; buffer: Buffer; path: string }
  | { type: "url"; buffer: Buffer; url: string }
  | { type: "unresolvable"; reason: string };

export async function resolveImageSource(
  src: string,
  file: SourceFile,
  projectRoot: string
): Promise<ImageSource> {
  // Absolute resolved path from resolveStaticImportPath (e.g. /Users/.../hero.jpg)
  // Must come before the startsWith("/") check so barrel-resolved absolute paths
  // are not incorrectly treated as public-relative paths like "/hero.jpg"
  if (path.isAbsolute(src) && isImagePath(src)) {
    try {
      const buffer = fs.readFileSync(src);
      return { type: "file", buffer, path: src };
    } catch {
      // Fall through — might be a short public-relative path like "/hero.jpg"
    }
  }

  // Static string path: src="/hero.png" (public-relative)
  if (src.startsWith("/")) {
    const publicPath = path.join(projectRoot, "public", src);
    try {
      const buffer = fs.readFileSync(publicPath);
      return { type: "file", buffer, path: publicPath };
    } catch {
      return { type: "unresolvable", reason: `File not found: ${publicPath}` };
    }
  }

  // Relative path: src="./hero.png"
  if (src.startsWith(".")) {
    const filePath = file.getFilePath();
    const resolved = path.resolve(path.dirname(filePath), src);
    try {
      const buffer = fs.readFileSync(resolved);
      return { type: "file", buffer, path: resolved };
    } catch {
      return { type: "unresolvable", reason: `File not found: ${resolved}` };
    }
  }

  // URL: src="https://..."
  if (src.startsWith("http://") || src.startsWith("https://")) {
    try {
      const buffer = await fetchImage(src);
      return { type: "url", buffer, url: src };
    } catch (err) {
      return {
        type: "unresolvable",
        reason: `Failed to fetch: ${src} — ${err}`,
      };
    }
  }

  return { type: "unresolvable", reason: "Dynamic image source" };
}

/**
 * Resolve a JSX expression to an image file path.
 * Handles: default imports, named imports, .src property access,
 * barrel file re-exports, and tsconfig path aliases.
 */
export function resolveStaticImportPath(
  importName: string,
  file: SourceFile,
  projectRoot?: string
): string | undefined {
  // Strip .src suffix: `heroImg.src` → `heroImg`
  let name = importName;
  if (name.endsWith(".src")) {
    name = name.slice(0, -4);
  }

  // Handle dynamic access: `obj[key]` → resolve first value from `obj`
  if (name.includes("[")) {
    const baseName = name.split("[")[0];
    if (baseName) {
      return resolveFirstValueFromObject(baseName, file, projectRoot);
    }
    return undefined;
  }

  // Handle property access: obj.prop → resolve from param default or variable (e.g. product.image, PLACEHOLDER.hero)
  if (name.includes(".") && !name.includes("(")) {
    const parts = name.split(".");
    if (parts.length === 2 && parts[0] && parts[1]) {
      const resolved =
        resolveFromParamDefault(parts[0], parts[1], file) ??
        resolveFromVariableDefault(parts[0], parts[1], file);
      if (resolved) return resolved;
    }
  }

  // Function calls — can't resolve
  if (name.includes("(")) {
    return undefined;
  }

  const imports = file.getImportDeclarations();
  const filePath = file.getFilePath();
  const root = projectRoot ?? findProjectRootFromFile(filePath);

  const project = file.getProject();

  for (const imp of imports) {
    const moduleSpecifier = imp.getModuleSpecifierValue();

    // Check default import: `import heroImg from "./hero.jpg"`
    const defaultImport = imp.getDefaultImport();
    if (defaultImport?.getText() === name) {
      return resolveModuleToImage(moduleSpecifier, filePath, root, undefined, project);
    }

    // Check named imports: `import { img_xxx } from "$/data/images"`
    const namedImports = imp.getNamedImports();
    for (const named of namedImports) {
      if (named.getName() === name || named.getAliasNode()?.getText() === name) {
        const originalName = named.getName();
        return resolveModuleToImage(moduleSpecifier, filePath, root, originalName, project);
      }
    }
  }

  return undefined;
}

/**
 * For `obj[key]` patterns, find the variable declaration of `obj`,
 * extract the first property value, and resolve it through imports.
 * e.g. `cpvCodeImages[code]` → find `cpvCodeImages = { "x": img_foo, ... }` → resolve `img_foo`
 */
function resolveFirstValueFromObject(
  varName: string,
  file: SourceFile,
  projectRoot?: string
): string | undefined {
  const root = projectRoot ?? findProjectRootFromFile(file.getFilePath());
  const project = file.getProject();

  // Find variable declaration: `const cpvCodeImages = { ... }`
  const varDecls = file.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
  for (const decl of varDecls) {
    if (decl.getName() !== varName) continue;

    const init = decl.getInitializer();
    if (!init) continue;

    // Object literal: `{ "key": value, ... }`
    const objLiteral = init.asKind(SyntaxKind.ObjectLiteralExpression);
    if (!objLiteral) continue;

    const props = objLiteral.getProperties();
    for (const prop of props) {
      const propAssign = prop.asKind(SyntaxKind.PropertyAssignment);
      if (!propAssign) continue;

      const valueNode = propAssign.getInitializer();
      if (!valueNode) continue;

      // The value is an identifier referencing an import (e.g., `img_03000000_1`)
      const valueText = valueNode.getText();
      const resolved = resolveStaticImportPath(valueText, file, root);
      if (resolved) return resolved;
    }
  }

  return undefined;
}

/**
 * Resolve obj.prop from a function parameter's default value.
 * e.g. product.image when param is product = { image: "/product.jpg", thumbnail: "/thumb.jpg" }
 * Handles both simple params and destructured params ({ product = { ... } }).
 */
function resolveFromParamDefault(
  paramName: string,
  propName: string,
  file: SourceFile
): string | undefined {
  const funcs = [
    ...file.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
    ...file.getDescendantsOfKind(SyntaxKind.ArrowFunction),
    ...file.getDescendantsOfKind(SyntaxKind.FunctionExpression),
  ];

  for (const func of funcs) {
    const params = func.getParameters();
    for (const param of params) {
      let init = param.getInitializer();

      // Destructured param: { product = { image: "...", ... } }
      const nameNode = param.getNameNode();
      if (nameNode?.getKind() === SyntaxKind.ObjectBindingPattern) {
        const pattern = nameNode.asKind(SyntaxKind.ObjectBindingPattern);
        const elements = pattern?.getElements() ?? [];
        for (const el of elements) {
          if (el.getName() === paramName) {
            init = el.getInitializer();
            break;
          }
        }
      } else if (param.getName() !== paramName) {
        continue;
      }

      if (!init) continue;

      const objLiteral = init.asKind(SyntaxKind.ObjectLiteralExpression);
      if (!objLiteral) continue;

      const prop = objLiteral.getProperty(propName);
      if (!prop) continue;

      const propInit = prop.asKind(SyntaxKind.PropertyAssignment)?.getInitializer();
      const strLit = propInit?.asKind(SyntaxKind.StringLiteral);
      if (strLit) {
        return strLit.getLiteralValue();
      }
    }
  }
  return undefined;
}

/**
 * Resolve obj.prop from a variable/const declaration with object literal.
 * e.g. PLACEHOLDER.hero when const PLACEHOLDER = { hero: "https://...", ... }
 */
function resolveFromVariableDefault(
  varName: string,
  propName: string,
  file: SourceFile
): string | undefined {
  const decls = file.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
  for (const decl of decls) {
    if (decl.getName() !== varName) continue;

    const init = decl.getInitializer();
    if (!init) continue;

    const objLiteral = init.asKind(SyntaxKind.ObjectLiteralExpression);
    if (!objLiteral) continue;

    const prop = objLiteral.getProperty(propName);
    if (!prop) continue;

    const propInit = prop.asKind(SyntaxKind.PropertyAssignment)?.getInitializer();
    const strLit = propInit?.asKind(SyntaxKind.StringLiteral);
    if (strLit) {
      return strLit.getLiteralValue();
    }
  }
  return undefined;
}

/**
 * Given a module specifier, resolve it to an image file path.
 * If the module is a barrel file, follow re-exports one level.
 */
function resolveModuleToImage(
  moduleSpecifier: string,
  fromFile: string,
  projectRoot: string,
  namedExport?: string,
  project?: Project
): string | undefined {
  // Direct image import: `"./hero.jpg"`
  if (isImagePath(moduleSpecifier)) {
    return resolveModulePath(moduleSpecifier, fromFile, projectRoot, project);
  }

  // Barrel/index file — try to follow re-exports
  if (namedExport) {
    const barrelPath = resolveModulePath(moduleSpecifier, fromFile, projectRoot, project);
    if (barrelPath) {
      return followReExport(barrelPath, namedExport);
    }
  }

  return undefined;
}

/**
 * Resolve a module specifier to an absolute file path.
 * Handles relative paths, tsconfig aliases, and index files.
 */
function resolveModulePath(
  moduleSpecifier: string,
  fromFile: string,
  projectRoot: string,
  project?: Project
): string | undefined {
  let resolved: string;

  if (moduleSpecifier.startsWith(".")) {
    // Relative import
    resolved = path.resolve(path.dirname(fromFile), moduleSpecifier);
  } else {
    // Could be a path alias — try tsconfig resolution
    const aliasResolved = resolvePathAlias(moduleSpecifier, projectRoot, project);
    if (aliasResolved) {
      resolved = aliasResolved;
    } else {
      return undefined;
    }
  }

  // Try exact path first
  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    return resolved;
  }

  // Try with extensions
  const extensions = [".ts", ".tsx", ".js", ".jsx", ...IMAGE_EXTENSIONS];
  for (const ext of extensions) {
    const withExt = resolved + ext;
    if (fs.existsSync(withExt)) return withExt;
  }

  // Try as directory with index
  const indexFiles = ["index.ts", "index.tsx", "index.js", "index.jsx"];
  for (const idx of indexFiles) {
    const indexPath = path.join(resolved, idx);
    if (fs.existsSync(indexPath)) return indexPath;
  }

  return undefined;
}

/**
 * Read a barrel/index file and follow a named re-export to find the image.
 * Handles: `export { default as img_xxx } from "./xxx.jpeg"`
 */
function followReExport(
  barrelPath: string,
  exportName: string
): string | undefined {
  try {
    const content = fs.readFileSync(barrelPath, "utf-8");

    // Match: export { default as exportName } from "./path.jpeg"
    // Also:  export { exportName } from "./path.jpeg"
    const reExportPattern = new RegExp(
      `export\\s*\\{[^}]*\\b(?:default\\s+as\\s+)?${escapeRegex(exportName)}\\b[^}]*\\}\\s*from\\s*["']([^"']+)["']`
    );
    const match = content.match(reExportPattern);
    if (match) {
      const reExportPath = match[1];
      if (isImagePath(reExportPath)) {
        return path.resolve(path.dirname(barrelPath), reExportPath);
      }
    }
  } catch {
    // Can't read barrel file
  }
  return undefined;
}

/**
 * Resolve tsconfig path aliases (e.g., `$/...`, `@/...`).
 * Uses ts-morph's already-parsed compiler options instead of reading tsconfig manually.
 */
function resolvePathAlias(
  moduleSpecifier: string,
  projectRoot: string,
  project?: Project
): string | undefined {
  if (!project) return undefined;

  const opts = project.getCompilerOptions();
  const paths = opts.paths as Record<string, string[]> | undefined;
  if (!paths) return undefined;

  // baseUrl is resolved to an absolute path by TypeScript when loaded from tsconfig
  const baseDir = opts.baseUrl ?? projectRoot;

  for (const [pattern, mappings] of Object.entries(paths)) {
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -1); // "$/*" → "$/"
      if (moduleSpecifier.startsWith(prefix)) {
        const rest = moduleSpecifier.slice(prefix.length);
        for (const mapping of mappings) {
          const mappingBase = mapping.endsWith("/*") ? mapping.slice(0, -1) : mapping;
          const resolved = path.resolve(baseDir, mappingBase + rest);
          return resolved;
        }
      }
    } else if (pattern === moduleSpecifier) {
      if (mappings.length > 0) {
        return path.resolve(baseDir, mappings[0]);
      }
    }
  }

  return undefined;
}

// Exported for testing
export { resolveModuleToImage as _resolveModuleToImage };
export { resolveModulePath as _resolveModulePath };
export { followReExport as _followReExport };
export { resolvePathAlias as _resolvePathAlias };
export { findProjectRootFromFile as _findProjectRootFromFile };
export { isImagePath as _isImagePath };

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findProjectRootFromFile(filePath: string): string {
  let dir = path.dirname(filePath);
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    if (fs.existsSync(path.join(dir, "next.config.js"))) return dir;
    if (fs.existsSync(path.join(dir, "next.config.mjs"))) return dir;
    if (fs.existsSync(path.join(dir, "next.config.ts"))) return dir;
    dir = path.dirname(dir);
  }
  return path.dirname(filePath);
}

function fetchImage(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { timeout: 10000 }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchImage(res.headers.location).then(resolve).catch(reject);
        return;
      }

      const chunks: Buffer[] = [];
      let size = 0;
      const MAX_SIZE = 5 * 1024 * 1024; // 5MB

      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_SIZE) {
          res.destroy();
          reject(new Error("Image too large (>5MB)"));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
  });
}
