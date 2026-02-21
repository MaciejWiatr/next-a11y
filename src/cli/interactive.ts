import * as readline from "node:readline";
import pc from "picocolors";
import type { Violation } from "../scan/types.js";
import { formatViolationDetail } from "./format.js";

export type ReviewAction = "yes" | "no" | "skip" | "quit";

export async function interactiveReview(
  violations: Violation[],
  onAccept: (violation: Violation) => Promise<void>
): Promise<{ applied: number; skipped: number }> {
  const fixable = violations.filter((v) => v.fix);

  if (fixable.length === 0) {
    console.log(pc.dim("  No fixable violations to review."));
    return { applied: 0, skipped: 0 };
  }

  console.log(
    pc.bold(`\n  next-a11y — Interactive mode (${fixable.length} fixes)\n`)
  );

  let applied = 0;
  let skipped = 0;

  for (let i = 0; i < fixable.length; i++) {
    const violation = fixable[i];

    console.log(formatViolationDetail(violation, i, fixable.length));

    if (violation.fix) {
      const value =
        typeof violation.fix.value === "function"
          ? await violation.fix.value()
          : violation.fix.value;

      console.log(`\n  ${pc.green("Suggested:")}`);
      if (violation.fix.attribute) {
        console.log(`    ${violation.fix.attribute}="${value}"`);
      } else {
        console.log(`    ${value}`);
      }
    }

    const action = await promptAction();

    switch (action) {
      case "yes":
        await onAccept(violation);
        applied++;
        console.log(pc.green("  Applied."));
        break;
      case "no":
        skipped++;
        console.log(pc.dim("  Skipped."));
        break;
      case "skip":
        skipped += fixable.length - i;
        console.log(pc.dim("  Skipping remaining..."));
        return { applied, skipped };
      case "quit":
        console.log(pc.dim("  Quitting..."));
        return { applied, skipped: fixable.length - i };
    }

    console.log(pc.dim("\n  " + "-".repeat(40)));
  }

  console.log(
    `\n  ${pc.bold("Summary:")} ${pc.green(`${applied} applied`)}, ${pc.dim(`${skipped} skipped`)}\n`
  );

  return { applied, skipped };
}

function promptAction(): Promise<ReviewAction> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(
      `\n  ${pc.bold("(Y)es")}  ${pc.dim("(n)o")}  ${pc.dim("(s)kip remaining")}  ${pc.dim("(q)uit")} > `,
      (answer) => {
        rl.close();
        const normalized = answer.trim().toLowerCase();
        if (normalized === "n" || normalized === "no") resolve("no");
        else if (normalized === "s" || normalized === "skip") resolve("skip");
        else if (normalized === "q" || normalized === "quit") resolve("quit");
        else resolve("yes"); // default to yes
      }
    );
  });
}
