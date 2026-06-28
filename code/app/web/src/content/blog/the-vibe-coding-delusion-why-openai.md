---
title: "The Vibe Coding Delusion: Why OpenAI Still Pays for Slack"
description: "In the last 30 days, I've overseen over 105,928 lines of agent-edited code."
slug: the-vibe-coding-delusion-why-openai
pubDate: 2026-03-17
tags:
  - SOFTWARE_ENGINEERING
  - SUBSTACK
  - VIBE_CODING
---
I am not an AI skeptic. Far from it. I am a power user of agentic coding with Cursor Ultra, MCPs, custom rules, and integrations: you know, the whole shebang. I’ve seen exactly what happens when you push LLMs to their absolute limit in a production environment. It is precisely because of that experience, not in spite of it, that I’m seeing a short-sighted trend in how we talk about the future of this industry.

The disappointments I’m seeing people hit with vibe coding boil down to two fundamental issues:

1.  **Programming is not Software Engineering.**
    
2.  **A successful and defensible business is far more than just a computer program.**
    

We are currently confusing the act of generating code with the discipline of building and maintaining industrial machinery that serves a business purpose.

---

## 1. Programming vs. Software Engineering (The “Day 2” Problem)

In the book *[Software Engineering at Google](https://abseil.io/resources/swe-book)*, the authors define the discipline as the “tools and processes an organization uses to build and maintain code over time.” Their key insight is simple: **Software engineering is programming integrated over time.**

That time component radically changes the craft. Programming is the act of solving a problem once. Software engineering is the discipline of keeping that solution alive, relevant, and improving while the world changes around it.

LLMs are “stateless” tools. They solve the “Day 1” problem of getting something to run, but they do nothing to solve the “Day 2” problem of keeping that solution viable. Vibe coding captures a snapshot in time, yet it ignores the reality that software exists in a state of constant collision with the real world. It cannot navigate evolving threat vectors, multi-market regulatory shifts, or the relentless pressure of cost optimization.

As platform capabilities change and customer demands grow, systems vibed without proper engineering, product, and business discipline often lack the structural integrity needed to adapt. This is because they are the result of compounding issues accumulated one stateless prompt at a time. Such systems begin to rot the moment the first user logs in.

---

## 2. The Slack Paradox: Simplicity as a Shield

A great product looks simple. That is its primary job. Tools like Slack, Stripe, and Linear are designed to hide massive infrastructural, product, and business complexities from the user.

**The delusion is thinking that because the interface is simple to prompt, the engine is simple to build and operate.**

This explains a strange pattern in the vibe coding community. We hear about people trying to vibe code their own versions of Slack, but we never hear about them vibe coding their own Postgres or React. Why? Because the complexity of a database is visible and intimidating. The complexity of a world-class SaaS is invisible, hidden behind a clean UI and a smooth vibe.

These products shield you from the operational nightmare of 99.99% uptime, global compliance, and the 90% of edge-case complexity that isn’t vibey to build. When you vibe code a replacement, you are doing far more than writing an app: you are inheriting an operational, infrastructural, and engineering burden you aren’t prepared to carry.

![](/writing/the-vibe-coding-delusion-why-openai/0-2e5410c8-82b8-4d7d-bd0c-968185f08785_2816x1536.png)

*Credit: Gemini, which also assisted in writing this post.*

---

## 3. Why OpenAI Still Pays for Slack

If vibe coding were truly a replacement for industrial-grade software engineering, the leaders of the revolution would be the first to dogfood it.

Yet, OpenAI and Anthropic, the very people building the models, still hire thousands of engineers. They use Slack as their primary communication tool. They collect payments with Stripe instead of vibe coding a replacement over a weekend.

They know that a vibe coded replacement for Stripe isn’t a cost-saving measure but a business liability. They understand that while the cost of **creation** has dropped, the total cost of **ownership** (hosting, securing, scaling, and operating) remains the same, perhaps even higher due to increased entropy.

---

## The Value of the “Hustle”

The recurring argument (”Why pay for X service when I can just code it myself?”) often reveals a lack of understanding of the software business.

Enduring value requires maintenance, and maintenance is costly. When you pay $20 for a seat at Linear or Sentry, you aren’t paying for lines of code. You are paying for a team of global domain experts whose primary hustle is to make that single product the best in its category globally.

If your whole business can be easily replaced with a vibe coded weekend project, you never really had a moat to begin with. You had a prototype. Real defensibility lives in everything else that can’t be prompted away.

**State-of-the-art coding agents are scarily good at programming, and we should be squeezing every bit of efficiency out of them.** But they aren't a magic pill to materializing a dependable system or a defensible business. Speed is not velocity. Most of the time, you’re better off paying for the industrial-grade tool and spending your "vibe energy" on the problems only you can solve.

**And that is why great tools will continue to acquire paying customers.**
