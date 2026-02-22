import type { LanguageModel } from "ai";
import type { SourceFile } from "ts-morph";
import type { Violation } from "../scan/types.js";
import type { ResolvedConfig } from "../config/schema.js";
import { createProvider } from "./create-provider.js";
import { generate } from "./generate.js";
import { FsCache } from "../cache/fs-cache.js";
import { extractContext } from "../scan/context.js";
import { IMG_ALT_SYSTEM_PROMPT, buildImgAltPrompt } from "../rules/img-alt/img-alt.prompt.js";
import { resolveImageSource, resolveStaticImportPath } from "../rules/img-alt/img-alt.resolve.js";
import { getIconLabel, ICON_LABEL_OVERRIDES } from "../rules/button-label/icon-name-map.js";
import {
  findLabelVariableInScope,
  wrapLabelWithVariable,
} from "../utils/find-label-variable.js";
import { SyntaxKind, Project } from "ts-morph";
import pc from "picocolors";
import { PROVIDER_ENV } from "../config/schema.js";

const AI_SETUP_SUGGESTION = `  Either:
  • Run with --no-ai — deterministic fixes only (not recommended for best results)
  • Or set provider in a11y.config.ts and add the API key to .env:
    openai: OPENAI_API_KEY
    anthropic: ANTHROPIC_API_KEY
    google: GOOGLE_GENERATIVE_AI_API_KEY
    openrouter: OPENROUTER_API_KEY
`;

import { ARIA_LABEL_SYSTEM, buildAriaLabelPrompt } from "./aria-label-prompt.js";

const METADATA_TITLE_SYSTEM = `You are an accessibility expert. Generate a concise page title for a Next.js route.
Rules:
- Return ONLY the title text, nothing else
- Output MUST be in the language of the locale (e.g. Polish for pl, German for de)
- Keep it short: 2-6 words
- Use title case (e.g. "About Us", "Contact")
- Infer from component name, route path, and page content (headings)`;

type ResolveResult = { text: string; usage?: { totalTokens?: number; promptTokens?: number; completionTokens?: number } };

export interface AiResolveOptions {
  config: ResolvedConfig;
  project: Project;
  violations: Violation[];
  onProgress?: (resolved: number, total: number, violation: Violation, result: string) => void;
}

export async function resolveAiFixes(opts: AiResolveOptions): Promise<void> {
  const { config, project, violations, onProgress } = opts;

  const aiViolations = violations.filter(
    (v) =>
      ["img-alt", "button-label", "link-label", "input-label", "next-metadata-title"].includes(
        v.rule
      ) && v.fix
  );

  if (aiViolations.length === 0) return;

  if (!config.provider) {
    console.error(pc.red("\n  No AI provider configured.\n"));
    console.error(pc.dim(AI_SETUP_SUGGESTION));
    process.exit(1);
  }

  let model: LanguageModel;
  try {
    model = createProvider(config.provider, config.model);
  } catch (err: any) {
    console.error(pc.red(`\n  AI provider error: ${err.message}\n`));
    console.error(pc.dim(AI_SETUP_SUGGESTION));
    process.exit(1);
  }

  if (!config.quiet) {
    console.log(pc.bold(`\n  Generating text using ${config.provider}/${config.model}\n`));
  }

  const cache = new FsCache(config.cache);
  let resolved = 0;
  let totalTokens = 0;

  for (const violation of aiViolations) {
    try {
      // Skip if fix value already resolved (e.g. generic aria-label → variable replacement)
      if (typeof violation.fix?.value === "string") continue;

      const sourceFile = project.getSourceFile(violation.filePath);
      if (!sourceFile) continue;

      let result: ResolveResult;

      switch (violation.rule) {
        case "img-alt":
          result = await resolveImgAlt(sourceFile, violation, model, config, cache);
          break;
        case "button-label":
        case "link-label":
        case "input-label":
          result = await resolveCodeContext(project, sourceFile, violation, model, config, cache);
          break;
        case "next-metadata-title":
          result = await resolveMetadataTitle(sourceFile, violation, model, config, cache);
          break;
        default:
          continue;
      }

      const generatedValue = result.text;
      if (result.usage?.totalTokens) totalTokens += result.usage.totalTokens;
      else if (result.usage?.promptTokens !== undefined || result.usage?.completionTokens !== undefined) {
        totalTokens += (result.usage.promptTokens ?? 0) + (result.usage.completionTokens ?? 0);
      }

      if (generatedValue) {
        // Use variable in scope when element is inside .map() etc.
        const varRef = findLabelVariableInScope(sourceFile, violation.line);
        const finalValue = varRef
          ? wrapLabelWithVariable(generatedValue, varRef)
          : generatedValue;
        violation.fix!.value = finalValue;
        resolved++;
        onProgress?.(resolved, aiViolations.length, violation, finalValue);
      } else if (violation.rule === "img-alt") {
        // Fallback: derive alt from filename when AI can't resolve (e.g. unresolvable, API error)
        const heuristic = getHeuristicImgAlt(sourceFile, violation);
        if (heuristic) {
          violation.fix!.value = heuristic;
          resolved++;
          onProgress?.(resolved, aiViolations.length, violation, heuristic);
        } else {
          delete violation.fix;
        }
      } else {
        // AI couldn't generate a value — remove fix to prevent placeholder
        delete violation.fix;
      }
    } catch (err: any) {
      // Fall back to heuristic value — resolve the original async function
      if (typeof violation.fix?.value === "function") {
        try {
          const fallback = await violation.fix.value();
          // Never use placeholder for img-alt — it's not real alt text
          if (
            violation.rule === "img-alt" &&
            fallback === "[AI-generated alt text placeholder]"
          ) {
            delete violation.fix;
          } else {
            violation.fix!.value = fallback;
          }
        } catch {
          if (violation.rule === "img-alt") delete violation.fix;
          // Keep the function for other rules, applyFix will call it
        }
      }
    }
  }

  if (totalTokens > 0 && !config.quiet) {
    console.log(pc.dim(`  Total tokens used: ${totalTokens.toLocaleString()}\n`));
  }
}

async function resolveImgAlt(
  file: SourceFile,
  violation: Violation,
  model: LanguageModel,
  config: ResolvedConfig,
  cache: FsCache
): Promise<ResolveResult> {
  const el = findElement(file, violation.line);
  if (!el) return { text: "" };

  // Find project root by walking up from the file
  const filePath = file.getFilePath();
  const projectRoot = findProjectRoot(filePath);

  // Get image source
  const srcAttr = el.getAttribute("src");
  let srcValue = "";

  if (srcAttr?.getKind() === SyntaxKind.JsxAttribute) {
    const init = srcAttr.asKind(SyntaxKind.JsxAttribute)?.getInitializer();
    if (init?.getKind() === SyntaxKind.StringLiteral) {
      srcValue = init.asKind(SyntaxKind.StringLiteral)?.getLiteralValue() ?? "";
    } else if (init?.getKind() === SyntaxKind.JsxExpression) {
      const expr = init.asKind(SyntaxKind.JsxExpression)?.getExpression();
      if (expr) {
        const importName = expr.getText();
        const importPath = resolveStaticImportPath(importName, file, projectRoot);
        srcValue = importPath ?? importName;
      }
    }
  }

  const imageSource = await resolveImageSource(srcValue, file, projectRoot);
  const context = extractContext(file);
  const prompt = buildImgAltPrompt({
    componentName: context.componentName,
    route: context.route,
    nearbyHeadings: context.nearbyHeadings,
    locale: config.locale,
  });

  if (imageSource.type === "unresolvable") {
    // Can't generate meaningful alt without seeing the image
    console.log(`  ${pc.blue("[AI]")} ${pc.dim(`skipped ${violation.filePath.replace(process.cwd() + "/", "")}:${violation.line} — dynamic image source, cannot resolve`)}`);
    return { text: "" };
  }

  // Check cache (key includes locale so en/pl don't overwrite)
  const cacheKey = FsCache.hashContent(
    Buffer.concat([imageSource.buffer, Buffer.from(`:${config.locale}`, "utf8")])
  );
  const cached = cache.get(cacheKey);
  if (cached) return { text: cached.value };

  // Generate with vision
  const { text, usage } = await generate({
    model, system: IMG_ALT_SYSTEM_PROMPT, prompt,
    image: imageSource.buffer,
  });

  cache.set(cacheKey, {
    value: text,
    model: typeof model === "string" ? model : config.model,
    locale: config.locale,
    rule: "img-alt",
    generatedAt: new Date().toISOString(),
  });
  return { text, usage };
}

async function resolveCodeContext(
  project: Project,
  file: SourceFile,
  violation: Violation,
  model: LanguageModel,
  config: ResolvedConfig,
  cache: FsCache
): Promise<ResolveResult> {
  const context = extractContext(file);
  const element = violation.element;

  // Get icon name from source (button/link contains <CartIcon /> etc.)
  const iconName = getIconNameFromViolation(project, violation);

  // Build context string for cache key — include iconName so each icon gets its own label
  const contextStr = `${violation.rule}:${iconName ?? "unknown"}:${element}:${context.componentName}:${config.locale}`;
  const cacheKey = FsCache.hashContent(Buffer.from(contextStr));

  const cached = cache.get(cacheKey);
  if (cached && cached.locale === config.locale) return { text: cached.value };

  // Use heuristic for known icons — ensures correct locale and saves API calls
  if (iconName && ICON_LABEL_OVERRIDES[iconName] && (violation.rule === "button-label" || violation.rule === "link-label")) {
    const label = getIconLabel(iconName, config.locale);
    return { text: label };
  }

  const prompt = buildAriaLabelPrompt({
    iconName: iconName ?? undefined,
    element,
    componentName: context.componentName,
    route: context.route,
    nearbyHeadings: context.nearbyHeadings,
    locale: config.locale,
    rule: violation.rule as "button-label" | "link-label" | "input-label",
  });

  const { text, usage } = await generate({ model, system: ARIA_LABEL_SYSTEM, prompt });

  cache.set(cacheKey, {
    value: text,
    model: typeof model === "string" ? model : config.model,
    locale: config.locale,
    rule: violation.rule,
    generatedAt: new Date().toISOString(),
  });
  return { text, usage };
}

async function resolveMetadataTitle(
  file: SourceFile,
  violation: Violation,
  model: LanguageModel,
  config: ResolvedConfig,
  cache: FsCache
): Promise<ResolveResult> {
  const context = extractContext(file);

  const contextStr = `next-metadata-title:${context.componentName}:${context.route}:${context.nearbyHeadings.join("|")}:${config.locale}`;
  const cacheKey = FsCache.hashContent(Buffer.from(contextStr));

  const cached = cache.get(cacheKey);
  if (cached && cached.locale === config.locale) return { text: cached.value };

  let prompt = `Generate a page title for this Next.js page:\n\n`;
  prompt += `Component: ${context.componentName}\n`;
  if (context.route) prompt += `Route: ${context.route}\n`;
  if (context.nearbyHeadings.length > 0)
    prompt += `Headings on page: ${context.nearbyHeadings.join(", ")}\n`;
  prompt += `Locale: ${config.locale}\n`;
  prompt += `\nReturn ONLY the title text (e.g. "Home", "About Us", "Contact").`;

  const { text, usage } = await generate({
    model,
    system: METADATA_TITLE_SYSTEM,
    prompt,
  });

  cache.set(cacheKey, {
    value: text,
    model: typeof model === "string" ? model : config.model,
    locale: config.locale,
    rule: "next-metadata-title",
    generatedAt: new Date().toISOString(),
  });
  return { text, usage };
}

function findElement(file: SourceFile, line: number) {
  const elements = [
    ...file.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...file.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ];
  return elements.find((el) => el.getStartLineNumber() === line);
}

/**
 * Derive a simple alt from the image src when AI can't resolve.
 * e.g. "/hero.jpg" → "Hero image", "team-photo.jpg" → "Team photo"
 */
function getHeuristicImgAlt(file: SourceFile, violation: Violation): string | undefined {
  const el = findElement(file, violation.line);
  if (!el) return undefined;

  const srcAttr = el.getAttribute("src");
  if (!srcAttr || srcAttr.getKind() !== SyntaxKind.JsxAttribute) return undefined;

  const init = srcAttr.asKind(SyntaxKind.JsxAttribute)?.getInitializer();
  if (!init || init.getKind() !== SyntaxKind.StringLiteral) return undefined;

  const src = init.asKind(SyntaxKind.StringLiteral)?.getLiteralValue() ?? "";
  const basename = src.split("/").pop() ?? src;
  const name = basename.replace(/\.(jpg|jpeg|png|webp|gif|svg|avif)$/i, "").replace(/[-_]/g, " ");
  if (!name) return undefined;

  const titleCase = name.replace(/\b\w/g, (c) => c.toUpperCase());
  return `${titleCase} image`;
}

function getIconNameFromViolation(project: Project, violation: Violation): string | undefined {
  if (violation.rule !== "button-label" && violation.rule !== "link-label") return undefined;
  const file = project.getSourceFile(violation.filePath);
  if (!file) return undefined;
  const el = findElement(file, violation.line);
  if (!el) return undefined;
  const parent = el.getParent();
  if (!parent) return undefined;
  const children = [
    ...parent.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
    ...parent.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
  ];
  for (const child of children) {
    const tag = child.getTagNameNode().getText();
    if (tag === "svg" || tag === "path" || tag === "rect") continue;
    if (tag.endsWith("Icon")) return tag;
    if (tag.length > 0 && tag[0] === tag[0].toUpperCase() && !["Image", "Link", "Svg"].includes(tag))
      return tag;
  }
  return undefined;
}

function findProjectRoot(filePath: string): string {
  const path = require("node:path");
  const fs = require("node:fs");
  let dir = path.dirname(filePath);
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    if (fs.existsSync(path.join(dir, "next.config.js"))) return dir;
    if (fs.existsSync(path.join(dir, "next.config.mjs"))) return dir;
    if (fs.existsSync(path.join(dir, "next.config.ts"))) return dir;
    dir = path.dirname(dir);
  }
  return path.dirname(filePath);
}
