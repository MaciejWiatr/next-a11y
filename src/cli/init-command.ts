import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import { execSync } from "node:child_process";
import type { Command } from "commander";
import pc from "picocolors";
import { detect as detectPM, resolveCommand } from "package-manager-detector";
import { PROVIDER_ENV, type ProviderName } from "../config/schema.js";

interface InitOptions {
  provider: ProviderName | "none";
  installDep: boolean;
  addGitignore: boolean;
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize next-a11y configuration")
    .action(async () => {
      console.log(pc.bold("\n  next-a11y v0.1.4 — Setup\n"));

      const options = await promptInitOptions();

      // Detect project structure
      const cwd = process.cwd();
      const hasAppDir = fs.existsSync(path.join(cwd, "app"));
      const hasSrcDir = fs.existsSync(path.join(cwd, "src"));
      const include: string[] = [];
      if (hasSrcDir) include.push("src/**/*.{tsx,jsx}");
      if (hasAppDir) include.push("app/**/*.{tsx,jsx}");
      if (include.length === 0) include.push("**/*.{tsx,jsx}");

      // Generate config
      const configContent = generateConfig(options.provider, include);
      const configPath = path.join(cwd, "a11y.config.ts");
      fs.writeFileSync(configPath, configContent);
      console.log(pc.green("  Created a11y.config.ts"));

      // Install peer dep
      if (options.provider !== "none" && options.installDep) {
        const pkgMap: Record<string, string> = {
          openai: "@ai-sdk/openai",
          anthropic: "@ai-sdk/anthropic",
          google: "@ai-sdk/google",
          ollama: "ollama-ai-provider",
        };
        const pkg = pkgMap[options.provider];
        if (pkg) {
          const pm = await detectPM({ cwd });
          const resolved = resolveCommand(pm?.agent ?? "npm", "add", [pkg]);
          const installCmd = resolved ? `${resolved.command} ${resolved.args.join(" ")}` : `npm install ${pkg}`;

          try {
            console.log(pc.dim(`  Running: ${installCmd}`));
            execSync(installCmd, { cwd, stdio: "pipe" });
            console.log(pc.green(`  Installed ${pkg}`));
          } catch {
            console.log(pc.yellow(`  Failed to install ${pkg}. Run manually: ${installCmd}`));
          }
        }
      }

      // Update .gitignore
      if (options.addGitignore) {
        const gitignorePath = path.join(cwd, ".gitignore");
        let content = "";
        if (fs.existsSync(gitignorePath)) {
          content = fs.readFileSync(gitignorePath, "utf-8");
        }
        if (!content.includes(".a11y-cache")) {
          const newline = content.endsWith("\n") ? "" : "\n";
          fs.appendFileSync(gitignorePath, `${newline}.a11y-cache\n`);
          console.log(pc.green("  Updated .gitignore"));
        }
      }

      // Next steps
      console.log("");
      console.log(pc.bold("  Next steps:"));
      if (options.provider !== "none" && options.provider !== "ollama") {
        const envVar = PROVIDER_ENV[options.provider];
        if (envVar) {
          console.log(`    1. Set ${pc.bold(envVar)} in your .env`);
          console.log(`    2. Run: ${pc.bold("npx next-a11y scan ./src")}`);
        }
      } else if (options.provider === "ollama") {
        console.log(`    1. Ensure Ollama is running locally`);
        console.log(`    2. Run: ${pc.bold("npx next-a11y scan ./src")}`);
      } else {
        console.log(`    1. Run: ${pc.bold("npx next-a11y scan ./src --no-ai")}`);
      }
      console.log("");
    });
}

async function promptInitOptions(): Promise<InitOptions> {
  const provider = await promptSelect<ProviderName | "none">(
    "Which AI provider do you want to use?",
    [
      { value: "openai", label: "OpenAI (gpt-4.1-nano)" },
      { value: "google", label: "Google (gemini-2.0-flash-lite) — free tier" },
      { value: "anthropic", label: "Anthropic (claude-haiku-4-5)" },
      { value: "ollama", label: "Ollama (local, offline)" },
      { value: "none", label: "None — deterministic fixes only" },
    ]
  );

  let installDep = false;
  if (provider !== "none") {
    installDep = await promptYesNo(`Install AI SDK package now?`);
  }

  const addGitignore = await promptYesNo(`Add .a11y-cache to .gitignore?`);

  return { provider, installDep, addGitignore };
}

function promptSelect<T extends string>(
  question: string,
  options: { value: T; label: string }[]
): Promise<T> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log(`  ${pc.bold(question)}`);
    options.forEach((opt, i) => {
      console.log(`    ${pc.dim(`${i + 1}.`)} ${opt.label}`);
    });

    rl.question(`  Choice [1-${options.length}]: `, (answer) => {
      rl.close();
      const idx = parseInt(answer.trim()) - 1;
      if (idx >= 0 && idx < options.length) {
        resolve(options[idx].value);
      } else {
        resolve(options[0].value);
      }
    });
  });
}

function promptYesNo(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(`  ${question} ${pc.dim("[Y/n]")} `, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized !== "n" && normalized !== "no");
    });
  });
}

function generateConfig(provider: ProviderName | "none", include: string[]): string {
  const providerLine =
    provider === "none"
      ? "  // provider: 'openai',  // Uncomment and set when ready"
      : `  provider: "${provider}",`;

  const modelMap: Record<string, string> = {
    openai: "gpt-4.1-nano",
    anthropic: "claude-haiku-4-5-20251001",
    google: "gemini-2.0-flash-lite",
    ollama: "llava",
  };

  const modelLine =
    provider !== "none"
      ? `\n  model: "${modelMap[provider]}",`
      : "";

  return `import { defineConfig } from "next-a11y";

export default defineConfig({
${providerLine}${modelLine}
  locale: "en",
  cache: ".a11y-cache",
  scanner: {
    include: [${include.map((p) => `"${p}"`).join(", ")}],
    exclude: ["**/*.test.*", "**/*.stories.*"],
  },
  rules: {
    "img-alt": "fix",
    "button-label": "fix",
    "link-label": "fix",
    "input-label": "fix",
    "html-lang": "fix",
    "emoji-alt": "fix",
    "no-positive-tabindex": "fix",
    "button-type": "fix",
    "link-noopener": "fix",
    "next-metadata-title": "warn",
    "next-image-sizes": "warn",
    "next-link-no-nested-a": "fix",
    "next-skip-nav": "warn",
    "heading-order": "warn",
    "no-div-interactive": "warn",
  },
});
`;
}
