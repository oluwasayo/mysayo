import { access, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = new URL('../dist/', import.meta.url)
const distPath = fileURLToPath(dist)

const file = (path: string) => new URL(path, dist)

const read = (path: string) => readFile(file(path), 'utf8')

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

const assertExists = async (path: string) => {
  try {
    await access(file(path))
  } catch {
    throw new Error(`Expected build output to include ${path}`)
  }
}

const listXmlFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async entry => {
      const entryPath = join(directory, entry.name)
      if (entry.isDirectory()) {
        return listXmlFiles(entryPath)
      }

      return entry.name.endsWith('.xml') ? [entryPath] : []
    }),
  )
  return nested.flat()
}

const listHtmlFiles = async (
  directory: string,
  prefix = '',
): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async entry => {
      const entryPath = join(directory, entry.name)
      if (entry.isDirectory()) {
        return listHtmlFiles(entryPath, `${prefix}${entry.name}/`)
      }

      return entry.name === 'index.html' ? [`${prefix}${entry.name}`] : []
    }),
  )
  return nested.flat()
}

const assertNoSubstackCrossPostLinks = (html: string) =>
  !html.includes('oluwasayo.substack.com/p/') &&
  !html.includes('substack.com/@oluwasayo/p-')

async function main() {
  await assertExists('index.html')
  await assertExists('about/index.html')
  await assertExists('work/index.html')
  await assertExists('reading/index.html')
  await assertExists('writing/index.html')
  await assertExists('writing/building-mysayo/index.html')
  await assertExists('og/writing.png')
  await assertExists('og/writing/building-mysayo.png')
  await assertExists('rss.xml')
  await assertExists('sitemap-index.xml')
  await assertExists('_redirects')

  const home = await read('index.html')
  assert(home.includes('href="/writing"'), 'Home page should link to /writing')
  assert(!home.includes('href="/blog"'), 'Home page must not link to /blog')

  const about = await read('about/index.html')
  assert(
    about.includes('href="/writing"'),
    'About page should link to /writing',
  )
  assert(!about.includes('href="/blog"'), 'About page must not link to /blog')

  const notFound = await read('404.html')
  assert(
    notFound.includes('href="/writing"'),
    '404 page should link to /writing',
  )
  assert(!notFound.includes('href="/blog"'), '404 page must not link to /blog')

  const post = await read('writing/building-mysayo/index.html')
  assert(
    post.includes('/writing/brain-1.webp'),
    'Writing post should use /writing asset paths',
  )
  assert(
    !post.includes('/blog/brain-'),
    'Writing post must not use /blog asset paths',
  )

  const rss = await read('rss.xml')
  assert(
    rss.includes('/writing/building-mysayo/'),
    'RSS should link to canonical /writing post URLs',
  )
  assert(!rss.includes('/blog/'), 'RSS must not contain /blog URLs')

  const redirects = await read('_redirects')
  assert(
    redirects.includes('/blog /writing 301'),
    '_redirects should redirect /blog to /writing',
  )
  assert(
    redirects.includes('/blog/* /writing/:splat 301'),
    '_redirects should redirect /blog/* to /writing/*',
  )

  const blogIndexRedirect = await read('blog/index.html')
  assert(
    blogIndexRedirect.includes('Redirecting to: /writing') &&
      blogIndexRedirect.includes('content="0;url=/writing"') &&
      blogIndexRedirect.includes('name="robots" content="noindex"'),
    '/blog should be a noindex redirect page',
  )

  const blogPostRedirect = await read('blog/building-mysayo/index.html')
  assert(
    blogPostRedirect.includes('Redirecting to: /writing/building-mysayo') &&
      blogPostRedirect.includes('content="0;url=/writing/building-mysayo"') &&
      blogPostRedirect.includes('name="robots" content="noindex"'),
    '/blog/building-mysayo should be a noindex redirect page',
  )

  await assertExists('writing/on-compilers-compression-and-llms/index.html')
  await assertExists(
    'writing/pull-requests-where-engineering-culture/index.html',
  )

  for (const relativePath of await listHtmlFiles(join(distPath, 'writing'))) {
    const html = await read(`writing/${relativePath}`)
    assert(
      assertNoSubstackCrossPostLinks(html),
      `Writing page writing/${relativePath} must not link to Substack posts`,
    )
  }

  const sitemapPaths = await listXmlFiles(distPath)
  const sitemap = (
    await Promise.all(sitemapPaths.map(path => readFile(path, 'utf8')))
  ).join('\n')
  assert(
    sitemap.includes('https://mysayo.com/writing'),
    'Sitemap should include /writing URLs',
  )
  assert(
    !sitemap.includes('https://mysayo.com/blog'),
    'Sitemap must not include /blog URLs',
  )

  process.stdout.write('Build output verified\n')
}

await main()
