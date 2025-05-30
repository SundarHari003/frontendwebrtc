import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    'process.env': {},
    'process.browser': true,
  },
  base: '/frontendwebrtc/',
  server: {
    port: 3001,
    open: true,
    host: true,
    strictPort: true,
    allowedHosts: ['*']
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 12000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        },
      },
    },
  },
})

