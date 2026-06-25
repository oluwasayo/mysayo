import { describe, expect, it } from 'vitest'

import { formatDate, toISODate } from '@/lib/date'

describe('date', () => {
  const sample = new Date('2026-06-24T15:30:00.000Z')

  describe('formatDate', () => {
    it('formats UTC dates for display', () => {
      expect(formatDate(sample)).toBe('June 24, 2026')
    })
  })

  describe('toISODate', () => {
    it('returns the calendar date in ISO form', () => {
      expect(toISODate(sample)).toBe('2026-06-24')
    })
  })
})
