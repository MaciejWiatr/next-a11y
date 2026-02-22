import type { RuleId, RuleSetting } from "../scan/types.js";

export type ProviderName = "openai" | "anthropic" | "google" | "ollama" | "openrouter";

/** Per-rule config: shorthand "fix"|"warn"|"off" or object with level + rule-specific options. */
export type RuleConfig =
  | RuleSetting
  | { level: RuleSetting; scanCustomComponents?: boolean; fillAlt?: boolean };

export interface A11yConfig {
  provider?: ProviderName;
  model?: string;
  locale?: string;
  cache?: string;
  scanner?: {
    include?: string[];
    exclude?: string[];
  };
  rules?: Partial<Record<RuleId, RuleConfig>>;
}

export interface ResolvedRuleConfig {
  level: RuleSetting;
  /** button-type: scanCustomComponents (default false) */
  scanCustomComponents?: boolean;
  /** img-alt: fillAlt (default true) */
  fillAlt?: boolean;
}

export interface ResolvedConfig {
  provider: ProviderName | undefined;
  model: string;
  locale: string;
  cache: string;
  scanner: {
    include: string[];
    exclude: string[];
  };
  rules: Record<RuleId, ResolvedRuleConfig>;
  fix: boolean;
  interactive: boolean;
  noAi: boolean;
  quiet: boolean;
  minScore?: number;
}

export const PROVIDER_DEFAULTS: Record<ProviderName, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5-20251001",
  google: "gemini-2.0-flash-lite",
  ollama: "llava",
  openrouter: "openai/gpt-4o-mini",
};

export const PROVIDER_ENV: Record<ProviderName, string | null> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  ollama: null,
  openrouter: "OPENROUTER_API_KEY",
};

export const DEFAULT_RULES: Record<RuleId, RuleConfig> = {
  "img-alt": "fix",
  "button-label": "fix",
  "link-label": "fix",
  "input-label": "fix",
  "html-lang": "fix",
  "emoji-alt": "fix",
  "no-positive-tabindex": "fix",
  "button-type": "fix",
  "link-noopener": "fix",
  "next-metadata-title": "warn",
  "next-image-sizes": "warn",
  "next-link-no-nested-a": "fix",
  "next-skip-nav": "warn",
  "heading-order": "warn",
  "no-div-interactive": "warn",
};

const RULE_OPTION_DEFAULTS: Partial<Record<RuleId, Partial<ResolvedRuleConfig>>> = {
  "button-type": { scanCustomComponents: false },
  "img-alt": { fillAlt: true },
};

export function resolveRuleConfig(
  ruleId: RuleId,
  config: RuleConfig | undefined
): ResolvedRuleConfig {
  const merged = config ?? DEFAULT_RULES[ruleId];
  const level = typeof merged === "string" ? merged : merged.level;
  const opts: Partial<ResolvedRuleConfig> = typeof merged === "string" ? {} : merged;
  const defaults = (RULE_OPTION_DEFAULTS[ruleId] ?? {}) as Partial<ResolvedRuleConfig>;
  return {
    level,
    // button-type: explicitly false by default
    scanCustomComponents: opts.scanCustomComponents ?? defaults.scanCustomComponents ?? false,
    // img-alt: explicitly true by default
    fillAlt: opts.fillAlt ?? defaults.fillAlt ?? true,
  };
}

export const DEFAULT_CONFIG: A11yConfig = {
  locale: "en",
  cache: ".a11y-cache",
  scanner: {
    include: ["**/*.{tsx,jsx}"],
    exclude: ["**/*.test.*", "**/*.spec.*", "**/*.stories.*", "**/node_modules/**"],
  },
  rules: DEFAULT_RULES,
};

export function defineConfig(config: A11yConfig): A11yConfig {
  return config;
}
