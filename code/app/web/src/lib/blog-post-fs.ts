import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const moduleDir = dirname(fileURLToPath(import.meta.url))

export const webWorkspaceRoot = resolve(moduleDir, '../..')
export const repoRoot = resolve(webWorkspaceRoot, '../../..')

export const BLOG_POST_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const blogContentDir = join(webWorkspaceRoot, 'src/content/blog')

export type BlogPostFile = {
  id: string
  markdownPath: string
  slug: string
}

const isEnoent = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 'ENOENT'

export const findBlogPostBySlug = async (slug: string) => {
  const filenames = (await readdir(blogContentDir)).filter(name =>
    name.endsWith('.md'),
  )

  for (const filename of filenames) {
    const markdownPath = join(blogContentDir, filename)
    const fileSlug = (await readFile(markdownPath, 'utf8')).match(
      /^slug:\s*(\S+)/m,
    )?.[1]

    if (fileSlug !== slug) {
      continue
    }

    return {
      id: filename.replace(/\.md$/, ''),
      markdownPath,
      slug: fileSlug,
    } satisfies BlogPostFile
  }

  throw new Error(`No blog post found for slug: ${slug}`)
}

export const loadColocatedPostCss = async (postId: string) => {
  const cssPath = join(blogContentDir, `${postId}.css`)

  try {
    const css = await readFile(cssPath, 'utf8')
    const fontUrlPattern = /url\(["']?(\/fonts\/[^"')]+)["']?\)/g

    return css.replace(fontUrlPattern, (_, fontUrl) => {
      const fontFile = join(webWorkspaceRoot, 'public', fontUrl.slice(1))
      return `url("file://${fontFile}")`
    })
  } catch (error) {
    if (isEnoent(error)) {
      return ''
    }
    throw error
  }
}
