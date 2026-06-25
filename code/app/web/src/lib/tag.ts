import {
  enumValuesToRecord,
  enumValueToSlug,
  enumValueToText,
} from '@shared/lib/enum'

export const Tag = {
  Architecture: 'ARCHITECTURE',
  Astro: 'ASTRO',
  Cloudflare: 'CLOUDFLARE',
  Cursor: 'CURSOR',
  Design: 'DESIGN',
  Terraform: 'TERRAFORM',
  Testing: 'TESTING',
  VibeCoding: 'VIBE_CODING',
} as const

export type Tag = (typeof Tag)[keyof typeof Tag]

export const tagValues = Object.values(Tag) as [Tag, ...Tag[]]

export const tagLabels = enumValuesToRecord(tagValues, enumValueToText)

/** URL slug per tag — for future /blog/tags/{slug} archive pages. */
export const tagSlugs = enumValuesToRecord(tagValues, enumValueToSlug)

export const getTagLabel = (tag: Tag) => tagLabels[tag]
