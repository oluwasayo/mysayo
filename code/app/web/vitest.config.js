/// <reference types="vitest/config" />
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'
import { sharedTestConfig, sharedViteConfig } from '../../../vite.shared.js'

export default defineConfig({
  ...sharedViteConfig,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@shared': path.resolve(import.meta.dirname, '../shared/src'),
      '@vitestBrowser': 'vitest/browser',
    },
    dedupe: ['react', 'react-dom'],
  },
  test: {
    ...sharedTestConfig,
    browser: {
      enabled: true,
      headless: true,
      instances: [
        {
          browser: 'chromium',
          headless: true,
          name: 'chromium',
          screenshotFailures: false,
        },
      ],
      provider: playwright(),
    },
    globals: true,
    include: ['src/**/*.test.ts?(x)'],
    name: 'web',
    setupFiles: ['vitest.setup.ts'],
  },
})
