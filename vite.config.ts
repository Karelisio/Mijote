import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Dev-only proxy so URL import can be tested in a desktop browser
 * (on Android, CapacitorHttp bypasses CORS natively).
 */
function devFetchProxy(): Plugin {
  return {
    name: 'mijote-dev-fetch-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__proxy', (req, res) => {
        const target = new URL(req.url ?? '', 'http://x').searchParams.get('url');
        if (!target) {
          res.statusCode = 400;
          res.end('missing url');
          return;
        }
        fetch(target, { headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 14) Mijote' } })
          .then(async (r) => {
            res.statusCode = r.status;
            res.setHeader('content-type', r.headers.get('content-type') ?? 'application/octet-stream');
            res.end(Buffer.from(await r.arrayBuffer()));
          })
          .catch((e: unknown) => {
            res.statusCode = 502;
            res.end(String(e));
          });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devFetchProxy()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
