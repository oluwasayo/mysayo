import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { chromium } from 'playwright'

import {
  BLOG_POST_SLUG_PATTERN,
  findBlogPostBySlug,
  loadColocatedPostCss,
  repoRoot,
  webWorkspaceRoot,
} from '@/lib/blog-post-fs'

// Playwright preserves CSS variables, custom fonts, and SVG filters that resvg
// cannot reproduce faithfully for the hand-drawn inline diagram figures.
const figurePattern = /<figure[^>]*>[\s\S]*?<\/figure>/g
const titlePattern = /<title id="[^"]*">([^<]*)<\/title>/

const rasterizeLayoutCss = `
  body {
    margin: 0;
    padding: 32px;
    background: var(--bg);
  }

  figure {
    margin: 0;
  }

  /* Match post diagram max-width: 44rem (704px at 16px). */
  figure svg {
    display: block;
    width: 704px;
    max-width: 704px;
    height: auto;
  }
`

const themeTokensCss = readFileSync(
  join(webWorkspaceRoot, 'src/style/tokens.css'),
  'utf8',
)

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const usage = () => {
  console.error('Usage: npm run rasterize -- <blog-post-slug>')
  console.error('Example: npm run rasterize -- everything-is-a-blob')
}

const launchBrowser = async () => {
  try {
    return await chromium.launch()
  } catch (error) {
    console.error(
      'Failed to launch Chromium. Run: npm run install:testing:deps -w web',
    )
    throw error
  }
}

async function main() {
  const slug = process.argv[2]

  if (!slug || slug.startsWith('-')) {
    usage()
    process.exit(1)
  }

  if (!BLOG_POST_SLUG_PATTERN.test(slug)) {
    console.error(`Invalid blog post slug: ${slug}`)
    usage()
    process.exit(1)
  }

  const post = findBlogPostBySlug(slug)
  const postCss = loadColocatedPostCss(post.id)
  const outputDir = join(repoRoot, '.out', 'rasterize', post.slug)
  const markdown = readFileSync(post.markdownPath, 'utf8')
  const figures = (markdown.match(figurePattern) ?? []).filter(figure =>
    /<svg[\s>]/i.test(figure),
  )

  if (figures.length === 0) {
    throw new Error(`No inline SVG figures found in ${post.markdownPath}`)
  }

  mkdirSync(outputDir, { recursive: true })

  const browser = await launchBrowser()
  const page = await browser.newPage({ deviceScaleFactor: 2 })

  try {
    for (const [index, figure] of figures.entries()) {
      const title = figure.match(titlePattern)?.[1] ?? `diagram-${index + 1}`
      const diagramSlug = slugify(title)
      const outputPath = join(
        outputDir,
        `${String(index + 1).padStart(2, '0')}-${diagramSlug}.png`,
      )

      const html = `
        <!DOCTYPE html>
        <html lang="en" data-theme="light">
          <head>
            <meta charset="utf-8">
            <style>
              ${themeTokensCss}
              ${rasterizeLayoutCss}
              ${postCss}
            </style>
          </head>
          <body>
          ${figure}
          </body>
        </html>
      `

      await page.setContent(html, { waitUntil: 'load' })
      await page.locator('figure svg').screenshot({
        path: outputPath,
        type: 'png',
      })

      process.stdout.write(`Wrote ${outputPath}\n`)
    }
  } finally {
    await browser.close()
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
