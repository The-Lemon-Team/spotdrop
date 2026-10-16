import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import https from 'node:https';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findOfflineCandidateByQuery } from './offlineAudio.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localExe = path.resolve(__dirname, '../bin/yt-dlp.exe');
const localUnix = path.resolve(__dirname, '../bin/yt-dlp');

export const ytDlpPath =
  process.env.YT_DLP_PATH ||
  (fs.existsSync(localExe) ? localExe : fs.existsSync(localUnix) ? localUnix : 'yt-dlp');

export const DEFAULT_HTTP_PROXY = process.env.HTTP_PROXY || 'http://127.0.0.1:10809';
export const DEFAULT_SOCKS_PROXY = process.env.SOCKS_PROXY || 'socks5://127.0.0.1:10808';
export const DEFAULT_BACKUP_PROXY = process.env.BACKUP_PROXY || 'http://127.0.0.1:20808';

export function resolveProxyUrl(proxyUrl) {
  if (!proxyUrl || typeof proxyUrl !== 'string') return proxyUrl;
  const inDocker = fs.existsSync('/.dockerenv') || process.env.IS_DOCKER === 'true';
  if (inDocker) {
    return proxyUrl
      .replace('://127.0.0.1', '://host.docker.internal')
      .replace('://localhost', '://host.docker.internal');
  }
  return proxyUrl;
}

export function createProxyAgent(proxyUrl = DEFAULT_HTTP_PROXY) {
  const target = resolveProxyUrl(proxyUrl);
  if (target.startsWith('socks')) {
    return new SocksProxyAgent(target);
  }
  return new HttpsProxyAgent(target);
}

const streamCache = new Map();
const searchCache = new Map();
const SEARCH_CACHE_TTL = 1000 * 60 * 30; // 30 minutes
const MAX_SEARCH_CACHE_SIZE = 500;

/**
 * Searches YouTube candidates via InnerTube API over local proxy
 */
export async function searchYouTube(query, proxyUrl = DEFAULT_HTTP_PROXY, limit = 8) {
  const targetProxy = resolveProxyUrl(proxyUrl);
  const cacheKey = `${targetProxy}:::${query.toLowerCase().trim()}:::${limit}`;
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.candidates;
  }

  const offlineMatch = findOfflineCandidateByQuery(query);

  const doFetch = (activeProxy) =>
    new Promise((resolve, reject) => {
      const agent = createProxyAgent(activeProxy);
      const payload = JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20240101.01.00',
            hl: 'en',
            gl: 'US',
          },
        },
        query,
      });

      const req = https.request(
        'https://www.youtube.com/youtubei/v1/search',
        {
          method: 'POST',
          agent,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          },
          timeout: 8000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              const candidates = [];
              const contents =
                json.contents?.twoColumnSearchResultsRenderer?.primaryContents
                  ?.sectionListRenderer?.contents;

              for (const section of contents || []) {
                for (const item of section.itemSectionRenderer?.contents || []) {
                  const v = item.videoRenderer;
                  if (v && v.videoId) {
                    const title = v.title?.runs?.[0]?.text || 'Track';
                    const channel = v.ownerText?.runs?.[0]?.text || 'Artist';
                    const durationText = v.lengthText?.simpleText || '';
                    const thumbnails = v.thumbnail?.thumbnails;
                    const thumbUrl =
                      thumbnails && thumbnails.length > 0
                        ? thumbnails[thumbnails.length - 1].url
                        : '';

                    candidates.push({
                      videoId: v.videoId,
                      title,
                      channel,
                      durationText,
                      thumbnailUrl: thumbUrl,
                    });

                    if (candidates.length >= limit) break;
                  }
                }
                if (candidates.length >= limit) break;
              }

              resolve(candidates);
            } catch (err) {
              reject(err);
            }
          });
        }
      );

      req.on('timeout', () => {
        req.destroy(new Error('Search request timed out (8s)'));
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

  const proxiesToTry = [
    targetProxy,
    resolveProxyUrl(DEFAULT_SOCKS_PROXY),
    resolveProxyUrl(DEFAULT_BACKUP_PROXY),
  ].filter((p, idx, arr) => p && arr.indexOf(p) === idx);

  let candidates = [];
  let lastErr = null;

  for (let i = 0; i < proxiesToTry.length; i++) {
    const active = proxiesToTry[i];
    try {
      candidates = await doFetch(active);
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      if (i < proxiesToTry.length - 1) {
        console.warn(`[searchYouTube] Proxy ${active} failed (${err.message}), retrying via fallback ${proxiesToTry[i + 1]}...`);
      }
    }
  }

  if (lastErr) {
    if (offlineMatch) {
      console.warn(`[searchYouTube] All YouTube proxies failed, serving offline match for "${query}"`);
      candidates = [];
    } else {
      throw lastErr;
    }
  }

  // Prepend offline match if available and not already in candidates
  if (offlineMatch) {
    const existingIdx = candidates.findIndex((c) => c.videoId === offlineMatch.videoId);
    if (existingIdx > 0) {
      candidates.splice(existingIdx, 1);
    }
    if (existingIdx !== 0) {
      candidates.unshift({
        videoId: offlineMatch.videoId,
        title: offlineMatch.title,
        channel: offlineMatch.channel,
        durationText: offlineMatch.durationText,
        thumbnailUrl: offlineMatch.thumbnailUrl,
        isPinned: true,
      });
    }
  }

  if (searchCache.size >= MAX_SEARCH_CACHE_SIZE) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey) searchCache.delete(oldestKey);
  }
  searchCache.set(cacheKey, {
    candidates,
    expires: Date.now() + SEARCH_CACHE_TTL,
  });

  return candidates;
}

/**
 * Resolves direct audio stream URL via yt-dlp over proxy
 */
export async function resolveStreamUrl(videoId, proxyUrl = DEFAULT_HTTP_PROXY) {
  const cached = streamCache.get(videoId);
  if (cached && cached.expires > Date.now()) {
    return cached.url;
  }

  const proxiesToTry = [
    targetProxy,
    resolveProxyUrl(DEFAULT_SOCKS_PROXY),
    resolveProxyUrl(DEFAULT_BACKUP_PROXY),
  ].filter((p, idx, arr) => p && arr.indexOf(p) === idx);

  const executeOnce = (activeProxy) =>
    new Promise((resolve, reject) => {
      const proc = spawn(ytDlpPath, [
        '--proxy',
        activeProxy,
        '--no-playlist',
        '--no-warnings',
        '--no-check-certificates',
        '--socket-timeout',
        '10',
        '--js-runtimes',
        'node',
        '-g',
        '-f',
        'ba/b',
        `https://www.youtube.com/watch?v=${videoId}`,
      ]);

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => (stdout += data));
      proc.stderr.on('data', (data) => (stderr += data));

      proc.on('close', (code) => {
        const url = stdout.trim().split('\n')[0]?.trim();
        if (url && url.startsWith('http')) {
          resolve(url);
        } else {
          const detail = stderr.trim().split('\n').pop() || `exit code ${code}`;
          reject(new Error(`yt-dlp error: ${detail}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn yt-dlp: ${err.message}`));
      });
    });

  let lastErr = null;
  for (let i = 0; i < proxiesToTry.length; i++) {
    const active = proxiesToTry[i];
    try {
      const url = await executeOnce(active);
      streamCache.set(videoId, {
        url,
        expires: Date.now() + 1000 * 60 * 90, // cache for 1.5h
      });
      return url;
    } catch (err) {
      lastErr = err;
      if (i < proxiesToTry.length - 1) {
        console.warn(`[resolveStreamUrl] Proxy ${active} failed for ${videoId} (${err.message}), retrying via ${proxiesToTry[i + 1]}...`);
      }
    }
  }

  throw lastErr || new Error(`yt-dlp stream resolution failed for ${videoId}`);
}

/**
 * Pipes audio stream from YouTube directly to client with HTTP 206 Partial Content support
 * and automatic 301/302/307 redirect following.
 */
export async function proxyAudioStream(req, res, videoId, proxyUrl = DEFAULT_HTTP_PROXY, retryCount = 0) {
  try {
    const streamUrl = await resolveStreamUrl(videoId, proxyUrl);
    const agent = createProxyAgent(proxyUrl);

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    };
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const requestStream = (currentUrl, redirectCount = 0) => {
      if (redirectCount > 3) {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Too many redirects from stream source' }));
        }
        return;
      }

      let parsedUrl;
      try {
        parsedUrl = new URL(currentUrl);
      } catch (err) {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid stream URL', details: err.message }));
        }
        return;
      }

      const gReq = https.request(
        parsedUrl,
        {
          method: 'GET',
          agent,
          headers,
        },
        (gRes) => {
          // Handle 301 / 302 / 307 / 308 redirects automatically
          if (
            gRes.statusCode &&
            gRes.statusCode >= 300 &&
            gRes.statusCode < 400 &&
            gRes.headers.location
          ) {
            gRes.resume(); // drain response
            const nextLocation = new URL(gRes.headers.location, currentUrl).toString();
            return requestStream(nextLocation, redirectCount + 1);
          }

          // Handle expired token or link (403 Forbidden / 410 Gone) -> retry with fresh yt-dlp URL once
          if ((gRes.statusCode === 403 || gRes.statusCode === 410) && retryCount === 0) {
            gRes.resume();
            streamCache.delete(videoId);
            return proxyAudioStream(req, res, videoId, proxyUrl, retryCount + 1);
          }

          const responseHeaders = {
            'Content-Type': gRes.headers['content-type'] || 'audio/webm',
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*',
          };
          if (gRes.headers['content-length']) {
            responseHeaders['Content-Length'] = gRes.headers['content-length'];
          }
          if (gRes.headers['content-range']) {
            responseHeaders['Content-Range'] = gRes.headers['content-range'];
          }

          res.writeHead(gRes.statusCode || 200, responseHeaders);
          gRes.pipe(res);
        }
      );

      gReq.on('error', (err) => {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });

      req.on('close', () => {
        gReq.destroy();
      });

      gReq.end();
    };

    requestStream(streamUrl, 0);
  } catch (err) {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  }
}
