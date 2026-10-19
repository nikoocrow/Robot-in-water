import { defineConfig } from 'vite'

export default defineConfig({
  server: { open: true },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200
  }
})
