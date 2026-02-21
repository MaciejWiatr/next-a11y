import type { RuleId, RuleSetting } from "../scan/types.js";

export type ProviderName = "openai" | "anthropic" | "google" | "ollama" | "openrouter";

export interface A11yConfig {
  provider?: ProviderName;
  model?: string;
  locale?: string;
  cache?: string;
  fillAlt?: boolean;
  scanner?: {
    include?: string[];
    exclude?: string[];
  };
  rules?: Partial<Record<RuleId, RuleSetting>>;
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
  rules: Record<RuleId, RuleSetting>;
  fix: boolean;
  interactive: boolean;
  noAi: boolean;
  fillAlt: boolean;
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

export const DEFAULT_RULES: Record<RuleId, RuleSetting> = {
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
