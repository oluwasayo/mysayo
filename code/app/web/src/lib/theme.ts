import {
  isThemePreference,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from '@shared/lib/theme'

export const readDocumentThemePreference = (): ThemePreference => {
  if (typeof document === 'undefined') {
    return 'system'
  }

  const { theme } = document.documentElement.dataset
  return isThemePreference(theme) ? theme : 'system'
}

export const applyThemePreference = (preference: ThemePreference) => {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.dataset.theme = preference

  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // localStorage may be unavailable; preference still applies this session.
  }
}
