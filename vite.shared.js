import path from 'node:path'
import { coverageConfigDefaults } from 'vitest/config'

export const sharedViteConfig = {
  cacheDir: path.resolve(import.meta.dirname, '.vite'),
}

const generatedAndBoilerplateCoverageExcludes = [
  'src/testData.ts',
  'src/testHelpers.ts',
  '**/*.stories.tsx',
]

export const sharedTestConfig = {
  coverage: {
    excludeAfterRemap: true,
    include: ['src/**/*.{ts,tsx}'],
    exclude: [
      ...coverageConfigDefaults.exclude,
      ...generatedAndBoilerplateCoverageExcludes,
      '**/node_modules/**',
    ],
    provider: 'v8',
    reporter: ['text', 'json-summary', 'json'],
    reportsDirectory: './coverage',
  },
  mockReset: true,
  restoreMocks: true,
  testTimeout: 15_000,
}
