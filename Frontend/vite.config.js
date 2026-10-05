import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const proxy = {
  '/api': 'http://127.0.0.1:8000',
  '/o': 'http://127.0.0.1:8000',
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: { proxy },
  preview: { proxy },
})
