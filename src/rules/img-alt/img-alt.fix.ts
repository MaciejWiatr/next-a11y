import type { SourceFile } from "ts-morph";
import { SyntaxKind } from "ts-morph";
import type { Violation } from "../../scan/types.js";
import type { LanguageModel } from "ai";
import { generate } from "../../ai/generate.js";
import { IMG_ALT_SYSTEM_PROMPT, buildImgAltPrompt } from "./img-alt.prompt.js";
import { resolveImageSource, resolveStaticImportPath } from "./img-alt.resolve.js";
import { extractContext } from "../../scan/context.js";
import { FsCache } from "../../cache/fs-cache.js";

export async function generateImgAlt(
  file: SourceFile,
  violation: Violation,
  model: LanguageModel,
  locale: string,
  cache: FsCache,
  projectRoot: string
): Promise<string> {
  const el = findElement(file, violation.line);
  if (!el) return "";

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
        // Try to resolve static import
        const importName = expr.getText();
        const importPath = resolveStaticImportPath(importName, file);
        if (importPath) {
          srcValue = importPath;
        } else {
          srcValue = importName;
        }
      }
    }
  }

  // Resolve image
  const imageSource = await resolveImageSource(srcValue, file, projectRoot);

  if (imageSource.type === "unresolvable") {
    // Can't resolve image — generate from context only
    const context = extractContext(file);
    const prompt = buildImgAltPrompt({
      componentName: context.componentName,
      route: context.route,
      nearbyHeadings: context.nearbyHeadings,
      locale,
    });

    return generate({
      model,
      system: IMG_ALT_SYSTEM_PROMPT,
      prompt: prompt + `\nImage source: ${srcValue}\nNote: Image could not be loaded, generate alt text based on context only.`,
    });
  }

  // Check cache
  const cacheKey = FsCache.hashContent(imageSource.buffer);
  const cached = cache.get(cacheKey);
  if (cached && cached.locale === locale) {
    return cached.value;
  }

  // Generate with AI
  const context = extractContext(file);
  const prompt = buildImgAltPrompt({
    componentName: context.componentName,
    route: context.route,
    nearbyHeadings: context.nearbyHeadings,
    locale,
  });

  const altText = await generate({
    model,
    system: IMG_ALT_SYSTEM_PROMPT,
    prompt,
    image: imageSource.buffer,
  });

  // Cache the result
  cache.set(cacheKey, {
    value: altText,
    model: model.modelId,
    locale,
    rule: "img-alt",
    generatedAt: new Date().toISOString(),
  });

  return altText;
}

function findElement(file: SourceFile, line: number) {
  const elements = [
    ...file.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...file.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ];
  return elements.find((el) => el.getStartLineNumber() === line);
}

export function applyImgAltFix(
  file: SourceFile,
  violation: Violation,
  altText: string
): void {
  const el = findElement(file, violation.line);
  if (!el) return;

  const altAttr = el.getAttribute("alt");
  const escapedAlt = altText.replace(/"/g, "&quot;");

  if (altAttr) {
    // Replace existing alt
    const jsxAttr = altAttr.asKind(SyntaxKind.JsxAttribute);
    if (jsxAttr) {
      const init = jsxAttr.getInitializer();
      if (init) {
        init.replaceWithText(`"${escapedAlt}"`);
      } else {
        jsxAttr.setInitializer(`"${escapedAlt}"`);
      }
    }
  } else {
    // Insert new alt attribute
    el.addAttribute({ name: "alt", initializer: `"${escapedAlt}"` });
  }
}
