import type { LanguageModel } from "ai";
import type { ProviderName } from "../config/schema.js";

const PROVIDER_PACKAGES: Record<ProviderName, string> = {
  openai: "@ai-sdk/openai",
  anthropic: "@ai-sdk/anthropic",
  google: "@ai-sdk/google",
  ollama: "ollama-ai-provider",
};

const PROVIDER_INSTALL: Record<ProviderName, string> = {
  openai: "npm install @ai-sdk/openai",
  anthropic: "npm install @ai-sdk/anthropic",
  google: "npm install @ai-sdk/google",
  ollama: "npm install ollama-ai-provider",
};

export function createProvider(
  provider: ProviderName,
  model: string
): LanguageModel {
  const pkg = PROVIDER_PACKAGES[provider];

  let mod: any;
  try {
    mod = require(pkg);
  } catch {
    throw new Error(
      `AI provider "${provider}" requires the "${pkg}" package.\n` +
        `Install it with: ${PROVIDER_INSTALL[provider]}\n\n` +
        `Or run: npx next-a11y init`
    );
  }

  switch (provider) {
    case "openai": {
      const { openai } = mod;
      return openai(model);
    }
    case "anthropic": {
      const { anthropic } = mod;
      return anthropic(model);
    }
    case "google": {
      const { google } = mod;
      return google(model);
    }
    case "ollama": {
      const { ollama } = mod;
      return ollama(model);
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
