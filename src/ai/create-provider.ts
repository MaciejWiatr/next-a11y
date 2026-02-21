import { createRequire } from "node:module";
import * as path from "node:path";
import type { LanguageModel } from "ai";
import type { ProviderName } from "../config/schema.js";

const PROVIDER_PACKAGES: Record<ProviderName, string> = {
  openai: "@ai-sdk/openai",
  anthropic: "@ai-sdk/anthropic",
  google: "@ai-sdk/google",
  ollama: "ollama-ai-provider",
  openrouter: "@openrouter/ai-sdk-provider",
};

const PROVIDER_INSTALL: Record<ProviderName, string> = {
  openai: "npm install @ai-sdk/openai",
  anthropic: "npm install @ai-sdk/anthropic",
  google: "npm install @ai-sdk/google",
  ollama: "npm install ollama-ai-provider",
  openrouter: "npm install @openrouter/ai-sdk-provider",
};

export function createProvider(
  provider: ProviderName,
  model: string
): LanguageModel {
  const pkg = PROVIDER_PACKAGES[provider];

  // Resolve from the user's project directory, not from next-a11y's install location.
  // This is needed when running via bunx/npx where next-a11y is in a temp cache.
  const projectRequire = createRequire(
    path.resolve(process.cwd(), "package.json")
  );

  let mod: any;
  try {
    mod = projectRequire(pkg);
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
    case "openrouter": {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error(
          "OpenRouter requires OPENROUTER_API_KEY. Set it in .env or your environment."
        );
      }
      const { createOpenRouter } = mod;
      const openrouter = createOpenRouter({ apiKey });
      return openrouter(model);
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
