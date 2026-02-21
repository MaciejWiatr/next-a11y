import type { Command } from "commander";
import pc from "picocolors";
import { FsCache } from "../cache/fs-cache.js";
import { loadConfigFile, resolveConfig } from "../config/resolve.js";

export function registerCacheCommand(program: Command): void {
  const cache = program
    .command("cache")
    .description("Manage the AI result cache");

  cache
    .command("stats")
    .description("Show cache statistics")
    .action(async () => {
      const fileConfig = await loadConfigFile(process.cwd());
      const config = resolveConfig(fileConfig);
      const fsCache = new FsCache(config.cache);
      const stats = fsCache.stats();

      console.log(pc.bold("\n  Cache Statistics\n"));
      console.log(`  Entries: ${stats.entries}`);
      console.log(
        `  Size:    ${formatBytes(stats.sizeBytes)}`
      );
      console.log(`  Path:    ${config.cache}/cache.json`);
      console.log("");
    });

  cache
    .command("clear")
    .description("Clear the cache")
    .action(async () => {
      const fileConfig = await loadConfigFile(process.cwd());
      const config = resolveConfig(fileConfig);
      const fsCache = new FsCache(config.cache);
      fsCache.clear();

      console.log(pc.green("\n  Cache cleared.\n"));
    });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
