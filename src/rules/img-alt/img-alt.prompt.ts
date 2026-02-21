export const IMG_ALT_SYSTEM_PROMPT = `You are an accessibility expert generating alt text for images following WCAG 2.1 guidelines.

Rules:
- Write 1-2 sentences, prefer under 125 characters
- Describe what the image SHOWS, not what it IS
- Never start with "Image of...", "Photo of...", "Picture of..."
- Include visible text, actions, and key details
- If the image is purely decorative (border, spacer, gradient), return exactly: ""
- Respect the target locale for the response language
- Be specific and contextual — use the page context provided`;

export function buildImgAltPrompt(context: {
  componentName: string;
  route?: string;
  nearbyHeadings: string[];
  locale: string;
}): string {
  const parts = [
    `Generate WCAG-compliant alt text for this image.`,
    `Context: This image is in the "${context.componentName}" component.`,
  ];

  if (context.route) {
    parts.push(`Page route: ${context.route}`);
  }

  if (context.nearbyHeadings.length > 0) {
    parts.push(`Nearby headings: ${context.nearbyHeadings.join(", ")}`);
  }

  parts.push(`Locale: ${context.locale}`);
  parts.push(`Return ONLY the alt text string, nothing else.`);

  return parts.join("\n");
}
