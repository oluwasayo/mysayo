import { assertNotNil } from '@shared/lib/assertion'
import { enumValuesToRecord, enumValueToText } from '@shared/lib/enum'

export const THEME_STORAGE_KEY = 'theme'

export const themePreferenceOrder = ['system', 'light', 'dark'] as const

export type ThemePreference = (typeof themePreferenceOrder)[number]

export const isThemePreference = (
  value: string | null | undefined,
): value is ThemePreference =>
  typeof value === 'string' &&
  (themePreferenceOrder as readonly string[]).includes(value)

export const nextThemePreference = (
  current: ThemePreference,
): ThemePreference => {
  const index = themePreferenceOrder.indexOf(current)
  return assertNotNil(
    themePreferenceOrder[(index + 1) % themePreferenceOrder.length],
    'Theme preference order must not be empty',
  )
}

export const themePreferenceLabels = enumValuesToRecord(
  themePreferenceOrder,
  enumValueToText,
)
