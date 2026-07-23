import type { CollectionEntry } from 'astro:content'
import { getCollection } from 'astro:content'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  featuredPostSlugs,
  getFeaturedPosts,
  getPostSlug,
  getPublishedPosts,
} from '@/lib/post'

const blogPost = (
  data: Partial<CollectionEntry<'blog'>['data']> &
    Pick<CollectionEntry<'blog'>['data'], 'slug' | 'pubDate'>,
  id = `${data.slug}.md`,
): CollectionEntry<'blog'> =>
  ({
    collection: 'blog',
    data: {
      description: 'Test description',
      draft: false,
      tags: [],
      title: 'Test title',
      ...data,
    },
    id,
  }) as CollectionEntry<'blog'>

describe('post', () => {
  beforeEach(() => {
    vi.mocked(getCollection).mockReset()
  })

  describe('getPostSlug', () => {
    it('returns the slug from frontmatter', () => {
      const post = blogPost({ pubDate: new Date(), slug: 'building-mysayo' })

      expect(getPostSlug(post)).toBe('building-mysayo')
    })
  })

  describe('getPublishedPosts', () => {
    it('filters drafts, sorts newest first, and applies the collection filter', async () => {
      const posts = [
        blogPost({
          pubDate: new Date('2025-01-01T00:00:00.000Z'),
          slug: 'older-post',
        }),
        blogPost({
          draft: true,
          pubDate: new Date('2026-06-01T00:00:00.000Z'),
          slug: 'draft-post',
        }),
        blogPost({
          pubDate: new Date('2026-06-24T00:00:00.000Z'),
          slug: 'newer-post',
        }),
      ]

      vi.mocked(getCollection).mockImplementation(
        async (_collection, filter) => (filter ? posts.filter(filter) : posts),
      )

      const published = await getPublishedPosts()

      expect(published.map(getPostSlug)).toEqual(['newer-post', 'older-post'])
    })

    it('throws when two published posts share a slug', async () => {
      const posts = [
        blogPost({
          pubDate: new Date('2026-01-01T00:00:00.000Z'),
          slug: 'duplicate-slug',
        }),
        blogPost(
          {
            pubDate: new Date('2026-06-01T00:00:00.000Z'),
            slug: 'duplicate-slug',
          },
          'other-file.md',
        ),
      ]

      vi.mocked(getCollection).mockResolvedValue(posts)

      await expect(getPublishedPosts()).rejects.toThrow(
        'Duplicate blog slug: duplicate-slug',
      )
    })
  })

  describe('getFeaturedPosts', () => {
    it('returns featured posts in configured order', async () => {
      const posts = featuredPostSlugs.toReversed().map((slug, index) =>
        blogPost({
          pubDate: new Date(`2026-0${index + 1}-01T00:00:00.000Z`),
          slug,
        }),
      )

      vi.mocked(getCollection).mockImplementation(
        async (_collection, filter) => (filter ? posts.filter(filter) : posts),
      )

      const featured = await getFeaturedPosts()

      expect(featured.map(getPostSlug)).toEqual([...featuredPostSlugs])
    })

    it('throws when a featured slug is missing', async () => {
      vi.mocked(getCollection).mockResolvedValue([])

      await expect(getFeaturedPosts()).rejects.toThrow(
        `Featured blog slug not found: ${featuredPostSlugs[0]}`,
      )
    })
  })
})
