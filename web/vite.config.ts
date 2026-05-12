import { URL, fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'

import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import { visualizer } from 'rollup-plugin-visualizer'

// `ANALYZE=1 pnpm web:build` adds a treemap of the bundle at .stats.html
// (gzipped + brotli'd sizes too). Cheap way to catch duplicated deps
// like the react-query Context dup that caused the /stats QueryClient
// error before — would've shown two react-query trees in two chunks.
const analyze = process.env.ANALYZE === '1'

const config = defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    devtools(),
    nitro(process.env.VERCEL ? { preset: 'vercel' } : undefined),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    ...(analyze
      ? [
          visualizer({
            filename: '.stats.html',
            open: true,
            gzipSize: true,
            brotliSize: true,
            template: 'treemap',
          }),
        ]
      : []),
  ],
})

export default config
