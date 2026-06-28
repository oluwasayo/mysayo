import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = new URL('../dist/', import.meta.url)
const distPath = fileURLToPath(dist)

const file = path => new URL(path, dist)

const read = path => readFileSync(file(path), 'utf8')

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}

const assertExists = path => {
  assert(existsSync(file(path)), `Expected build output to include ${path}`)
}

const listXmlFiles = directory => {
  const entries = readdirSync(directory, { withFileTypes: true })
  return entries.flatMap(entry => {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      return listXmlFiles(entryPath)
    }

    return entry.name.endsWith('.xml') ? [entryPath] : []
  })
}

assertExists('index.html')
assertExists('about/index.html')
assertExists('work/index.html')
assertExists('reading/index.html')
assertExists('writing/index.html')
assertExists('writing/building-mysayo/index.html')
assertExists('og/writing.png')
assertExists('og/writing/building-mysayo.png')
assertExists('rss.xml')
assertExists('sitemap-index.xml')
assertExists('_redirects')

const home = read('index.html')
assert(home.includes('href="/writing"'), 'Home page should link to /writing')
assert(!home.includes('href="/blog"'), 'Home page must not link to /blog')

const about = read('about/index.html')
assert(about.includes('href="/writing"'), 'About page should link to /writing')
assert(!about.includes('href="/blog"'), 'About page must not link to /blog')

const notFound = read('404.html')
assert(notFound.includes('href="/writing"'), '404 page should link to /writing')
assert(!notFound.includes('href="/blog"'), '404 page must not link to /blog')

const post = read('writing/building-mysayo/index.html')
assert(
  post.includes('/writing/brain-1.webp'),
  'Writing post should use /writing asset paths',
)
assert(
  !post.includes('/blog/brain-'),
  'Writing post must not use /blog asset paths',
)

const rss = read('rss.xml')
assert(
  rss.includes('/writing/building-mysayo/'),
  'RSS should link to canonical /writing post URLs',
)
assert(!rss.includes('/blog/'), 'RSS must not contain /blog URLs')

const redirects = read('_redirects')
assert(
  redirects.includes('/blog /writing 301'),
  '_redirects should redirect /blog to /writing',
)
assert(
  redirects.includes('/blog/* /writing/:splat 301'),
  '_redirects should redirect /blog/* to /writing/*',
)

const blogIndexRedirect = read('blog/index.html')
assert(
  blogIndexRedirect.includes('Redirecting to: /writing') &&
    blogIndexRedirect.includes('content="0;url=/writing"') &&
    blogIndexRedirect.includes('name="robots" content="noindex"'),
  '/blog should be a noindex redirect page',
)

const blogPostRedirect = read('blog/building-mysayo/index.html')
assert(
  blogPostRedirect.includes('Redirecting to: /writing/building-mysayo') &&
    blogPostRedirect.includes('content="0;url=/writing/building-mysayo"') &&
    blogPostRedirect.includes('name="robots" content="noindex"'),
  '/blog/building-mysayo should be a noindex redirect page',
)

const listHtmlFiles = (directory, prefix = '') => {
  const entries = readdirSync(directory, { withFileTypes: true })
  return entries.flatMap(entry => {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      return listHtmlFiles(entryPath, `${prefix}${entry.name}/`)
    }

    return entry.name === 'index.html' ? [`${prefix}${entry.name}`] : []
  })
}

const assertNoSubstackCrossPostLinks = html =>
  !html.includes('oluwasayo.substack.com/p/') &&
  !html.includes('substack.com/@oluwasayo/p-')

assertExists('writing/on-compilers-compression-and-llms/index.html')
assertExists('writing/pull-requests-where-engineering-culture/index.html')

for (const relativePath of listHtmlFiles(join(distPath, 'writing'))) {
  const html = read(`writing/${relativePath}`)
  assert(
    assertNoSubstackCrossPostLinks(html),
    `Writing page writing/${relativePath} must not link to Substack posts`,
  )
}

const sitemap = listXmlFiles(distPath)
  .map(path => readFileSync(path, 'utf8'))
  .join('\n')
assert(
  sitemap.includes('https://mysayo.com/writing'),
  'Sitemap should include /writing URLs',
)
assert(
  !sitemap.includes('https://mysayo.com/blog'),
  'Sitemap must not include /blog URLs',
)

process.stdout.write('Build output verified\n')
