import { THEME_STORAGE_KEY } from '@shared/lib/theme'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

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
  })

  describe('applyThemePreference', () => {
    it('updates the document and persists to localStorage', () => {
      applyThemePreference('light')

      expect(document.documentElement.dataset.theme).toBe('light')
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    })
  })
})
