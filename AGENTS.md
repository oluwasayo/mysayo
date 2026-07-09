# mysayo — agent instructions

Instructions for AI coding agents working in this repository. **This file is the single source of truth** for agent-oriented project knowledge. Follow [AGENTS.md](https://agents.md/) conventions.

Human-oriented onboarding lives in [README.md](./README.md).

---

## Repository at a glance

| Property | Value |
| --- | --- |
| Domain | `mysayo.com` |
| GitHub | `oluwasayo/mysayo` |
| Hosting | Cloudflare Pages project `mysayo-web` |
| Node (CI + local) | **26** |
| Package manager | npm workspaces |
| Primary app | `code/app/web` (Astro 7 static site) |

---

## Forking and content reuse

This repository is public as a reference for structure, tooling, deployment, and implementation patterns. If someone forks or reuses it for their own site, they should replace the personal content rather than shipping it as-is.

- Do not reuse Oluwasayo's personal writings, reading lists, about copy, photographs, homepage copy, blog posts, essays, or other site content in forked projects.
- Treat `code/app/web` page structure, components, styling patterns, tests, CI, and infrastructure as the reusable parts.
- When adapting this repo, preserve the architecture but create original content, images, metadata, branding, and domain/project names for the new owner.

---

## Monorepo layout

```
code/app/web/       Astro + React islands + hand-rolled CSS — SHIP HERE for site work
code/app/shared/    Cross-package constants (minimal today)
code/app/server/    Placeholder — future Workers/DO; no runtime yet
code/bin/           filter-terraform-plan CLI for CI
code/doc/           Placeholder doc tooling
infrastructure/     Terraform (Cloudflare only — no AWS)
```

Root orchestrates workspaces via `package.json` scripts. Vitest projects are defined in root `vitest.config.js` (`shared`, `web`).

---

## Commands reference

### Install & dev

```bash
npm install
npm run install:testing:deps -w web   # Playwright Chromium — once per machine
npm run dev                           # Astro dev (code/app/web)
npm run dev:web
```

### Test

```bash
npm run test              # all Vitest projects
npm run test:web          # browser mode (Chromium)
npm run test:shared       # node environment
npm run test:coverage
```

### Quality

```bash
npm run fix               # all workspaces + knip + terraform fmt
npm run fix:web           # web workspace + knip
npm run knip
npm run lint:web

cd code/app/web && npm run tsc
cd code/app/web && npm run lint     # biome + stylelint
```

### Terraform

```bash
./tf.sh init -backend-config=backend.hcl   # first time; backend.hcl is gitignored
./tf.sh plan
./tf.sh apply tfplan

npm run filter-terraform-plan -- --input infrastructure/plan.txt --output infrastructure/plan-filtered.txt --ci
```

Never run bare `terraform` without loading secrets unless you have exported `TF_VAR_*` and R2/AWS creds yourself. Prefer `./tf.sh`.

### Deploy (manual)

```bash
npm run deploy:web        # build + wrangler pages deploy (needs code/app/web/.env)
```

Production deploys normally happen via GitHub Actions on merge to `main`.

---

## Architecture decisions (do not regress)

### Astro + React islands

- **Static output** (`output: 'static'`). No SSR adapter.
- React components are islands (`client:load`, etc.) in `.astro` pages.
- Site URL: `https://mysayo.com` in `astro.config.mjs`.

### React Compiler — build only

Production and dev builds use the React Compiler via:

```js
// astro.config.mjs
vite: {
  plugins: [babel({ presets: [reactCompilerPreset()] })],
}
```

Required packages: `@rolldown/plugin-babel`, `@babel/core`, `babel-plugin-react-compiler`, `react-compiler-runtime`.

**Tests do NOT use the compiler.** `code/app/web/vitest.config.js` uses only `@vitejs/plugin-react`. Putting the compiler in Vitest browser mode fails with:

```
react-compiler-runtime does not provide an export named 'c'
```

This is a known pre-bundle/interop issue. Test component **behavior**, not compiler output.

### Testing — kreia philosophy

- **Vitest browser mode** + **Playwright Chromium** (headless)
- **Not jsdom** — removed intentionally
- Setup: `vitest.setup.ts` — `@testing-library/jest-dom`, RTL `cleanup`, `ResizeObserver` rAF shim, console error filtering
- CI caches Playwright binaries keyed on lockfile version; installs Chromium before tests

Do not reintroduce jsdom without an explicit user request and a documented reason.

### TypeScript

- **TypeScript 7** (`typescript@7.0.2`)
- Use **`tsc`** in all workspaces — not `tsgo` / `@typescript/native-preview`
- Root and workspaces pin exact versions

### Linting

- **Biome** at repo root (`biome.json`) — formatter + linter
- **Stylelint** in web for `src/**/*.css`
- **Knip** at root for unused deps/exports (`knip.json`)
- Astro files excluded from Biome format; TS/TSX in web are linted
- Web/shared source: **no relative imports** — use `@/` and `@shared/` (Biome `noRestrictedImports`)

### Vite versions

Root `package.json` overrides:

```json
"overrides": {
  "@astrojs/react": { "@vitejs/plugin-react": "6.0.3" },
  "vite": "8.1.0"
}
```

Keep `@vitejs/plugin-react` on v6 with Astro 7 / Vite 8.

---

## Secrets & environment files

| File | Gitignored | Purpose |
| --- | --- | --- |
| `infrastructure/.env` | yes | `./tf.sh` — TF vars + R2 creds |
| `infrastructure/backend.hcl` | yes | R2 bucket + endpoint for `terraform init` |
| `code/app/web/.env` | yes | Wrangler deploy creds |

Committed template: `infrastructure/.env.example`.

### `./tf.sh` behavior (important)

- Loads `infrastructure/.env` via **blocking `cat` to a temp file** — required for 1Password FIFO mounts
- Do **not** use process substitution (`<(...)`) or background reads on FIFO env files
- Supports piped stdin: `cat infrastructure/.env | ./tf.sh plan`
- Maps `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` → `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
- `--env-stdin` is deprecated (auto-detects piped stdin)
- If load fails: close IDE tabs viewing `.env`, remount in 1Password, retry

**Never commit secrets.** Warn the user if they ask to commit `.env` files.

### Astro dev + 1Password

`astro.config.mjs` ignores `**/.env` in Vite server watch — prevents dev-server restart loops when 1Password remounts FIFO files.

---

## Infrastructure (Terraform)

### Provider & backend

- Cloudflare provider `~> 5`
- Remote state: R2 via `backend "s3"` with `use_path_style = true`
- Terraform `>= 1.11`; CI uses `1.15.5`

### Modules (all under `infrastructure/cloudflare/`)

| Module | Resources |
| --- | --- |
| `r2-terraform-state` | State bucket |
| `pages` | Pages project + custom domains |
| `dns` | `@` and `www` CNAME → `{project}.pages.dev` |
| `zone-settings` | SSL, HTTPS, Brotli, HTTP/3, security level |

Variables defaults: `domain = mysayo.com`, `pages_project_name = mysayo-web`, `project = mysayo`.

Modules are gated with `count = var.cloudflare_api_token != null ? 1 : 0` so validate works without creds locally in some contexts; real plans need tokens.

### State bucket bootstrap (first-time only)

```bash
cd code/app/web
npx wrangler r2 bucket create mysayo-production-terraform-state

cd ../..
cp infrastructure/backend.hcl.example infrastructure/backend.hcl
# Set endpoint: https://<CLOUDFLARE_ACCOUNT_ID>.r2.cloudflarestorage.com

./tf.sh init -backend-config=backend.hcl

./tf.sh import \
  'module.terraform_state[0].cloudflare_r2_bucket.state' \
  '<CLOUDFLARE_ACCOUNT_ID>/mysayo-production-terraform-state/default'
```

Bucket name pattern: `${project}-${environment}-terraform-state` (default `mysayo-production-terraform-state`).

### Pages project bootstrap (critical)

```bash
cd code/app/web
npx wrangler pages project create mysayo-web --production-branch main

cd ../..
./tf.sh import \
  'module.cloudflare_pages[0].cloudflare_pages_project.web' \
  '<CLOUDFLARE_ACCOUNT_ID>/mysayo-web'
```

1. **Create project with Wrangler first** — recommended Pages bootstrap; use a data source so computed fields stay aligned with the live project ([terraform-provider-cloudflare#5928](https://github.com/cloudflare/terraform-provider-cloudflare/issues/5928))
2. **Import** `cloudflare_pages_project.web` before first apply
3. Do **not** reintroduce a `pages_project_exists` toggle — bootstrap is Wrangler-first by design

Terraform configures the Pages **project** (build settings reference, domains). **Deploying built assets** is Wrangler/GHA (`pages deploy`), not `terraform apply`.

### R2 vs Cloudflare API token

- `CLOUDFLARE_API_TOKEN` — Cloudflare API (Pages, DNS, zone)
- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` — S3-compatible R2 credentials for **state backend only**

These are different credentials with different scopes.

---

## CI/CD

### Workflows

| File | When |
| --- | --- |
| `web-checks-reusable.yml` | Called by validate/deploy — clean check, tsc, lint, knip, build, Playwright tests |
| `web-validate.yml` | PR — checks + preview deploy (parallel, not gated on tests) |
| `web-deploy.yml` | Push main — checks then production deploy |
| `infrastructure-validate.yml` | PR — fmt, validate, plan, PR comment |
| `infrastructure-deploy.yml` | Push main — plan + auto-apply |

### GitHub secrets (all 5 required)

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_ZONE_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

Wrangler version in CI: `4.104.0` (keep in sync with `code/app/web` devDependency).

### Clean script CI gate

`web-checks-reusable.yml` runs `npm run clean` and fails if git is dirty afterward. Workspace `clean` scripts must not leave tracked artifacts.

---

## Coding conventions

### Imports

```typescript
// web — always alias
import ThemeToggle from '@/component/ThemeToggle'
import { siteName } from '@shared/lib/site'

// shared — always @shared/ for internal paths (when applicable)
```

### React components

- Default exports allowed (Biome `noDefaultExport: off`)
- Prefer `type` over `interface` (Biome enforced)
- `useImportType` / `useExportType` enforced
- No `console.log` in app code (tests/scripts exempt)

### CSS

- **Hand-rolled design system** — no component/UI library. Flat (no border radius), editorial, mobile-first.
- **Typography** — Source Serif 4 for display headings (hero, article titles, essay h2/h3); system sans for body and UI; mono for meta/dates/code
- Design tokens + base/layout/components: `code/app/web/src/style/global.css`
- Long-form article typography: `code/app/web/src/style/prose.css` (includes collapsible `.callout` disclosures for blog posts; its `@media print` block expands callouts, unboxes inline code, and wraps code blocks)
- Print: `code/app/web/src/style/print.css` (imported **last** in `global.css` so its high-contrast light tokens beat `[data-theme]`; hides site chrome)
- Theming: light/dark driven by `data-theme` on `<html>`, set before paint by an inline script in `BaseHead.astro`, with a `prefers-color-scheme` fallback for no-JS visitors
- No PostCSS config; Astro/Vite handle CSS. Stylelint uses **modern color notation** (`rgb(... / ..%)`), kebab-case classes

### New files

- Tests colocated: `Component.test.tsx` next to `Component.tsx`
- Shared logic → `code/app/shared` if used by more than one workspace
- Do not add AWS/Terraform for non-Cloudflare resources without explicit request

### Content (blog)

- Blog posts are Markdown in `code/app/web/src/content/blog/*.md`
- Schema in `code/app/web/src/content.config.ts` (Astro content layer, `glob` loader with flat `*.md` pattern)
- **Every post must have `slug`, `title`, `description`, and `pubDate`**; `updatedDate`, `draft`, and `tags` are optional
- **`slug` is the permanent permalink** — lowercase kebab-case, set at publish time, used in URLs as `/blog/{slug}`. It is independent of the filename (`post.id`), though matching them is fine for editor convenience
- **Never change a published `slug`** without adding a 301 redirect in `code/app/web/public/_redirects` (Cloudflare Pages). Title and body edits are safe; slug changes break inbound links
- **Tags** — optional array of values from `Tag` in `code/app/web/src/lib/tag.ts`. Add new tags only to the `Tag` const; labels and slugs are derived via `enumValueToText` / `enumValueToSlug` in `@shared/lib/enum`. Never rename a tag value after publish
- Use `getPostSlug()` from `@/lib/post` for hrefs and routes; use `post.id` only for source-file links (`blogPostSourceUrl(post.id)`)
- `getPublishedPosts()` throws at build time on duplicate slugs
- After adding/changing collections, `npm run tsc` runs `astro sync` first to regenerate `astro:content` types

#### Callouts (`.callout`)

Blog-wide callout styling lives in `code/app/web/src/style/prose.css` (`.prose .callout`). Use it for **optional design forks, caveats, and tangents** — material that is useful but not part of the main narrative. Callouts are **collapsible** via native `<details>`/`<summary>` (no JavaScript) and render **collapsed by default**. Do **not** use post-specific CSS for callouts.

**Not** for pull quotes — use Markdown `blockquote` for those (italic, accent left rule).

**Markup** — raw HTML inside `.md` posts (Astro content layer renders it inside `.prose`):

```html
<details class="callout">
<summary>Label: title of the aside</summary>

First body paragraph…

Second paragraph if needed.

</details>
```

**Conventions:**

- Use `<details class="callout">` with a `<summary>` as its first child. The summary is the always-visible, clickable label; it renders as a muted uppercase heading with a disclosure caret.
- Put the label as **plain text** in `<summary>` (no Markdown bold, no backticks) — e.g. `Alternative: the commit outbox`. Keep it short.
- Leave a **blank line after `</summary>`** so the body renders as Markdown; follow with normal Markdown paragraphs.
- Collapsed by default. Add the `open` attribute (`<details class="callout" open>`) only if the callout should start expanded.
- No post-specific class names — always `callout`.

**Example** (from `everything-is-a-blob.md`):

```html
<details class="callout">
<summary>Alternative: the commit outbox</summary>

`adopt` keeps commit synchronous and verified, but it is not the only shape…

</details>
```

---

## Common pitfalls (learned the hard way)

| Issue | Cause | Fix |
| --- | --- | --- |
| `./tf.sh` hangs or empty env | 1Password FIFO + IDE holding `.env` | Close tabs; use blocking cat; pipe env |
| `tmp: unbound variable` | RETURN trap + `set -u` with local temp | Fixed in `tf.sh` — explicit rm paths |
| Terraform plan 404 on Pages | Project doesn't exist yet | `wrangler pages project create` + import |
| Vitest compiler import error | Compiler in browser test bundle | Compiler only in `astro.config.mjs` |
| Dev server restart loop | 1Password remounts `.env` | `server.watch.ignored: ['**/.env']` |
| Knip flags `react-compiler-runtime` | Runtime used only in compiled output | Listed in `knip.json` `ignoreDependencies` |
| `@babel/core` engine warnings | Babel 8 wants Node ≥24.11 | CI uses Node 26 — OK; local older Node may warn |

---

## What agents should / should not do

### Do

- Run `npm run test:web` after web test changes
- Run `npm run fix:web` or `npm run fix` before finishing substantive TS/CSS changes
- Use `./tf.sh` for Terraform, not raw `terraform` with manual env
- Match existing pinned dependency style (exact versions in package.json)
- Keep changes minimal and focused
- Ask before committing — user rules require explicit commit requests

### Do not

- Commit `.env`, `backend.hcl`, tfplan, or state files
- Add jsdom for web tests
- Enable React Compiler in `vitest.config.js` without solving runtime pre-bundle
- Force-push `main` or skip git hooks unless explicitly asked
- Add AWS infrastructure — this project is Cloudflare-only
- Create markdown files the user didn't ask for (except these docs)
- Over-engineer placeholders (`server/`, `doc/`) before there is a concrete need

---

## Dependency upgrades

Routine bumps follow the same three tracks as the Cursor Automations — use **`/bump-dependencies`** in chat or run manually:

```bash
npm run bump-deps    # ncu across workspaces with 5-day cooldown
npm install
npm audit fix
npm run test && npm run fix
```

See `.cursor/commands/bump-dependencies.md` for the full bump workflow: read release notes from current → target version (npm, GHA, and each Terraform provider), then apply, audit-fix, validate, and plan. **Local agents** run `./tf.sh plan` when credentials are available; **cloud agents** open a PR and use `/loop-on-ci` to review the plan posted by `infrastructure-validate.yml`.

After major upgrades, verify:

1. Astro build: `npm run build -w web`
2. Browser tests: `npm run test:web`
3. React Compiler still works in dev/build (not tests)
4. CI wrangler version if wrangler major changed

Recent stack: Astro 7, Vite 8, `@astrojs/react` 6, `@vitejs/plugin-react` 6, TypeScript 7, Vitest 4, Wrangler 4. UI is a hand-rolled CSS design system (no component library).

---

## Related files (quick index)

| Concern | File |
| --- | --- |
| Astro + compiler | `code/app/web/astro.config.mjs` |
| Browser tests | `code/app/web/vitest.config.js`, `vitest.setup.ts` |
| Wrangler / Pages | `code/app/web/wrangler.toml` |
| Terraform root | `infrastructure/main.tf`, `variables.tf` |
| TF wrapper | `tf.sh` |
| Shared test config | `vite.shared.js` |
| Lint rules | `biome.json` |
| Blog prose + callouts | `code/app/web/src/style/prose.css` |
| Unused code | `knip.json` |
| Workflows | `.github/workflows/*.yml` |
