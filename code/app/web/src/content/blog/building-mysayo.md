---
title: Building mysayo.com
description: How I built this site. A static Astro front-end, a React Compiler island, and a Cloudflare-only stack managed entirely in Terraform, with secrets that never touch the repo.
slug: building-mysayo
pubDate: 2026-06-24
tags:
  - DESIGN
  - ARCHITECTURE
  - ASTRO
  - CLOUDFLARE
  - TERRAFORM
  - CURSOR
---

I'd always liked the idea of a personal website but never gotten around to it. So I made an empty directory, ran `git init`, and got to work. The first post had to be the obvious one: how the thing you're reading was made. That means the decisions, the trade-offs, and the one platform surprise that had me scratching my head. The initial structure took about two hours, with the England vs Ghana World Cup match on in the background.

The short version: it's a static [Astro](https://astro.build/) site with a single React island, compiled and bundled by Vite, deployed to Cloudflare Pages, with every piece of infrastructure (DNS, the Pages project, zone settings, even the Terraform state bucket) managed in Terraform against Cloudflare. The hosting stack and CI all sit on free tiers; at this scale the bill is zero. Local secrets live in 1Password and are mounted at runtime; none of them are in the repository. The validation, build and deployment run in GitHub Actions.

## The stack, briefly

- **Astro 7**, static output. No SSR adapter.
- **React 19** for the one interactive island, optimized by the **React Compiler** at build time.
- **Vite 8** as the bundler, via Astro.
- **TypeScript 7 RC** everywhere, type-checked with `tsc`.
- **Biome** for lint/format, **Stylelint** for CSS, **Knip** for dead code and unused dependencies.
- **Vitest 4** in browser mode, running real **Chromium via Playwright**, not jsdom.
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

Astro's model fits a content site perfectly: ship HTML, hydrate only what needs to be interactive. On this site, exactly one thing needs JavaScript for now (the light/dark theme toggle), so exactly one thing is a [React island](https://docs.astro.build/en/concepts/islands/). Everything else is static markup generated at build time.

The interesting wrinkle is the **React Compiler**. I wanted its automatic memoization in production, but it has no business running inside the test bundle. So it lives only in the Astro/Vite build, wired in through Babel:

```js
// astro.config.mjs
vite: {
  plugins: [
    babel({
      presets: [reactCompilerPreset()],
    }),
  ],
}
```

Tests compile the same components with plain `@vitejs/plugin-react` instead. Putting the compiler in Vitest's browser mode fails on a `react-compiler-runtime` interop error, and there's no reason to test compiler output anyway. I test behavior. Keeping the compiler on the build path and out of the test path is a small decision that saves a lot of confusion.

## Tests run in a real browser

Component tests run in headless Chromium through Vitest's browser mode and Playwright, not jsdom. If a test says a button toggles the theme, it's a real browser dispatching a real click against a real DOM. CI caches the Playwright binaries against the lockfile and installs Chromium before the run.

It's heavier than a simulated DOM. For a UI, the extra fidelity is worth the cost.

## Guardrails

Biome formats and lints, Stylelint covers the CSS, and Knip fails the build if a dependency or export goes unused. The CI also runs `clean` and fails if the working tree is dirty afterward, so no stray build artifacts sneak into commits.

## Everything in Terraform, all on Cloudflare

I bought the domain through Cloudflare's registrar and decided, on principle, that nothing about the platform would be configured by clicking around a dashboard. If it isn't in Terraform, it doesn't exist.

So Terraform manages the DNS records, the Pages project and its custom domains, the zone-level settings (TLS, HTTPS rewrites, Brotli, HTTP/3), and the R2 bucket that holds Terraform's own state. The state backend is R2 itself, through Terraform's S3-compatible backend:

```hcl
backend "s3" {
  key            = "infrastructure/terraform.tfstate"
  region         = "auto"
  use_lockfile   = true
  use_path_style = true
}
```

R2 speaks enough of the S3 API to be a credible state store, as long as you tell the backend to skip the checks that only make sense against real S3.

## Secrets live in 1Password, never in the repo

There are no `.env` files with real values anywhere in this project, and there never will be. Local credentials come from **1Password Environments**, mounted as `.env` files on demand. A small wrapper script, `tf.sh`, loads `infrastructure/.env` and maps the R2 credentials onto the `AWS_*` variables the S3 backend expects, then hands off to Terraform.

One detail worth flagging if you do this: 1Password mounts those files as **FIFOs**, not regular files, which rules out the usual shortcuts. Process substitution and background reads race against the mount and hand you an empty environment. The dependable pattern is the plainest one: read the FIFO once with a single blocking `cat` into a temp file, then source that. Boring beats clever here.

## Terraform on Cloudflare: what I learned

A few setup patterns made Cloudflare Terraform feel straightforward once they clicked.

**State bucket.** Create the R2 bucket, init the remote backend, then import:

```bash
cd code/app/web
npx wrangler r2 bucket create mysayo-production-terraform-state

cd ../..
cp infrastructure/backend.hcl.example infrastructure/backend.hcl

./tf.sh init -backend-config=backend.hcl

./tf.sh import \
  'module.terraform_state[0].cloudflare_r2_bucket.state' \
  '<CLOUDFLARE_ACCOUNT_ID>/mysayo-production-terraform-state/default'
```

**Pages project.** Create with Wrangler, import into state (after backend init):

```bash
cd code/app/web
npx wrangler pages project create mysayo-web --production-branch main

cd ../..
./tf.sh import \
  'module.cloudflare_pages[0].cloudflare_pages_project.web' \
  '<CLOUDFLARE_ACCOUNT_ID>/mysayo-web'
```

I also enabled lockfile locking on the R2 backend and a CI concurrency group so plans and applies don't overlap.

For a personal site at this scale, the whole stack is free: Pages, DNS, R2 for Terraform state, and GitHub Actions for CI. Edge performance is fine, deploys are painless, and the Terraform provider is actively maintained. Reading release notes or provider discussions when something looks off has been enough to keep moving.

## Built with an agent

I built this in Cursor with an AI agent. It's quick at the mechanical work (scaffolding workspaces, wiring CI, chasing down that FIFO bug, refactoring the Terraform modules), while the architecture and the trade-offs stay with me. The workflow is simple: I set direction, the agent drafts, and I review every change the way I'd review a pull request.

The same loop covers the front-end. For typography, the galaxy-brain grid, and the syntax colours, I point at [Linear Now](https://linear.app/now), the [Vercel blog](https://vercel.com/blog), or the [Cursor blog](https://cursor.com/blog), say "more like this," and iterate until it feels right.

<h2 class="prose-heading-ruler">A flat <span class="prose-heading-ruler__mark">design system<span class="prose-heading-ruler__tick" aria-hidden="true"></span><span class="prose-heading-ruler__tail" aria-hidden="true"></span></span></h2>

The UI is a hand-rolled design system: CSS custom properties, semantic markup, no border radius, mobile-first layout. For a mostly-static site whose only interactivity is a theme toggle, that keeps the JavaScript surface tiny and the markup honest.

The stylesheet is organized the way the page is: design tokens first, then base elements, utilities, site chrome, and the page-specific layers, imported in cascade order. Anything bespoke to a single post, like the grid above, lives in a stylesheet next to that post's markdown and loads only on that page. The shared bundle stays lean, and a one-off flourish never leaks onto every other page.

The aesthetic borrow is deliberate but not literal. Sites like Linear, Vercel, and Cursor share a discipline I wanted here: restrained colour, mono for meta labels, fine 1px rules, strong hierarchy, and prose that reads like an editorial product, not a dashboard. I didn't copy their layouts; I copied the restraint.

The expanding-brain grid above is a **2×4 CSS grid** (step labels on the left, the classic galaxy-brain levels on the right) with optimized WebP assets and theme-aware styling.

## Typography and reading

**Source Serif 4** carries display type: the home hero, article titles, and essay section headings. Body copy and all UI chrome stay on the system sans stack: enough editorial character in the headlines without sacrificing legibility in long paragraphs.

Reading measure is intentionally wider than the default (~50rem for the essay column). A small `-webkit-font-smoothing: antialiased` on `body` lightens the apparent weight without dropping to a thin 300 that would wash out on light backgrounds. Details, but you notice them over a long post.

<h2>Light, dark, and <span class="accent-text">orange</span></h2>

The theme lives in **`data-theme` on `<html>`**, with values `system` (the default), `light`, or `dark`, set before first paint by an inline script in `BaseHead.astro`. That avoids the [flash of wrong-theme content](https://css-tricks.com/flash-of-inaccurate-color-theme-fart/). The script reads `localStorage` when it can, defaults to **system** when nothing is stored, and the React theme toggle cycles through all three preferences.

Everything else inherits from tokens (`--bg`, `--text`, `--text-muted`, `--accent`), so light and dark are one definition each, not duplicated component styles. Toggling cross-fades those token values over ~220ms (registered custom properties on `<html>`), with no animation when `prefers-reduced-motion` is set.

Code blocks use Shiki's **`css-variables`** theme, with syntax tokens mapped onto the site palette:

```js
// astro.config.mjs
markdown: {
  shikiConfig: { theme: 'css-variables' },
},
```

Keywords and function names pick up the orange accent, while strings, arguments, and values stay neutral and comments and punctuation are muted. That keeps shell commands legible instead of a wall of orange, and the whole thing flips with the rest of the page.

## Writing on the web

Blog posts are Astro content collections with a schema that enforces the boring important bits:

- **`slug`** in frontmatter is the permanent permalink, independent of the filename. The build fails on duplicate slugs.
- **`tags`** are a typed enum in code, not free-form strings, so the taxonomy can't drift.
- Each post links to its **source markdown on GitHub** and a **Discuss on X** intent URL with the canonical link pre-filled.

The repo is linked from the nav as **Source**. The site is the story; the repo is the proof. Clone it, run the checks, and read along.

## Discoverable by default

A site nobody can find is just a diary. Discovery is wired in at build time: a generated sitemap, a `robots.txt` that points at it, an RSS feed for anyone who still keeps a reader, and JSON-LD so search engines read each post as an authored thing rather than a wall of text.

Social cards were the one part with a real detour. The obvious choice, a ready-made Astro OG-image integration, didn't support Astro 7 yet, and I wasn't going to force a peer dependency the lockfile would quietly lie about. So the cards are generated directly: [satori](https://github.com/vercel/satori) turns a small HTML and CSS template into SVG, and [resvg](https://github.com/yisibl/resvg-js) rasterizes it to a 1200×630 PNG, one per page, at build:

```ts
const svg = await satori(
  card({ title, description }),
  { width: 1200, height: 630, fonts },
)

const png = new Resvg(svg)
  .render()
  .asPng()
```

Two things bit me, both quietly. A decorative bullet in the footer rendered as a tofu box because the display font has no glyph for it, so it became a plain styled square. And reading the font by a path relative to the module worked in dev but broke in the build, because the endpoint gets bundled elsewhere; resolving from the working directory fixed it. Minor, but the sort of thing you only notice once the finished card is staring back at you.

## Accessibility, audited twice

Lighthouse gives this site a clean automated accessibility score, which is reassuring, but it's not the point. Automated checks catch contrast, missing labels, and a slice of ARIA mistakes. They don't tell you whether keyboard focus moves sensibly, whether landmarks make sense to a screen reader, or whether a `target="_blank"` link warns someone they're opening a new tab.

For a site with one interactive control, the bet is simple: **semantic HTML first**, then test the island in a real browser, then walk the manual checklist once.

What that looks like in practice:

- A **skip link** to `#main`, with `<main tabindex="-1">` so focus can land on the content region.
- **Landmarks** (`<header>`, labeled `<nav>` regions, `<main>`, `<footer>`, `<article>` on posts) instead of div soup.
- The theme toggle as a native **`<button>`** with an `aria-label` that names the current preference (`System`, `Light`, `Dark`). Decorative SVG icons are `aria-hidden`; the button text is the label.
- **External links** that open new tabs (Source in the nav, Discuss on X, View source on posts) include visually hidden “(opens in new tab)” text for assistive technology. Sighted users get the ↗ on Source; screen reader users get the full phrase everywhere.
- The theme toggle test runs in **headless Chromium**, same as the rest of the UI checks: one real click, one real DOM update.

The Lighthouse manual pass is ten items long: keyboard focusability, logical tab order, landmark usage, offscreen content hidden from assistive tech, and the rest. Most of it passes because the markup is boring on purpose. The items worth verifying by hand are the ones automation can't fully judge: tab flow through the header, whether inactive theme icons stay out of the accessibility tree, whether new-tab links announce themselves.

That's the guardrail I'd keep: spot-check with Lighthouse before shipping, fix what it finds, then spend ten minutes with the keyboard and a screen reader on the one page that has JavaScript. For everything else, ship HTML you wouldn't be embarrassed to read aloud.

## What's next

The bones are here: typed content, a clean build, infrastructure as code, a deploy pipeline on every merge, and now feeds, sitemaps, and generated share cards. From here it's mostly writing, plus the occasional polish pass on the editorial surface. Tag archive pages are the obvious next addition; the enum and slugs are already wired for them.
