/**
 * Shared prompt building for aria-label generation.
 * Used by resolve-fixes and evals.
 */
export const ARIA_LABEL_SYSTEM = `You are an accessibility expert. Generate an accessible aria-label for icon-only buttons and links.

Rules:
- Return ONLY the label text, nothing else
- Output MUST be in the language of the locale (e.g. Polish for pl, German for de)
- Use action-oriented phrasing: describe what happens when the user activates it, not what the icon looks like
- Keep it short: 2-5 words
- Use the icon name and component context to infer the action

Examples (follow these patterns):
- ShoppingCartIcon → "Add to cart"
- HeartIcon → "Add to favorites"
- ShareIcon → "Share"
- XMarkIcon, close button → "Close"
- Bars3Icon, menu → "Open menu"
- MagnifyingGlassIcon → "Search"
- TwitterIcon link → "Visit Twitter" or "Visit X"
- Avoid bare nouns: "Cart" → "Add to cart", "Twitter" → "Visit Twitter"`;

export interface AriaLabelPromptInput {
  iconName?: string;
  element: string;
  componentName: string;
  route?: string;
  nearbyHeadings?: string[];
  locale: string;
  rule: "button-label" | "link-label" | "input-label";
}

export function buildAriaLabelPrompt(input: AriaLabelPromptInput): string {
  const { iconName, element, componentName, route, nearbyHeadings, locale, rule } = input;
  const elementType =
    rule === "button-label" ? "button" : rule === "link-label" ? "link" : "input";
  let prompt = `Generate an aria-label for this icon-only ${elementType}:\n\n`;
  if (iconName) prompt += `Icon component: ${iconName}\n`;
  prompt += `Element: ${element}\n`;
  prompt += `Component: ${componentName}\n`;
  if (route) prompt += `Route: ${route}\n`;
  if (nearbyHeadings && nearbyHeadings.length > 0) {
    prompt += `Nearby headings: ${nearbyHeadings.join(", ")}\n`;
  }
  prompt += `Locale: ${locale}\n`;
  prompt += `\nReturn ONLY the action-oriented label (e.g. "Add to cart", "Visit Twitter").`;
  return prompt;
}
