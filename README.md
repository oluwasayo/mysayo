# Sayo Oladeji

**Live site → [mysayo.com](https://mysayo.com)**

Open-source personal website and writing. This repo holds the Astro site, Cloudflare Terraform infra, and CI.

**Repository → [github.com/oluwasayo/mysayo](https://github.com/oluwasayo/mysayo)**

[![Node.js](https://img.shields.io/badge/Node.js-26-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0--rc-blue.svg)](https://www.typescriptlang.org/)
[![Astro](https://img.shields.io/badge/Astro-7-orange.svg)](https://astro.build/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Pages%20%2B%20Terraform-orange.svg)](https://www.cloudflare.com/)

Static Astro site with React islands, deployed to Cloudflare Pages. Infrastructure (DNS, Pages project config, zone settings, Terraform state) is managed with Terraform and stored in Cloudflare R2. At this scale the stack and hosting are entirely on free tiers.

## Table of contents

- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Project structure](#project-structure)
- [Local secrets (1Password)](#local-secrets-1password)
- [Development](#development)
- [Testing](#testing)
- [Infrastructure & Terraform](#infrastructure--terraform)
- [Deployment & CI/CD](#deployment--cicd)
- [GitHub secrets](#github-secrets)
- [Cold boot / first-time setup](#cold-boot--first-time-setup)

---

## Prerequisites

- **Node.js 26** — matches GitHub Actions
- **npm** (workspaces)
- **Git**
- **[1Password](https://1password.com/)** desktop app — local secrets via mounted `.env` files (not shared plaintext copies)
- **Terraform 1.15+** — for local infrastructure plans/applies via `./tf.sh`
- **Wrangler 4.x** — for manual Pages deploys and bootstrap (`npm install` provides it in the web workspace)

Optional for full local deploy testing:

- Cloudflare account with `mysayo.com` zone and Pages project `mysayo-web`

---

## Quick start

```bash
git clone git@github.com:oluwasayo/mysayo.git
cd mysayo

npm install

# Browser tests (once per machine)
npm run install:testing:deps -w web

# Mount secrets — see "Local secrets" below, then:
npm run dev          # Astro dev server (default port 4321)
npm run test         # shared + web Vitest projects
npm run fix:web      # format, lint, typecheck web workspace
```

---

## Project structure

```
mysayo/
├── code/
│   ├── app/
│   │   ├── web/          # Astro 7 site — primary application
│   │   ├── shared/       # Shared constants/types (e.g. siteName)
│   │   └── server/       # Placeholder for future Cloudflare Workers / DO
│   ├── bin/              # Ops scripts (Terraform plan filter)
│   └── doc/              # Placeholder for doc tooling
├── infrastructure/       # Terraform — Cloudflare DNS, Pages, zone settings, R2 state
├── .github/workflows/    # CI: validate on PR, deploy on main
├── tf.sh                 # Terraform wrapper — loads infrastructure/.env, maps R2 → AWS creds
├── vitest.config.js      # Root Vitest project orchestration
├── vite.shared.js        # Shared Vitest/Vite config fragments
├── biome.json            # Formatter + linter (root)
└── knip.json             # Unused dependency/export checker
```

### Technology stack

| Layer | Choice |
| --- | --- |
| Site framework | [Astro 7](https://astro.build/) (static output) |
| UI | Hand-rolled flat CSS design system (no component library); React 19 islands only where interactive |
| React Compiler | `@rolldown/plugin-babel` + `reactCompilerPreset()` in `astro.config.mjs` (build/dev only) |
| Bundler | Vite 8 (via Astro) |
| Language | TypeScript 7 RC (`tsc`, not `tsgo`) |
| Tests | Vitest 4 + Playwright Chromium (browser mode, not jsdom) |
| Lint/format | Biome + Stylelint (CSS in web) |
| Hosting | Cloudflare Pages (`mysayo-web`) — free tier |
| IaC | Terraform → Cloudflare provider v5, state in R2 — free tier at this scale |
| Cost | $0 for hosting, infra, and CI (OSS tooling; domain registration aside) |
| Secrets | 1Password Environment mounts + GitHub Actions secrets |

---

## Local secrets (1Password)

We do **not** commit or share plaintext secrets. Use **1Password Environments** mounted as `.env` files.

| Mount path | Used for |
| --- | --- |
| `infrastructure/.env` | `./tf.sh` — Cloudflare API token, account/zone IDs, R2 state credentials |
| `code/app/web/.env` | `wrangler pages deploy` — `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |

Template (safe to commit): `infrastructure/.env.example`.

### Terraform env file

Create a 1Password Environment (e.g. `mysayo-terraform`) and mount it to `infrastructure/.env`. Required variables:

```bash
TF_VAR_cloudflare_api_token=
TF_VAR_cloudflare_account_id=
TF_VAR_cloudflare_zone_id=
R2_ACCESS_KEY_ID=          # R2 API token — NOT the same as CLOUDFLARE_API_TOKEN
R2_SECRET_ACCESS_KEY=
```

`./tf.sh` reads this file, maps `R2_*` → `AWS_*` for Terraform's S3-compatible R2 backend, and runs `terraform -chdir=infrastructure`.

**1Password FIFO mounts:** `./tf.sh` uses a blocking `cat` to read the mount (process substitution and background reads race with 1Password). Close IDE tabs that keep `infrastructure/.env` open before running `./tf.sh`, or pipe instead:

```bash
cat infrastructure/.env | ./tf.sh plan
```

Astro dev ignores `.env` file-watch events so 1Password remounts do not restart the dev server.

---

## Development

```bash
# From repo root
npm run dev              # alias for npm run dev:web
npm run dev:web          # Astro dev server

# Web workspace only
cd code/app/web
npm run dev:web          # astro dev
npm run build            # static build → dist/
npm run preview          # preview production build locally
npm run deploy           # build + wrangler pages deploy (needs code/app/web/.env)
```

### Path aliases

| Alias | Resolves to |
| --- | --- |
| `@/*` | `code/app/web/src/*` |
| `@shared/*` | `code/app/shared/src/*` |

Biome enforces aliases over relative imports in web and shared source (tests exempt).

### Code quality

```bash
npm run fix              # all workspaces + knip + terraform fmt
npm run fix:web          # web only + knip
npm run lint:web
npm run knip             # unused deps/exports

cd code/app/web && npm run tsc
cd code/app/web && npm run lint    # biome + stylelint
```

Root `npm run bump-deps` bumps pinned versions across workspaces (respects 5-day cooldown).

---

## Testing

Tests run in **real Chromium** via Vitest browser mode (`@vitest/browser-playwright`), matching the kreia monorepo approach — not jsdom.

```bash
# One-time browser install
npm run install:testing:deps -w web

# Run tests
npm run test             # shared + web
npm run test:web         # browser tests only
npm run test:shared      # node tests only
npm run test:coverage    # with v8 coverage
```

**React Compiler in tests:** intentionally **off**. Vitest uses plain `@vitejs/plugin-react`. The compiler runs only in `astro.config.mjs` for dev/build. Enabling the compiler in browser tests breaks on `react-compiler-runtime` pre-bundling.

Web test setup (`vitest.setup.ts`): RTL cleanup, `ResizeObserver` shim, filtered console noise.

---

## Infrastructure & Terraform

All Cloudflare resources for this project live under `infrastructure/`.

| Module | Purpose |
| --- | --- |
| `cloudflare/r2-terraform-state` | R2 bucket for remote state |
| `cloudflare/pages` | Pages project config + custom domains |
| `cloudflare/dns` | Apex + `www` CNAME → `*.pages.dev` |
| `cloudflare/zone-settings` | SSL, HTTPS, Brotli, HTTP/3, etc. |

State backend: **Cloudflare R2** via Terraform `backend "s3"` (S3-compatible API).

### State bucket bootstrap (first-time only)

The remote state bucket must exist **before** `./tf.sh init` can attach to the R2 backend. Create it once with Wrangler, configure the backend, init, then import the bucket into Terraform state.

```bash
# 1. Create the R2 bucket (name: ${project}-${environment}-terraform-state → mysayo-production-terraform-state)
cd code/app/web
npx wrangler r2 bucket create mysayo-production-terraform-state

# 2. Backend config (gitignored) — set endpoint with your account ID
cd ../..
cp infrastructure/backend.hcl.example infrastructure/backend.hcl
# bucket   = "mysayo-production-terraform-state"
# endpoint = "https://<CLOUDFLARE_ACCOUNT_ID>.r2.cloudflarestorage.com"

# 3. Init remote backend (loads R2 + TF_VAR_* from infrastructure/.env via ./tf.sh)
./tf.sh init -backend-config=backend.hcl

# 4. Import existing bucket into Terraform (requires TF_VAR_cloudflare_api_token in .env)
./tf.sh import \
  'module.terraform_state[0].cloudflare_r2_bucket.state' \
  '<CLOUDFLARE_ACCOUNT_ID>/mysayo-production-terraform-state/default'
```

After import, `./tf.sh plan` should show no changes for the state bucket (or only benign diffs). Re-run `./tf.sh init -backend-config=backend.hcl -reconfigure` if you change `backend.hcl`.

### Pages project bootstrap (first-time only)

The Pages project must exist **before** the first Terraform plan that touches `module.cloudflare_pages`. Create it with Wrangler, then import into state (after state-bucket bootstrap and `./tf.sh init` above).

```bash
# 1. Create the Pages project (name matches pages_project_name → mysayo-web)
cd code/app/web
npx wrangler pages project create mysayo-web --production-branch main

# 2. Import into Terraform (from repo root; ./tf.sh loads infrastructure/.env)
cd ../..
./tf.sh import \
  'module.cloudflare_pages[0].cloudflare_pages_project.web' \
  '<CLOUDFLARE_ACCOUNT_ID>/mysayo-web'
```

Terraform manages project settings and custom domains (`mysayo.com`, `www.mysayo.com`); **application deploys** are done by GitHub Actions / Wrangler (`pages deploy`), not Terraform builds.

### Local Terraform workflow

```bash
# 1. Copy and fill backend config (gitignored)
cp infrastructure/backend.hcl.example infrastructure/backend.hcl
# Set bucket + endpoint with your account ID

# 2. Init (after secrets are mounted)
./tf.sh init -backend-config=backend.hcl

# 3. Plan / apply
./tf.sh plan \
  -var="cloudflare_account_id=$TF_VAR_cloudflare_account_id" \
  -var="cloudflare_api_token=$TF_VAR_cloudflare_api_token" \
  -var="cloudflare_zone_id=$TF_VAR_cloudflare_zone_id"

./tf.sh apply tfplan
```

Or rely on `TF_VAR_*` entries in `infrastructure/.env` and run `./tf.sh plan` directly.

### Cloudflare API token scopes (local + CI)

Minimum for Terraform + Pages deploy:

- Account: Cloudflare Pages (Edit), Workers R2 Storage (Edit) — for state bucket
- Zone: DNS (Edit), Zone Settings (Edit), Zone (Read)

R2 credentials for state are separate **R2 API tokens** scoped to the terraform state bucket.

---

## Deployment & CI/CD

| Workflow | Trigger | Action |
| --- | --- | --- |
| `web-validate.yml` | PR → `main` (web paths) | Lint, typecheck, knip, build, browser tests; PR preview deploy |
| `web-deploy.yml` | Push → `main` (web paths) | Same checks, then production Pages deploy |
| `infrastructure-validate.yml` | PR → `main` (infra paths) | `terraform fmt`, validate, plan; posts filtered plan to PR |
| `infrastructure-deploy.yml` | Push → `main` (infra paths) | Plan + auto-apply |

Production site: **https://mysayo.com**  
Pages project: **mysayo-web**  
Build output: `code/app/web/dist`

Preview deploys on PRs run in parallel with validation (they do not gate on test success).

---

## GitHub secrets

Configure these in the repository (or org) secrets:

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Pages deploy + Terraform Cloudflare provider |
| `CLOUDFLARE_ACCOUNT_ID` | Account scoping; R2 endpoint URL in CI |
| `CLOUDFLARE_ZONE_ID` | DNS + zone settings modules |
| `R2_ACCESS_KEY_ID` | Terraform remote state (S3-compatible) |
| `R2_SECRET_ACCESS_KEY` | Terraform remote state |

`GITHUB_TOKEN` is used automatically for deployment statuses and PR comments.

---

## Cold boot / first-time setup

Order matters for a greenfield account:

1. **Create R2 state bucket** (Wrangler or dashboard), then `./tf.sh init` with `backend.hcl`.
2. **Import or apply** the `terraform_state` module bucket if created outside Terraform.
3. **Create Pages project** with Wrangler (`mysayo-web`), import into Terraform.
4. **Apply infrastructure** — DNS, custom domains, zone settings.
5. **Push to `main`** — CI builds and deploys the site.

For day-to-day app work, steps 1–4 are already done; use `npm run dev` and open PRs as usual.

---

## Agent documentation

See [AGENTS.md](./AGENTS.md) for AI/agent conventions, pitfalls, and detailed workflows.

---

## License

Code in this repository is licensed under the [MIT License](./LICENSE).

Writing, images, personal branding, and other non-code content are not licensed for reuse without permission.
