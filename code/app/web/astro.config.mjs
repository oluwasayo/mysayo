import path from 'node:path'
import react from '@astrojs/react'
import babel from '@rolldown/plugin-babel'
import { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig } from 'astro/config'

export default defineConfig({
  integrations: [react()],
  output: 'static',
  site: 'https://mysayo.com',
  vite: {
    plugins: [babel({ presets: [reactCompilerPreset()] })],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
        '@shared': path.resolve(import.meta.dirname, '../shared/src'),
      },
      dedupe: ['react', 'react-dom'],
    },
    server: {
      watch: {
        // 1Password FIFO mounts emit fs events; ignore to avoid dev-server restart loops.
        ignored: ['**/.env'],
      },
    },
  },
})
