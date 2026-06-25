import { enumValueToSlug, enumValueToText } from '@shared/lib/enum'
import { describe, expect, it } from 'vitest'
import { getTagLabel, Tag, tagLabels, tagSlugs, tagValues } from '@/lib/tag'

describe('tag', () => {
  it('exposes stable enum values for the content schema', () => {
    expect(tagValues).toContain(Tag.VibeCoding)
    expect(tagValues).toContain(Tag.Architecture)
  })

  it('derives display labels and archive slugs from tag values', () => {
    expect(getTagLabel(Tag.VibeCoding)).toBe('Vibe coding')
    expect(getTagLabel(Tag.Design)).toBe('Design')
    expect(tagSlugs[Tag.Terraform]).toBe('terraform')
    expect(tagSlugs[Tag.VibeCoding]).toBe('vibe-coding')
  })

  it('covers every tag with a derived label and slug', () => {
    for (const tag of tagValues) {
      expect(tagLabels[tag]).toBe(enumValueToText(tag))
      expect(tagSlugs[tag]).toBe(enumValueToSlug(tag))
    }
  })
})
