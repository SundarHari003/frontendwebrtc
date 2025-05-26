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
    port: 3000,
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

// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'
// import tailwindcss from '@tailwindcss/vite'

// export default defineConfig({
//   plugins: [react(), tailwindcss()],
//   define: {
//     'process.env': {},
//     'process.browser': true,
//   },
//   base: '/',
//   server: {
//     host: true, // 👈 allows external access
//     port: 3000,
//     open: true,
//     strictPort: true,
//     cors: true,
//     allowedHosts: ['512c-103-176-188-201.ngrok-free.app'], // optional, helps if you're embedding via iframe or external tools
//   },
//   build: {
//     outDir: 'dist',
//     chunkSizeWarningLimit: 12000,
//     rollupOptions: {
//       output: {
//         manualChunks: (id) => {
//           if (id.includes('node_modules')) {
//             return 'vendor'
//           }
//         },
//       },
//     },
//   },
// })
