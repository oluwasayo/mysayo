export const siteName = 'mysayo'

export const siteUrl = 'https://mysayo.com'

export const siteAuthor = 'Sayo Oladeji'

export const siteTagline =
  'Software engineer — web, systems, and cloud infrastructure.'

export const siteDescription =
  'The personal site and writing of Sayo Oladeji, a software engineer building for the web and the cloud.'

export type NavItem = {
  href: string
  label: string
}

export const navItems: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/blog', label: 'Writing' },
]

export const socialLinks: NavItem[] = [
  { href: 'https://github.com/oluwasayo', label: 'GitHub' },
  { href: 'https://linkedin.com/in/oluwasayo', label: 'LinkedIn' },
  { href: 'https://x.com/oluwasayo_', label: 'X' },
]
