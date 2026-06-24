import { defineConfig } from 'vitest/config'
import { sharedTestConfig } from './vite.shared.js'

export default defineConfig({
  cacheDir: './.vite',
  test: {
    coverage: sharedTestConfig.coverage,
    projects: [
      {
        extends: './code/app/shared/vitest.config.js',
        test: {
          name: 'shared',
          root: './code/app/shared',
        },
      },
      {
        extends: './code/app/web/vitest.config.js',
        test: {
          name: 'web',
          root: './code/app/web',
        },
      },
    ],
  },
})
