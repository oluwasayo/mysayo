---
title: Prepare Pull Request
description: 'Agent guardrails are safety that makes high velocity workable. I encode mine as a single Cursor command that runs reviews, tests, lint, CI, and the feedback loop before a human ever sees the PR.'
slug: prepare-pull-request
pubDate: 2026-07-24
draft: false
tags:
  - CURSOR
  - PULL_REQUEST
  - CODE_REVIEW
  - SOFTWARE_ENGINEERING
  - TESTING
---

Agents are fast at producing diffs and slow at the unglamorous readiness work. Left to their own devices, they skip self-review, under-test, open pull requests too early, and call it done when the laptop build passes. Plenty of motion. Thin pull requests.

I wired the gates into the repo instead of re-explaining them in every chat. The hook is a Cursor custom command: `/prepare-pull-request`. One invocation runs the stack end to end. The rails make it safe to go fast.

I've written about [pull requests as cultural artifacts](/writing/pull-requests-where-engineering-culture) and [programming vs software engineering over time](/writing/the-vibe-coding-delusion-why-openai). This post is the operational layer: what actually runs before a human gets pinged.

## Standing context

**`AGENTS.md`** is standing instructions: layout, commands, conventions, what not to commit. **`KNOWLEDGE.md`** (where I keep one) holds design decisions that are easy to lose in a chat. Those files tell the agent what the codebase expects. `/prepare-pull-request` tells it what to do before review.

## The guardrail stack

| Guardrail | What it protects |
| --- | --- |
| Strong typing / typecheck | Type errors before runtime |
| Strict lint + format (`npm run fix`) | Mechanical nits out of human review |
| Builds and tests | Artifacts that compile, apps brought to readiness, behavior that holds |
| Bug review (`/review-bugbot`) | Correctness and security |
| Maintainability review (`/thermo-nuclear-code-quality-review`) | Readability and long-term structure |
| Draft PR → CI | Remote quality gates, not laptop theater |
| CI (`/loop-on-ci`) | Builds, tests, and deploy-shaped checks on clean runners |
| Component screenshots (when the UI warrants it) | Cheap visual eyeballing for humans and agents |
| Review comments | Feedback on the PR itself, not only build status |

These only work if the repo already has typed boundaries, strict lint, real CI, and builds/tests that mean something. [Building this site](/writing/building-mysayo) was the same idea on a much smaller scale. What CI runs in a multi-app repo (Lambda bundles, container images, web builds, simulated deploy paths) is a topic for another post. Here, CI is the remote gate the command loops on until green.

<figure class="pr-pipeline-diagram">
<svg viewBox="0 0 720 160" role="img" aria-labelledby="pr-d1-title pr-d1-desc">
<title id="pr-d1-title">Prepare pull request pipeline</title>
<desc id="pr-d1-desc">Five stages: local reviews, builds, and tests, draft pull request, CI and screenshots, loop on CI, ready for review.</desc>
<defs><filter id="rgh-pr1" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="11" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.5"/></filter></defs>
<g class="d-ink" filter="url(#rgh-pr1)">
<rect x="14" y="48" width="118" height="76"/>
<rect x="156" y="48" width="118" height="76"/>
<rect x="298" y="48" width="118" height="76"/>
<rect x="440" y="48" width="118" height="76"/>
<rect x="582" y="48" width="118" height="76"/>
<path d="M136 86 L 150 86"/>
<path d="M150 86 l -8 -5 m 8 5 l -8 5"/>
<path d="M278 86 L 292 86"/>
<path d="M292 86 l -8 -5 m 8 5 l -8 5"/>
<path d="M420 86 L 434 86"/>
<path d="M434 86 l -8 -5 m 8 5 l -8 5"/>
<path d="M562 86 L 576 86"/>
<path d="M576 86 l -8 -5 m 8 5 l -8 5"/>
</g>
<text x="24" y="72" class="d-t-muted">local</text>
<text x="24" y="96">reviews + fix</text>
<text x="166" y="72" class="d-t-muted">open</text>
<text x="166" y="96" class="d-t-accent">draft PR</text>
<text x="308" y="72" class="d-t-muted">remote</text>
<text x="308" y="96">CI + shots</text>
<text x="450" y="86">/loop-on-ci</text>
<text x="592" y="72" class="d-t-muted">mark</text>
<text x="592" y="96" class="d-t-accent">ready</text>
</svg>
<figcaption>Local gates first, then a draft PR, then CI and the feedback loop.</figcaption>
</figure>

## What the command does

Run in order. Do not skip a step because the prior one looked clean.

**1. Maintainability review.** `/thermo-nuclear-code-quality-review` on the branch diff. Address every finding. False positives get explained in the PR body, not ignored.

**2. Bug review.** `/review-bugbot`. Fix valid findings. Push back only with a concrete reason.

**3. Builds and tests.** Cover gaps the diff introduced or exposed. Run affected tests and fix failures. Build what the change touches: web bundle, Lambda artifact, ECS image, whatever your repo ships. Bring apps to readiness or simulate a deploy path so you have some confidence the change survives outside your laptop. Prefer the full suite before opening the PR unless the change is clearly isolated.

**4. Lint and format.** `npm run fix` (or your repo's equivalent). Typecheck rides along here or in CI. Do not commit a tree that would fail the clean-script gate.

**5. Branch.** Still on `main`? Check out a feature branch first.

**6. Component previews (repo-specific).** In a UI-heavy codebase I extend the command: scaffold missing Storybook stories, capture screenshots, attach a **Component previews** section to the PR body. Optional. Swap for migration checklists, API doc diffs, or whatever your product needs.

**7. Commit, push, draft PR.** Open as a **draft**. Summary, test plan, previews if you captured them. CI runs; humans do not get pinged yet.

**8. CI loop.** `/loop-on-ci` until required checks pass. React to failures and review comments. Do not weaken CI or skip hooks to get green.

**9. Ready for review.** `gh pr ready`. GitHub requests reviewers from `CODEOWNERS`. First human ping, on a PR that already passed local and CI gates and is already thoroughly reviewed by AI.

## Why one command

I pasted this checklist into every chat for a while. It drifted. Steps got skipped when the agent was "confident." Screenshot capture appeared in some sessions and not others.

A custom command is a durable prompt: same ritual every time, checked into `.cursor/commands/` so pipeline changes get reviewed like any other code. The team shares one definition of ready, not five chat transcripts that diverged last Tuesday.

Humans get higher-signal PRs. The agent stops burning context re-deriving the checklist.

## The production command

Portable idea above. This is what I run in a production monorepo, including the component-preview branch. Adapt the steps; keep the order.

```markdown
prepare-pull-request

Run /thermo-nuclear-code-quality-review
Address all the review findings
Run /review-bugbot
Address all the review findings
Cover all the testing gaps introduced or exposed by this diff
Run all the affected tests and fix up as necessary
Run "npm run fix" and address any errors that arise
If we are on the main branch on git, checkout a new branch

**Component previews** (only when the branch diff vs `main` includes meaningful `code/app/web/src` component changes):

1. Run `npm run list-components-needing-stories -w web` and parse the JSON output
2. For each component with `hasStory: false`: read the component and colocated test (when `testPath` is present), write co-located `Foo.stories.tsx` following `code/app/web/script/story-scaffold.template.ts` and `storyHelpers` conventions. Use `mockQueryResultFactory(..., false)` in stories — never `vi.fn()`. Commit new story files to the branch.
3. Re-run affected web tests if new stories were added
4. Run `npm run capture-component-screenshots -w web`
5. Upload PNGs using `code/app/web/script/lib/githubMarkdownImages.ts` (`gh auth token`) and prepare a **Component previews** markdown section for the PR body. List components that could not be storied under **Component previews (skipped)** with reasons.

Commit, push and open a draft pull request — include the **Component previews** section in the PR body when screenshots were captured
/loop-on-ci and iterate until all CI checks pass
Mark the pull request as ready for review (i.e. name it non-draft)
```

Pick your rails, write them down, wire one command. Then let the agent cook.
