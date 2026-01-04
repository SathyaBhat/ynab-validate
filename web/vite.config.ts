import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/amex-sync/',
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // Listen on all network interfaces
    allowedHosts: ['wraeclast.bishop-bass.ts.net'],
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
