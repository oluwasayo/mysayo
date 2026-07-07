import {
  enumValuesToRecord,
  enumValueToSlug,
  enumValueToText,
} from '@shared/lib/enum'

export const Tag = {
  Agile: 'AGILE',
  Architecture: 'ARCHITECTURE',
  Astro: 'ASTRO',
  Backend: 'BACKEND',
  Cloudflare: 'CLOUDFLARE',
  CodeReview: 'CODE_REVIEW',
  Compilers: 'COMPILERS',
  Cursor: 'CURSOR',
  CycleTime: 'CYCLE_TIME',
  Design: 'DESIGN',
  Efficiency: 'EFFICIENCY',
  EngineeringEffectiveness: 'ENGINEERING_EFFECTIVENESS',
  InformationTheory: 'INFORMATION_THEORY',
  LargeLanguageModels: 'LARGE_LANGUAGE_MODELS',
  PullRequest: 'PULL_REQUEST',
  S3: 'S3',
  SoftwareEngineering: 'SOFTWARE_ENGINEERING',
  Substack: 'SUBSTACK',
  Terraform: 'TERRAFORM',
  Testing: 'TESTING',
  Throughput: 'THROUGHPUT',
  VibeCoding: 'VIBE_CODING',
} as const

export type Tag = (typeof Tag)[keyof typeof Tag]

export const tagValues = Object.values(Tag) as [Tag, ...Tag[]]

export const tagLabels = enumValuesToRecord(tagValues, enumValueToText)

/** URL slug per tag — for future /writing/tags/{slug} archive pages. */
export const tagSlugs = enumValuesToRecord(tagValues, enumValueToSlug)

export const getTagLabel = (tag: Tag) => tagLabels[tag]

/** Substack publication tag slug → site Tag value. */
export const substackTagSlugToTag: Record<string, Tag> = {
  agile: Tag.Agile,
  'code-review': Tag.CodeReview,
  compilers: Tag.Compilers,
  'cycle-time': Tag.CycleTime,
  efficiency: Tag.Efficiency,
  'engineering-effectiveness': Tag.EngineeringEffectiveness,
  'information-theory': Tag.InformationTheory,
  'large-language-models': Tag.LargeLanguageModels,
  'pull-request': Tag.PullRequest,
  'software-engineering': Tag.SoftwareEngineering,
  testing: Tag.Testing,
  throughput: Tag.Throughput,
  'vibe-coding': Tag.VibeCoding,
}
