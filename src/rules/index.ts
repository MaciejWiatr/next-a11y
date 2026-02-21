import type { Rule, RuleId, RuleSetting } from "../scan/types.js";
import { imgAltRule } from "./img-alt/img-alt.rule.js";
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

export const ALL_RULES: Rule[] = [
  imgAltRule,
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

const RULE_MAP = new Map<RuleId, Rule>(
  ALL_RULES.map((r) => [r.id, r])
);

export function getRulesForConfig(
  ruleSettings: Record<RuleId, RuleSetting>,
  noAi: boolean
): Rule[] {
  return ALL_RULES.filter((rule) => {
    const setting = ruleSettings[rule.id];
    if (setting === "off") return false;
    if (noAi && rule.type === "ai") return false;
    return true;
  });
}

export function getRule(id: RuleId): Rule | undefined {
  return RULE_MAP.get(id);
}
