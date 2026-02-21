import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

export interface CacheEntry {
  value: string;
  model: string;
  locale: string;
  rule: string;
  generatedAt: string;
}

export interface CacheStats {
  entries: number;
  sizeBytes: number;
}

export class FsCache {
  private cacheDir: string;
  private cachePath: string;
  private data: Record<string, CacheEntry>;

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
    this.cachePath = path.join(cacheDir, "cache.json");
    this.data = this.load();
  }

  private load(): Record<string, CacheEntry> {
    try {
      if (fs.existsSync(this.cachePath)) {
        return JSON.parse(fs.readFileSync(this.cachePath, "utf-8"));
      }
    } catch {
      // Corrupted cache — start fresh
    }
    return {};
  }

  private save(): void {
    fs.mkdirSync(this.cacheDir, { recursive: true });
    fs.writeFileSync(this.cachePath, JSON.stringify(this.data, null, 2));
  }

  static hashContent(content: Buffer | string): string {
    return crypto
      .createHash("sha256")
      .update(content)
      .digest("hex")
      .slice(0, 16);
  }

  get(key: string): CacheEntry | undefined {
    return this.data[key];
  }

  set(key: string, entry: CacheEntry): void {
    this.data[key] = entry;
    this.save();
  }

  has(key: string): boolean {
    return key in this.data;
  }

  clear(): void {
    this.data = {};
    if (fs.existsSync(this.cachePath)) {
      fs.unlinkSync(this.cachePath);
    }
  }

  stats(): CacheStats {
    const entries = Object.keys(this.data).length;
    let sizeBytes = 0;
    try {
      if (fs.existsSync(this.cachePath)) {
        sizeBytes = fs.statSync(this.cachePath).size;
      }
    } catch {
      // ignore
    }
    return { entries, sizeBytes };
  }
}
