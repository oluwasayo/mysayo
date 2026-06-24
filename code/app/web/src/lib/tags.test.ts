import { describe, expect, it } from 'vitest'
import { getTagLabel, Tag, tagSlugs, tagValues } from '@/lib/tags'

describe('tags', () => {
  it('exposes stable enum values for the content schema', () => {
    expect(tagValues).toContain(Tag.VibeCoding)
    expect(tagValues).toContain(Tag.Architecture)
  })

  it('maps tags to display labels and future archive slugs', () => {
    expect(getTagLabel(Tag.VibeCoding)).toBe('Vibe coding')
    expect(tagSlugs[Tag.Terraform]).toBe('terraform')
  })
})
