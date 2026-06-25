import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { Resvg } from '@resvg/resvg-js'
import { siteAuthor, siteName, siteTagline } from '@shared/lib/site'
import type { APIContext, GetStaticPaths } from 'astro'
import satori from 'satori'
import { html } from 'satori-html'
import { getPostSlug, getPublishedPosts } from '@/lib/post'

type OgCard = { title: string; description: string }

// Astro always builds with the cwd set to this workspace root (CI uses
// working-directory: code/app/web), so resolve the vendored fonts from there.
const readFont = (file: string) =>
  readFileSync(join(process.cwd(), 'src/assets/og', file))

const fonts = [
  {
    data: readFont('SourceSerif4-Regular.ttf'),
    name: 'Source Serif 4',
    style: 'normal' as const,
    weight: 400 as const,
  },
  {
    data: readFont('SourceSerif4-SemiBold.ttf'),
    name: 'Source Serif 4',
    style: 'normal' as const,
    weight: 600 as const,
  },
]

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const truncate = (value: string, max = 120) =>
  value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value

export const getStaticPaths = (async () => {
  const posts = await getPublishedPosts()

  return [
    {
      params: { route: 'index' },
      props: { description: siteTagline, title: siteName },
    },
    {
      params: { route: 'blog' },
      props: {
        description:
          'Long-form notes on building software, systems, and this site.',
        title: 'Writing',
      },
    },
    {
      params: { route: '404' },
      props: {
        description: 'That page could not be found.',
        title: 'Page not found',
      },
    },
    ...posts.map(post => ({
      params: { route: `blog/${getPostSlug(post)}` },
      props: { description: post.data.description, title: post.data.title },
    })),
  ]
}) satisfies GetStaticPaths

const card = ({ title, description }: OgCard) =>
  html(`
    <div style="height:100%;width:100%;display:flex;flex-direction:column;justify-content:space-between;background-color:#0d0d0f;color:#ededee;padding:72px;font-family:'Source Serif 4';">
      <div style="display:flex;flex-direction:column;flex:1;justify-content:center;border-left:10px solid #ff6f4d;padding-left:48px;">
        <div style="display:flex;font-size:26px;font-weight:400;letter-spacing:8px;text-transform:uppercase;color:#9a9aa2;margin-bottom:32px;">mysayo.com</div>
        <div style="display:flex;font-size:68px;font-weight:600;line-height:1.1;letter-spacing:-2px;">${escapeHtml(title)}</div>
        <div style="display:flex;font-size:32px;font-weight:400;color:#9a9aa2;line-height:1.4;margin-top:32px;">${escapeHtml(truncate(description))}</div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;font-size:26px;font-weight:400;color:#9a9aa2;padding-left:48px;">
        <div style="display:flex;">${escapeHtml(siteAuthor)}</div>
        <div style="display:flex;width:18px;height:18px;background-color:#ff6f4d;"></div>
      </div>
    </div>
  `)

export async function GET({ props }: APIContext) {
  const { title, description } = props as OgCard

  // satori-html returns a VNode that satori accepts at runtime; the published
  // types model the arg as ReactNode, so bridge it through satori's own param type.
  const markup = card({ description, title }) as unknown as Parameters<
    typeof satori
  >[0]

  const svg = await satori(markup, { fonts, height: 630, width: 1200 })

  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
  })
    .render()
    .asPng()

  return new Response(png as unknown as BodyInit, {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': 'image/png',
    },
  })
}
