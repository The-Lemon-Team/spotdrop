import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
// @ts-expect-error - mjs import
import { searchYouTube, proxyAudioStream, DEFAULT_HTTP_PROXY, DEFAULT_SOCKS_PROXY } from './server/youtubeProxy.mjs';
// @ts-expect-error - mjs import
import { getTailscaleIp, getLanIp, PORT } from './server/authConfig.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    fs: {
      allow: ['..'],
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'youtube-proxy-middleware',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

          // Helper for JSON responses
          const sendJson = (status: number, data: unknown, extraHeaders: Record<string, string> = {}) => {
            res.writeHead(status, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              ...extraHeaders,
            });
            res.end(JSON.stringify(data));
          };

          // Auth: /api/auth/verify (always valid, no tokens required)
          if (url.pathname === '/api/auth/verify') {
            return sendJson(200, { valid: true, authRequired: false, tailscaleIp: getTailscaleIp(), port: PORT });
          }

          // Network info: /api/network-info
          if (url.pathname === '/api/network-info') {
            return sendJson(200, {
              tailscaleIp: getTailscaleIp(),
              lanIp: getLanIp(),
              port: PORT,
              hostname: os.hostname(),
              authRequired: false,
            });
          }

          // 1. YouTube Search endpoint
          if (url.pathname === '/api/search') {
            const query = url.searchParams.get('q');
            const proxy = url.searchParams.get('proxy') || DEFAULT_HTTP_PROXY;

            if (!query) {
              return sendJson(400, { error: 'Missing query parameter q' });
            }

            try {
              const candidates = await searchYouTube(query, proxy);
              return sendJson(200, { candidates });
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : 'Search failed';
              return sendJson(500, { error: message });
            }
          }

          // 2. YouTube Audio Stream endpoint
          if (url.pathname === '/api/stream') {
            const videoId = url.searchParams.get('videoId');
            const proxy = url.searchParams.get('proxy') || DEFAULT_HTTP_PROXY;

            if (!videoId) {
              return sendJson(400, { error: 'Missing videoId parameter' });
            }

            await proxyAudioStream(req, res, videoId, proxy);
            return;
          }

          // 3. Health & Proxy configuration endpoint
          if (url.pathname === '/api/config') {
            return sendJson(200, {
              httpProxy: DEFAULT_HTTP_PROXY,
              socksProxy: DEFAULT_SOCKS_PROXY,
              status: 'ready',
              tailscaleIp: getTailscaleIp(),
              port: PORT,
            });
          }

          // 4. Defaults folder static serving
          if (url.pathname.startsWith('/defaults/')) {
            const relPath = decodeURIComponent(url.pathname.replace(/^\/defaults\//, ''));
            const filePath = path.resolve(__dirname, '../defaults', relPath);
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              const ext = path.extname(filePath).toLowerCase();
              const mime =
                ext === '.json'
                  ? 'application/json'
                  : ext === '.txt'
                  ? 'text/plain'
                  : ext === '.md'
                  ? 'text/markdown'
                  : 'application/octet-stream';
              res.writeHead(200, {
                'Content-Type': mime,
                'Access-Control-Allow-Origin': '*',
              });
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          }

          next();
        });
      },
    },
  ],
});
