import { assertNotNil, isDefined } from '@shared/lib/assertion'
import { describe, expect, it } from 'vitest'

describe('assertion', () => {
  describe('isDefined', () => {
    it('narrows null and undefined away', () => {
      expect(isDefined('light')).toBe(true)
      expect(isDefined(null)).toBe(false)
      expect(isDefined(undefined)).toBe(false)
    })
  })

  describe('assertNotNil', () => {
    it('returns defined values', () => {
      expect(assertNotNil('dark')).toBe('dark')
    })

    it('throws for null and undefined', () => {
      expect(() => assertNotNil(null)).toThrow('Expected value to be defined')
      expect(() => assertNotNil(undefined, 'Missing theme')).toThrow(
        'Missing theme',
      )
    })
  })
})
