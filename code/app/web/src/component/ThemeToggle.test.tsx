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

  it('cycles system → light → dark → system and persists the choice', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    const button = screen.getByRole('button', { name: /color theme: system/i })

    await user.click(button)
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('theme')).toBe('light')
    expect(
      screen.getByRole('button', { name: /color theme: light/i }),
    ).toBeTruthy()

    await user.click(button)
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')

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
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('theme')).toBe('light')
  })
})
