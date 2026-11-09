import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Isolated API previews must not invalidate the live website's optimized dependencies.
  cacheDir: process.env.LMS_VITE_CACHE_DIR || (process.env.NODE_TEST_CONTEXT ? 'node_modules/.vite-tests/default' : 'node_modules/.vite'),
  // Prebundle lazy dashboard dependencies before serving navigation requests.
  optimizeDeps: { include: ['react', 'react-dom/client', 'react-router-dom', 'recharts', 'pdfjs-dist', 'axios', 'lucide-react', 'react-hot-toast', 'react-gauge-component'] },
})
