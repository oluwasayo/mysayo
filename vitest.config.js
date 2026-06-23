import { defineConfig } from 'vitest/config'

export default defineConfig({
  cacheDir: './.vite',
  test: {
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
