import { readFile } from 'node:fs/promises'
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

const isEnoent = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 'ENOENT'

/** Unicode code point path segment used by Twemoji filenames. */
export const emojiCodePoint = (char: string) => {
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

export const loadEmojiDataUri = async (segment: string) => {
  const code = emojiCodePoint(segment)
  const path = join(process.cwd(), 'src/asset/og/emoji', `${code}.svg`)

  try {
    const svg = await readFile(path, 'utf8')
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  } catch (error) {
    if (isEnoent(error)) {
      return
    }
    throw error
  }
}
