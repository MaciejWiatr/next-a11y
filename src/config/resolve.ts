import * as fs from "node:fs";
import * as path from "node:path";
import type { A11yConfig, ResolvedConfig, ProviderName } from "./schema.js";
import {
  DEFAULT_CONFIG,
  DEFAULT_RULES,
  PROVIDER_DEFAULTS,
  PROVIDER_ENV,
  resolveRuleConfig,
} from "./schema.js";
import type { RuleId } from "../scan/types.js";

export interface CLIFlags {
  fix?: boolean;
  interactive?: boolean;
  noAi?: boolean;
  fillAlt?: boolean;
  provider?: string;
  model?: string;
  locale?: string;
  detectedLocale?: string;
  minScore?: number;
  quiet?: boolean;
}
 
export async function loadConfigFile(cwd: string): Promise<A11yConfig> {
  const configNames = ["a11y.config.ts", "a11y.config.js", "a11y.config.mjs"];
  for (const name of configNames) {
    const configPath = path.join(cwd, name);
    if (fs.existsSync(configPath)) {
      try {
        // Try dynamic import for .mjs / .js
        if (name.endsWith(".js") || name.endsWith(".mjs")) {
          const mod = await import(configPath);
          return mod.default ?? mod;
        }
        // For .ts files, try jiti/bundle-require or fallback
        const { createJiti } = await import("jiti").catch(() => ({ createJiti: null }));
        if (createJiti) {
          const jiti = createJiti(configPath);
          const mod = await jiti.import(configPath) as any;
          return mod.default ?? mod;
        }
        // Fallback: try direct import
        const mod = await import(configPath);
        return mod.default ?? mod;
      } catch {
        // Config file exists but can't be loaded — use defaults
      }
    }
  }
  return {};
}

export function resolveConfig(
  fileConfig: A11yConfig,
  cliFlags: CLIFlags = {}
): ResolvedConfig {
  const merged = deepMerge(DEFAULT_CONFIG, fileConfig);

  const provider = (cliFlags.provider ?? merged.provider ?? detectProviderFromEnv()) as ProviderName | undefined;
  const model =
    cliFlags.model ??
    merged.model ??
    (provider ? PROVIDER_DEFAULTS[provider] : "gpt-4o-mini");

  const rawRules = { ...DEFAULT_RULES, ...merged.rules };
  const rules = Object.fromEntries(
    (Object.keys(DEFAULT_RULES) as RuleId[]).map((id) => [
      id,
      resolveRuleConfig(id, rawRules[id]),
    ])
  ) as ResolvedConfig["rules"];

  // CLI --fill-alt overrides img-alt.fillAlt
  if (cliFlags.fillAlt !== undefined) {
    rules["img-alt"] = { ...rules["img-alt"], fillAlt: cliFlags.fillAlt };
  }

  return {
    provider,
    model,
    locale: cliFlags.locale ?? merged.locale ?? cliFlags.detectedLocale ?? "en",
    cache: merged.cache ?? ".a11y-cache",
    scanner: {
      include: merged.scanner?.include ?? DEFAULT_CONFIG.scanner!.include!,
      exclude: merged.scanner?.exclude ?? DEFAULT_CONFIG.scanner!.exclude!,
    },
    rules,
    fix: cliFlags.fix ?? false,
    interactive: cliFlags.interactive ?? false,
    noAi: cliFlags.noAi ?? false,
    minScore: cliFlags.minScore,
    quiet: cliFlags.quiet ?? false,
  };
}

/**
 * Auto-detect locale from Next.js / next-intl config. Returns undefined if not found.
 */
export async function detectLocaleFromProject(cwd: string): Promise<string | undefined> {
  const projectRoot = findProjectRoot(cwd);
  if (!projectRoot) return undefined;

  // 1. next.config.js/mjs/ts — i18n.defaultLocale (Pages Router)
  for (const name of ["next.config.js", "next.config.mjs", "next.config.ts"]) {
    const configPath = path.join(projectRoot, name);
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, "utf-8");
        const m = content.match(/defaultLocale\s*:\s*['"`]([a-z]{2}(-[A-Za-z0-9]+)?)['"`]/);
        if (m) return m[1];
      } catch {
        // ignore
      }
      break; // only check first found
    }
  }

  // 2. next-intl — i18n/routing.ts, i18n.ts, src/i18n/routing.ts
  for (const p of [
    "i18n/routing.ts",
    "i18n.ts",
    "src/i18n/routing.ts",
    "src/i18n.ts",
  ]) {
    const filePath = path.join(projectRoot, p);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const m = content.match(/defaultLocale\s*:\s*['"`]([a-z]{2}(-[A-Za-z0-9]+)?)['"`]/);
        if (m) return m[1];
      } catch {
        // ignore
      }
    }
  }

  return undefined;
}

function findProjectRoot(dir: string): string | undefined {
  let current = path.resolve(dir);
  if (fs.statSync(current).isFile()) current = path.dirname(current);
  while (current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, "package.json"))) return current;
    current = path.dirname(current);
  }
  return fs.existsSync(path.join(current, "package.json")) ? current : undefined;
}

/**
 * Auto-detect AI provider from environment variables.
 */
function detectProviderFromEnv(): ProviderName | undefined {
  for (const [name, envVar] of Object.entries(PROVIDER_ENV)) {
    if (envVar && process.env[envVar]) return name as ProviderName;
  }
  return undefined;
}

function deepMerge(target: A11yConfig, source: A11yConfig): A11yConfig {
  const result: A11yConfig = { ...target };

  for (const key of Object.keys(source) as (keyof A11yConfig)[]) {
    const val = source[key];
    if (val === undefined) continue;
    if (
      typeof val === "object" &&
      val !== null &&
      !Array.isArray(val) &&
      typeof result[key] === "object" &&
      result[key] !== null
    ) {
      (result as any)[key] = { ...(result as any)[key], ...val };
    } else {
      (result as any)[key] = val;
    }
  }

  return result;
}
