import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' => relative asset paths, so the build works at https://<user>.github.io/shopping/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'docs', emptyOutDir: true },
});
