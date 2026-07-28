import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Twemoji SVGs vendored under src/asset/og/emoji/{codepoint}.svg
 * (CC-BY 4.0, https://github.com/twitter/twemoji).
 *
 * Satori cannot draw emoji from Source Serif; missing glyphs become tofu.
 * loadAdditionalAsset maps each emoji grapheme to a data URI image instead.
 */

const zwj = String.fromCharCode(0x200d)
const variationSelector = /\uFE0F/g

/** Unicode code point path segment used by Twemoji filenames. */
export const emojiCodePoint = (char: string): string => {
  const normalized =
    char.indexOf(zwj) < 0 ? char.replace(variationSelector, '') : char
  const points: string[] = []
  let high = 0

  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i)
    if (high) {
      points.push(
        (0x10000 + ((high - 0xd800) << 10) + (code - 0xdc00)).toString(16),
      )
      high = 0
    } else if (code >= 0xd800 && code <= 0xdbff) {
      high = code
    } else {
      points.push(code.toString(16))
    }
  }

  return points.join('-')
}

export const loadEmojiDataUri = (segment: string): string | undefined => {
  const code = emojiCodePoint(segment)
  const path = join(process.cwd(), 'src/asset/og/emoji', `${code}.svg`)
  if (!existsSync(path)) {
    return undefined
  }

  const svg = readFileSync(path, 'utf8')
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}
