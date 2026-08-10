import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Electron file:// yüklemesi için göreli yollar
  base: './',
  server: {
    host: true,
    port: 5173,
    open: false,
    strictPort: true,
  },
})
