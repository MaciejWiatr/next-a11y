import type { SourceFile } from "ts-morph";
import { SyntaxKind } from "ts-morph";

export interface ComponentContext {
  componentName: string;
  filePath: string;
  route?: string;
  nearbyHeadings: string[];
  parentComponent?: string;
}

export function extractContext(file: SourceFile): ComponentContext {
  const filePath = file.getFilePath();
  const componentName = extractComponentName(file);
  const route = extractRoute(filePath);
  const nearbyHeadings = extractHeadings(file);

  return {
    componentName,
    filePath,
    route,
    nearbyHeadings,
  };
}

function extractComponentName(file: SourceFile): string {
  // Check for default export function/const
  const defaultExport = file.getDefaultExportSymbol();
  if (defaultExport) {
    const name = defaultExport.getName();
    if (name !== "default") return name;
  }

  // Check for named function declarations
  const functions = file.getFunctions();
  for (const fn of functions) {
    if (fn.isExported()) {
      const name = fn.getName();
      if (name) return name;
    }
  }

  // Check for const arrow function exports
  const variables = file.getVariableStatements();
  for (const stmt of variables) {
    if (stmt.isExported()) {
      const decls = stmt.getDeclarations();
      if (decls.length > 0) return decls[0].getName();
    }
  }

  // Fallback to filename
  const base = file.getBaseNameWithoutExtension();
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function extractRoute(filePath: string): string | undefined {
  const normalized = filePath.replace(/\\/g, "/");

  // App Router: app/<path>/page.tsx
  const appMatch = normalized.match(/app\/(.+?)\/page\.[tj]sx?$/);
  if (appMatch) return `/${appMatch[1]}`;

  // App Router root: app/page.tsx
  if (/app\/page\.[tj]sx?$/.test(normalized)) return "/";

  // Pages Router: pages/<path>.tsx
  const pagesMatch = normalized.match(/pages\/(.+?)\.[tj]sx?$/);
  if (pagesMatch) {
    const route = pagesMatch[1].replace(/\/index$/, "");
    return `/${route}`;
  }

  return undefined;
}

function extractHeadings(file: SourceFile): string[] {
  const headings: string[] = [];
  const jsxElements = file.getDescendantsOfKind(SyntaxKind.JsxOpeningElement);

  for (const el of jsxElements) {
    const tag = el.getTagNameNode().getText();
    if (/^h[1-6]$/.test(tag)) {
      const parent = el.getParent();
      if (parent) {
        const text = parent
          .getDescendantsOfKind(SyntaxKind.JsxText)
          .map((t) => t.getText().trim())
          .filter(Boolean)
          .join(" ");
        if (text) headings.push(`${tag}: ${text}`);
      }
    }
  }

  return headings;
}
