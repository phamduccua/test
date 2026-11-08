import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

const shim = decodeURIComponent(new URL('./src/vendor/react-shim.ts', import.meta.url).pathname)

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: { alias: { react: shim } },
})
