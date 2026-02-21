import { generateText } from "ai";
import type { LanguageModel } from "ai";

export interface GenerateOptions {
  model: LanguageModel;
  system: string;
  prompt: string;
  image?: Buffer;
  maxRetries?: number;
}

export async function generate(options: GenerateOptions): Promise<string> {
  const { model, system, prompt, image, maxRetries = 2 } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (image) {
        // Vision prompt — send image as part of the message
        const result = await generateText({
          model,
          system,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  image,
                },
                {
                  type: "text",
                  text: prompt,
                },
              ],
            },
          ],
        });
        return result.text.trim();
      } else {
        // Text-only prompt
        const result = await generateText({
          model,
          system,
          prompt,
        });
        return result.text.trim();
      }
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        // Wait before retry with exponential backoff
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError ?? new Error("AI generation failed");
}
