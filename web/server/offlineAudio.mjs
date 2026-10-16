import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MIME_TYPES = {
  '.webm': 'audio/webm',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
};

export function resolveDefaultsDir() {
  const candidates = [
    process.env.DEFAULTS_DIR,
    path.resolve(__dirname, '../../defaults'),
    path.resolve(__dirname, '../defaults'),
    path.resolve(process.cwd(), 'defaults'),
    '/app/defaults',
  ].filter(Boolean);

  for (const dir of candidates) {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      return dir;
    }
  }
  return path.resolve(__dirname, '../../defaults');
}

export const DEFAULTS_DIR = resolveDefaultsDir();
export const AUDIO_DIR = path.resolve(DEFAULTS_DIR, 'default/audio');
export const MANIFEST_FILE = path.resolve(DEFAULTS_DIR, 'default/download_manifest.json');
export const LIBRARY_FILE = path.resolve(DEFAULTS_DIR, 'default/YourLibrary.json');

// Memory index for ultra-fast local candidate resolution
let localTracksIndex = null;

function normalizeSearchString(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\b(audio|official|video|lyrics|hd|hq|remastered|version|track)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function reloadOfflineIndex() {
  const index = [];
  const videoIdMap = new Map();

  // 1. Load from download_manifest.json
  if (fs.existsSync(MANIFEST_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
      const entries = Array.isArray(data) ? data : Object.values(data);
      for (const item of entries) {
        if (item && item.status === 'downloaded' && item.videoId) {
          const entry = {
            videoId: item.videoId,
            title: item.videoTitle || item.track || item.title || 'Track',
            channel: item.channel || item.artist || 'Artist',
            durationText: item.durationText || (item.durationSeconds ? `${Math.floor(item.durationSeconds / 60)}:${(item.durationSeconds % 60).toString().padStart(2, '0')}` : ''),
            thumbnailUrl: `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
            artist: item.artist || '',
            track: item.track || item.title || '',
            album: item.album || '',
            searchKey: normalizeSearchString(`${item.artist || ''} ${item.track || item.title || ''}`),
          };
          index.push(entry);
          videoIdMap.set(item.videoId, entry);
        }
      }
    } catch (e) {
      console.warn('[offlineAudio] Error parsing download_manifest.json:', e.message);
    }
  }

  // 2. Load from YourLibrary.json (for any pinned tracks not in manifest)
  if (fs.existsSync(LIBRARY_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
      const tracks = data.tracks || [];
      for (const item of tracks) {
        if (item && item.pinnedVideoId && !videoIdMap.has(item.pinnedVideoId)) {
          const entry = {
            videoId: item.pinnedVideoId,
            title: item.pinnedTitle || item.track || 'Track',
            channel: item.pinnedChannel || item.artist || 'Artist',
            durationText: item.pinnedDuration || '',
            thumbnailUrl: item.pinnedThumbnail || `https://i.ytimg.com/vi/${item.pinnedVideoId}/hqdefault.jpg`,
            artist: item.artist || '',
            track: item.track || '',
            album: item.album || '',
            searchKey: normalizeSearchString(`${item.artist || ''} ${item.track || ''}`),
          };
          index.push(entry);
          videoIdMap.set(item.pinnedVideoId, entry);
        }
      }
    } catch (e) {
      console.warn('[offlineAudio] Error parsing YourLibrary.json:', e.message);
    }
  }

  localTracksIndex = { index, videoIdMap };
  return localTracksIndex;
}

export function getOfflineIndex() {
  if (!localTracksIndex) {
    reloadOfflineIndex();
  }
  return localTracksIndex;
}

/**
 * Checks if a given query matches an existing locally-downloaded audio track.
 * Returns the candidate object if matched.
 */
export function findOfflineCandidateByQuery(query) {
  if (!query || typeof query !== 'string') return null;
  const cleanQ = normalizeSearchString(query);
  if (!cleanQ || cleanQ.length < 3) return null;

  const { index } = getOfflineIndex();
  const queryTokens = cleanQ.split(' ').filter((w) => w.length > 1);
  if (queryTokens.length === 0) return null;

  let bestMatch = null;
  let maxScore = 0;

  for (const item of index) {
    if (!item.searchKey) continue;

    // Exact string match bonus
    if (item.searchKey === cleanQ) {
      return item;
    }

    // Token intersection matching
    let matchedCount = 0;
    for (const tok of queryTokens) {
      if (item.searchKey.includes(tok)) {
        matchedCount++;
      }
    }

    const score = matchedCount / queryTokens.length;
    // Require at least 80% tokens matched or all matched
    if (score > maxScore && (score >= 0.8 || matchedCount === queryTokens.length)) {
      maxScore = score;
      bestMatch = item;
    }
  }

  return bestMatch;
}

/**
 * Checks if the local audio file exists for the given videoId.
 */
export function getLocalAudioFile(videoId) {
  if (!videoId || typeof videoId !== 'string') return null;
  const safeId = path.basename(videoId.trim());
  const extensions = ['.webm', '.m4a', '.mp3', '.ogg', '.opus'];
  for (const ext of extensions) {
    const candidate = path.join(AUDIO_DIR, `${safeId}${ext}`);
    if (fs.existsSync(candidate)) {
      try {
        if (fs.statSync(candidate).isFile()) {
          return candidate;
        }
      } catch {
        // ignore
      }
    }
  }
  return null;
}

/**
 * Serves an audio file directly with HTTP 206 Partial Content (Range) support.
 */
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

/**
 * Status of local offline audio directory
 */
export function getOfflineCacheStatus() {
  let audioFiles = [];
  let totalBytes = 0;
  if (fs.existsSync(AUDIO_DIR)) {
    const allowedExts = new Set(['.webm', '.m4a', '.mp3', '.ogg', '.opus']);
    for (const f of fs.readdirSync(AUDIO_DIR)) {
      const ext = path.extname(f).toLowerCase();
      if (allowedExts.has(ext)) {
        const fullPath = path.join(AUDIO_DIR, f);
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

  return {
    totalCached: audioFiles.length,
    totalBytes,
    audioDir: AUDIO_DIR,
    cachedVideoIds: audioFiles.map((a) => a.videoId),
  };
}
