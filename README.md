> [!IMPORTANT]
> THIS PACKAGE IS IN ACTIVE DEVELOPMENT

# next-a11y

**Finds accessibility violations in your Next.js source code. Writes the fix.**

```
jsx-a11y tells you the alt is missing.
axe tells you the button has no accessible name.
next-a11y writes the fix.
```

95% of websites fail WCAG 2.2 AA. The same 6 error types. Every year. For 5 years straight. ([WebAIM Million 2025](https://webaim.org/projects/million/))

next-a11y fixes 5 of those 6 automatically: **missing alt text**, **missing form labels**, **empty links**, **empty buttons**, **missing lang**. The 6th — low contrast — requires runtime color analysis and isn't detectable from source. We also catch the rest (heading order, skip nav, etc.).

## Quick start

```bash
npx next-a11y init        # pick AI provider, generates config
npx next-a11y scan ./src  # see what's broken
npx next-a11y scan ./src --fix   # fix it
```

### Before (report only)

```
  next-a11y v0.1.9
  Scanned 13 files

  Heuristic score:  34 / 100  Poor

  [AI] fixes available:
    [img]  12 images missing alt text -24 pts
         src/components/Hero.tsx:7 — Image is missing alt text
         src/components/ProductCard.tsx:8 — Image has meaningless alt text: "IMG_123.jpg"
    [btn]   4 buttons without accessible name -8 pts
         src/components/Navbar.tsx:12 — Button has no accessible name
    [lnk]   2 links without accessible name -4 pts
    [inp]   3 inputs without label -9 pts
  Auto fixes available:
    [lng]   1 missing lang on <html> -5 pts
  Warnings (manual review needed):
    [img]   2 next/image without sizes -2 pts
    [nav]   1 missing skip navigation link -3 pts
    [hdg]   1 heading hierarchy violations -1 pts
    [div]   1 div used as interactive element -1 pts

  ----------------------------------------
  38 fixable · 4 warnings · Run --fix to apply
```

### After (with --fix)

```
  Generating text using openai/gpt-4o-mini

  [AI] resolved 1/18 → "Hero image with welcome message"
  [AI] resolved 2/18 → "Add to cart"
  [AI] resolved 3/18 → "Visit Twitter"
  ...
  Total tokens used: 2,450

  Fixes applied:

  [FIXED]  src/components/Hero.tsx:7  added alt text "Hero image with welcome message"
  [FIXED]  src/components/Navbar.tsx:12  added aria-label "Add to cart"
  [FIXED]  src/components/Footer.tsx:7  added rel="noopener noreferrer"
  [FIXED]  src/app/layout.tsx:11  added lang "en"
  [FIXED]  src/app/page.tsx:1  added metadata.title "Home"
  ...

  next-a11y v0.1.9
  Scanned 13 files

  Heuristic score:  97 / 100  Good

  Warnings (manual review needed):
    [img]   2 next/image without sizes -2 pts
    [nav]   1 missing skip navigation link -3 pts
    [hdg]   1 heading hierarchy violations -1 pts
    [div]   1 div used as interactive element -1 pts

  ----------------------------------------
  [FIXED] 31 · 4 warnings
  Score: 34 -> 97 (+63 pts)
```

## What it fixes

### AI-powered (vision + text models)

| Rule           | What it does                                                    |
| -------------- | --------------------------------------------------------------- |
| `img-alt`      | Sends image to vision model → generates WCAG-compliant alt text |
| `button-label` | Icon button → reads icon name + context → `aria-label`          |
| `link-label`   | Icon link → same approach                                       |
| `input-label`  | Unlabeled input → generates `<label>` or `aria-label`           |

### Deterministic (zero AI cost, no API key)

| Rule                   | What it does                                          |
| ---------------------- | ----------------------------------------------------- |
| `html-lang`            | Reads `next.config.js` locale → inserts `lang`        |
| `emoji-alt`            | `🔥` → `<span role="img" aria-label="fire">🔥</span>` |
| `no-positive-tabindex` | `tabIndex={5}` → `tabIndex={0}`                       |
| `button-type`          | `<button>` → `<button type="button">`                 |
| `link-noopener`        | `target="_blank"` → adds `rel="noopener noreferrer"`  |

### Next.js-specific

| Rule                    | What it does                                                             |
| ----------------------- | ------------------------------------------------------------------------ |
| `next-metadata-title`   | Warns if `layout.tsx` / `page.tsx` has no title (breaks route announcer) |
| `next-image-sizes`      | Warns if `<Image fill>` is missing `sizes`                               |
| `next-link-no-nested-a` | Removes `<Link><a>` double anchor (Next 12→13 migration artifact)        |
| `next-skip-nav`         | Warns if root layout has no skip navigation link                         |

### Detection-only (reports, human decides)

| Rule                 | What it does                                             |
| -------------------- | -------------------------------------------------------- |
| `heading-order`      | Flags `h1` → `h3` skips (shows heading text in message)  |
| `no-div-interactive` | Flags `<div onClick>` without `role` or keyboard handler |

## Locale support

Generated labels (aria-labels, alt text, page titles) follow the target locale:

```bash
npx next-a11y scan ./src --fix --locale pl
```

Supported: `en`, `pl`, `de`, `es`, `fr`. Known icons (Twitter, GitHub, Cart, etc.) use locale-aware heuristics; others are generated by AI in the requested language.

## No AI? No problem.

```bash
npx next-a11y scan ./src --fix --no-ai  # not recommended for best results
```

9 deterministic rules work without any API key or AI setup. Not recommended for best results — AI fixes handle alt text, labels, and page titles more accurately.

## AI providers

Works with any major provider through [Vercel AI SDK](https://sdk.vercel.ai/):

```bash
npm install -D @ai-sdk/google       # free tier: 1500 req/day
# or
npm install -D @ai-sdk/openai       # gpt-4o-mini ~$0.001/fix
# or
npm install -D @ai-sdk/anthropic    # claude-haiku ~$0.001/fix
# or
npm install -D @openrouter/ai-sdk-provider   # 200+ models via one API
# or
npm install -D ollama-ai-provider   # local, $0
```

## Config

```typescript
// a11y.config.ts
import { defineConfig } from "next-a11y";

export default defineConfig({
  provider: "google",
  model: "gemini-2.0-flash-lite",
  locale: "en",
  scanner: {
    include: ["src/**/*.{tsx,jsx}"],
    exclude: ["**/*.test.*", "**/*.stories.*"],
  },
  rules: {
    "img-alt": "fix", // 'fix' | 'warn' | 'off'
    "button-label": "fix",
    "emoji-alt": "fix",
    "heading-order": "warn",
    // ...all 15 rules configurable
  },
});
```

## CLI reference

### scan

```bash
npx next-a11y scan <path> [options]
```

| Option                | Description                                                          |
| --------------------- | -------------------------------------------------------------------- |
| `--fix`               | Auto-fix issues                                                      |
| `-i, --interactive`   | Review each fix interactively                                        |
| `--no-ai`             | Skip AI-powered fixes (deterministic only, not recommended)          |
| `--provider <name>`   | Override AI provider (openai, anthropic, google, ollama, openrouter) |
| `--model <name>`      | Override AI model                                                    |
| `--fill-alt`          | Replace empty `alt=""` with AI-generated text                        |
| `--locale <locale>`   | Locale for generated content (e.g. en, pl, de)                       |
| `--min-score <score>` | Exit code 1 if heuristic score below threshold                       |
| `-q, --quiet`         | Minimal output (no progress, one-line report)                        |

### init

```bash
npx next-a11y init
```

Creates `a11y.config.ts`, optionally installs AI SDK package, adds `.a11y-cache` to `.gitignore`.

### cache

```bash
npx next-a11y cache stats   # Show cache statistics
npx next-a11y cache clear  # Clear the cache
```

## Scoring

The 0–100 score is a **heuristic** — it does not certify WCAG compliance. It's a weighted count of detected violations (e.g. missing alt −2 pts, missing lang −5 pts). Use it to track progress and gate CI; don't treat 97/100 as "WCAG AA compliant."

## CI

```yaml
# .github/workflows/a11y.yml
- name: Accessibility check
  run: npx next-a11y scan ./src --min-score 80
```

Exits with code 1 below threshold. Block PRs that regress accessibility.

## Try it

```bash
git clone https://github.com/MaciejWiatr/next-a11y
cd next-a11y/examples/broken-site
npx next-a11y scan . --fix
```

`broken-site` is an intentionally inaccessible Next.js app that triggers all 15 rules.

## How it works

Static analysis codemod. Parses your source with [ts-morph](https://github.com/dsherret/ts-morph), runs 15 rules against the AST, generates fixes (AI or pattern-based), writes them back to your files. Fixes are applied concurrently per file. Cache keys include locale so `--locale pl` and `--locale en` don't overwrite each other. Use `--quiet` / `-q` for minimal output (CI-friendly). No browser. No runtime. Ships zero code to production.

## License

MIT
