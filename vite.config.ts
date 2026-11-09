import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// fileURLToPath (không dùng URL.pathname): trên Windows pathname là "/D:/..." làm alias hỏng khi chạy dev.
const shim = fileURLToPath(new URL('./src/vendor/react-shim.ts', import.meta.url))

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: { alias: { react: shim } },
})
