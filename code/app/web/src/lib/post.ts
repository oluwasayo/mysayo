import { type CollectionEntry, getCollection } from 'astro:content'

export const getPostSlug = (post: CollectionEntry<'blog'>) => post.data.slug

/** Homepage featured writing, in display order. */
export const featuredPostSlugs = [
  'everything-is-a-blob',
  'building-mysayo',
  'on-compilers-compression-and-llms',
] as const

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

export const getFeaturedPosts = async () => {
  const bySlug = new Map(
    (await getPublishedPosts()).map(post => [getPostSlug(post), post]),
  )

  return featuredPostSlugs.map(slug => {
    const post = bySlug.get(slug)
    if (!post) {
      throw new Error(`Featured blog slug not found: ${slug}`)
    }
    return post
  })
}
