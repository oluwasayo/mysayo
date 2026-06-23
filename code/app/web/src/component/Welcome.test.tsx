import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import Welcome from '@/component/Welcome'

describe('Welcome', () => {
  it('renders the site name and increments the counter', async () => {
    const user = userEvent.setup()

    render(<Welcome />)

    expect(screen.getByRole('heading', { name: 'mysayo' })).toBeInTheDocument()

    const button = screen.getByRole('button', {
      name: /React island clicks: 0/,
    })
    await user.click(button)

    expect(
      screen.getByRole('button', { name: /React island clicks: 1/ }),
    ).toBeInTheDocument()
  })
})
