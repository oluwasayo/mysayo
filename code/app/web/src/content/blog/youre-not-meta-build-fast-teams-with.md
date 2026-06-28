---
title: "You’re Not Meta: Build Fast Teams with Fast Tests"
description: "A tale of two internet giants and what it teaches us about release confidence and velocity."
slug: youre-not-meta-build-fast-teams-with
pubDate: 2025-08-04
tags:
  - AGILE
  - ENGINEERING_EFFECTIVENESS
  - SOFTWARE_ENGINEERING
  - SUBSTACK
  - TESTING
---
Velocity in software engineering gets romanticized — but speed alone doesn’t deliver the win. True velocity is directional: it’s speed toward the right goal. As conditions shift, your ability to reorient confidently becomes the real differentiator.

Similarly, testing isn't the goal either. We don't write tests to hit arbitrary code coverage targets. We write them to build **confidence in our ability to release**, and to preserve business value as we evolve our products rapidly.

You don't win by shipping the most code — you win by shipping the right code, confidently and consistently. What sets high-performing teams apart isn’t just speed, but the ability to change direction quickly when risks or opportunities emerge. That’s what testing unlocks: safe, adaptable velocity — especially if you're not sitting on a billion-dollar infra stack.

### The Feedback Loop of Confident Code

I love finding self-reinforcing loops in engineering culture. The kinds of systems where a small improvement in one area creates pressure and potential for improvements in another, compounding until the flywheel spins almost effortlessly.

Testing has one of the strongest loops:
- The faster tests are to write and run, the more often engineers write them.
- The more tests engineers write, the more regressions they catch early.
- The earlier engineers catch bugs, the less time they spend firefighting.
- The less time engineers spend firefighting, the faster they can iterate.
- The faster engineers iterate, the more capacity they have to improve infra.
- The better the infra engineers build, the faster and more reliable the tests become.
    

Each turn of the loop improves confidence. And confidence is the foundation of velocity.

### A Tale of Two Cultures

Over my career, I’ve had the privilege of experiencing the engineering cultures at both **Google** and **Meta** — two companies at the pinnacle of internet-scale success. Their approaches to testing couldn’t be more different.

At **Google**, testing is deeply embedded into the engineering culture. It shows up in infrastructure, code review expectations, and even in restrooms. Yes, restrooms.

One of my favorite rituals from my time at Google Zurich was **Testing on the Toilet** — a legendary internal publication of testing tips posted on bathroom doors. Engineers literally couldn't avoid thinking about test quality.

![Photo of TotT posted in a bathroom stall](/writing/youre-not-meta-build-fast-teams-with/0-d1629fdf-3c27-477a-8d36-3704d5c823ab_509x625.png)

That same ethos spills over into tooling, patterns, and expectations. You can see this mindset reflected in their public [testing blog](https://testing.googleblog.com/), which has been running since 2007. Testing at Google shapes how code is written, not just how it's verified.

At **Meta**, I found something quite different.

During [Bootcamp](https://engineering.fb.com/2009/11/19/production-engineering/facebook-engineering-bootcamp/) — Meta’s onboarding program, now discontinued — I submitted diffs to multiple product teams. To my surprise, they were approved without tests. Testing wasn’t absent, but it didn’t carry the same cultural weight it does at Google.

And yet, with a staggering $1.9T market cap, Meta is undeniably successful. Its dominance in social networking was so complete that even Google eventually gave up — pulling the plug on Google+. Both companies are home to some of the brightest engineers and have reshaped modern computing.

Google, for its part, has world-class infrastructure and one of the most respected site reliability organizations on the planet — with [books](https://sre.google/books/), research, and engineering practices that have set the industry standard. Meta matches that technical excellence with its own strengths: cutting-edge internal tooling, rich observability, and a cultural bias toward fast iteration.

The difference isn’t about capability — it’s cultural. Each company has evolved its own operating philosophy. Google invests deeply in upfront correctness; Meta leans into speed, feedback, and course correction at scale.

So how do you reconcile these two approaches?

You don’t. **You recognize that testing is a means to an end**: release confidence. At Google, that confidence comes from pre-release validation. At Meta, it comes from post-release observability and recovery. Both work — at scale.

But here’s the important part: **You are not Meta.**

You don’t have Meta’s observability stack. You don’t have hundreds of engineers maintaining custom dev infra. And you probably don’t have the organizational slack to tolerate failure at scale.

![File:Mark Zuckerberg - Move Fast and Break Things.jpg - Wikimedia Commons](/writing/youre-not-meta-build-fast-teams-with/1-d2b440f6-3994-4316-af9a-c084dc408e6e_1664x1248.jpeg)

*[Source](https://commons.wikimedia.org/wiki/File:Mark\_Zuckerberg\_-\_Move\_Fast\_and\_Break\_Things.jpg)*

That’s why, for most teams, **testing is the most pragmatic path to velocity**.

### Culture Moves at the Speed of Feedback

When testing is fast — fast to write, fast to run, fast to interpret — it becomes habitual. And that habit becomes cultural.

I’ve worked with teams where running tests took 20 minutes, where runs were flaky, and writing tests felt like grunt work. In those environments, the testing culture decays. Trust decays. Velocity drops.

I’ve also worked with teams where running tests was near-instant. Where failures were rare and meaningful. Where tooling made it *easy* to do the right thing. Those teams moved faster — not because they skipped testing, but because they trusted it.

Culture doesn't change because someone writes a memo. It changes when feedback becomes too fast, too useful, and too integrated to ignore.

### Investments That Pay for Themselves

If you want testing to become part of the culture, you have to invest in the velocity of testing itself:
- **Speed up local execution.** Tests that run in milliseconds run constantly.
- **Write tools for test data and mocking.** Reduce setup friction.
- **Fix flaky tests aggressively or delete them altogether.** A flaky test is worse than no test — it erodes trust.
- **Optimize your CI pipeline.** Reducing runtime by even 5 minutes does more than cut costs, it preserves developer momentum.
- **Structure your test suite with intent.** Don’t over-rely on slow end-to-end tests — aim for a balanced testing pyramid instead.
    

None of this is glamorous. But it's how most high-functioning teams scale with confidence.

### Returning to the Loop

In my [previous essay](/writing/pull-requests-where-engineering-culture), I explored a similar feedback loop in pull request culture — how faster reviews lead to smaller PRs, which lead to even faster reviews, and so on. That same systemic thinking applies here.

**Faster tests → More tests → More confidence → Fewer bugs → Faster shipping → More time to improve testing**

These loops matter. They’re how engineering orgs scale, adapt, and become truly formidable.

### Conclusion: Confidence + Capability = Velocity

In the end, we test not for testing’s sake — but to move fast without fear.

The most successful engineering cultures are the ones that build confidence into the system. At Google, that confidence comes from preemptive coverage. At Meta, it comes from resilience and observability. Either way, the goal is the same: to ship with speed, and learn without regret.

For most teams, testing is the most accessible lever to reach that goal. It’s not the only way — but it’s the most pragmatic way to **earn the right to move fast**.

That said, the landscape is evolving rapidly. AI is challenging many of our assumptions, and it’s already proving adept at writing tests. Who knows — in a few years, traditional testing as we know it today might become obsolete. Until then, the best path forward remains clear: **move fast, with fast tests**.
