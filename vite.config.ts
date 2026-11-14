import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// BASE_PATH được GitHub Actions đặt thành "/<tên-repo>/" khi deploy lên GitHub Pages.
// Khi chạy local, mặc định là "/".
const base = process.env.BASE_PATH || '/'

export default defineConfig({
  base,
  plugins: [react()],
  server: { port: 5290, strictPort: true },
  preview: { port: 5291, strictPort: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
} as Parameters<typeof defineConfig>[0])
