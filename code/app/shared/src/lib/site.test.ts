import { siteName, xDiscussUrl } from '@shared/lib/site'
import { describe, expect, it } from 'vitest'

describe('siteName', () => {
  it('is configured', () => {
    expect(siteName).toBe('mysayo')
  })
})

describe('xDiscussUrl', () => {
  it('opens X compose with the post url before the mention', () => {
    const url = xDiscussUrl('https://mysayo.com/blog/building-mysayo')

    expect(url).toMatch(/^https:\/\/x\.com\/intent\/tweet\?/)
    expect(url).toContain(
      'https%3A%2F%2Fmysayo.com%2Fblog%2Fbuilding-mysayo+%40oluwasayo_',
    )
  })
})
