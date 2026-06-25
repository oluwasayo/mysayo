import {
  enumValuesToRecord,
  enumValueToSlug,
  enumValueToText,
} from '@shared/lib/enum'
import { describe, expect, it } from 'vitest'

describe('enum', () => {
  describe('enumValueToText', () => {
    it('converts UPPER_SNAKE_CASE to capitalized text', () => {
      expect(enumValueToText('FIRST_VALUE')).toBe('First value')
    })

    it('converts single word values', () => {
      expect(enumValueToText('ADMIN')).toBe('Admin')
    })

    it('handles lowercase input', () => {
      expect(enumValueToText('vibe_coding')).toBe('Vibe coding')
    })

    it('handles empty string', () => {
      expect(enumValueToText('')).toBe('')
    })
  })

  describe('enumValueToSlug', () => {
    it('converts UPPER_SNAKE_CASE to kebab-case', () => {
      expect(enumValueToSlug('VIBE_CODING')).toBe('vibe-coding')
    })

    it('converts single word values', () => {
      expect(enumValueToSlug('ASTRO')).toBe('astro')
    })
  })

  describe('enumValuesToRecord', () => {
    it('maps each value through the given function', () => {
      const values = ['FIRST_VALUE', 'SECOND_VALUE'] as const
      const result = enumValuesToRecord(values, enumValueToText)

      expect(result.FIRST_VALUE).toBe('First value')
      expect(result.SECOND_VALUE).toBe('Second value')
    })
  })
})
