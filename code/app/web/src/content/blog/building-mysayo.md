---
title: Building mysayo.com
description: How I built this site — a static Astro front-end, a React Compiler island, and a Cloudflare-only stack managed entirely in Terraform, with secrets that never touch the repo.
slug: building-mysayo
pubDate: 2026-06-24
tags:
  - VIBE_CODING
  - ARCHITECTURE
  - ASTRO
  - CLOUDFLARE
  - TERRAFORM
  - TESTING
  - CURSOR
---

I'd always loved the idea of having a personal website but never gotten around to building on. So I created an empty directory, ran `git init` and got to business. I wanted the first post to be the obvious one: how the thing you're reading was actually made. Not a tutorial — a record of the decisions, the trade-offs, and the one platform surprise that had me scratching my head. This all took about 2 hours to put together, while the England vs Ghana world cup match played in the background.

The short version: it's a static [Astro](https://astro.build/) site with a single React island, compiled and bundled by Vite, deployed to Cloudflare Pages, with every piece of infrastructure — DNS, the Pages project, zone settings, even the Terraform state bucket — managed in Terraform against Cloudflare. No AWS. Secrets live in 1Password and are mounted at runtime; none of them are in the repository.

## The stack, briefly

- **Astro 7**, static output. No SSR adapter.
- **React 19** for the one interactive island, optimized by the **React Compiler** at build time.
- **Vite 8** as the bundler, via Astro.
- **TypeScript 7 RC** everywhere, type-checked with `tsc`.
- **Biome** for lint/format, **Stylelint** for CSS, **Knip** for dead code and unused dependencies.
- **Vitest 4** in browser mode, running real **Chromium via Playwright** — not jsdom.
- **Cloudflare Pages** for hosting, **Terraform** for everything else.
- **npm workspaces** holding it together as a monorepo.
- **Node 26**, pinned to match CI exactly.

## A monorepo, even for one simple site?

A single static site doesn't need a monorepo. I used one anyway, because I'd rather grow into structure than retrofit it later.

```
.
├── code/
│   ├── app/
│   │   ├── web/           Astro site — where the work happens
│   │   ├── shared/        cross-package constants and types
│   │   └── server/        placeholder for future Cloudflare Workers
│   └── bin/               ops CLIs (Terraform plan filter for CI)
└── infrastructure/        Terraform — Cloudflare only
```

The root orchestrates everything through npm workspace scripts, and Vitest runs the `shared` and `web` projects together. The shared package already earns its keep: site metadata (name, URL, nav, social links) lives in one typed module that both the build and the tests import.

<figure class="brain-meme">
  <div class="brain-meme__grid">
    <div class="brain-meme__cell brain-meme__text" data-level="1"><span class="brain-meme__step">01</span><span class="brain-meme__label">Create a single <code>index.html</code> file</span></div>
    <div class="brain-meme__cell brain-meme__mind" data-level="1"><img class="brain-meme__brain" src="/blog/brain-1.webp" alt="" width="420" height="305" loading="lazy" decoding="async" /></div>
    <div class="brain-meme__cell brain-meme__text" data-level="2"><span class="brain-meme__step">02</span><span class="brain-meme__label">Initialize npm workspaces</span></div>
    <div class="brain-meme__cell brain-meme__mind" data-level="2"><img class="brain-meme__brain" src="/blog/brain-2.webp" alt="" width="420" height="309" loading="lazy" decoding="async" /></div>
    <div class="brain-meme__cell brain-meme__text" data-level="3"><span class="brain-meme__step">03</span><span class="brain-meme__label">Add Vitest, Playwright, and Chromium</span></div>
    <div class="brain-meme__cell brain-meme__mind" data-level="3"><img class="brain-meme__brain" src="/blog/brain-3.webp" alt="" width="420" height="281" loading="lazy" decoding="async" /></div>
    <div class="brain-meme__cell brain-meme__text" data-level="4"><span class="brain-meme__step">04</span><span class="brain-meme__label">Manage secrets and infrastructure with Terraform and 1Password… for a one-page static site</span></div>
    <div class="brain-meme__cell brain-meme__mind" data-level="4"><img class="brain-meme__brain" src="/blog/brain-4.webp" alt="" width="420" height="266" loading="lazy" decoding="async" /></div>
  </div>
  <figcaption class="brain-meme__caption">At least no Kubernetes. Yet.</figcaption>
</figure>

## Astro, React islands, and a build-only compiler

Astro's model fits a content site perfectly: ship HTML, hydrate only what needs to be interactive. On this site, exactly one thing needs JavaScript, for now — the light/dark theme toggle — so exactly one thing is a [React island](https://docs.astro.build/en/concepts/islands/). Everything else is static markup generated at build time.

The interesting wrinkle is the **React Compiler**. I wanted its automatic memoization in production, but it has no business running inside the test bundle. So it lives only in the Astro/Vite build, wired in through Babel:

```js
// astro.config.mjs
vite: {
  plugins: [babel({ presets: [reactCompilerPreset()] })],
}
```

Tests compile the same components with plain `@vitejs/plugin-react` instead. Putting the compiler in Vitest's browser mode fails on a `react-compiler-runtime` interop error, and there's no reason to test compiler output anyway — I test behavior. Keeping the compiler on the build path and out of the test path is a small decision that saves a lot of confusion.

## Testing like I mean it

I removed jsdom on purpose. Component tests run in headless Chromium through Vitest's browser mode and Playwright. If a test says a button toggles the theme, it's a real browser dispatching a real click against a real DOM. CI caches the Playwright binaries against the lockfile and installs Chromium before the run.

It's heavier than jsdom. It's also honest, and for a UI that's the trade I want.

## Guardrails over vibes

Biome formats and lints, Stylelint covers the CSS, and Knip fails the build if a dependency or export goes unused. That last one is quietly excellent: when I dropped a library later (more on that below), Knip immediately told me which dependencies had become dead weight. The CI also runs `clean` and fails if the working tree is dirty afterward — no stray build artifacts sneak into commits.

## Everything in Terraform, all on Cloudflare

I bought the domain through Cloudflare's registrar and decided, on principle, that nothing about the platform would be configured by clicking around a dashboard. If it isn't in Terraform, it doesn't exist.

So Terraform manages the DNS records, the Pages project and its custom domains, the zone-level settings (TLS, HTTPS rewrites, Brotli, HTTP/3), and the R2 bucket that holds Terraform's own state. The state backend is R2 itself, through Terraform's S3-compatible backend:

```hcl
backend "s3" {
  key          = "infrastructure/terraform.tfstate"
  region       = "auto"
  use_lockfile = true
  use_path_style = true
  # ...skip the AWS-specific validation the R2 endpoint doesn't implement
}
```

R2 speaks enough of the S3 API to be a credible state store, as long as you tell the backend to skip the checks that only make sense against real S3.

## Secrets live in 1Password, never in the repo

There are no `.env` files with real values anywhere in this project, and there never will be. Local credentials come from **1Password Environments**, mounted as `.env` files on demand. A small wrapper script, `tf.sh`, loads `infrastructure/.env` and maps the R2 credentials onto the `AWS_*` variables the S3 backend expects, then hands off to Terraform.

The thing nobody warns you about: 1Password mounts those files as **FIFOs**, not regular files. My first few attempts read them with process substitution and background reads, which raced and produced empty environments. The fix was almost anticlimactic — read the FIFO with a single blocking `cat` into a temp file, then source that. Once I stopped being clever, it became reliable.

## Where Cloudflare surprised me

Here's the afternoon I mentioned. I went in assuming Cloudflare's Terraform story would feel like AWS's. It doesn't, yet — and that's worth saying plainly because the marketing won't.

The sharpest edge was the **Pages project**. The Cloudflare provider will happily try to *create* a Pages project, but its data source and resource fight each other over computed build settings, producing permanent, phantom plan diffs. The working pattern turned out to be inverted from what I expected: create the project once with Wrangler, then **import** it into Terraform and let a data source read the fields the provider can't manage cleanly. That's the opposite of the "Terraform owns the full lifecycle" model AWS spoiled me with.

A few more gaps in the same spirit:

- **State locking** isn't a given. AWS's S3 backend made locking effortless for years; on R2 I had to explicitly opt into the lockfile and add a CI concurrency group so two `apply`s can't race.
- **Fewer knobs, and quieter ones.** Several resources expose a thinner surface than their AWS equivalents, and "computed vs. configurable" isn't always where you'd guess — which is exactly what feeds the phantom-diff problem.
- **Bootstrap is chicken-and-egg.** The bucket that stores state has to exist before the backend can initialize, so the very first run is a manual `wrangler r2 bucket create` followed by a Terraform import.

None of this is a dealbreaker. Cloudflare's edge, R2's pricing, and Pages' simplicity are genuinely great. But if you're coming from AWS expecting one-to-one Terraform parity, calibrate down. The platform is excellent; the IaC maturity is still catching up.

## Built with an agent, steered by me

I built this in Cursor, working with an AI agent the whole way — but guided, not on autopilot. The agent was fast at the mechanical parts: scaffolding workspaces, wiring CI, chasing down that FIFO bug, refactoring the Terraform modules. The architecture, the trade-offs, and every "no, do it this way" were mine. It's the most productive way I've found to work: I make the decisions, it does the typing, and I review everything like a pull request.

## Dropping the component library

I started with a component library and removed it before launch. For a flat, typography-led, mostly-static site, it was fighting me on every border radius and shipping React for chrome that should've been plain HTML. So I hand-rolled a small design system instead: a set of CSS custom properties, semantic markup, proper light and dark themes, and a measure tuned for reading. Less code, less JavaScript, full control — and a more honest representation of how I like to build.

## What's next

The bones are here: content collections for writing, a clean type-checked build, infrastructure as code, and a deploy pipeline that runs on every merge. From here it's mostly content — and the occasional note, like this one, about how it all fits together.
