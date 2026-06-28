import {
  isThemePreference,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from '@shared/lib/theme'

type ThemeDocument = Pick<Document, 'documentElement'>
type ThemeStorage = Pick<Storage, 'setItem'>

const getDocument = (): ThemeDocument | undefined =>
  typeof document === 'undefined' ? undefined : document

const getStorage = (): ThemeStorage | undefined =>
  typeof localStorage === 'undefined' ? undefined : localStorage

export const readDocumentThemePreference = (
  themeDocument: ThemeDocument | null | undefined = getDocument(),
): ThemePreference => {
  if (!themeDocument) {
    return 'system'
  }

  const { theme } = themeDocument.documentElement.dataset
  return isThemePreference(theme) ? theme : 'system'
}

export const applyThemePreference = (
  preference: ThemePreference,
  themeDocument: ThemeDocument | null | undefined = getDocument(),
  themeStorage = getStorage(),
) => {
  if (!themeDocument) {
    return
  }

  themeDocument.documentElement.dataset.theme = preference

  try {
    themeStorage?.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // localStorage may be unavailable; preference still applies this session.
  }
}
