import * as fs from "node:fs";
import * as path from "node:path";

export async function discoverFiles(
  basePath: string,
  include: string[],
  exclude: string[]
): Promise<string[]> {
  const absBase = path.resolve(basePath);
  const allFiles: string[] = [];

  // Try native fs.glob (Node 22+)
  if (typeof (fs as any).glob === "function") {
    for (const pattern of include) {
      try {
        const matches: string[] = await new Promise((resolve, reject) => {
          (fs as any).glob(
            pattern,
            { cwd: absBase },
            (err: Error | null, files: string[]) => {
              if (err) reject(err);
              else resolve(files);
            }
          );
        });
        for (const f of matches) {
          allFiles.push(path.join(absBase, f));
        }
      } catch {
        // Fallback below
        return fallbackGlob(absBase, include, exclude);
      }
    }
  } else {
    return fallbackGlob(absBase, include, exclude);
  }

  return filterExcluded(allFiles, exclude);
}

async function fallbackGlob(
  basePath: string,
  include: string[],
  exclude: string[]
): Promise<string[]> {
  const allFiles = await walkDir(basePath);
  const matched = allFiles.filter((f) => {
    const rel = path.relative(basePath, f);
    return include.some((pattern) => matchGlob(rel, pattern));
  });
  return filterExcluded(matched, exclude);
}

function filterExcluded(files: string[], exclude: string[]): string[] {
  if (exclude.length === 0) return files;
  return files.filter((f) => {
    const rel = path.relative(path.dirname(f), f);
    return !exclude.some(
      (pattern) =>
        matchGlob(path.basename(f), pattern) ||
        matchGlob(rel, pattern) ||
        matchGlob(f, pattern)
    );
  });
}

async function walkDir(dir: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      if (entry.isDirectory()) {
        results.push(...(await walkDir(fullPath)));
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  } catch {
    // Permission denied or similar
  }
  return results;
}

function matchGlob(filePath: string, pattern: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  const regex = globToRegex(pattern);
  return regex.test(normalized);
}

function globToRegex(pattern: string): RegExp {
  let regex = pattern.replace(/\\/g, "/");

  // Escape regex special chars (except glob chars)
  regex = regex.replace(/[.+^${}()|[\]\\]/g, "\\$&");

  // Convert glob patterns
  regex = regex.replace(/\*\*/g, "___GLOBSTAR___");
  regex = regex.replace(/\*/g, "[^/]*");
  regex = regex.replace(/___GLOBSTAR___/g, ".*");
  regex = regex.replace(/\?/g, "[^/]");

  // Handle {a,b} alternatives
  regex = regex.replace(/\\{([^}]+)\\}/g, (_, contents: string) => {
    const alternatives = contents.split(",").map((s: string) => s.trim());
    return `(${alternatives.join("|")})`;
  });

  return new RegExp(`^${regex}$`);
}
