import * as fs from "node:fs";
import * as path from "node:path";
import * as https from "node:https";
import * as http from "node:http";
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

  // Strip property access for dynamic patterns like `obj[key].src` → give up
  if (name.includes("[") || name.includes("(")) {
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
