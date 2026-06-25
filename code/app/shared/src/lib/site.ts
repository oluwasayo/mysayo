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

export const siteTagline =
  'Software engineer — web, systems, and cloud infrastructure.'

export const siteDescription =
  'The personal site and writing of Sayo Oladeji, a software engineer building for the web and the cloud.'

export type NavItem = {
  external?: boolean
  href: string
  label: string
}

export const navItems: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/blog', label: 'Writing' },
  {
    external: true,
    href: siteRepoUrl,
    label: 'Source',
  },
]

export const socialLinks: NavItem[] = [
  { href: 'https://github.com/oluwasayo', label: 'GitHub' },
  { href: 'https://linkedin.com/in/oluwasayo', label: 'LinkedIn' },
  { href: 'https://x.com/oluwasayo_', label: 'X' },
]
