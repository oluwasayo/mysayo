import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

import { tagValues } from '@/lib/tags'

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '*.md' }),
  schema: z.object({
    description: z.string(),
    draft: z.boolean().default(false),
    pubDate: z.coerce.date(),
    slug: z
      .string()
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'slug must be lowercase kebab-case (e.g. building-mysayo)',
      ),
    tags: z.array(z.enum(tagValues)).default([]),
    title: z.string(),
    updatedDate: z.coerce.date().optional(),
  }),
})

export const collections = { blog }
