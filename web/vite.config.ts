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
import { getLocalAudioFile, serveLocalAudioStream, getOfflineCacheStatus } from './server/offlineAudio.mjs';
// @ts-expect-error - mjs import
import { getTailscaleIp, getLanIp, PORT } from './server/authConfig.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  clearScreen: false,
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
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

            // Check offline audio cache on host first (zero latency)
            const localFile = getLocalAudioFile(videoId);
            if (localFile) {
              return serveLocalAudioStream(req, res, localFile);
            }

            await proxyAudioStream(req, res, videoId, proxy);
            return;
          }

          // 2.1 Offline Status endpoint
          if (url.pathname === '/api/offline-status') {
            return sendJson(200, getOfflineCacheStatus());
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

          // 4. Profiles API
          const DATA_DIR = path.resolve(__dirname, '../data');
          const PROFILES_DIR = path.join(DATA_DIR, 'profiles');
          const DEFAULTS_DIR = path.resolve(__dirname, '../defaults');

          if (url.pathname === '/api/profiles' && req.method === 'GET') {
            const list = [
              {
                id: 'bandita',
                name: 'Bandita Library',
                avatarEmoji: '🎧',
                description: 'Коллекция с 1,600+ треками и локальным аудио-кэшем',
                isMaster: true,
                cacheAudio: true,
                url: '/p/bandita',
              },
            ];
            if (fs.existsSync(PROFILES_DIR)) {
              for (const d of fs.readdirSync(PROFILES_DIR)) {
                const metaPath = path.join(PROFILES_DIR, d, 'profile.json');
                if (fs.existsSync(metaPath)) {
                  try {
                    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                    list.push({
                      id: meta.id || d,
                      name: meta.name || 'Spotify Library',
                      avatarEmoji: meta.avatarEmoji || '🎵',
                      description: meta.description || 'Импортированная библиотека Spotify',
                      isMaster: false,
                      cacheAudio: false,
                      url: `/p/${meta.id || d}`,
                    });
                  } catch {}
                }
              }
            }
            return sendJson(200, { profiles: list });
          }

          const profileMatch = url.pathname.match(/^\/api\/profiles\/([^/]+)(?:\/(library|playlists))?$/);
          if (profileMatch && req.method === 'GET') {
            const pId = decodeURIComponent(profileMatch[1]).toLowerCase();
            const sub = profileMatch[2];
            const isMaster = pId === 'bandita' || pId === 'default' || pId === 'profile_default';

            if (isMaster) {
              if (!sub) {
                return sendJson(200, {
                  id: 'bandita',
                  name: 'Bandita Library',
                  avatarEmoji: '🎧',
                  isMaster: true,
                  cacheAudio: true,
                  hasLibrary: true,
                  hasPlaylists: true,
                });
              }
              const fPath = path.resolve(DEFAULTS_DIR, sub === 'library' ? 'default/YourLibrary.json' : 'default/Playlist1.json');
              if (fs.existsSync(fPath)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return fs.createReadStream(fPath).pipe(res);
              }
              return sendJson(404, { error: 'Master file not found' });
            } else {
              const pDir = path.join(PROFILES_DIR, pId);
              if (!fs.existsSync(pDir)) return sendJson(404, { error: 'Profile not found' });
              if (!sub) {
                const metaPath = path.join(pDir, 'profile.json');
                if (fs.existsSync(metaPath)) {
                  return sendJson(200, JSON.parse(fs.readFileSync(metaPath, 'utf-8')));
                }
                return sendJson(200, { id: pId, name: pId });
              }
              const fPath = path.join(pDir, sub === 'library' ? 'YourLibrary.json' : 'Playlist1.json');
              if (fs.existsSync(fPath)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return fs.createReadStream(fPath).pipe(res);
              }
              return sendJson(404, { error: 'File not found' });
            }
          }

          if (profileMatch && (req.method === 'POST' || req.method === 'PUT') && profileMatch[2] === 'playlists') {
            const pId = decodeURIComponent(profileMatch[1]).toLowerCase();
            const isMaster = pId === 'bandita' || pId === 'default' || pId === 'profile_default';
            const targetFile = isMaster
              ? path.resolve(DEFAULTS_DIR, 'default/Playlist1.json')
              : path.join(PROFILES_DIR, pId, 'Playlist1.json');

            let body = '';
            req.on('data', (c: any) => { body += c; });
            req.on('end', () => {
              try {
                fs.mkdirSync(path.dirname(targetFile), { recursive: true });
                fs.writeFileSync(targetFile, body, 'utf-8');
                return sendJson(200, { success: true });
              } catch (e: any) {
                return sendJson(500, { error: e.message });
              }
            });
            return;
          }

          // 5. Defaults folder static serving
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
