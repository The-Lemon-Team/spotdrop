import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const DEFAULTS_DIR = path.resolve(ROOT_DIR, 'defaults/default');
const AUDIO_DIR = path.resolve(DEFAULTS_DIR, 'audio');
const MANIFEST_FILE = path.resolve(DEFAULTS_DIR, 'download_manifest.json');
const PLAYLISTS_FILE = path.resolve(DEFAULTS_DIR, 'Playlist1.json');
const LIBRARY_FILE = path.resolve(DEFAULTS_DIR, 'YourLibrary.json');

const YT_DLP_BIN = path.resolve(ROOT_DIR, 'web/bin/yt-dlp.exe');

async function downloadSingleTrack(videoId) {
  const targetFile = path.resolve(AUDIO_DIR, `${videoId}.webm`);
  if (fs.existsSync(targetFile) && fs.statSync(targetFile).size > 200000) {
    return { skipped: true, size: fs.statSync(targetFile).size };
  }

  return new Promise((resolve) => {
    const args = [
      '-f', '251/ba[ext=webm]/ba',
      '--no-playlist',
      '-o', path.resolve(AUDIO_DIR, '%(id)s.%(ext)s'),
      `https://www.youtube.com/watch?v=${videoId}`
    ];

    const child = spawn(YT_DLP_BIN, args, {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });

    let stderr = '';
    child.stderr.on('data', d => (stderr += d.toString()));

    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(targetFile) && fs.statSync(targetFile).size > 200000) {
        resolve({ success: true, size: fs.statSync(targetFile).size });
      } else {
        resolve({ success: false, error: stderr.slice(-300) || `Exit code ${code}` });
      }
    });
  });
}

async function main() {
  console.log('=== Downloading Halloween Audio Tracks for Offline Playback ===\n');

  const plData = JSON.parse(fs.readFileSync(PLAYLISTS_FILE, 'utf8'));
  const hwPl = plData.playlists.find(p => p.name === 'Halloween: Quiet & Atmospheric');
  if (!hwPl) {
    console.error('Halloween playlist not found in Playlist1.json');
    return;
  }

  const libData = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
  const libMap = new Map();
  for (const t of libData.tracks) {
    if (t.uri) libMap.set(t.uri, t);
  }

  let manifest = [];
  if (fs.existsSync(MANIFEST_FILE)) {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
  }
  const manifestMap = new Map();
  for (const m of manifest) {
    if (m.uri) manifestMap.set(m.uri, m);
    if (m.videoId) manifestMap.set(m.videoId, m);
  }

  let downloadedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < hwPl.items.length; i++) {
    const item = hwPl.items[i];
    const trackInfo = item.track;
    const libTrack = libMap.get(trackInfo.trackUri);
    const videoId = libTrack?.pinnedVideoId;

    if (!videoId) {
      console.warn(`[${i + 1}/${hwPl.items.length}] No pinned videoId for ${trackInfo.artistName} - ${trackInfo.trackName}`);
      continue;
    }

    const t0 = Date.now();
    process.stdout.write(`[${i + 1}/${hwPl.items.length}] Downloading: ${trackInfo.artistName} - ${trackInfo.trackName} (${videoId})... `);
    const res = await downloadSingleTrack(videoId);

    if (res.skipped) {
      console.log(`already cached (${(res.size / 1024 / 1024).toFixed(2)} MB)`);
      skippedCount++;
    } else if (res.success) {
      console.log(`DONE in ${((Date.now() - t0) / 1000).toFixed(1)}s (${(res.size / 1024 / 1024).toFixed(2)} MB)`);
      downloadedCount++;
    } else {
      console.log(`FAILED: ${res.error}`);
      failedCount++;
    }

    // Update manifest entry
    const mEntry = manifestMap.get(trackInfo.trackUri) || manifestMap.get(videoId);
    if (mEntry) {
      const audioPath = path.resolve(AUDIO_DIR, `${videoId}.webm`);
      if (fs.existsSync(audioPath)) {
        mEntry.status = 'downloaded';
        mEntry.localFile = `${videoId}.webm`;
        mEntry.fileSizeBytes = fs.statSync(audioPath).size;
        mEntry.downloadedAt = Date.now();
      }
    }
  }

  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\nCompleted: ${downloadedCount} downloaded, ${skippedCount} skipped (already cached), ${failedCount} failed.`);
  console.log('Updated download_manifest.json.');
}

main();
