export const siteName = 'ṣayọ̀'

export const siteUrl = 'https://mysayo.com'

export const siteRepoUrl = 'https://github.com/oluwasayo/mysayo'

export const siteRepoBranch = 'main'

export const blogPostSourceUrl = (fileId: string) =>
  `${siteRepoUrl}/blob/${siteRepoBranch}/code/app/web/src/content/blog/${fileId}.md`

export const siteAuthor = 'Sayo Oladeji'

export const siteXHandle = 'oluwasayo_'

export const xDiscussUrl = (pageUrl: string) =>
  `https://x.com/intent/tweet?${new URLSearchParams({
    text: `${pageUrl} @${siteXHandle}`,
  })}`

export const xRecommendUrl = `https://x.com/intent/tweet?${new URLSearchParams({
  text: `@${siteXHandle} you should read `,
})}`

export const siteTagline =
  'Hands-on engineer building and leading across product and infrastructure.'

export const siteDescription =
  'The personal site and writing of Sayo Oladeji, a hands-on engineer who builds and leads across product and infrastructure.'

export type NavItem = {
  external?: boolean
  href: string
  label: string
}

export const navItems: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/work', label: 'Work' },
  { href: '/reading', label: 'Reading' },
  { href: '/writing', label: 'Writing' },
  {
    external: true,
    href: siteRepoUrl,
    label: 'Source',
  },
]

export const socialLinks: NavItem[] = [
  { external: true, href: 'https://x.com/oluwasayo_', label: 'X (Twitter)' },
  {
    external: true,
    href: 'https://linkedin.com/in/oluwasayo',
    label: 'LinkedIn',
  },
  { external: true, href: 'https://github.com/oluwasayo', label: 'GitHub' },
]

export const profileLinks: NavItem[] = [
  ...socialLinks,
  { external: true, href: 'https://cursor.com/@sayo', label: 'Cursor' },
]
