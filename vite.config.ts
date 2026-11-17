import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Page title and description come from site-copy.json so index.html holds no copy.
const meta = JSON.parse(readFileSync('./src/content/site-copy.json', 'utf8')).meta

export default defineConfig({
  base: './', // relative paths so the build works from any GitHub Pages sub-path
  build: { chunkSizeWarningLimit: 1200 }, // three.js is one large, lazily loaded chunk
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'site-meta',
      transformIndexHtml: (html: string) =>
        html.replaceAll('%SITE_TITLE%', meta.title).replaceAll('%SITE_DESCRIPTION%', meta.description),
    },
  ],
})
