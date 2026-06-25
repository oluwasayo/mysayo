# Bump dependencies

Routine dependency maintenance for **mysayo** — to be scheduled as Cursor Automations.

If the user names a track (`npm`, `gha`, `terraform`), run only that track. Otherwise run **all three** in order, using **separate commits** per track (one PR is fine if the user wants a single chore PR).

Do not hand-bump versions outside this flow unless fixing a specific issue.

Read `AGENTS.md` before starting — especially pinned-version style, `./tf.sh`, and post-upgrade checks.

---

## Release notes (all tracks — required)

**Before applying any version bump**, read the release notes, changelog, or migration guide **from the currently pinned version through the target version** (inclusive of every intermediate major/minor that matters). Do not bump blind.

For each dependency being upgraded, capture:

| Field | Example |
|-------|---------|
| Name | `astro`, `actions/checkout`, `cloudflare/cloudflare` |
| From → To | `7.0.2` → `7.1.0`, `# v7.0.0` → `# v7.0.1`, `5.21.1` → `6.0.0` |
| Breaking / behavior changes | bullet list from release notes |
| Required follow-up in this repo | code, workflow, or config changes implied by the notes |

Use the best source available:

| Track | Where to read |
|-------|----------------|
| **npm** | Package `CHANGELOG.md` / GitHub releases / npm package page “Versions” tab. For monorepo tools (`astro`, `vitest`, `wrangler`, `@biomejs/biome`, etc.), read upstream release notes—not just the version number. |
| **GHA** | Action repo GitHub **Releases** and `CHANGELOG` between the current `# vX.Y.Z` comment and the target tag. |
| **Terraform providers** | Provider GitHub **Releases** and any published upgrade guide on the Terraform Registry. Read notes for **each provider** separately. |

If release notes are missing or thin, say so in the summary and lean harder on validate/plan/test gates.

Apply code and config changes **implied by the release notes first**, then bump versions, then verify. Skip or defer a bump when release notes describe breaking work you cannot complete safely in this session.

---

## 1. Bump npm deps

### 1a. Discover and read

1. Record current versions from every workspace `package.json`, root `package.json`, and root `overrides`.
2. Preview bumps without writing files — run the same workspaces as `bump-deps`, but use `ncu --dry-run` (no `-u`) per directory:

   ```bash
   ncu --dry-run --removeRange --cooldown 5 --cwd code/app/server
   ncu --dry-run --removeRange --cooldown 5 --cwd code/app/shared
   ncu --dry-run --removeRange --cooldown 5 --cwd code/app/web
   ncu --dry-run --removeRange --cooldown 5 --cwd code/doc
   ncu --dry-run --removeRange --cooldown 5 --cwd code/bin
   ncu --dry-run --removeRange --cooldown 5
   ```

3. For every package whose version would change — especially **majors** and repo-critical packages (`astro`, `vite`, `react`, `typescript`, `vitest`, `playwright`, `wrangler`, `@astrojs/react`) — read release notes **from current → target**.
4. Note required migrations (config keys, renamed exports, Node engine bumps, peer dependency changes) before proceeding.

### 1b. Apply

```bash
npm run bump-deps
npm install
npm audit fix
```

`bump-deps` runs `npm-check-updates` with `--removeRange --cooldown 5` across every workspace plus the root. Packages published within the last **five days** are skipped (supply-chain guard).

`npm audit fix` applies compatible security patches after the lockfile refresh. Re-run `npm install` only when audit output requires it.

Implement any follow-ups surfaced in release notes (config, imports, CI pins) **before** or alongside the version bump.

### 1c. Verify

```bash
npm run test
npm run fix
```

### npm rules for this repo

- Keep **exact versions** in every `package.json` — no carets from `ncu` (`--removeRange` handles this).
- Respect root **`overrides`** (`vite`, `@astrojs/react` → `@vitejs/plugin-react`). Do not drop or widen them without cause.
- If **Wrangler** changes in `code/app/web`, sync `wranglerVersion` in `.github/workflows/web-deploy.yml` and `.github/workflows/web-validate.yml` (keep in sync with the web devDependency).
- After **major** upgrades called out in release notes, explicitly verify:
  1. `npm run build -w web`
  2. `npm run test:web`
  3. React Compiler still works in dev/build (`astro.config.mjs`, not Vitest)
  4. Playwright browser tests still pass

Summarize bumped packages **and** the release-note-driven changes in the PR/commit message.

---

## 2. Bump GHA deps

### 2a. Discover and read

Inventory every third-party action in `.github/workflows/` (pinned SHA + `# vX.Y.Z` comment today).

| Workflow | Actions to check |
|----------|------------------|
| `web-checks-reusable.yml` | `actions/checkout`, `actions/setup-node`, `actions/cache`, `actions/upload-artifact` |
| `web-validate.yml` | above + `mshick/add-pr-comment`, `cloudflare/wrangler-action` |
| `web-deploy.yml` | checkout, setup-node, `cloudflare/wrangler-action` |
| `infrastructure-validate.yml` | checkout, setup-node, `hashicorp/setup-terraform`, upload-artifact, `actions/github-script` |
| `infrastructure-deploy.yml` | checkout, setup-node, `hashicorp/setup-terraform` |

For each action with a newer release:

1. Read **release notes / changelog from current tag → target tag**.
2. Note breaking input renames, Node version requirements, permission changes, or deprecated outputs.
3. Update workflow YAML for any required input/output migrations **before** bumping the SHA.

### 2b. Apply

This repo pins actions by **full commit SHA** with a trailing version comment:

```yaml
uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0
```

When bumping:

1. Look up the latest appropriate **release tag** (`gh release list -R owner/repo`).
2. Read release notes for **current → target** (see § Release notes).
3. Resolve the target tag to its commit SHA.
4. Update **both** the SHA and the `# vX.Y.Z` comment.
5. Apply the same SHA everywhere that action is reused.
6. For `cloudflare/wrangler-action`, bump the action SHA **and** confirm `wranglerVersion` still matches `code/app/web/package.json`.

Do not switch to floating `@v*` tags.

---

## 3. Bump Terraform providers

Provider-agnostic instructions — applies to **every** provider declared under `infrastructure/` (root and modules). Today that is only `cloudflare/cloudflare`; future providers use the same flow.

### 3a. Discover and read

1. List all providers and version constraints:

   ```bash
   rg 'required_providers|source\s+=' infrastructure --glob '*.tf'
   ```

2. Record **locked** versions from `infrastructure/.terraform.lock.hcl` (and any module lockfiles if present).
3. For each provider, identify the latest version within the current constraint and whether a **next major** exists on the registry.
4. Read provider **release notes from locked version → candidate target** (GitHub releases + registry upgrade guides). Do this per provider, per bump pass.
5. From the notes, list required HCL changes: renamed resources/attributes, new required fields, state migrations, `moved` blocks, import path changes.

Do not edit `versions.tf` / constraints until you understand the migration path from release notes.

### 3b. Bump strategy (per provider: minor first, major when safe)

Work in two passes **for each provider independently**. Stop and report if a pass cannot be made cleanly.

**Pass A — latest within the current major constraint** (e.g. `~> 5` stays `~> 5`):

1. Refresh the lockfile to the newest provider satisfying the **existing** constraint (`init -upgrade` when creds allow).
2. Apply any minor/patch migration steps from release notes.
3. Run validate + plan when creds allow (§ 3c). Commit if the plan is empty or benign — or, without creds, commit after fmt/validate and defer plan review to CI (§ 3d).

**Pass B — next major, only if nothing breaks:**

1. Use release notes to confirm the major migration is feasible in this repo.
2. Widen the version constraint in **every** `terraform` / `required_providers` block that declares that provider (root + all modules — keep constraints consistent).
3. Implement breaking changes documented in the upgrade guide (resource renames, attribute moves, new required arguments).
4. Re-init with `-upgrade`, then validate + plan again.
5. **Accept the major bump only when** (locally per § 3c, or from the latest CI plan comment per § 3d):
   - `terraform validate` passes
   - `terraform plan` shows **no unexpected destroys** on production-critical resources
   - Plan diffs match what release notes predict, or are fixed in the same commit
6. If the major plan is destructive or needs state surgery you cannot complete — **revert the constraint bump** for that provider and report what blocked the upgrade.
7. If plan fails **only because credentials are unavailable** (see § 3d) — defer the plan gate to CI; do not revert solely for missing local secrets.

A clean plan is the gate. Release notes explain *why*; plan proves *safe*.

### 3c. Verify (lockfile + plan)

After constraint/code changes informed by release notes:

```bash
terraform -chdir=infrastructure fmt -recursive
```

(`npm run fix` includes fmt.)

When **credentials are available** (local machine with `infrastructure/.env` / 1Password mount):

```bash
./tf.sh init -backend-config=backend.hcl -upgrade
./tf.sh validate
./tf.sh plan -out=tfplan
./tf.sh show -no-color tfplan > infrastructure/plan.txt
npm run filter-terraform-plan -- --input infrastructure/plan.txt --output infrastructure/plan-filtered.txt --ci
```

Review filtered plan output locally before committing a major bump. Never commit `tfplan`, `.env`, or `backend.hcl`.

Also refresh as needed:

- **`terraform_version`** in `.github/workflows/infrastructure-validate.yml` and `infrastructure-deploy.yml` when release notes or provider docs require a newer CLI.
- **`hashicorp/setup-terraform`** action SHA (GHA track).

### 3d. Cloud agents — no local credentials

**Cursor Cloud agents cannot run `./tf.sh plan`.** That is expected. Do not block the Terraform track on local plan failure when the only issue is missing secrets.

**Still run without secrets:**

```bash
terraform -chdir=infrastructure fmt -recursive
npm run fix
```

**Try `./tf.sh init` / `validate` / `plan` only when credentials are present.** If `./tf.sh` exits with errors like *Could not load secrets*, *Missing infrastructure/.env*, *R2 credentials are missing*, or plan fails for missing `TF_VAR_*` / API tokens — treat that as **credential-unavailable**, not a code defect.

When credential-unavailable:

1. Commit lockfile + HCL changes (fmt-clean, validate if you could run it).
2. Open or update the PR — do **not** wait for a local plan.
3. Run **`/loop-on-ci`** after push — wait for CI green and triage failures.
4. Inspect the **latest** `Infrastructure Validation Complete` PR comment posted by `.github/workflows/infrastructure-validate.yml` (each push adds a new comment; ignore older ones). If no comment appears and the job logged *No infrastructure changes detected*, the plan was empty.
5. Use that CI plan as the gate for major bumps and unexpected destroys — same rules as § 3b step 5, but judged from the PR comment.

If CI plan shows unexpected destroys, fix the branch and loop again. Do not merge-ready a major provider bump until CI plan looks safe.

### Terraform rules for this repo

- Do **not** add providers or cloud resources outside project policy (today: **Cloudflare only** — no AWS).
- Do **not** regress bootstrap patterns documented in `AGENTS.md` (e.g. Wrangler-first Pages project, import before apply).
- After provider bumps, confirm the CI plan matches release-note expectations — defer bumps that introduce unexplained recurring diffs on managed resources (see Pages bootstrap in `AGENTS.md`).
- Review filtered plan output for unexpected destroys on any managed resource — locally or from the latest **`Infrastructure Validation Complete`** PR comment.

---

## 4. Finish

1. Show a summary table: **npm** / **GHA** / **Terraform** — version spans, release-note highlights, code changes made, what was already current.
2. Confirm `npm run test` and `npm run fix` pass after all tracks.
3. Open or update a PR when work is ready:
   - If Terraform changed and local plan was skipped (cloud / no creds), run **`/loop-on-ci`** and report the latest CI plan comment verdict.
   - If the user invoked this as part of release hygiene, run **`/prepare-pull-request`** (or commit + push + open a draft PR yourself).

Suggested branch: `chore/bump-deps-YYYY-MM-DD`.

Suggested commit messages (one per track):

- `chore(deps): bump npm dependencies`
- `ci: bump GitHub Actions`
- `terraform: bump <provider> provider` (minor/patch within current major)
- `terraform: upgrade <provider> provider to vN` (major — only when plan is clean)
