import { defineConfig } from 'vite'

export default defineConfig({
  base: './', // Garante que os caminhos sejam relativos para o GitHub Pages
  build: {
    outDir: 'dist',
  }
})
