import { THEME_STORAGE_KEY } from '@shared/lib/theme'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyThemePreference, readDocumentThemePreference } from '@/lib/theme'

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  afterEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  describe('readDocumentThemePreference', () => {
    it('reads a valid data-theme value from the document', () => {
      document.documentElement.dataset.theme = 'dark'
      expect(readDocumentThemePreference()).toBe('dark')
    })

    it('falls back to system for missing or invalid values', () => {
      expect(readDocumentThemePreference()).toBe('system')
      document.documentElement.dataset.theme = 'auto'
      expect(readDocumentThemePreference()).toBe('system')
    })

    it('falls back to system outside a document environment', () => {
      expect(readDocumentThemePreference(null)).toBe('system')
    })
  })

  describe('applyThemePreference', () => {
    it('updates the document and persists to localStorage', () => {
      applyThemePreference('light')

      expect(document.documentElement.dataset.theme).toBe('light')
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    })

    it('does nothing outside a document environment', () => {
      expect(() => applyThemePreference('dark', null)).not.toThrow()
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
    })

    it('still applies the document theme when localStorage is unavailable', () => {
      const unavailableStorage = {
        setItem: vi.fn(() => {
          throw new Error('localStorage unavailable')
        }),
      }

      expect(() =>
        applyThemePreference('dark', document, unavailableStorage),
      ).not.toThrow()
      expect(document.documentElement.dataset.theme).toBe('dark')
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
    })
  })
})
