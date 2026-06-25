import rss from '@astrojs/rss'
import { siteDescription, siteName, siteUrl } from '@shared/lib/site'
import type { APIContext } from 'astro'
import { getPostSlug, getPublishedPosts } from '@/lib/post'

export async function GET(context: APIContext) {
  const posts = await getPublishedPosts()

  return rss({
    description: siteDescription,
    items: posts.map(post => ({
      description: post.data.description,
      link: `/blog/${getPostSlug(post)}/`,
      pubDate: post.data.pubDate,
      title: post.data.title,
    })),
    site: context.site ?? siteUrl,
    title: siteName,
  })
}
