# next-a11y

**Finds accessibility violations in your Next.js source code. Writes the fix.**

```
jsx-a11y tells you the alt is missing.
axe tells you the button has no accessible name.
next-a11y writes the fix.
```

95% of websites fail WCAG 2.2 AA. The same 6 error types. Every year. For 5 years straight. ([WebAIM Million 2025](https://webaim.org/projects/million/))

next-a11y fixes 4 of those 6 automatically — and catches the rest.

## Quick start

```bash
npx next-a11y init        # pick AI provider, generates config
npx next-a11y scan ./src  # see what's broken
npx next-a11y scan ./src --fix   # fix it
```

### Before

```
╭──────────────────────────────────────╮
│  Accessibility Score:  34 / 100  🔴  │
╰──────────────────────────────────────╯

  🖼️  12 images missing alt text              -24 pts
  🔘   4 icon buttons without aria-label       -8 pts
  🔗   2 icon links without aria-label         -4 pts
  📝   3 inputs without label                  -9 pts
  🌐   1 missing lang on <html>                -5 pts
  ...and 21 more issues

  38 fixable · 4 warnings · Run --fix to apply
```

### After

```
╭──────────────────────────────────────╮
│  Accessibility Score:  97 / 100  🟢  │
╰──────────────────────────────────────╯

  ✅ All auto-fixable issues resolved

  0 fixable · 4 warnings · Score: 34 → 97 (+63 pts)
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
| `heading-order`      | Flags `h1` → `h3` skips                                  |
| `no-div-interactive` | Flags `<div onClick>` without `role` or keyboard handler |

## No AI? No problem.

```bash
npx next-a11y scan ./src --fix --no-ai
```

9 deterministic rules work without any API key or AI setup.

## AI providers

Works with any major provider through [Vercel AI SDK](https://sdk.vercel.ai/):

```bash
npm install @ai-sdk/google       # free tier: 1500 req/day
# or
npm install @ai-sdk/openai       # gpt-4.1-nano ~$0.001/fix
# or
npm install @ai-sdk/anthropic    # claude-haiku ~$0.001/fix
# or
npm install ollama-ai-provider   # local, $0
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

Static analysis codemod. Parses your source with [ts-morph](https://github.com/dsherret/ts-morph), runs 15 rules against the AST, generates fixes (AI or pattern-based), writes them back to your files. No browser. No runtime. Ships zero code to production.

## License

MIT
