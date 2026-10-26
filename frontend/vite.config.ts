import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Static hosting under a sub-path (GitHub Pages: BUREAU_BASE=/poekhali/); the lesson server serves from the root.
  base: process.env.BUREAU_BASE || '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@content': fileURLToPath(new URL('../content', import.meta.url)),
      '@judge': fileURLToPath(new URL('../packages/judge/judge', import.meta.url)),
    },
  },
  server: {
    fs: { allow: ['..'] },
    // Lesson server (python -m bureau_server) in development.
    proxy: { '/api': 'http://localhost:8000', '/ws': { target: 'ws://localhost:8000', ws: true } },
  },
  worker: { format: 'es' },
  build: { chunkSizeWarningLimit: 900 },
});
