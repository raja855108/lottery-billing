import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          // Only split vendor (React) — don't include dynamic imports here
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
})
