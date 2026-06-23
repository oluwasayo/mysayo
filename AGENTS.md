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

## Monorepo layout

```
code/app/web/       Astro + React islands + Mantine — SHIP HERE for site work
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
- Setup: `vitest.setup.ts` — Mantine CSS, `@testing-library/jest-dom`, RTL `cleanup`, `ResizeObserver` rAF shim, console error filtering
- CI caches Playwright binaries keyed on lockfile version; installs Chromium before tests

Do not reintroduce jsdom without an explicit user request and a documented reason.

### TypeScript

- **TypeScript 7 RC** (`typescript@7.0.1-rc`)
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

Committed templates: `*.env.example`.

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

### Pages project bootstrap (critical)

1. **Create project with Wrangler first** — Terraform data source reads existing project to avoid plan drift ([cloudflare/terraform-provider-cloudflare#5928](https://github.com/cloudflare/terraform-provider-cloudflare/issues/5928))
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
import Welcome from '@/component/Welcome'
import { siteName } from '@shared/lib/site'

// shared — always @shared/ for internal paths (when applicable)
```

### React components

- Default exports allowed (Biome `noDefaultExport: off`)
- Prefer `type` over `interface` (Biome enforced)
- `useImportType` / `useExportType` enforced
- No `console.log` in app code (tests/scripts exempt)

### CSS

- Mantine: `@mantine/core/styles.css` in pages or test setup
- Global styles: `code/app/web/src/style/global.css`
- PostCSS: Mantine preset in `postcss.config.cjs`

### New files

- Tests colocated: `Component.test.tsx` next to `Component.tsx`
- Shared logic → `code/app/shared` if used by more than one workspace
- Do not add AWS/Terraform for non-Cloudflare resources without explicit request

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

```bash
npm run bump-deps    # ncu across workspaces with 5-day cooldown
npm install
npm run test && npm run fix
```

After major upgrades, verify:

1. Astro build: `npm run build -w web`
2. Browser tests: `npm run test:web`
3. React Compiler still works in dev/build (not tests)
4. CI wrangler version if wrangler major changed

Recent stack (as scaffolded): Astro 7, Vite 8, `@astrojs/react` 6, `@vitejs/plugin-react` 6, TypeScript 7 RC, Vitest 4, Mantine 9, Wrangler 4.

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
| Unused code | `knip.json` |
| Workflows | `.github/workflows/*.yml` |
