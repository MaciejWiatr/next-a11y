import * as fs from "node:fs";
import * as path from "node:path";
import type { RuleId, Violation } from "./types.js";

export const WEIGHT_TABLE: Record<RuleId, number> = {
  "img-alt": 2,
  "button-label": 2,
  "link-label": 2,
  "input-label": 3,
  "html-lang": 5,
  "next-metadata-title": 3,
  "next-skip-nav": 3,
  "next-link-no-nested-a": 2,
  "no-positive-tabindex": 1,
  "button-type": 1,
  "next-image-sizes": 1,
  "heading-order": 1,
  "no-div-interactive": 1,
  "emoji-alt": 0.5,
  "link-noopener": 0.5,
};

export function computeScore(violations: Violation[]): number {
  let score = 100;
  for (const v of violations) {
    const weight = WEIGHT_TABLE[v.rule] ?? 1;
    score -= weight;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getScoreBadge(score: number): { label: string; color: "green" | "yellow" | "red" } {
  if (score >= 90) return { label: "Good", color: "green" };
  if (score >= 70) return { label: "Needs work", color: "yellow" };
  return { label: "Poor", color: "red" };
}

export function loadPreviousScore(cacheDir: string): number | undefined {
  const scorePath = path.join(cacheDir, "score.json");
  try {
    if (fs.existsSync(scorePath)) {
      const data = JSON.parse(fs.readFileSync(scorePath, "utf-8"));
      return data.score;
    }
  } catch {
    // No previous score
  }
  return undefined;
}

export function savePreviousScore(cacheDir: string, score: number): void {
  const scorePath = path.join(cacheDir, "score.json");
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(scorePath, JSON.stringify({ score, timestamp: new Date().toISOString() }));
}
