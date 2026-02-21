#!/usr/bin/env node
/**
 * test:example - Copies broken-site, runs next-a11y --fix, validates 0 violations
 * Usage: node scripts/test-example.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const EXAMPLE = path.join(ROOT, "examples", "broken-site");
const EXCLUDE = new Set(["node_modules", ".next", ".a11y-cache", ".git", "dist"]);

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      if (EXCLUDE.has(name)) continue;
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function run(cmd, args, cwd = ROOT) {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: "utf-8",
    stdio: ["inherit", "pipe", "pipe"],
  });
  return { ...r, output: (r.stdout || "") + (r.stderr || "") };
}

function main() {
  console.log("  test:example — copy, fix, validate\n");

  const distPath = path.join(ROOT, "dist", "cli", "index.js");
  if (!fs.existsSync(distPath)) {
    console.log("  Building next-a11y first...");
    const build = run("npm", ["run", "build"], ROOT);
    if (build.status !== 0) {
      console.error("  Build failed");
      process.exit(1);
    }
  }

  const tmpDir = path.join(ROOT, ".tmp-broken-site-test");
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true });
  }

  // 1. Copy
  console.log("  1. Copying examples/broken-site to .tmp-broken-site-test");
  copyRecursive(EXAMPLE, tmpDir);
  console.log("     Done.\n");

  // 2. Install deps in copy (needed for next build)
  console.log("  2. Installing dependencies in copy");
  const install = run("npm", ["install", "--silent"], tmpDir);
  if (install.status !== 0) {
    console.error("     npm install failed:", install.output);
    process.exit(1);
  }
  console.log("     Done.\n");

  // 3. Run next-a11y scan --fix (use local bin)
  console.log("  3. Running next-a11y scan . --fix");
  const fixResult = run("node", [path.join(ROOT, "bin/cli.js"), "scan", tmpDir, "--fix"], ROOT);
  if (fixResult.status !== 0) {
    console.error("     Scan --fix failed:", fixResult.output);
    process.exit(1);
  }
  console.log(fixResult.output);
  console.log("     Done.\n");

  // 4. Run next-a11y scan again — check result
  console.log("  4. Running next-a11y scan (validation)");
  const validateResult = run("node", [path.join(ROOT, "bin/cli.js"), "scan", tmpDir], ROOT);
  const out = validateResult.output;
  console.log(out);

  // Pass if no issues, or only warnings (detect-only rules have no fix)
  const noIssues = /No accessibility issues found/i.test(out);
  const fixableMatch = out.match(/(\d+)\s+fixable/);
  const fixableCount = fixableMatch ? parseInt(fixableMatch[1], 10) : 0;

  if (!noIssues && fixableCount > 0) {
    console.error("\n  FAIL: Expected 0 fixable violations after --fix.");
    process.exit(1);
  }
  console.log("     Validation passed.\n");

  // 5. Verify Next.js build
  console.log("  5. Verifying Next.js build");
  const buildResult = run("npm", ["run", "build"], tmpDir);
  if (buildResult.status !== 0) {
    console.error("     Next.js build failed:", buildResult.output);
    process.exit(1);
  }
  console.log("     Build OK.\n");

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true });
  console.log("  6. Cleanup done.");
  console.log("\n  test:example passed.\n");
}

main();
