import type { Rule, RuleId, RuleSetting } from "../scan/types.js";
import { createImgAltRule } from "./img-alt/img-alt.rule.js";
import { buttonLabelRule } from "./button-label/button-label.rule.js";
import { linkLabelRule } from "./link-label/link-label.rule.js";
import { inputLabelRule } from "./input-label/input-label.rule.js";
import { noPositiveTabindexRule } from "./no-positive-tabindex/no-positive-tabindex.rule.js";
import { buttonTypeRule } from "./button-type/button-type.rule.js";
import { linkNoopenerRule } from "./link-noopener/link-noopener.rule.js";
import { emojiAltRule } from "./emoji-alt/emoji-alt.rule.js";
import { htmlLangRule } from "./html-lang/html-lang.rule.js";
import { headingOrderRule } from "./heading-order/heading-order.rule.js";
import { noDivInteractiveRule } from "./no-div-interactive/no-div-interactive.rule.js";
import { nextMetadataTitleRule } from "./next-metadata-title/next-metadata-title.rule.js";
import { nextImageSizesRule } from "./next-image-sizes/next-image-sizes.rule.js";
import { nextSkipNavRule } from "./next-skip-nav/next-skip-nav.rule.js";
import { nextLinkNoNestedARule } from "./next-link-no-nested-a/next-link-no-nested-a.rule.js";

export interface RuleOptions {
  fillAlt?: boolean;
}

function buildAllRules(options: RuleOptions = {}): Rule[] {
  return [
    createImgAltRule({ fillAlt: options.fillAlt ?? false }),
    buttonLabelRule,
    linkLabelRule,
    inputLabelRule,
    noPositiveTabindexRule,
    buttonTypeRule,
    linkNoopenerRule,
    emojiAltRule,
    htmlLangRule,
    headingOrderRule,
    noDivInteractiveRule,
    nextMetadataTitleRule,
    nextImageSizesRule,
    nextSkipNavRule,
    nextLinkNoNestedARule,
  ];
}

export function getRulesForConfig(
  ruleSettings: Record<RuleId, RuleSetting>,
  noAi: boolean,
  options: RuleOptions = {}
): Rule[] {
  return buildAllRules(options).filter((rule) => {
    const setting = ruleSettings[rule.id];
    if (setting === "off") return false;
    if (noAi && rule.type === "ai") return false;
    return true;
  });
}
