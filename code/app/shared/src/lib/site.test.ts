import { siteName } from '@shared/lib/site'
import { describe, expect, it } from 'vitest'

describe('siteName', () => {
  it('is configured', () => {
    expect(siteName).toBe('mysayo')
  })
})
