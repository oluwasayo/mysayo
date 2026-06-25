# Prepare pull request

End-to-end workflow: review, fix, test, commit, open a draft PR, iterate on CI, then mark ready for review.

Follow each step in order. Do not skip a step because a prior one looked clean — run it anyway.

## 1. Code quality review

Run `/thermo-nuclear-code-quality-review` on the current branch changes.

Address every finding before continuing. If a finding is a false positive, note why in the PR body later — do not silently ignore it.

## 2. Bugbot review

Run `/review-bugbot` on the current branch changes.

Address every valid finding. Push back only when you can explain concretely why the report is wrong.

## 3. Tests

Run the tests affected by the changes. For this repo, that usually means:

```bash
npm run test
```

If the change is scoped to one workspace, `npm run test:web` or `npm run test:shared` is acceptable — but prefer the full suite before opening the PR unless the diff is clearly isolated.

Fix any failures before continuing.

## 4. Fix and lint

```bash
npm run fix
```

Address every error. Do not commit if `npm run fix` leaves the tree in a failing state or if CI's clean-script gate would fail (`npm run clean` must not leave tracked artifacts dirty).

## 5. Branch

If the current branch is `main` (or `master`), create and check out a descriptive feature branch before committing:

```bash
git checkout -b <type>/<short-description>
```

Use branch names like `feature/…`, `fix/…`, or `chore/…`.

## 6. Commit, push, draft PR

Only commit when the user has asked you to commit, or when this command is explicitly invoked (this command implies commit permission).

Follow the repo's git safety rules:

- Never force-push to `main`
- Never commit secrets (`.env`, `backend.hcl`, tfplan, etc.)
- Use a concise commit message focused on **why**

Then push and open a **draft** pull request:

```bash
git push -u origin HEAD
gh pr create --draft --title "…" --body "…"
```

PR body should include **Summary** (1–3 bullets) and **Test plan** (checklist of what you ran).

## 7. CI loop

Run **`/loop-on-ci`** until all required checks pass. Do not weaken CI or skip hooks to get green.

## 8. Mark ready for review

When CI is green and review findings are addressed:

```bash
gh pr ready
```

Confirm the PR is no longer draft and summarize what changed for the user.
