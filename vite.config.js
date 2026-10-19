import { defineConfig } from 'vite'

export default defineConfig({
  server: { open: true },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Three.js en su propio chunk: cambia poco, así que queda en caché entre despliegues
        manualChunks: (id) => (id.includes('node_modules/three') ? 'three' : undefined)
      }
    }
  }
})
