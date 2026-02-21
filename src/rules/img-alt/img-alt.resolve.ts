import * as fs from "node:fs";
import * as path from "node:path";
import * as https from "node:https";
import * as http from "node:http";
import type { SourceFile } from "ts-morph";
import { SyntaxKind } from "ts-morph";

export type ImageSource =
  | { type: "file"; buffer: Buffer; path: string }
  | { type: "url"; buffer: Buffer; url: string }
  | { type: "unresolvable"; reason: string };

export async function resolveImageSource(
  src: string,
  file: SourceFile,
  projectRoot: string
): Promise<ImageSource> {
  // Static string path: src="/hero.png"
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

export function resolveStaticImportPath(
  importName: string,
  file: SourceFile
): string | undefined {
  const imports = file.getImportDeclarations();
  for (const imp of imports) {
    const defaultImport = imp.getDefaultImport();
    if (defaultImport?.getText() === importName) {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      if (
        moduleSpecifier.endsWith(".png") ||
        moduleSpecifier.endsWith(".jpg") ||
        moduleSpecifier.endsWith(".jpeg") ||
        moduleSpecifier.endsWith(".webp") ||
        moduleSpecifier.endsWith(".gif") ||
        moduleSpecifier.endsWith(".svg") ||
        moduleSpecifier.endsWith(".avif")
      ) {
        const filePath = file.getFilePath();
        return path.resolve(path.dirname(filePath), moduleSpecifier);
      }
    }
  }
  return undefined;
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
