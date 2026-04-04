import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Phone: `npm run dev:phone` → open LAN URL on device, or Chrome DevTools → device toolbar (Cmd/Ctrl+Shift+M).

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/react-router')) {
            return 'router';
          }
          if (id.includes('node_modules/@supabase')) {
            return 'supabase';
          }
        },
      },
    },
  },
})
