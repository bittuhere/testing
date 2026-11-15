import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Arcade Hub — Vite configuration
// Production build goes to ./build (the folder you deploy to GitHub Pages)
export default defineConfig({
  plugins: [react()],
  base: './', // relative paths — works on any GitHub Pages path (user/repo)
  preview: { allowedHosts: true }, // accept any host (GitHub Pages preview / e2b proxy)
  server: { allowedHosts: true },
  resolve: {
    // Belt-and-braces against duplicate Firebase copies sneaking into the
    // dev-server pre-bundle — a mixed registry is what throws
    // "Component auth has not been registered yet".
    dedupe: ['firebase', '@firebase/app', '@firebase/auth', '@firebase/component', '@firebase/firestore', '@firebase/analytics'],
  },
  optimizeDeps: {
    // Pre-bundle the Firebase subpath imports together as one coherent set.
    include: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/analytics', 'firebase/messaging'],
  },
  build: {
    outDir: 'build',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2400, // pdf.js + firebase are big; that's expected
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('firebase')) return 'firebase'
          if (id.includes('react-dom') || id.includes('react-router') || id.match(/node_modules\/react\//)) return 'vendor'
        },
      },
    },
  },
})

