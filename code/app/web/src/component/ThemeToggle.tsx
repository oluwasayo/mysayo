import {
  nextThemePreference,
  type ThemePreference,
  themePreferenceLabels,
} from '@shared/lib/theme'
import { useEffect, useState } from 'react'

import { applyThemePreference, readDocumentThemePreference } from '@/lib/theme'

export default function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>('system')

  useEffect(() => {
    setPreference(readDocumentThemePreference())
  }, [])

  const label = themePreferenceLabels[preference]
  const nextLabel = themePreferenceLabels[nextThemePreference(preference)]

  const activate = () => {
    const next = nextThemePreference(preference)
    applyThemePreference(next)
    setPreference(next)
  }

  return (
    <button
      aria-label={`Color theme: ${label}`}
      className="theme-toggle"
      onClick={activate}
      title={`Color theme: ${label}. Click for ${nextLabel}.`}
      type="button"
    >
      <svg
        aria-hidden="true"
        className="theme-toggle__sun"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4" />
      </svg>
      <svg
        aria-hidden="true"
        className="theme-toggle__moon"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        viewBox="0 0 24 24"
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
      <svg
        aria-hidden="true"
        className="theme-toggle__system"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 3.5v17" />
        <path
          d="M12 3.5a8.5 8.5 0 0 0 0 17"
          fill="currentColor"
          fillOpacity="0.35"
        />
      </svg>
    </button>
  )
}
