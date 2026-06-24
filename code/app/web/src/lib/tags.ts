export const Tag = {
  Architecture: 'ARCHITECTURE',
  Astro: 'ASTRO',
  Cloudflare: 'CLOUDFLARE',
  Cursor: 'CURSOR',
  Terraform: 'TERRAFORM',
  Testing: 'TESTING',
  VibeCoding: 'VIBE_CODING',
} as const

export type Tag = (typeof Tag)[keyof typeof Tag]

export const tagValues = Object.values(Tag) as [Tag, ...Tag[]]

export const tagLabels: Record<Tag, string> = {
  [Tag.Architecture]: 'Architecture',
  [Tag.Astro]: 'Astro',
  [Tag.Cloudflare]: 'Cloudflare',
  [Tag.Cursor]: 'Cursor',
  [Tag.Terraform]: 'Terraform',
  [Tag.Testing]: 'Testing',
  [Tag.VibeCoding]: 'Vibe coding',
}

/** URL slug per tag — for future /blog/tags/{slug} archive pages. */
export const tagSlugs: Record<Tag, string> = {
  [Tag.Architecture]: 'architecture',
  [Tag.Astro]: 'astro',
  [Tag.Cloudflare]: 'cloudflare',
  [Tag.Cursor]: 'cursor',
  [Tag.Terraform]: 'terraform',
  [Tag.Testing]: 'testing',
  [Tag.VibeCoding]: 'vibe-coding',
}

export const getTagLabel = (tag: Tag) => tagLabels[tag]
