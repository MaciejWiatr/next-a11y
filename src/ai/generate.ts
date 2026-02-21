import { generateText } from "ai";
import type { LanguageModel } from "ai";

export interface GenerateOptions {
  model: LanguageModel;
  system: string;
  prompt: string;
  image?: Buffer;
  maxRetries?: number;
}

export interface GenerateResult {
  text: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
}

export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const { model, system, prompt, image, maxRetries = 2 } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      let result;
      if (image) {
        result = await generateText({
          model,
          system,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", image },
                { type: "text", text: prompt },
              ],
            },
          ],
        });
      } else {
        result = await generateText({ model, system, prompt });
      }
      const u = result.usage;
      const usage = u
        ? {
            promptTokens: u.inputTokens,
            completionTokens: u.outputTokens,
            totalTokens: u.totalTokens ?? (u.inputTokens ?? 0) + (u.outputTokens ?? 0),
          }
        : undefined;
      return { text: result.text.trim(), usage };
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError ?? new Error("AI generation failed");
}
