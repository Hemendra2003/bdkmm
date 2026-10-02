import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Classic scripts share browser globals and rely on their existing load order.
// Vite serves them from the root in dev but does not bundle non-module scripts.
// Emit only this explicit allowlist, never the whole repo or an environment file.
function preserveClassicScripts(): Plugin {
  return {
    name: 'momentum-classic-scripts',
    apply: 'build',
    generateBundle() {
      for (const fileName of ['auth.js', 'storage.js', 'app.js']) {
        this.emitFile({
          type: 'asset',
          fileName,
          source: readFileSync(fileURLToPath(new URL(fileName, import.meta.url))),
        });
      }
    },
  };
}

export default defineConfig({
  base: './',
  publicDir: false,
  envPrefix: 'VITE_',
  plugins: [preserveClassicScripts(), react()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
        app: fileURLToPath(new URL('app/index.html', import.meta.url)),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/app/test-setup.ts'],
    include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
  },
});
