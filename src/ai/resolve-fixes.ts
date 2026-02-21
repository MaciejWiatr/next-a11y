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
import { SyntaxKind, Project } from "ts-morph";
import pc from "picocolors";

const CODE_CONTEXT_SYSTEM = `You are an accessibility expert. Generate a concise, descriptive aria-label for the given UI element.
Rules:
- Return ONLY the label text, nothing else
- Keep it short: 2-5 words
- Describe the action or purpose, not the appearance
- Use the component context and icon name to infer purpose`;

export interface AiResolveOptions {
  config: ResolvedConfig;
  project: Project;
  violations: Violation[];
  onProgress?: (resolved: number, total: number, violation: Violation, result: string) => void;
}

export async function resolveAiFixes(opts: AiResolveOptions): Promise<void> {
  const { config, project, violations, onProgress } = opts;

  if (!config.provider) return;

  const aiViolations = violations.filter(
    (v) => ["img-alt", "button-label", "link-label", "input-label"].includes(v.rule) && v.fix
  );

  if (aiViolations.length === 0) return;

  let model: LanguageModel;
  try {
    model = createProvider(config.provider, config.model);
  } catch (err: any) {
    console.error(pc.red(`\n  AI provider error: ${err.message}\n`));
    return;
  }

  const cache = new FsCache(config.cache);
  let resolved = 0;

  for (const violation of aiViolations) {
    try {
      const sourceFile = project.getSourceFile(violation.filePath);
      if (!sourceFile) continue;

      let generatedValue: string;

      switch (violation.rule) {
        case "img-alt":
          generatedValue = await resolveImgAlt(sourceFile, violation, model, config, cache);
          break;
        case "button-label":
        case "link-label":
        case "input-label":
          generatedValue = await resolveCodeContext(sourceFile, violation, model, config, cache);
          break;
        default:
          continue;
      }

      if (generatedValue) {
        // Replace the fix value with the AI-generated result
        violation.fix!.value = generatedValue;
        resolved++;
        onProgress?.(resolved, aiViolations.length, violation, generatedValue);
      }
    } catch (err: any) {
      // Fall back to heuristic value — resolve the original async function
      if (typeof violation.fix?.value === "function") {
        try {
          violation.fix.value = await violation.fix.value();
        } catch {
          // Keep the function, applyFix will call it
        }
      }
    }
  }
}

async function resolveImgAlt(
  file: SourceFile,
  violation: Violation,
  model: LanguageModel,
  config: ResolvedConfig,
  cache: FsCache
): Promise<string> {
  const el = findElement(file, violation.line);
  if (!el) return "";

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
    // Context-only generation
    const cacheKey = FsCache.hashContent(Buffer.from(srcValue + context.componentName + config.locale));
    const cached = cache.get(cacheKey);
    if (cached && cached.locale === config.locale) return cached.value;

    const result = await generate({
      model,
      system: IMG_ALT_SYSTEM_PROMPT,
      prompt: prompt + `\nImage source: ${srcValue}\nNote: Image could not be loaded, generate alt text based on context only.`,
    });

    cache.set(cacheKey, {
      value: result, model: model.modelId, locale: config.locale,
      rule: "img-alt", generatedAt: new Date().toISOString(),
    });
    return result;
  }

  // Check cache
  const cacheKey = FsCache.hashContent(imageSource.buffer);
  const cached = cache.get(cacheKey);
  if (cached && cached.locale === config.locale) return cached.value;

  // Generate with vision
  const result = await generate({
    model, system: IMG_ALT_SYSTEM_PROMPT, prompt,
    image: imageSource.buffer,
  });

  cache.set(cacheKey, {
    value: result, model: model.modelId, locale: config.locale,
    rule: "img-alt", generatedAt: new Date().toISOString(),
  });
  return result;
}

async function resolveCodeContext(
  file: SourceFile,
  violation: Violation,
  model: LanguageModel,
  config: ResolvedConfig,
  cache: FsCache
): Promise<string> {
  const context = extractContext(file);
  const element = violation.element;

  // Build context string for cache key
  const contextStr = `${violation.rule}:${element}:${context.componentName}:${config.locale}`;
  const cacheKey = FsCache.hashContent(Buffer.from(contextStr));

  const cached = cache.get(cacheKey);
  if (cached && cached.locale === config.locale) return cached.value;

  // Build prompt
  let prompt = `Generate an aria-label for this ${violation.rule === "button-label" ? "button" : violation.rule === "link-label" ? "link" : "input"} element:\n\n`;
  prompt += `Element: ${element}\n`;
  prompt += `Component: ${context.componentName}\n`;
  if (context.route) prompt += `Route: ${context.route}\n`;
  if (context.nearbyHeadings.length > 0) prompt += `Nearby headings: ${context.nearbyHeadings.join(", ")}\n`;
  prompt += `Locale: ${config.locale}\n`;
  prompt += `\nReturn ONLY the label text.`;

  const result = await generate({ model, system: CODE_CONTEXT_SYSTEM, prompt });

  cache.set(cacheKey, {
    value: result, model: model.modelId, locale: config.locale,
    rule: violation.rule, generatedAt: new Date().toISOString(),
  });
  return result;
}

function findElement(file: SourceFile, line: number) {
  const elements = [
    ...file.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...file.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ];
  return elements.find((el) => el.getStartLineNumber() === line);
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
