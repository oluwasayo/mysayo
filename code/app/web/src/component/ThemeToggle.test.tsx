import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import ThemeToggle from '@/component/ThemeToggle'

describe('ThemeToggle', () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = 'system'
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('cycles system → dark → light → system and persists the choice', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    const button = screen.getByRole('button', { name: /color theme: system/i })

    await user.click(button)
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(
      screen.getByRole('button', { name: /color theme: dark/i }),
    ).toBeTruthy()

    await user.click(button)
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('theme')).toBe('light')

    await user.click(button)
    expect(document.documentElement.dataset.theme).toBe('system')
    expect(localStorage.getItem('theme')).toBe('system')
  })

  it('activates with the keyboard', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    const button = screen.getByRole('button', { name: /color theme: system/i })
    button.focus()

    await user.keyboard('{Enter}')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('cycles with Cmd+B or Ctrl+B outside editable fields', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    await user.keyboard('{Meta>}b{/Meta}')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')

    await user.keyboard('{Meta>}b{/Meta}')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('theme')).toBe('light')

    await user.keyboard('{Control>}b{/Control}')
    expect(document.documentElement.dataset.theme).toBe('system')
    expect(localStorage.getItem('theme')).toBe('system')
  })

  it('does not cycle with Cmd+B while typing in an input', async () => {
    const user = userEvent.setup()
    render(
      <>
        <ThemeToggle />
        <input aria-label="Search" />
      </>,
    )

    const input = screen.getByRole('textbox', { name: 'Search' })
    await user.click(input)
    await user.keyboard('{Meta>}b{/Meta}')

    expect(document.documentElement.dataset.theme).toBe('system')
    expect(localStorage.getItem('theme')).toBeNull()
  })
})
