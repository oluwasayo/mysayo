type Theme = 'light' | 'dark'

const persistTheme = (theme: Theme) => {
  try {
    localStorage.setItem('theme', theme)
  } catch {
    // localStorage may be unavailable (e.g. private mode); toggling still
    // works for the current session via the data-theme attribute.
  }
}

export default function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement
    const next: Theme = root.dataset.theme === 'dark' ? 'light' : 'dark'
    root.dataset.theme = next
    persistTheme(next)
  }

  return (
    <button
      aria-label="Toggle color theme"
      className="theme-toggle"
      onClick={toggle}
      title="Toggle color theme"
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
    </button>
  )
}
