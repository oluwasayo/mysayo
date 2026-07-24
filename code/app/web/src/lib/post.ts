import { type CollectionEntry, getCollection } from 'astro:content'

export const getPostSlug = (post: CollectionEntry<'blog'>) => post.data.slug

/** Homepage featured candidates, in preference order. */
export const featuredPostSlugs = [
  'everything-is-a-blob',
  'on-compilers-compression-and-llms',
  'building-mysayo',
] as const

const homepageLatestCount = 1
const homepageFeaturedCount = 2

export const getPublishedPosts = async () => {
  const posts = await getCollection('blog', ({ data }) => !data.draft)
  const sorted = posts.sort(
    (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime(),
  )

  const slugs = new Set<string>()
  for (const post of sorted) {
    const slug = getPostSlug(post)
    if (slugs.has(slug)) {
      throw new Error(`Duplicate blog slug: ${slug}`)
    }
    slugs.add(slug)
  }

  return sorted
}

/** Latest + featured for the homepage; featured never includes latest. */
export const getHomepageWriting = async () => {
  const published = await getPublishedPosts()
  const latestPosts = published.slice(0, homepageLatestCount)
  const latestSlug = latestPosts[0] ? getPostSlug(latestPosts[0]) : undefined
  const bySlug = new Map(published.map(post => [getPostSlug(post), post]))

  const featuredPosts: CollectionEntry<'blog'>[] = []
  for (const slug of featuredPostSlugs) {
    if (slug === latestSlug) {
      continue
    }
    const post = bySlug.get(slug)
    if (!post) {
      throw new Error(`Featured blog slug not found: ${slug}`)
    }
    featuredPosts.push(post)
    if (featuredPosts.length === homepageFeaturedCount) {
      break
    }
  }

  return { featuredPosts, latestPosts }
}
