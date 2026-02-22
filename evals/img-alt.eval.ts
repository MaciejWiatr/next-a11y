import { evalite } from "evalite";
import { wrapAISDKModel } from "evalite/ai-sdk";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import {
  IMG_ALT_SYSTEM_PROMPT,
  buildImgAltPrompt,
} from "../src/rules/img-alt/img-alt.prompt.js";

const model = wrapAISDKModel(openai("gpt-4o-mini"));

/** WCAG-compliant: no "Image of...", under 125 chars, non-empty (unless decorative). */
function wcagCompliant({
  output,
  expected,
}: {
  output: string;
  expected: { decorative?: boolean; maxLength?: number };
}) {
  const out = output.trim().replace(/^["']|["']$/g, "");
  const badPrefixes = ["image of", "photo of", "picture of", "image showing", "photo showing"];
  const hasBadPrefix = badPrefixes.some((p) => out.toLowerCase().startsWith(p));
  const maxLen = expected.maxLength ?? 125;
  const okLength = out.length <= maxLen;
  const decorative = expected.decorative === true;
  const okContent = decorative ? out === "" : out.length > 0;
  const score = !hasBadPrefix && okLength && okContent ? 1 : 0;
  return {
    name: "WCAG Compliant",
    description: "No bad prefixes, under 125 chars, non-empty unless decorative",
    score,
  };
}

/** Output contains any of the expected keywords (case-insensitive). */
function containsAny({
  output,
  expected,
}: {
  output: string;
  expected: string | string[];
}) {
  const out = output.trim().toLowerCase();
  const keywords = Array.isArray(expected) ? expected : [expected];
  const match = keywords.some((k) => out.includes(k.toLowerCase()));
  return {
    name: "Contains Keyword",
    description: "Output contains expected contextual keyword",
    score: match ? 1 : 0,
  };
}

evalite("AI image alt generation (context-only)", {
  data: [
    {
      input: {
        componentName: "Hero",
        route: "/",
        nearbyHeadings: ["Welcome to our store"],
        locale: "en",
        imageSource: "hero.jpg",
      },
      expected: {
        keywords: ["welcome", "store", "hero", "banner", "landing"],
        decorative: false,
      },
    },
    {
      input: {
        componentName: "ProductCard",
        route: "/products",
        nearbyHeadings: ["Blue running shoes", "Product details"],
        locale: "en",
        imageSource: "product-123.jpg",
      },
      expected: {
        keywords: ["shoe", "product", "blue", "running", "sneaker"],
        decorative: false,
      },
    },
    {
      input: {
        componentName: "TeamSection",
        route: "/about",
        nearbyHeadings: ["Our team", "Meet the founders"],
        locale: "en",
        imageSource: "team.jpg",
      },
      expected: {
        keywords: ["team", "founder", "person", "people", "portrait", "member"],
        decorative: false,
      },
    },
    {
      input: {
        componentName: "Hero",
        route: "/",
        nearbyHeadings: ["Witaj w sklepie"],
        locale: "pl",
        imageSource: "hero.jpg",
      },
      expected: {
        keywords: ["witaj", "sklep", "hero", "baner", "strona"],
        decorative: false,
      },
    },
    {
      input: {
        componentName: "ProductCard",
        route: "/produkte",
        nearbyHeadings: ["Blaue Laufschuhe"],
        locale: "de",
        imageSource: "product.jpg",
      },
      expected: {
        keywords: ["schuh", "produkt", "blau", "lauf", "sneaker"],
        decorative: false,
      },
    },
  ],
  task: async (input) => {
    const prompt = buildImgAltPrompt({
      componentName: input.componentName,
      route: input.route,
      nearbyHeadings: input.nearbyHeadings,
      locale: input.locale,
    });
    const fullPrompt =
      prompt +
      `\nImage source: ${input.imageSource}\nNote: Image could not be loaded, generate alt text based on context only.`;
    const result = await generateText({
      model,
      system: IMG_ALT_SYSTEM_PROMPT,
      prompt: fullPrompt,
    });
    return result.text.trim();
  },
  scorers: [
    {
      scorer: ({ output, expected }) =>
        wcagCompliant({ output, expected: { decorative: false, maxLength: 150 } }),
    },
    {
      scorer: ({ output, expected }) => containsAny({ output, expected: expected.keywords }),
    },
  ],
});
