import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),
    tailwindcss()
  ],
  base: 'frontendwebrtc',
  build: {
    chunkSizeWarningLimit: 1000, // increase limit if you're okay with larger chunks
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            return 'vendor'; // creates a separate vendor chunk
          }
        }
      }
    }
  }
})
