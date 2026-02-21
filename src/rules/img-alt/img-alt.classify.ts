export type AltClassification =
  | "missing"
  | "meaningless"
  | "decorative"
  | "dynamic"
  | "valid";

const MEANINGLESS_PATTERNS = [
  /^image$/i,
  /^photo$/i,
  /^picture$/i,
  /^img$/i,
  /^banner$/i,
  /^hero$/i,
  /^thumbnail$/i,
  /^untitled$/i,
  /^placeholder$/i,
  /^screenshot$/i,
  /^IMG_\d+/i,
  /^DSC_?\d+/i,
  /^DCIM/i,
  /^\d+$/,
  /\.(jpg|jpeg|png|gif|webp|svg|avif)$/i,
];

export function classifyAlt(
  altValue: string | undefined | null,
  isExpression: boolean
): AltClassification {
  // No alt attribute at all
  if (altValue === undefined || altValue === null) {
    return "missing";
  }

  // alt="" → decorative (intentional)
  if (altValue === "") {
    return "decorative";
  }

  // Dynamic expression like {t('key')} or {variable}
  if (isExpression) {
    return "dynamic";
  }

  // Check for meaningless patterns
  const trimmed = altValue.trim();
  for (const pattern of MEANINGLESS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return "meaningless";
    }
  }

  // Short single-word alts are likely meaningless
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 3 && words.length > 0) {
    // Allow short but descriptive (e.g. "Company logo")
    if (words.length >= 2) return "valid";
    // Single word — check if it's descriptive enough
    if (MEANINGLESS_PATTERNS.some((p) => p.test(words[0]))) {
      return "meaningless";
    }
  }

  return "valid";
}
