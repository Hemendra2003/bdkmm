import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

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
  plugins: [preserveClassicScripts()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
});
