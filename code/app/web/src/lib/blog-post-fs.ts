import { existsSync, readdirSync, readFileSync } from 'node:fs'
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

export const findBlogPostBySlug = (slug: string): BlogPostFile => {
  for (const filename of readdirSync(blogContentDir).filter(name =>
    name.endsWith('.md'),
  )) {
    const markdownPath = join(blogContentDir, filename)
    const fileSlug = readFileSync(markdownPath, 'utf8').match(
      /^slug:\s*(\S+)/m,
    )?.[1]

    if (fileSlug !== slug) {
      continue
    }

    return {
      id: filename.replace(/\.md$/, ''),
      markdownPath,
      slug: fileSlug,
    }
  }

  throw new Error(`No blog post found for slug: ${slug}`)
}

export const loadColocatedPostCss = (postId: string) => {
  const cssPath = join(blogContentDir, `${postId}.css`)
  if (!existsSync(cssPath)) {
    return ''
  }

  const fontUrlPattern = /url\(["']?(\/fonts\/[^"')]+)["']?\)/g

  return readFileSync(cssPath, 'utf8').replace(
    fontUrlPattern,
    (_, fontUrl: string) => {
      const fontFile = join(webWorkspaceRoot, 'public', fontUrl.slice(1))
      return `url("file://${fontFile}")`
    },
  )
}
