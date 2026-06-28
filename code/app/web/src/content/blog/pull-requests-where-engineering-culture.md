---
title: "Pull Requests: Where Engineering Culture Lives"
description: "Show me your PR workflow, and I'll tell you how your team collaborates."
slug: pull-requests-where-engineering-culture
pubDate: 2025-05-15
tags:
  - CYCLE_TIME
  - ENGINEERING_EFFECTIVENESS
  - PULL_REQUEST
  - SOFTWARE_ENGINEERING
  - SUBSTACK
---
Every engineering team has a culture, whether intentional or accidental. That culture manifests in processes, rituals, and artifacts — none more telling than the **pull request (PR)**.

In [my last article](/writing/forget-complexity-the-simplest-metric), I argued that **PR throughput** is an important signal for velocity. But throughput alone can mislead. While throughput is a proxy for value delivery, [cycle time](https://help.swarmia.com/metrics-and-definitions/pull-request-cycle-time) — the time from PR creation to merge — is a better indicator of team health.

![](/writing/pull-requests-where-engineering-culture/0-c47ca6a2-e461-4272-8175-01e70a586ac5_1192x392.jpeg)

*Pull request cycle time stages ([source](https://help.swarmia.com/metrics-and-definitions/pull-request-cycle-time))*

From what I’ve seen across different teams, a consistent pattern shows up:
- **High-performing teams**: first review in under 2 hours, merge within 24
- **Struggling teams**: over a day to first review, PRs hang around for days or even weeks
    

The difference isn’t just in their tooling, but in how these teams wield it — whether it reinforces their culture or gets in its way. Tooling can enforce process, but it can’t manufacture care. Pull requests are where culture shows up in practice; not just checkpoints in a delivery pipeline.

### PR Reviews Reflect How a Team Works

Look closely at your team’s PR reviews and you’ll see more than code:
- **Standards** get defined in comments
- **Knowledge** moves across people
- **Trust** is either built — or eroded — through how feedback is delivered or received
- **Growth happens**: For many engineers, PRs are where they get the most **frequent, timely, and contextual** feedback on their work.
    

> *Feedback is the engine of growth — and pull requests are the most consistent touchpoint for giving and receiving it.*

A review process shapes habits, expectations, and relationships. That’s what makes it a cultural artifact.

Long cycle times usually come down to slow reviews. Speed up the first response, and everything else starts to move faster too.

### When Reviews Stall Often, Culture is Usually the Cause

Frequent review delays aren’t just scheduling problems. They often point to missing expectations, unclear ownership, or a lack of accountability.

#### Problem #1: Slow First Response
- *Watch this metric*: **Time-to-first-review (TTFR)**. Under 2h puts you in an excellent position.
- *Why it matters*:
- Fast TTFR encourages smaller PRs
- Slow TTFR leads to batching (“Might as well add more while I wait”)
- *Fixes*:
- Use `CODEOWNERS` or rotations to auto-assign reviewers
- Define SLOs: e.g. “All PRs receive first review within 4 hours”
        

I’ve personally seen how ultra-low time to first review can transform a team’s momentum. In my own workflow, I’ve handled hundreds of reviews in minutes — because quick feedback encourages smaller, more focused PRs.

Of course, speed has trade-offs. Occasionally, a detail might slip through. But in teams with solid test coverage, continuous deployment, and a culture of fast iteration, the benefits far outweigh the downsides. You get faster merges, more trust, and fewer blockers — all without sacrificing long-term quality.

![](/writing/pull-requests-where-engineering-culture/1-1ad67892-fd6d-4d70-b87c-efe07b1ccb42_1600x788.png)

*253 PRs reviewed in under 10 minutes (2024 Year in Review)*

#### Problem #2: Large Batch Sizes
- *Metric to watch*: **PR size** (lines changed, files touched, excluding generated files).
- *Why it matters*:
- Large PRs take longer to review, increasing cognitive load and review time.
- Reviewers are more likely to skim or rubber-stamp just to get through it.
- Bigger batches raise merge risk — more likely to introduce bugs or require rework.
- *Fixes*:
- **Encourage atomic PRs**: Small, purpose-driven changes are easier to review and roll back.
- **Review velocity incentives**: Celebrate fast, high-quality reviews of small PRs.
- **Make it visible**: Track PR size distribution over time — people fix what they can see.
        

#### Problem #3: PRs Get Lost in the Noise
- *Why it matters*:
- A PR that waits too long is often forgotten.
- Reviewers may not realize it’s pending — or they saw it, meant to review it, and it slipped past.
- Human-written PRs get buried under a sea of bot updates (hello, Dependabot).
- *Fixes*:
- **Use tooling that surfaces what matters**: Tools like [Swarmia](https://www.swarmia.com/) help teams cut through the noise. Smart notifications and reminders for pending PRs keep reviews moving.
- **Create shared visibility**: Dashboards showing “PRs awaiting review” help teams stay accountable and responsive. Swarmia’s PR View separates human vs bot PRs, groups them by age and filters them by team, making it easy to spot what’s stuck.
- **Limit PR clutter**: Automate or auto-merge low-risk bot PRs to avoid burying the signal.
        

#### Problem #4: Inconsistent Review Quality
- *References*:
- [Google’s Code Review Guidelines](https://google.github.io/eng-practices/review/)
- [Chromium’s Code Author’s Guide](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/cl_respect.md)
- *Fixes*:
- Authors self-review before requesting feedback — you’d be surprised how much that catches.
- Reviewers use checklists to stay focused and avoid nitpicking.
        

#### Problem #5: Risky PRs No One Wants to Approve
- *Why it matters*:
- Some pull requests sit untouched not because they’re unclear or poorly written — but because they feel too risky. No one wants to be the person whose name is on the approval if something breaks. The result? Silent hesitation, delayed merges, and frustrated authors.
- *Why it happens*:
- Low confidence in test coverage or safety nets
- Fear of blame if something goes wrong
- No shared sense of ownership over the affected code
- *Fixes*:
- **Pair review high-risk changes**: Two reviewers share accountability and reduce approval hesitation.
- **Use feature flags or progressive delivery** to lower the blast radius.
- **Improve psychological safety**: Make it clear that the team shares responsibility when good process is followed — even if bugs slip through.
- **Label PRs by risk level** (“safe”, “risky”, “needs extra eyes”, “needs coordinated deploy”) to set expectations and triage accordingly.
        

> *If no one feels safe approving a PR, that’s a culture signal — not just a code smell.*

### Use Tools to Reduce Friction — Not to Replace Judgment

The right automation trims overhead and keeps reviews moving. But it only works when the team already values speed and clarity.

#### 1. Pre-Review Context
- Add preview links (e.g., from hosting platforms like [Cloudflare](https://developers.cloudflare.com/pages/configuration/preview-deployments/) or Vercel)
- Auto-generate important deltas, e.g., test coverage, bundle size, performance metrics
- *Why*: Reduces the “can you add a screenshot?” back-and-forth
    

#### 2. Spread the Load
- Assign review ownership to *teams*, not individuals
- Use specialized review tools to balance load
- *Why*:
- Avoids single points of failure
- Maximizes reviewer pool utilization
        

#### 3. Enforce Merge Policies
- Use branch protections and merge rules
- Require approvals and block unreviewed merges
- *Why*: Protects long-term standards from one-off exceptions
    

### Culture Still Comes First

You can automate routing and rules, but not care. Teams that thrive treat review time as essential, not optional.

#### 1. Encourage Respectful Feedback
- Use suggestions instead of accusations
- Keep comments focused on improvement, not judgment
    

#### 2. Make Reviewing Part of the Job
- Don’t leave reviews to chance — schedule and track them like any other engineering work
- Treat PR reviewing as equal in importance to authoring
- Encourage engineers to aim for **parity over time**: reviewing at least as many PRs as they open. I’ve found this mindset powerful—over the past year, I’ve reviewed more than twice as many PRs as I’ve authored. It’s kept the team unblocked and sharpened my ability to shift context quickly.
    

#### 3. Reward Small, Clean PRs
- Track PR size and highlight well-scoped work
- Praise thoughtful, small changes in retros and reviews
    

> *🧠 **What Highly Effective PR Workflows Look Like***
> 
> -   *Time to first review: under 2h*
>     
> -   *Merge time: under 24h*
>     
> -   *PRs are small and focused*
>     
> -   *Feedback is fast, clear, and respectful*
>     
> -   *Review load is shared, not siloed*
>     

### It’s Not Just About the Merge

Pull requests are where your team’s habits show up. Every comment, delay, or rushed approval says something about how the team works. If you want to improve collaboration, start where it’s visible.

---

### Down the Line: How CI/CD Quietly Shapes PR Velocity

Many teams focus on review habits, but often underestimate the role CI/CD systems play in enabling fast, confident merges. In a future post, I’ll dive into how flaky tests, batching strategies, merge queues and direct production releases shape PR flow behind the scenes.
