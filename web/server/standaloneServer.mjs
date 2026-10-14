import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  searchYouTube,
  proxyAudioStream,
  DEFAULT_HTTP_PROXY,
  DEFAULT_SOCKS_PROXY,
} from './youtubeProxy.mjs';
import {
  PORT,
  HOST,
  AUTH_TOKEN,
  REQUIRE_AUTH,
  isAuthorized,
  extractToken,
  getTailscaleIp,
  getLanIp,
} from './authConfig.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '../dist');
const DEFAULTS_DIR = path.resolve(__dirname, '../../defaults');
const DATA_DIR = path.resolve(__dirname, '../../data');
const PROFILES_DIR = path.join(DATA_DIR, 'profiles');

// Ensure profiles directory exists
if (!fs.existsSync(PROFILES_DIR)) {
  fs.mkdirSync(PROFILES_DIR, { recursive: true });
}

export const FUNNEL_HOST = process.env.TAILSCALE_FUNNEL_HOST || 'alovingpc.tail0f092f.ts.net';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.webm': 'audio/webm',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function sendJson(res, statusCode, data, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    ...extraHeaders,
  });
  res.end(JSON.stringify(data));
}

function sendUnauthorized(res) {
  sendJson(res, 401, {
    error: 'Unauthorized',
    message: 'Требуется авторизация.',
  });
}

const MASTER_AUDIO_DIR = path.resolve(DEFAULTS_DIR, 'default/audio');

export function getLocalAudioFile(videoId) {
  if (!videoId || typeof videoId !== 'string') return null;
  const safeId = path.basename(videoId.trim());
  const extensions = ['.webm', '.m4a', '.mp3', '.ogg', '.opus'];
  for (const ext of extensions) {
    const candidate = path.join(MASTER_AUDIO_DIR, `${safeId}${ext}`);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

export function serveLocalAudioStream(req, res, filePath) {
  try {
    const stat = fs.statSync(filePath);
    const total = stat.size;
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'audio/webm';
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;

      if (isNaN(start) || start >= total || (parts[1] && end >= total)) {
        res.writeHead(416, { 'Content-Range': `bytes */${total}` });
        return res.end();
      }

      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=31536000',
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': total,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=31536000',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to stream local audio', details: err.message }));
  }
}

const server = http.createServer(async (req, res) => {
  const hostHeader = req.headers.host || 'localhost';
  const url = new URL(req.url || '/', `http://${hostHeader}`);

  // CORS headers for all API calls
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization, X-Access-Token');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  // 1. Auth Endpoint: /api/auth/verify (Backwards compatibility)
  if (url.pathname === '/api/auth/verify') {
    const valid = isAuthorized(req, url);
    return sendJson(res, valid ? 200 : 401, {
      valid,
      authRequired: REQUIRE_AUTH,
      tailscaleIp: getTailscaleIp(),
      port: PORT,
    });
  }

  // 2. Network & Tailscale Info Endpoint
  if (url.pathname === '/api/network-info') {
    return sendJson(res, 200, {
      tailscaleIp: getTailscaleIp(),
      lanIp: getLanIp(),
      port: PORT,
      host: HOST,
      hostname: os.hostname(),
      funnelHost: FUNNEL_HOST,
      funnelUrl: `https://${FUNNEL_HOST}`,
      authRequired: REQUIRE_AUTH,
    });
  }

  // 3. YouTube Search API (Open)
  if (url.pathname === '/api/search') {
    if (!isAuthorized(req, url)) {
      return sendUnauthorized(res);
    }

    const query = url.searchParams.get('q');
    const proxy = url.searchParams.get('proxy') || DEFAULT_HTTP_PROXY;

    if (!query) {
      return sendJson(res, 400, { error: 'Missing query parameter q' });
    }

    try {
      const candidates = await searchYouTube(query, proxy);
      return sendJson(res, 200, { candidates });
    } catch (err) {
      return sendJson(res, 500, { error: err.message || 'Search failed' });
    }
  }

  // 4. Audio Stream API
  // Policy:
  // - If profileId is 'bandita' or 'default', check local audio cache first.
  // - All other profiles stream directly from YouTube proxy (zero disk writes).
  if (url.pathname === '/api/stream') {
    if (!isAuthorized(req, url)) {
      return sendUnauthorized(res);
    }

    const videoId = url.searchParams.get('videoId');
    const profileId = (url.searchParams.get('profileId') || '').toLowerCase().trim();
    const proxy = url.searchParams.get('proxy') || DEFAULT_HTTP_PROXY;

    if (!videoId) {
      return sendJson(res, 400, { error: 'Missing videoId parameter' });
    }

    // Master profile: check offline audio cache on host
    if (profileId === 'bandita' || profileId === 'default' || profileId === 'profile_default') {
      const localFile = getLocalAudioFile(videoId);
      if (localFile) {
        return serveLocalAudioStream(req, res, localFile);
      }
    }

    // Direct streaming from YouTube (Fallback & Guest profiles)
    await proxyAudioStream(req, res, videoId, proxy);
    return;
  }

  // 5. Offline Status API
  if (url.pathname === '/api/offline-status') {
    let audioFiles = [];
    let totalBytes = 0;
    if (fs.existsSync(MASTER_AUDIO_DIR)) {
      const allowedExts = new Set(['.webm', '.m4a', '.mp3', '.ogg', '.opus']);
      for (const f of fs.readdirSync(MASTER_AUDIO_DIR)) {
        const ext = path.extname(f).toLowerCase();
        if (allowedExts.has(ext)) {
          const fullPath = path.join(MASTER_AUDIO_DIR, f);
          try {
            const st = fs.statSync(fullPath);
            if (st.isFile()) {
              audioFiles.push({
                videoId: path.basename(f, ext),
                filename: f,
                size: st.size,
              });
              totalBytes += st.size;
            }
          } catch {
            // ignore
          }
        }
      }
    }

    return sendJson(res, 200, {
      totalCached: audioFiles.length,
      totalBytes,
      audioDir: MASTER_AUDIO_DIR,
      cachedVideoIds: audioFiles.map((a) => a.videoId),
    });
  }

  // 6. Profiles API
  // 6.1. GET /api/profiles - List available demo & public profiles
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
      const dirs = fs.readdirSync(PROFILES_DIR);
      for (const d of dirs) {
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
          } catch {
            // ignore malformed profiles
          }
        }
      }
    }

    return sendJson(res, 200, { profiles: list });
  }

  // 6.2. POST /api/profiles/upload - Create a new independent SpotDrop profile
  if (url.pathname === '/api/profiles/upload' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) {
        // 50MB limit
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload too large (max 50MB)' }));
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const rawName = (parsed.name || '').trim();
        const rawEmoji = (parsed.avatarEmoji || '🎵').trim();
        const libraryJson = parsed.libraryJson || null;
        const playlistsJson = parsed.playlistsJson || null;

        if (!libraryJson && !playlistsJson) {
          return sendJson(res, 400, {
            error: 'Необходимо предоставить хотя бы один файл: YourLibrary.json или Playlist1.json',
          });
        }

        // Generate unique profile id: spot_xxxxxxxx
        const uniqueSuffix = crypto.randomBytes(4).toString('hex');
        const profileId = `spot_${uniqueSuffix}`;
        const profileDir = path.join(PROFILES_DIR, profileId);

        fs.mkdirSync(profileDir, { recursive: true });

        const profileMeta = {
          id: profileId,
          name: rawName || `Spotify Import #${uniqueSuffix}`,
          avatarEmoji: rawEmoji,
          createdAt: Date.now(),
          isMaster: false,
          cacheAudio: false,
          hasLibrary: Boolean(libraryJson),
          hasPlaylists: Boolean(playlistsJson),
        };

        fs.writeFileSync(
          path.join(profileDir, 'profile.json'),
          JSON.stringify(profileMeta, null, 2),
          'utf-8'
        );

        if (libraryJson) {
          fs.writeFileSync(path.join(profileDir, 'YourLibrary.json'), libraryJson, 'utf-8');
        }
        if (playlistsJson) {
          fs.writeFileSync(path.join(profileDir, 'Playlist1.json'), playlistsJson, 'utf-8');
        }

        return sendJson(res, 201, {
          success: true,
          profileId,
          url: `/p/${profileId}`,
          meta: profileMeta,
        });
      } catch (err) {
        return sendJson(res, 400, { error: 'Invalid JSON payload', details: err.message });
      }
    });
    return;
  }

  // 6.3. Profile Details & Data: /api/profiles/:id, /api/profiles/:id/library, /api/profiles/:id/playlists
  const profileMatch = url.pathname.match(/^\/api\/profiles\/([^/]+)(?:\/(library|playlists))?$/);
  if (profileMatch && req.method === 'GET') {
    const pId = decodeURIComponent(profileMatch[1]).toLowerCase();
    const subResource = profileMatch[2]; // 'library' | 'playlists' | undefined

    const isMaster = pId === 'bandita' || pId === 'default' || pId === 'profile_default';

    if (isMaster) {
      if (!subResource) {
        return sendJson(res, 200, {
          id: 'bandita',
          name: 'Bandita Library',
          avatarEmoji: '🎧',
          description: 'Коллекция с 1,600+ треками и локальным аудио-кэшем',
          isMaster: true,
          cacheAudio: true,
          hasLibrary: true,
          hasPlaylists: true,
        });
      }
      if (subResource === 'library') {
        const fPath = path.resolve(DEFAULTS_DIR, 'default/YourLibrary.json');
        if (fs.existsSync(fPath)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return fs.createReadStream(fPath).pipe(res);
        }
        return sendJson(res, 404, { error: 'Master library not found' });
      }
      if (subResource === 'playlists') {
        const fPath = path.resolve(DEFAULTS_DIR, 'default/Playlist1.json');
        if (fs.existsSync(fPath)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return fs.createReadStream(fPath).pipe(res);
        }
        return sendJson(res, 404, { error: 'Master playlists not found' });
      }
    } else {
      const pDir = path.join(PROFILES_DIR, pId);
      if (!fs.existsSync(pDir)) {
        return sendJson(res, 404, { error: `Профиль ${pId} не найден` });
      }

      if (!subResource) {
        const metaPath = path.join(pDir, 'profile.json');
        if (fs.existsSync(metaPath)) {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          return sendJson(res, 200, meta);
        }
        return sendJson(res, 200, { id: pId, name: pId, isMaster: false, cacheAudio: false });
      }

      if (subResource === 'library') {
        const fPath = path.join(pDir, 'YourLibrary.json');
        if (fs.existsSync(fPath)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return fs.createReadStream(fPath).pipe(res);
        }
        return sendJson(res, 404, { error: 'Library not uploaded for this profile' });
      }

      if (subResource === 'playlists') {
        const fPath = path.join(pDir, 'Playlist1.json');
        if (fs.existsSync(fPath)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return fs.createReadStream(fPath).pipe(res);
        }
        return sendJson(res, 404, { error: 'Playlists not uploaded for this profile' });
      }
    }
  }

  // 7. Config API
  if (url.pathname === '/api/config') {
    return sendJson(res, 200, {
      httpProxy: DEFAULT_HTTP_PROXY,
      socksProxy: DEFAULT_SOCKS_PROXY,
      status: 'ready',
      tailscaleIp: getTailscaleIp(),
      port: PORT,
    });
  }

  // 8. Defaults folder static serving
  if (url.pathname.startsWith('/defaults/')) {
    const relPath = decodeURIComponent(url.pathname.replace(/^\/defaults\//, ''));
    const filePath = path.resolve(DEFAULTS_DIR, relPath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': mime,
        'Access-Control-Allow-Origin': '*',
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    } else {
      return sendJson(res, 404, { error: 'File not found in defaults' });
    }
  }

  // 9. Static File Serving (from web/dist) & SPA Fallback
  if (req.method === 'GET' || req.method === 'HEAD') {
    const safePath = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    const requestedFile = path.join(DIST_DIR, safePath);

    // If exact asset file exists in dist (e.g. /assets/index-xxx.js)
    if (fs.existsSync(requestedFile) && fs.statSync(requestedFile).isFile()) {
      const ext = path.extname(requestedFile).toLowerCase();
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      const isAsset = safePath.startsWith(path.sep + 'assets') || safePath.startsWith('/assets');

      res.writeHead(200, {
        'Content-Type': mime,
        'Cache-Control': isAsset
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=3600',
      });

      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(requestedFile).pipe(res);
      return;
    }

    // SPA Fallback: Serve dist/index.html for any route (including / and /p/:profileId)
    const indexHtml = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(indexHtml)) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(indexHtml).pipe(res);
      return;
    }

    // If dist doesn't exist yet
    res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!doctype html>
      <html>
        <head><title>SpotDrop - Build Required</title><meta charset="utf-8"></head>
        <body style="background:#0D0E15;color:#F3F4F6;font-family:sans-serif;padding:40px;text-align:center;">
          <h1 style="color:#00E5FF;">🎵 SpotDrop</h1>
          <p>Production frontend не собран. Запустите сборку в консоли:</p>
          <pre style="background:#161822;padding:15px;border-radius:8px;display:inline-block;color:#00E5FF;">cd web && npm run build</pre>
        </body>
      </html>
    `);
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, HOST, () => {
  const tsIp = getTailscaleIp();
  const lanIp = getLanIp();
  const sep = '='.repeat(70);

  console.log(`\n${sep}`);
  console.log(`🎵 SpotDrop - Production Web Server`);
  console.log(`${sep}`);
  console.log(`\n📱 Ссылки для доступа:`);
  console.log(`   • 🌐 Публичный HTTPS (Funnel): https://${FUNNEL_HOST}`);
  console.log(`   • 🎧 Master библиотека (Bandita): https://${FUNNEL_HOST}/p/bandita`);
  if (tsIp) {
    console.log(`   • Tailscale IP (VPN):        http://${tsIp}:${PORT}`);
    console.log(`   • Tailnet Host:              http://${os.hostname()}:${PORT}`);
  }
  if (lanIp) {
    console.log(`   • Wi-Fi / LAN:               http://${lanIp}:${PORT}`);
  }
  console.log(`   • Localhost:                 http://localhost:${PORT}`);

  console.log(`\n⚙️  Параметры прокси:`);
  console.log(`   • HTTP Proxy:    ${DEFAULT_HTTP_PROXY}`);
  console.log(`   • SOCKS5 Proxy:  ${DEFAULT_SOCKS_PROXY}`);
  console.log(`${sep}\n`);
});
