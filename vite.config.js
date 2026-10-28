import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Relative base so the build works from any folder, including GitHub Pages project sites.
// Two pages: the lab and the explainer.
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: { input: { main: resolve(import.meta.dirname, 'index.html'), learn: resolve(import.meta.dirname, 'learn.html') } }
  }
});
