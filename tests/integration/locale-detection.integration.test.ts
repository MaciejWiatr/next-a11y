/**
 * Smoke tests for locale autodetect (detectLocaleFromProject).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { detectLocaleFromProject } from "../../src/config/resolve.js";

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "next-a11y-locale-"));
});

afterAll(() => {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

describe("detectLocaleFromProject", () => {
  it("returns undefined when no project root (no package.json)", async () => {
    const emptyDir = path.join(tmpDir, "empty");
    fs.mkdirSync(emptyDir, { recursive: true });
    const result = await detectLocaleFromProject(emptyDir);
    expect(result).toBeUndefined();
  });

  it("returns undefined when project has no i18n config", async () => {
    const projDir = path.join(tmpDir, "no-i18n");
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(path.join(projDir, "package.json"), '{"name":"test"}', "utf-8");
    const result = await detectLocaleFromProject(projDir);
    expect(result).toBeUndefined();
  });

  it("detects locale from next.config.js i18n.defaultLocale", async () => {
    const projDir = path.join(tmpDir, "next-config");
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(path.join(projDir, "package.json"), '{"name":"test"}', "utf-8");
    fs.writeFileSync(
      path.join(projDir, "next.config.js"),
      `module.exports = { i18n: { defaultLocale: "pl", locales: ["pl", "en"] } };`,
      "utf-8"
    );
    const result = await detectLocaleFromProject(projDir);
    expect(result).toBe("pl");
  });

  it("detects locale from next.config.mjs", async () => {
    const projDir = path.join(tmpDir, "next-mjs");
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(path.join(projDir, "package.json"), '{"name":"test"}', "utf-8");
    fs.writeFileSync(
      path.join(projDir, "next.config.mjs"),
      `export default { i18n: { defaultLocale: "de", locales: ["de", "en"] } };`,
      "utf-8"
    );
    const result = await detectLocaleFromProject(projDir);
    expect(result).toBe("de");
  });

  it("detects locale from next-intl i18n/routing.ts", async () => {
    const projDir = path.join(tmpDir, "next-intl");
    fs.mkdirSync(path.join(projDir, "i18n"), { recursive: true });
    fs.writeFileSync(path.join(projDir, "package.json"), '{"name":"test"}', "utf-8");
    fs.writeFileSync(
      path.join(projDir, "i18n", "routing.ts"),
      `export const routing = { defaultLocale: "es", locales: ["es", "en"] };`,
      "utf-8"
    );
    const result = await detectLocaleFromProject(projDir);
    expect(result).toBe("es");
  });

  it("detects locale from next-intl src/i18n.ts", async () => {
    const projDir = path.join(tmpDir, "next-intl-src");
    fs.mkdirSync(path.join(projDir, "src", "i18n"), { recursive: true });
    fs.writeFileSync(path.join(projDir, "package.json"), '{"name":"test"}', "utf-8");
    fs.writeFileSync(
      path.join(projDir, "src", "i18n.ts"),
      `export default { defaultLocale: "fr", locales: ["fr", "en"] };`,
      "utf-8"
    );
    const result = await detectLocaleFromProject(projDir);
    expect(result).toBe("fr");
  });

  it("detects locale with region tag (e.g. en-US)", async () => {
    const projDir = path.join(tmpDir, "region");
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(path.join(projDir, "package.json"), '{"name":"test"}', "utf-8");
    fs.writeFileSync(
      path.join(projDir, "next.config.js"),
      `module.exports = { i18n: { defaultLocale: "en-US", locales: ["en-US", "pl"] } };`,
      "utf-8"
    );
    const result = await detectLocaleFromProject(projDir);
    expect(result).toBe("en-US");
  });
});
