import type { SourceFile, Node } from "ts-morph";
import { SyntaxKind } from "ts-morph";

/** Property names that make good label variables, in preference order. */
const LABEL_PROPERTIES = ["label", "name", "title", "heading", "text"];

/**
 * Finds a variable in scope that can enrich an aria-label when the element
 * is inside a .map/.flatMap/.forEach callback.
 *
 * Example: sections.map((section) => <button aria-label="...">{section.label}</button>)
 * Returns "section.label" so the fix can use `{\`Go to section ${section.label}\`}`
 *
 * @param usedInContent - if true, only return a variable that appears in the element's
 *   JSX children (e.g. {section.label}). Use when improving existing generic labels.
 */
export function findLabelVariableInScope(
  file: SourceFile,
  elementLine: number,
  options?: { usedInContent?: boolean }
): string | undefined {
  const el = findElementAtLine(file, elementLine);
  if (!el) return undefined;

  const arrowFn = findEnclosingMapCallback(el);
  if (!arrowFn) return undefined;

  const paramName = getFirstParamName(arrowFn);
  if (!paramName) return undefined;

  const body = arrowFn.getBody();
  if (!body) return undefined;

  // Find PropertyAccessExpression nodes: section.label, item.name, etc.
  const propAccesses = body.getDescendantsOfKind(
    SyntaxKind.PropertyAccessExpression
  );

  if (options?.usedInContent && el) {
    // Only return variable if it's used in the element's children
    const elementParent = el.getParent();
    const searchRoot = elementParent ?? el;
    const usedVars = new Set<string>();
    for (const node of searchRoot.getDescendantsOfKind(
      SyntaxKind.PropertyAccessExpression
    )) {
      const expr = node.getExpression();
      if (expr.getText() === paramName) {
        usedVars.add(node.getText());
      }
    }
    if (usedVars.size === 0) return undefined;
    for (const prop of propAccesses) {
      const expr = prop.getExpression();
      const exprText = expr.getText();
      if (exprText !== paramName) continue;
      const candidate = prop.getText();
      if (usedVars.has(candidate) && LABEL_PROPERTIES.includes(prop.getName())) {
        return candidate;
      }
    }
    for (const prop of propAccesses) {
      const expr = prop.getExpression();
      if (expr.getText() !== paramName) continue;
      const candidate = prop.getText();
      if (usedVars.has(candidate)) return candidate;
    }
    return undefined;
  }

  for (const prop of propAccesses) {
    const expr = prop.getExpression();
    const exprText = expr.getText();
    if (exprText !== paramName) continue;

    const propName = prop.getName();
    if (LABEL_PROPERTIES.includes(propName)) {
      return prop.getText(); // e.g. "section.label"
    }
  }

  // Fallback: any property access on the param that looks like a label
  for (const prop of propAccesses) {
    const expr = prop.getExpression();
    if (expr.getText() !== paramName) continue;
    const propName = prop.getName();
    if (
      /^(label|name|title|heading|text|id|placeholder)$/i.test(propName)
    ) {
      return prop.getText();
    }
  }

  return undefined;
}

function findElementAtLine(file: SourceFile, line: number): Node | undefined {
  const elements = [
    ...file.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...file.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ];
  return elements.find((el) => el.getStartLineNumber() === line);
}

function findEnclosingMapCallback(node: Node): import("ts-morph").ArrowFunction | undefined {
  let current: Node | undefined = node.getParent();
  while (current) {
    if (current.getKind() === SyntaxKind.ArrowFunction) {
      const arrowFn = current.asKind(SyntaxKind.ArrowFunction);
      const parent = arrowFn?.getParent();
      if (parent?.getKind() === SyntaxKind.CallExpression) {
        const callExpr = parent.asKind(SyntaxKind.CallExpression);
        const exprText = callExpr?.getExpression()?.getText() ?? "";
        if (
          exprText.endsWith(".map") ||
          exprText.endsWith(".flatMap") ||
          exprText.endsWith(".forEach")
        ) {
          return arrowFn ?? undefined;
        }
      }
    }
    current = current.getParent();
  }
  return undefined;
}

function getFirstParamName(
  arrowFn: import("ts-morph").ArrowFunction
): string | undefined {
  const params = arrowFn.getParameters();
  if (params.length === 0) return undefined;
  const first = params[0];
  const nameNode = first.getNameNode();
  if (nameNode.getKind() === SyntaxKind.Identifier) {
    return nameNode.getText();
  }
  return undefined;
}

/**
 * Wraps a base label with a variable reference for use in aria-label.
 * Returns a JSX expression string like {\`Go to section ${section.label}\`}
 */
export function wrapLabelWithVariable(baseLabel: string, varRef: string): string {
  return `{\`${baseLabel} \${${varRef}}\`}`;
}
