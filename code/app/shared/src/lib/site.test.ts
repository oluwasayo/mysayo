import {
  blogPostSourceUrl,
  profileLinks,
  socialLinks,
  xDiscussUrl,
  xRecommendUrl,
} from '@shared/lib/site'
import { describe, expect, it } from 'vitest'

describe('site', () => {
  describe('blogPostSourceUrl', () => {
    it('points at the markdown source on GitHub', () => {
      expect(blogPostSourceUrl('building-mysayo')).toBe(
        'https://github.com/oluwasayo/mysayo/blob/main/code/app/web/src/content/blog/building-mysayo.md',
      )
    })
  })

  describe('xDiscussUrl', () => {
    it('opens X compose with the post url before the mention', () => {
      const url = xDiscussUrl('https://mysayo.com/writing/building-mysayo')

      expect(url).toMatch(/^https:\/\/x\.com\/intent\/tweet\?/)
      expect(url).toContain(
        'https%3A%2F%2Fmysayo.com%2Fwriting%2Fbuilding-mysayo+%40oluwasayo_',
      )
    })
  })

  describe('xRecommendUrl', () => {
    it('opens X compose with a prompt mentioning the handle', () => {
      expect(xRecommendUrl).toMatch(/^https:\/\/x\.com\/intent\/tweet\?/)
      expect(xRecommendUrl).toContain('%40oluwasayo_+you+should+read')
    })
  })

  describe('external link metadata', () => {
    it('marks social and profile links as external', () => {
      for (const link of [...socialLinks, ...profileLinks]) {
        expect(link.external).toBe(true)
      }
    })
  })
})
