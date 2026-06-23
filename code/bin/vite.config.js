import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(import.meta.dirname, 'src/filter-terraform-plan.ts'),
      fileName: 'filter-terraform-plan',
      formats: ['es'],
    },
    outDir: 'dist',
    rollupOptions: {
      external: ['node:fs'],
    },
    target: 'node22',
  },
})
