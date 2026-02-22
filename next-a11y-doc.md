# next-a11y — Architecture Document

> AI-powered accessibility codemod for Next.js. Scans your source code, detects WCAG violations, and auto-fixes them — from missing alt texts to unlabeled buttons. Fixes 5 of the 6 most common accessibility errors (WebAIM Million 2025): missing alt, missing form labels, empty links, empty buttons, missing lang. The 6th — low contrast — requires runtime analysis.

---

## Scope

Static analysis codemod — runs at dev time, modifies source files, ships zero code to production. Two categories of fixes: **AI-powered** (generates accessible names using vision models) and **deterministic** (pattern-based transforms, no AI cost). No browser, no runtime, no Playwright.

---

## 1. What It Fixes

Based on WebAIM Million 2025 data — the annual audit of 1,000,000 homepages that found 95% failing WCAG 2.2 AA. The top 6 error categories account for 96.4% of all detected errors. next-a11y auto-fixes 5 of 6 (missing alt, form labels, empty links, empty buttons, missing lang); the 6th (low contrast) requires runtime color analysis.

### AI-Powered Fixes (require vision model)

| Issue                                | Prevalence     | What next-a11y does                                                                          |
| ------------------------------------ | -------------- | -------------------------------------------------------------------------------------------- |
| Missing / meaningless image alt text | 55.5% of pages | Sends image to vision model, generates WCAG-compliant alt text                               |
| Empty buttons (icon buttons)         | ~27% of pages  | Reads icon component name + surrounding code, generates `aria-label`                         |
| Empty links (icon links)             | ~18% of pages  | Same as above for `<a>` wrapping only an icon                                                |
| Missing form input labels            | ~20% of pages  | Analyzes input context (placeholder, name, nearby text), generates `<label>` or `aria-label` |

### Deterministic Fixes (zero AI cost)

| Issue                                     | What next-a11y does                                                                                                                       |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Missing `lang` on `<html>`                | Detects locale from `next.config.js` / `next-intl` / `i18n` config, inserts `lang` attribute                                              |
| Emoji without accessible name             | `<span>🔥</span>` → `<span role="img" aria-label="fire">🔥</span>`                                                                        |
| Positive `tabIndex`                       | `tabIndex={5}` → `tabIndex={0}` (positive tabindex is an antipattern)                                                                     |
| `<button>` without `type`                 | `<button>` / `<Button>` → `<button type="button">`. For custom Button components, checks if `type` prop exists in interface before fixing |
| `<a target="_blank">` without `rel`       | Adds `rel="noopener noreferrer"` — supports native `<a>` and `<Link>` from `next/link`                                                    |
| Missing page `<title>` / `metadata.title` | Detects routes (App Router `page.tsx` / Pages Router pages) without a title — critical for Next.js route announcer                        |
| `next/image` without `sizes`              | Responsive `<Image>` without `sizes` prop loads full-width image on all viewports — performance + a11y waste                              |
| `next/link` wrapping `<a>`                | Post-Next.js 13 antipattern: `<Link><a>...</a></Link>` renders double anchor — breaks keyboard navigation                                 |
| Missing skip navigation link              | Detects if root layout lacks a skip-to-content link — standard a11y practice missing from most Next.js projects                           |

### Detection-Only (reports, does not auto-fix)

| Issue                        | Prevalence | Why no auto-fix                                                                               |
| ---------------------------- | ---------- | --------------------------------------------------------------------------------------------- |
| Heading hierarchy violations | Common     | h1 → h3 skip — reports, but restructuring headings requires human judgment                    |
| `<div>` used as button/link  | Common     | Reports `<div onClick>` without `role="button"` — refactoring to `<button>` may break styling |

---

## 2. User-Facing Interface

### CLI

```bash
# Scan and report — no changes
npx next-a11y scan ./src

# Fix everything (AI + deterministic)
npx next-a11y scan ./src --fix

# Interactive — review each fix
npx next-a11y scan ./src --fix -i

# Deterministic fixes only (no AI, no API key needed — not recommended for best results)
npx next-a11y scan ./src --fix --no-ai

# Override AI provider
npx next-a11y scan ./src --fix --provider google --model gemini-2.0-flash-lite

# Cache management
npx next-a11y cache stats
npx next-a11y cache clear

# CI gate — exit code 1 if score below threshold
npx next-a11y scan ./src --min-score 80
```

### Init

```bash
npx next-a11y init
```

Interactive setup wizard that bootstraps the project config:

```
npx next-a11y init

  next-a11y v1.0.0 — Setup

  ◆ Which AI provider do you want to use?
  │  ○ OpenAI (gpt-4.1-nano)
  │  ● Google (gemini-2.0-flash-lite) — free tier: 1500/day
  │  ○ Anthropic (claude-haiku-4-5)
  │  ○ Ollama (local, offline)
  │  ○ None — deterministic fixes only
  │
  ◆ Install @ai-sdk/google now?
  │  ● Yes
  │  ○ No, I'll install it myself
  │
  ◆ Add .a11y-cache to .gitignore?
  │  ● Yes
  │  ○ No — I want to commit cached results
  │
  ✔ Created a11y.config.ts
  ✔ Installed @ai-sdk/google
  ✔ Updated .gitignore

  Next steps:
    1. Set GOOGLE_GENERATIVE_AI_API_KEY in your .env
    2. Run: npx next-a11y scan ./src
```

**What `init` does:**

1. **Detects package manager** — reads lockfile (`package-lock.json` → npm, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lock` → bun)
2. **Provider selection** — prompts for AI provider or "None" for deterministic-only mode (no API key needed)
3. **Peer dep install** — offers to install the chosen `@ai-sdk/*` package using the detected package manager
4. **Project detection** — reads `next.config.*` and directory structure to set `scanner.include` (`src/**` vs `app/**` vs both)
5. **Config generation** — writes `a11y.config.ts` with chosen provider, detected project structure, and sensible defaults
6. **Gitignore update** — optionally appends `.a11y-cache` to `.gitignore`
7. **Next steps** — prints the env variable name for the chosen provider's API key and the scan command

**Provider → env variable mapping:**

| Provider  | Env variable                   |
| --------- | ------------------------------ |
| OpenAI    | `OPENAI_API_KEY`               |
| Google    | `GOOGLE_GENERATIVE_AI_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY`            |
| Ollama    | None (local)                   |
| None      | None                           |

### Example Output — Before

```
npx next-a11y scan ./src

  next-a11y v1.0.0
  🔍 Scanned 47 files · 312 elements

  ╭──────────────────────────────────────╮
  │  Heuristic score:  34 / 100  🔴  │
  ╰──────────────────────────────────────╯

  AI fixes available:
    🖼️  12 images missing alt text              -24 pts
    🔘   4 icon buttons without aria-label       -8 pts
    🔗   2 icon links without aria-label         -4 pts
    📝   3 inputs without label                  -9 pts

  Auto fixes available:
    🌐   1 missing lang on <html>                -5 pts
    👆   3 positive tabIndex values              -3 pts
    😀   6 emoji without role="img"              -3 pts
    🔘   2 buttons without type                  -2 pts
    🔗   4 links target="_blank" without rel     -2 pts

  Next.js-specific:
    📄   2 routes missing page title             -6 pts
    🖼️   3 next/image without sizes              -3 pts
    🔗   1 next/link wrapping nested <a>         -2 pts
    ⏭️   missing skip navigation link            -3 pts

  Warnings (manual review needed):
    📊   2 heading hierarchy violations
    📦   1 div used as interactive element

  ─────────────────────────────────────
  38 fixable · 4 warnings · Run --fix to apply
```

### Example Output — After

```
npx next-a11y scan ./src     # after running --fix

  next-a11y v1.0.0
  🔍 Scanned 47 files · 312 elements

  ╭──────────────────────────────────────╮
  │  Heuristic score:  97 / 100  🟢  │
  ╰──────────────────────────────────────╯

  ✅ All auto-fixable issues resolved

  Remaining warnings (manual review):
    📊   2 heading hierarchy violations          -2 pts
    📦   1 div used as interactive element       -1 pt

  ─────────────────────────────────────
  0 fixable · 4 warnings · Score: 34 → 97 (+63 pts)
```

### Scoring System

Score starts at **100** and deducts points per violation. Weights reflect real-world user impact — how severely the issue blocks access for people using assistive technology. **This is a heuristic score, not a WCAG compliance certification** — 97/100 does not mean WCAG AA compliant.

**Weight table:**

| Weight   | Rule                    | Per violation | Rationale                       |
| -------- | ----------------------- | ------------- | ------------------------------- |
| Critical | `img-alt`               | -2            | Screen reader gets zero info    |
| Critical | `button-label`          | -2            | Unlabeled controls are unusable |
| Critical | `link-label`            | -2            | Same — no accessible name       |
| Critical | `input-label`           | -3            | Forms impossible to fill        |
| Critical | `html-lang`             | -5            | Entire page mispronounced       |
| Critical | `next-metadata-title`   | -3            | Route announcer silent          |
| Moderate | `next-skip-nav`         | -3            | Keyboard users trapped in nav   |
| Moderate | `next-link-no-nested-a` | -2            | Double anchor breaks keyboard   |
| Moderate | `no-positive-tabindex`  | -1            | Breaks expected tab order       |
| Moderate | `button-type`           | -1            | Unexpected form submission      |
| Moderate | `next-image-sizes`      | -1            | Performance degradation         |
| Moderate | `heading-order`         | -1            | Navigation confusion            |
| Moderate | `no-div-interactive`    | -1            | Keyboard users can't activate   |
| Low      | `emoji-alt`             | -0.5          | Decorative, minor impact        |
| Low      | `link-noopener`         | -0.5          | Security + minor UX             |

Score clamped to **0–100**. Thresholds:

| Range  | Badge         | Meaning                            |
| ------ | ------------- | ---------------------------------- |
| 90–100 | 🟢 Good       | Minor issues at most               |
| 70–89  | 🟡 Needs work | Notable barriers exist             |
| 0–69   | 🔴 Poor       | Significant accessibility failures |

**Delta tracking:** The score from the previous scan is stored in `.a11y-cache`. On subsequent runs, the before → after delta is shown automatically — gives immediate, quantified feedback on the impact of `--fix`.

**CI integration:** `npx next-a11y scan ./src --min-score 80` exits with code 1 if score is below threshold. Drop into GitHub Actions to block PRs that regress accessibility.

### Config File

```typescript
// a11y.config.ts
import { defineConfig } from "next-a11y";

export default defineConfig({
  // AI provider settings
  provider: "openai",
  model: "gpt-4.1-nano",
  locale: "en",

  // Cache
  cache: ".a11y-cache",

  // Scanner
  scanner: {
    include: ["src/**/*.{tsx,jsx}"],
    exclude: ["**/*.test.*", "**/*.stories.*"],
  },

  // Rule configuration
  rules: {
    // AI-powered rules
    "img-alt": "fix", // 'fix' | 'warn' | 'off'
    "button-label": "fix",
    "link-label": "fix",
    "input-label": "fix",

    // Deterministic rules
    "html-lang": "fix",
    "emoji-alt": "fix",
    "no-positive-tabindex": "fix",
    "button-type": "fix",
    "link-noopener": "fix",

    // Next.js-specific rules
    "next-metadata-title": "warn",
    "next-image-sizes": "warn",
    "next-link-no-nested-a": "fix",
    "next-skip-nav": "warn",

    // Detection-only rules
    "heading-order": "warn",
    "no-div-interactive": "warn",
  },
});
```

---

## 3. Pipeline Overview

```
npx next-a11y scan ./src --fix
         │
         ▼
┌─────────────────────┐
│  1. Load Config      │  a11y.config.ts → merge with CLI flags → ResolvedConfig
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  2. Discover Files   │  fs.glob() finds .tsx/.jsx files
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  3. Parse (AST)      │  ts-morph loads project with tsconfig.json
│                      │  Resolves imports (next/image, icon libraries)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  4. Run Rules        │  Each rule scans AST for violations
│                      │  Produces: Violation[] with file, line, element, rule, severity
└──────────┬──────────┘
           │
           ├──── deterministic ────┐
           │                       ▼
           │              ┌─────────────────┐
           │              │  5a. Auto-Fix    │  Pattern transform (no AI)
           │              │                  │  e.g. tabIndex={5} → tabIndex={0}
           │              └────────┬────────┘
           │                       │
           ├──── AI-powered ───────┤
           │                       ▼
           │              ┌─────────────────┐
           │              │  5b. Resolve     │  Image src → Buffer
           │              │                  │  Icon name → component context
           │              └────────┬────────┘
           │                       │
           │                       ▼
           │              ┌─────────────────┐
           │              │  5c. Cache Check │  SHA-256 hash → cached result?
           │              └────────┬────────┘
           │                       │
           │                       ▼
           │              ┌─────────────────┐
           │              │  5d. AI Generate │  Vercel AI SDK → generateText()
           │              │                  │  vision model for images
           │              │                  │  text model for code context
           │              └────────┬────────┘
           │                       │
           ├───────────────────────┘
           ▼
┌─────────────────────┐
│  6. Apply / Report   │  --fix: ts-morph writes changes to source
│                      │  -i: interactive review per fix
│                      │  default: print report only
└─────────────────────┘
```

---

## 4. Rule System

Each rule is a self-contained module that:

1. Scans the AST for violations
2. Classifies severity (`fix` or `warn`)
3. Produces a `Fix` object (or a `Warning` for detection-only rules)

```typescript
interface Rule {
  id: string; // e.g. 'img-alt'
  type: "ai" | "deterministic" | "detect";
  scan(file: SourceFile): Violation[];
}

interface Violation {
  rule: string;
  filePath: string;
  line: number;
  element: string; // JSX snippet for display
  fix?: Fix; // absent for detect-only rules
}

interface Fix {
  type: "insert-attr" | "replace-attr" | "insert-element" | "wrap-element";
  // AI fixes: value is generated asynchronously after resolve + generate steps
  // Deterministic fixes: value is computed immediately from AST
  value: string | (() => Promise<string>);
}
```

### Rule Reference

#### `img-alt` (AI)

Finds `<Image>` and `<img>` elements with missing or meaningless alt text.

**Classification:**

| `alt` value                                 | Classification | Action |
| ------------------------------------------- | -------------- | ------ |
| Missing entirely                            | `missing`      | Fix    |
| `"image"`, `"photo"`, `"IMG_001"`, filename | `meaningless`  | Fix    |
| `""`                                        | `decorative`   | Skip   |
| `{t('key')}`, `{variable}`                  | `dynamic`      | Skip   |
| 3+ descriptive words                        | `valid`        | Skip   |

**Fix:** Resolves image to Buffer → sends to vision model with system prompt + page context → inserts generated alt text.

#### `button-label` (AI)

Finds `<button>` elements with no accessible name — no text content, no `aria-label`, no `aria-labelledby`.

**Common pattern:** Icon buttons like `<button><TrashIcon /></button>` or `<button><svg>...</svg></button>`.

**Fix:** Reads icon component name (e.g. `TrashIcon`, `XIcon`, `ChevronLeft`), parent component context, nearby text → AI generates `aria-label`. Falls back to icon name heuristic if AI unavailable (`TrashIcon` → `"Delete"`).

**Variable in scope:** When the button is inside a `.map()` callback (e.g. `sections.map((section) => ...)`) and a variable like `section.label` is used in the content, the generated label includes it: `aria-label={\`Go to section ${section.label}\`}`. Same for generic existing labels — suggests replacing `aria-label="Przejdź do sekcji"` with the variable when it appears in the button content.

#### `link-label` (AI)

Same as `button-label` but for `<a>` and `<Link>` elements wrapping only an icon or image without alt text. Uses variable in scope when inside `.map()` (e.g. `item.label`).

#### `input-label` (AI)

Finds `<input>`, `<select>`, `<textarea>` elements without an associated `<label htmlFor>` or `aria-label`.

**Fix:** Reads `placeholder`, `name`, `id`, `type`, surrounding form context → AI generates either a `<label>` element (preferred) or `aria-label` attribute. Uses variable in scope when input is inside `.map()` (e.g. `field.placeholder`, `field.label`).

#### `html-lang` (deterministic)

Checks root layout for `<html>` without `lang` attribute.

**Detection:** Scans `app/layout.tsx` or `pages/_document.tsx` for the `<html>` element.

**Fix:** Reads locale from `next.config.js` `i18n.defaultLocale`, `next-intl` config, or falls back to `"en"`. Inserts `lang="en"`.

#### `emoji-alt` (deterministic)

Finds inline emoji characters in JSX text content without `role="img"` and `aria-label`.

**Fix:** Wraps emoji in `<span role="img" aria-label="...">emoji</span>`. Label is resolved from Unicode CLDR emoji names (bundled lookup table, ~15KB).

#### `no-positive-tabindex` (deterministic)

Finds `tabIndex` with positive values (1, 2, 5, etc.).

**Fix:** Replaces with `tabIndex={0}`. Positive tabindex breaks natural tab order and is a WCAG antipattern.

#### `button-type` (deterministic)

Finds native `<button>` elements without explicit `type` attribute.

**Fix:** Inserts `type="button"`. Components already having `type="submit"` or `type="reset"` are skipped.

**Custom components** (`Button`, `IconButton`, etc.) are reported as warnings only — no auto-fix attempt, since props vary across component libraries.

**Why this matters:** The default `type="submit"` causes unexpected form submissions when a button is inside a `<form>` without an explicit type.

#### `link-noopener` (deterministic)

Finds `<a target="_blank">` and `<Link target="_blank">` (from `next/link`) without `rel="noopener noreferrer"`.

**Detection:** ts-morph resolves the `Link` import to confirm it originates from `next/link` — ignores unrelated `Link` components (e.g. from React Router or custom UI libraries).

**Fix:** Inserts `rel="noopener noreferrer"`. If `rel` already exists with partial value (e.g. `rel="noopener"`), appends the missing part.

### Next.js-Specific Rules

#### `next-metadata-title` (deterministic)

Ensures routes have a page title — critical because the **Next.js route announcer** reads `document.title` to announce page changes to screen readers. Without a title, screen reader users get no feedback on navigation.

**Detection (App Router):** Checks each `layout.tsx` and `page.tsx` for `export const metadata = { title: '...' }` or `export function generateMetadata()`. Both files are scanned because a layout title template (`"%s | Mimira"`) still needs each page to provide its own `title` segment.

**Detection (Pages Router):** Checks pages for `<Head><title>...</title></Head>`.

**Reports:** Warning with file path. Does not auto-fix — title content requires human judgment.

#### `next-image-sizes` (deterministic)

Finds `<Image>` (from `next/image`) with `fill` prop but missing `sizes`.

**Why it matters:** Without `sizes`, the browser requests the largest image variant for all viewports — wastes bandwidth and degrades experience on slow connections.

**Reports:** File, line, warning with link to Next.js `sizes` documentation.

#### `next-link-no-nested-a` (deterministic)

Finds `<Link>` from `next/link` with a nested `<a>` tag inside — a common migration artifact from Next.js 12 → 13+.

**Why it matters:** Since Next.js 13, `<Link>` renders an `<a>` automatically. Wrapping another `<a>` inside creates a double anchor: `<a><a>text</a></a>`. This is invalid HTML, confuses screen readers, and can break keyboard navigation (two tab stops for one link).

**Fix:** Removes the inner `<a>` and hoists its props (`className`, `style`, etc.) to the parent `<Link>`:

```
// Before
<Link href="/about"><a className="nav-link">About</a></Link>

// After
<Link href="/about" className="nav-link">About</Link>
```

#### `next-skip-nav` (deterministic)

Checks if the root layout (`app/layout.tsx` or `pages/_app.tsx`) contains a skip navigation link — a visually hidden link at the very top of the page that jumps to `#main-content` on focus.

**Why it matters:** Keyboard users must tab through the entire navigation on every page load without a skip link. It's one of the most basic a11y requirements and one of the most commonly missing.

**Reports:** Warning if no skip link is detected. Suggests inserting:

```tsx
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
```

Does not auto-fix because insertion point and styling depend on the project's layout structure.

### Detection-Only Rules

#### `heading-order` (detect-only)

Walks the component tree and detects heading level skips (e.g. `<h1>` followed by `<h3>` with no `<h2>`).

**Reports:** File, line, expected level, actual level.

#### `no-div-interactive` (detect-only)

Finds `<div>` or `<span>` elements with `onClick` handler but no `role`, `tabIndex`, or keyboard event handler.

**Reports:** Suggests converting to `<button>` or adding `role="button"` + `tabIndex={0}` + `onKeyDown`.

---

## 5. AI Integration

### Provider System (Vercel AI SDK)

Uses `ai` package as unified interface. One integration handles all providers — same `generateText()` call regardless of model.

**Supported providers:**

| Config value  | AI SDK package (peer dep) | Recommended model           | Cost per fix    |
| ------------- | ------------------------- | --------------------------- | --------------- |
| `'openai'`    | `@ai-sdk/openai`          | `gpt-4.1-nano`              | ~$0.001         |
| `'anthropic'` | `@ai-sdk/anthropic`       | `claude-haiku-4-5-20251001` | ~$0.001         |
| `'google'`    | `@ai-sdk/google`          | `gemini-2.0-flash-lite`     | Free (1500/day) |
| `'ollama'`    | `ollama-ai-provider`      | `llava`, `moondream`        | $0 (local)      |

### Two Prompt Strategies

**Vision prompt** (for `img-alt`): Sends base64 image + system prompt + page context (component name, nearby headings, route).

System prompt guidelines (WCAG 2.1):

- 1-2 sentences, prefer <125 characters
- Describe what the image shows, not what it is
- No "Image of..." / "Photo of..." prefixes
- Include visible text, actions, key details
- Return `""` if purely decorative
- Respect target locale

**Code context prompt** (for `button-label`, `link-label`, `input-label`): Sends JSX snippet + component context + icon name. No image processing needed — uses text-only model (cheaper, faster).

### Image Resolution

| Source                          | Strategy                             |
| ------------------------------- | ------------------------------------ |
| `src="/hero.png"`               | Read `./public/hero.png` from disk   |
| `src={heroImg}` (static import) | ts-morph follows import to file path |
| `src="https://..."`             | HTTP GET, timeout 10s, max 5MB       |
| `src={product.image}` (dynamic) | Cannot resolve — skip                |

### Cache

Content-addressed JSON file cache. Key = `SHA-256(imageBuffer)` for images, `SHA-256(codeContext)` for code-based fixes.

```json
// .a11y-cache/cache.json
{
  "a1b2c3d4": {
    "alt": "Dashboard showing active tenders and bid analytics",
    "model": "gpt-4.1-nano",
    "locale": "en",
    "rule": "img-alt",
    "generatedAt": "2026-02-21T10:00:00Z"
  }
}
```

Same image at different paths → one cache entry. Image changes → cache miss → regenerate. Cache is git-committable — team shares generated fixes without re-running AI.

---

## 6. Interactive Mode

Built with Node.js `readline` + `picocolors`. No external prompt library.

```
next-a11y v1.0.0 — Interactive mode

[1/21] src/components/Hero.tsx:24
  Rule:     img-alt
  Element:  <Image src="/hero-dashboard.png" />
  Context:  Hero component, /app/page.tsx route

  📝 Suggested:
    alt="Procurement dashboard displaying active tenders and monthly savings"

  (Y)es  (n)o  (s)kip remaining  (q)uit → _

────────────────────────────────

[2/21] src/components/Sidebar.tsx:8
  Rule:     button-label
  Element:  <button onClick={toggle}><MenuIcon /></button>

  📝 Suggested:
    aria-label="Toggle navigation menu"

  (Y)es  (n)o  (s)kip remaining  (q)uit → _
```

Summary at end: applied, skipped counts per rule.

---

## 7. Dependencies

### Production

```
ai                  Vercel AI SDK core — generateText(), image parts, provider abstraction
ts-morph            AST parsing + modification, tsconfig.json resolution, JSX manipulation
commander           CLI framework — subcommands, flags, --help generation
picocolors          Terminal colors — 3.5KB, zero transitive deps
```

### Peer (user installs what they need)

```
@ai-sdk/openai      Required if provider: 'openai'
@ai-sdk/anthropic    Required if provider: 'anthropic'
@ai-sdk/google       Required if provider: 'google'
ollama-ai-provider   Required if provider: 'ollama'
```

### Development

```
typescript           Type checking
tsup                 Bundler — ESM + CJS dual output
vitest               Test runner
```

### What we don't depend on and why

| Avoided                        | Replaced with                     | Reason                              |
| ------------------------------ | --------------------------------- | ----------------------------------- |
| `globby` / `fast-glob`         | `fs.glob()` (Node 22+) + fallback | Native API, one less dep            |
| `@clack/prompts` / `inquirer`  | `readline` + `picocolors`         | Interactive mode is Y/n/skip loop   |
| `chalk`                        | `picocolors`                      | 45x smaller                         |
| `openai` / `@anthropic-ai/sdk` | `ai` (Vercel AI SDK)              | One package, all providers          |
| `eslint-plugin-jsx-a11y`       | Own rule engine                   | jsx-a11y detects, we detect AND fix |

---

## 8. File Structure

```
next-a11y/
├── src/
│   ├── index.ts                         # Public API: defineConfig
│   │
│   ├── config/
│   │   ├── schema.ts                    # Config types + defaults
│   │   └── resolve.ts                   # Load + merge config sources
│   │
│   ├── scan/
│   │   ├── scan.ts                      # Main scan orchestrator
│   │   ├── glob.ts                      # File discovery (fs.glob + fallback)
│   │   ├── context.ts                   # Extract component name, route, nearby text
│   │   ├── score.ts                     # Scoring engine — weights, compute, delta tracking
│   │   └── types.ts                     # Rule, Violation, Fix interfaces
│   │
│   ├── rules/
│   │   ├── index.ts                     # Rule registry — exports all rules
│   │   │
│   │   ├── img-alt/
│   │   │   ├── img-alt.rule.ts          # Detection: missing/meaningless alt
│   │   │   ├── img-alt.fix.ts           # AI fix: vision model → alt text
│   │   │   ├── img-alt.resolve.ts       # Image src → Buffer resolution
│   │   │   ├── img-alt.classify.ts      # Alt classification (missing/meaningless/valid/decorative)
│   │   │   ├── img-alt.prompt.ts        # WCAG-aligned vision prompt
│   │   │   └── img-alt.test.ts
│   │   │
│   │   ├── button-label/
│   │   │   ├── button-label.rule.ts     # Detection: buttons without accessible name
│   │   │   ├── button-label.fix.ts      # AI fix: icon name + context → aria-label
│   │   │   └── button-label.test.ts
│   │   │
│   │   ├── link-label/
│   │   │   ├── link-label.rule.ts       # Detection: links without accessible name
│   │   │   ├── link-label.fix.ts        # AI fix: icon/context → aria-label
│   │   │   └── link-label.test.ts
│   │   │
│   │   ├── input-label/
│   │   │   ├── input-label.rule.ts      # Detection: inputs without label
│   │   │   ├── input-label.fix.ts       # AI fix: context → <label> or aria-label
│   │   │   └── input-label.test.ts
│   │   │
│   │   ├── html-lang/
│   │   │   ├── html-lang.rule.ts        # Detection: <html> without lang
│   │   │   ├── html-lang.fix.ts         # Deterministic: read next config → insert lang
│   │   │   └── html-lang.test.ts
│   │   │
│   │   ├── emoji-alt/
│   │   │   ├── emoji-alt.rule.ts        # Detection: emoji without role="img"
│   │   │   ├── emoji-alt.fix.ts         # Deterministic: wrap + CLDR name lookup
│   │   │   ├── emoji-names.ts           # Unicode CLDR emoji name table (~15KB)
│   │   │   └── emoji-alt.test.ts
│   │   │
│   │   ├── no-positive-tabindex/
│   │   │   ├── no-positive-tabindex.rule.ts
│   │   │   ├── no-positive-tabindex.fix.ts
│   │   │   └── no-positive-tabindex.test.ts
│   │   │
│   │   ├── button-type/
│   │   │   ├── button-type.rule.ts      # Detection: native + custom Button components
│   │   │   ├── button-type.fix.ts       # Deterministic: insert type="button"
│   │   │   └── button-type.test.ts
│   │   │
│   │   ├── link-noopener/
│   │   │   ├── link-noopener.rule.ts    # Detection: <a> + next/link target="_blank"
│   │   │   ├── link-noopener.fix.ts     # Deterministic: insert/append rel
│   │   │   └── link-noopener.test.ts
│   │   │
│   │   ├── next-metadata-title/
│   │   │   ├── next-metadata-title.rule.ts  # Detection: routes without page title
│   │   │   └── next-metadata-title.test.ts
│   │   │
│   │   ├── next-image-sizes/
│   │   │   ├── next-image-sizes.rule.ts     # Detection: fill Image without sizes
│   │   │   └── next-image-sizes.test.ts
│   │   │
│   │   ├── next-link-no-nested-a/
│   │   │   ├── next-link-no-nested-a.rule.ts  # Detection: <Link><a> double anchor
│   │   │   ├── next-link-no-nested-a.fix.ts   # Deterministic: hoist props, remove <a>
│   │   │   └── next-link-no-nested-a.test.ts
│   │   │
│   │   ├── next-skip-nav/
│   │   │   ├── next-skip-nav.rule.ts    # Detection: missing skip link in root layout
│   │   │   └── next-skip-nav.test.ts
│   │   │
│   │   ├── heading-order/
│   │   │   ├── heading-order.rule.ts    # Detection: heading level skips
│   │   │   └── heading-order.test.ts
│   │   │
│   │   └── no-div-interactive/
│   │       ├── no-div-interactive.rule.ts  # Detection: div/span with onClick
│   │       └── no-div-interactive.test.ts
│   │
│   ├── ai/
│   │   ├── create-provider.ts           # Config → AI SDK provider instance
│   │   └── generate.ts                  # generateText() wrapper + retry logic
│   │
│   ├── cache/
│   │   └── fs-cache.ts                  # JSON file cache (read/write/clear/stats)
│   │
│   ├── apply/
│   │   └── apply.ts                     # AST modification (insert/replace attrs, wrap elements)
│   │
│   └── cli/
│       ├── index.ts                     # CLI entry, commander setup
│       ├── init-command.ts              # init wizard (provider, config, peer dep)
│       ├── scan-command.ts              # scan command orchestration
│       ├── cache-command.ts             # cache subcommands
│       ├── interactive.ts               # readline-based review flow
│       └── format.ts                    # Terminal output formatting (report, diffs)
│
├── examples/
│   └── broken-site/                     # Intentionally inaccessible Next.js app
│       ├── package.json
│       ├── next.config.js
│       ├── tsconfig.json
│       ├── public/
│       │   ├── hero.png
│       │   ├── team-photo.jpg
│       │   └── product-screenshot.png
│       ├── app/
│       │   ├── layout.tsx               # ❌ no lang, no skip nav, no metadata.title
│       │   ├── page.tsx                 # ❌ no metadata.title (route announcer silent)
│       │   ├── about/
│       │   │   └── page.tsx             # ❌ heading skip h1→h3, div with onClick
│       │   └── contact/
│       │       └── page.tsx             # ❌ form inputs without labels
│       └── components/
│           ├── Hero.tsx                 # ❌ <Image> missing alt, fill without sizes
│           ├── Navbar.tsx               # ❌ <Link><a>nested</a></Link>, icon links without label
│           ├── Sidebar.tsx              # ❌ icon buttons without aria-label
│           ├── TeamSection.tsx          # ❌ meaningless alt="photo", alt="IMG_4232.jpg"
│           ├── Footer.tsx              # ❌ emoji without role, <a target="_blank"> without rel
│           ├── SearchForm.tsx           # ❌ <input placeholder="Search"> without label
│           ├── ThemeToggle.tsx          # ❌ <Button> without type
│           └── ProductCard.tsx          # ❌ positive tabIndex={3}, div as button
│
├── tests/
│   └── fixtures/
│       └── images/
│           ├── 1x1.png                  # Minimal test images for resolver tests
│           └── 1x1.jpg
│
├── bin/
│   └── cli.js                           # #!/usr/bin/env node entry
├── tsup.config.ts
├── vitest.config.ts
├── package.json
└── tsconfig.json
```

---

## 9. Key Design Decisions

### Why a rule engine instead of a monolithic scanner?

Each a11y issue has different detection logic, different fix strategies (AI vs deterministic), and different user preferences (some teams want emoji fixes but not button-type fixes). A rule-per-file architecture makes it easy to add new rules, disable rules via config, and test rules in isolation.

### Why ts-morph over jscodeshift / babel / regex?

Full TypeScript type resolution — reads `tsconfig.json`, resolves imports (critical for distinguishing `next/image` from other `Image` components, and for following static image imports to file paths). Regex can't handle multiline props, JSX expressions in comments, or import resolution. Heavy (~40MB) but acceptable for a dev-time CLI.

### Why Vercel AI SDK?

One `generateText()` call works with OpenAI, Anthropic, Google, Ollama, and any OpenAI-compatible endpoint. Adding a provider is a config change. Provider packages are peer deps — user installs only what they need.

### Why two prompt strategies (vision vs code context)?

Image alt generation requires sending the actual image bytes to a vision model. But button-label, link-label, and input-label fixes only need code context (icon name, surrounding JSX, component name). Using a text-only model for code context is 10-100x cheaper and faster than vision.

### Why content-hash cache?

`SHA-256(imageBuffer)` for images, `SHA-256(codeContext)` for code-based fixes. Same image at `/hero.png` and `/landing/hero.png` → one cache entry. Image changes → cache miss. JSON file, git-committable, zero native deps.

### Why `--no-ai` flag?

Deterministic fixes (lang, emoji, tabindex, button-type, link-noopener) don't need an API key. A user can run `npx next-a11y scan ./src --fix --no-ai` and get immediate value without any AI setup. This lowers the barrier to entry and makes the tool useful even for teams that can't use external AI providers. Not recommended for best results — AI fixes handle alt text, labels, and page titles more accurately.

### Why detection-only rules (no auto-fix)?

Heading order and div-as-button require design decisions. Restructuring headings may break layout, and refactoring divs to buttons may break styling. The tool's value here is surfacing the issue with its location — the human decides the fix.

### Why not extend eslint-plugin-jsx-a11y?

jsx-a11y detects problems. next-a11y detects AND fixes them. ESLint's architecture doesn't support async fixes (needed for AI), multi-file analysis (needed for import resolution), or binary file access (needed for image resolution). A standalone CLI is the right shape.

---

## 10. Positioning

**The problem:** 95% of websites fail WCAG 2.2 AA (WebAIM 2025). The same 6 error types have dominated for 5 years. Developers know they should fix these issues but don't — it's tedious, repetitive, and easy to defer.

**What exists:** `eslint-plugin-jsx-a11y` warns you. Browser extensions (axe, WAVE) show you violations after the fact. Neither fixes anything.

**What next-a11y does:** Finds violations in your source code and writes the fix. One command. No browser needed. AI for the hard stuff (generating descriptive alt text, understanding icon semantics), pattern matching for the easy stuff (lang, tabindex, emoji). The only accessibility tool that goes from detection to fix in a single step.

```
jsx-a11y tells you the alt is missing.
axe tells you the button has no accessible name.
next-a11y writes the fix.
```
