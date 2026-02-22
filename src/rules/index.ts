import type { Rule, RuleId } from "../scan/types.js";
import type { ResolvedRuleConfig } from "../config/schema.js";
import { createImgAltRule } from "./img-alt/img-alt.rule.js";
import { createButtonLabelRule } from "./button-label/button-label.rule.js";
import { createLinkLabelRule } from "./link-label/link-label.rule.js";
import { inputLabelRule } from "./input-label/input-label.rule.js";
import { noPositiveTabindexRule } from "./no-positive-tabindex/no-positive-tabindex.rule.js";
import { createButtonTypeRule } from "./button-type/button-type.rule.js";
import { linkNoopenerRule } from "./link-noopener/link-noopener.rule.js";
import { emojiAltRule } from "./emoji-alt/emoji-alt.rule.js";
import { createHtmlLangRule } from "./html-lang/html-lang.rule.js";
import { headingOrderRule } from "./heading-order/heading-order.rule.js";
import { noDivInteractiveRule } from "./no-div-interactive/no-div-interactive.rule.js";
import { nextMetadataTitleRule } from "./next-metadata-title/next-metadata-title.rule.js";
import { nextImageSizesRule } from "./next-image-sizes/next-image-sizes.rule.js";
import { nextSkipNavRule } from "./next-skip-nav/next-skip-nav.rule.js";
import { nextLinkNoNestedARule } from "./next-link-no-nested-a/next-link-no-nested-a.rule.js";

export interface RuleOptions {
  locale?: string;
  rules: Record<RuleId, ResolvedRuleConfig>;
}

function buildAllRules(options: RuleOptions): Rule[] {
  const { rules, locale = "en" } = options;
  return [
    createImgAltRule({ fillAlt: rules["img-alt"]?.fillAlt ?? true }),
    createButtonLabelRule({ locale }),
    createLinkLabelRule({ locale }),
    inputLabelRule,
    noPositiveTabindexRule,
    createButtonTypeRule({
      scanCustomComponents: rules["button-type"]?.scanCustomComponents ?? false,
    }),
    linkNoopenerRule,
    emojiAltRule,
    createHtmlLangRule({ locale }),
    headingOrderRule,
    noDivInteractiveRule,
    nextMetadataTitleRule,
    nextImageSizesRule,
    nextSkipNavRule,
    nextLinkNoNestedARule,
  ];
}

export function getRulesForConfig(
  rules: Record<RuleId, ResolvedRuleConfig>,
  noAi: boolean,
  options: { locale?: string } = {}
): Rule[] {
  return buildAllRules({ rules, locale: options.locale }).filter((rule) => {
    const config = rules[rule.id];
    if (!config || config.level === "off") return false;
    // Keep AI rules even when noAi — they produce deterministic violations too
    return true;
  });
}
