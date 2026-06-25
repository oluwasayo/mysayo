import {
  isThemePreference,
  nextThemePreference,
  themePreferenceLabels,
  themePreferenceOrder,
} from '@shared/lib/theme'
import { describe, expect, it } from 'vitest'

describe('theme', () => {
  describe('isThemePreference', () => {
    it('accepts known preferences', () => {
      for (const preference of themePreferenceOrder) {
        expect(isThemePreference(preference)).toBe(true)
      }
    })

    it('rejects unknown and empty values', () => {
      expect(isThemePreference('auto')).toBe(false)
      expect(isThemePreference('')).toBe(false)
      expect(isThemePreference(null)).toBe(false)
      expect(isThemePreference(undefined)).toBe(false)
    })
  })

  describe('nextThemePreference', () => {
    it('cycles system → light → dark → system', () => {
      expect(nextThemePreference('system')).toBe('light')
      expect(nextThemePreference('light')).toBe('dark')
      expect(nextThemePreference('dark')).toBe('system')
    })
  })

  describe('themePreferenceLabels', () => {
    it('derives labels from preference values', () => {
      expect(themePreferenceLabels.system).toBe('System')
      expect(themePreferenceLabels.light).toBe('Light')
      expect(themePreferenceLabels.dark).toBe('Dark')
    })
  })
})
