import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import https from 'node:https';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localExe = path.resolve(__dirname, '../bin/yt-dlp.exe');
const localUnix = path.resolve(__dirname, '../bin/yt-dlp');

export const ytDlpPath =
  process.env.YT_DLP_PATH ||
  (fs.existsSync(localExe) ? localExe : fs.existsSync(localUnix) ? localUnix : 'yt-dlp');

export const DEFAULT_HTTP_PROXY = process.env.HTTP_PROXY || 'http://127.0.0.1:10809';
export const DEFAULT_SOCKS_PROXY = process.env.SOCKS_PROXY || 'socks5://127.0.0.1:10808';

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

      req.on('error', reject);
      req.write(payload);
      req.end();
    });

  let candidates;
  try {
    candidates = await doFetch(targetProxy);
  } catch (err) {
    const fallbackProxy = resolveProxyUrl(DEFAULT_SOCKS_PROXY);
    if (fallbackProxy && fallbackProxy !== targetProxy) {
      console.warn(`[searchYouTube] Primary proxy ${targetProxy} failed (${err.message}), retrying via fallback ${fallbackProxy}...`);
      try {
        candidates = await doFetch(fallbackProxy);
      } catch (fallbackErr) {
        throw new Error(`YouTube search failed on primary (${err.message}) and fallback (${fallbackErr.message})`);
      }
    } else {
      throw err;
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

  const targetProxy = resolveProxyUrl(proxyUrl);

  return new Promise((resolve, reject) => {
    const proc = spawn(ytDlpPath, [
      '--proxy',
      targetProxy,
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
        streamCache.set(videoId, {
          url,
          expires: Date.now() + 1000 * 60 * 90, // cache for 1.5h
        });
        resolve(url);
      } else {
        reject(new Error(`yt-dlp error (code ${code}): ${stderr}`));
      }
    });
  });
}

/**
 * Pipes audio stream from YouTube directly to client with HTTP 206 Partial Content support
 */
export async function proxyAudioStream(req, res, videoId, proxyUrl = DEFAULT_HTTP_PROXY) {
  try {
    const streamUrl = await resolveStreamUrl(videoId, proxyUrl);
    const agent = createProxyAgent(proxyUrl);

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    };
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const gReq = https.request(
      streamUrl,
      {
        method: 'GET',
        agent,
        headers,
      },
      (gRes) => {
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
  } catch (err) {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  }
}
