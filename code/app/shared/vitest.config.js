import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { sharedTestConfig, sharedViteConfig } from '../../../vite.shared.js'

export default defineConfig({
  ...sharedViteConfig,
  resolve: {
    alias: {
      '@shared': path.resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    ...sharedTestConfig,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    name: 'shared',
  },
})
