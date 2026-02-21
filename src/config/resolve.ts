import * as fs from "node:fs";
import * as path from "node:path";
import type { A11yConfig, ResolvedConfig, ProviderName } from "./schema.js";
import { DEFAULT_CONFIG, DEFAULT_RULES, PROVIDER_DEFAULTS, PROVIDER_ENV } from "./schema.js";

export interface CLIFlags {
  fix?: boolean;
  interactive?: boolean;
  noAi?: boolean;
  provider?: string;
  model?: string;
  minScore?: number;
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
    (provider ? PROVIDER_DEFAULTS[provider] : "gpt-4.1-nano");

  return {
    provider,
    model,
    locale: merged.locale ?? "en",
    cache: merged.cache ?? ".a11y-cache",
    scanner: {
      include: merged.scanner?.include ?? DEFAULT_CONFIG.scanner!.include!,
      exclude: merged.scanner?.exclude ?? DEFAULT_CONFIG.scanner!.exclude!,
    },
    rules: { ...DEFAULT_RULES, ...merged.rules },
    fix: cliFlags.fix ?? false,
    interactive: cliFlags.interactive ?? false,
    noAi: cliFlags.noAi ?? false,
    minScore: cliFlags.minScore,
  };
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
