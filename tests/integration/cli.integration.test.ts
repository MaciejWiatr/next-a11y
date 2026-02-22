/**
 * CLI smoke tests — run the actual bin and verify output.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const BIN = path.join(ROOT, "bin/cli.js");

let tmpDir: string;

beforeAll(() => {
  if (!fs.existsSync(path.join(ROOT, "dist/cli/index.js"))) {
    const build = spawnSync("npm", ["run", "build"], { cwd: ROOT, encoding: "utf-8" });
    if (build.status !== 0) throw new Error("Build required for CLI tests. Run: npm run build");
  }
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "next-a11y-cli-"));
  const fixture = `
export function Page() {
  return (
    <div>
      <button onClick={() => {}}><span>X</span></button>
      <a href="https://x.com" target="_blank">Link</a>
      <p>Test 🔥</p>
    </div>
  );
}
`;
  fs.writeFileSync(path.join(tmpDir, "page.tsx"), fixture.trim(), "utf-8");
});

afterAll(() => {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

function run(args: string[]) {
  return spawnSync("node", [BIN, ...args], {
    cwd: ROOT,
    encoding: "utf-8",
    env: { ...process.env, FORCE_COLOR: "0" },
  });
}

describe("CLI smoke", () => {
  it("scan --help prints usage", () => {
    const r = run(["scan", "--help"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Scan files");
    expect(r.stdout).toContain("--fix");
    expect(r.stdout).toContain("--no-ai");
  });

  it("scan <path> runs and reports violations", () => {
    const r = run(["scan", tmpDir, "--no-ai"]);
    expect(r.status).toBe(0);
    expect(r.stdout + r.stderr).toMatch(/\d+\s+fixable|\d+\s+files|Scanned/);
  });

  it("scan --fix --no-ai applies deterministic fixes", () => {
    const r = run(["scan", tmpDir, "--fix", "--no-ai"]);
    expect(r.status).toBe(0);
    const content = fs.readFileSync(path.join(tmpDir, "page.tsx"), "utf-8");
    expect(content).toContain('rel="noopener noreferrer"');
    expect(content).toMatch(/role="img".*aria-label/);
  });

  it("init --yes detects locale from next.config.js and writes it to a11y.config.ts", () => {
    const initDir = path.join(tmpDir, "init-locale");
    fs.mkdirSync(initDir, { recursive: true });
    fs.writeFileSync(path.join(initDir, "package.json"), '{"name":"test"}', "utf-8");
    fs.writeFileSync(
      path.join(initDir, "next.config.js"),
      "module.exports = { i18n: { defaultLocale: 'pl', locales: ['pl','en'] } };",
      "utf-8"
    );
    const r = spawnSync("node", [BIN, "init", "--yes"], {
      cwd: initDir,
      encoding: "utf-8",
      env: { ...process.env, FORCE_COLOR: "0" },
    });
    expect(r.status).toBe(0);
    const configPath = path.join(initDir, "a11y.config.ts");
    expect(fs.existsSync(configPath)).toBe(true);
    const config = fs.readFileSync(configPath, "utf-8");
    expect(config).toContain('locale: "pl"');
  });
});
