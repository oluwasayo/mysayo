export const siteName = 'mysayo'

export const siteUrl = 'https://mysayo.com'

export const siteAuthor = 'Oluwasayo'

export const siteTagline =
  'Software engineer — web, systems, and cloud infrastructure.'

export const siteDescription =
  'The personal site and writing of Oluwasayo, a software engineer building for the web and the cloud.'

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
  { href: 'mailto:hello@mysayo.com', label: 'Email' },
]
