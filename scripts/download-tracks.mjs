import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// File paths
const DEFAULTS_DIR = path.resolve(ROOT_DIR, 'defaults/default');
const LIBRARY_FILE = path.resolve(DEFAULTS_DIR, 'YourLibrary.json');
const MANIFEST_FILE = path.resolve(DEFAULTS_DIR, 'download_manifest.json');
const AUDIO_DIR = path.resolve(DEFAULTS_DIR, 'audio');
const ENV_FILE = path.resolve(ROOT_DIR, 'web/.env');

// Binary resolution
const localWinExe = path.resolve(ROOT_DIR, 'web/bin/yt-dlp.exe');
const localUnix = path.resolve(ROOT_DIR, 'web/bin/yt-dlp');
const YT_DLP_BIN = fs.existsSync(localWinExe)
  ? localWinExe
  : fs.existsSync(localUnix)
  ? localUnix
  : 'yt-dlp';

// Read default proxy from web/.env if present
function getProxyFromEnv() {
  if (process.env.HTTP_PROXY) return process.env.HTTP_PROXY;
  if (fs.existsSync(ENV_FILE)) {
    try {
      const content = fs.readFileSync(ENV_FILE, 'utf8');
      const match = content.match(/^HTTP_PROXY=(.+)$/m);
      if (match) return match[1].trim();
    } catch {
      // ignore
    }
  }
  return 'http://127.0.0.1:10809';
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    batchSize: 25,         // Safe batch size (20-25 recommended)
    batchIndex: null,      // Specific batch number (1-based)
    limit: null,           // Limit total tracks in this run
    offset: 0,             // Offset index
    concurrency: 2,        // Parallel downloads (1-2 safe)
    delayMin: 3,           // Min jitter delay between tracks (seconds)
    delayMax: 7,           // Max jitter delay between tracks (seconds)
    cooldown: 120,         // Cooldown between batches in auto-loop (seconds)
    rateLimit: '2M',       // yt-dlp download rate limit (e.g. 2M)
    format: 'webm',        // 'webm' (Opus 160k, native, no ffmpeg), 'm4a', 'mp3'
    proxy: getProxyFromEnv(),
    maxDuration: 900,      // 15 min max duration to skip loops/full albums
    autoLoop: false,       // Automatically run all batches with cooldown
    syncLibrary: false,    // Sync pinned IDs to YourLibrary.json
    status: false,         // Just show status and exit
    dryRun: false,         // Search without downloading
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--status') options.status = true;
    else if (arg === '--auto-loop') options.autoLoop = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--sync-library') options.syncLibrary = true;
    else if (arg === '--batch-size' && args[i + 1]) options.batchSize = parseInt(args[++i], 10);
    else if (arg === '--batch' && args[i + 1]) options.batchIndex = parseInt(args[++i], 10);
    else if (arg === '--limit' && args[i + 1]) options.limit = parseInt(args[++i], 10);
    else if (arg === '--offset' && args[i + 1]) options.offset = parseInt(args[++i], 10);
    else if (arg === '--concurrency' && args[i + 1]) options.concurrency = parseInt(args[++i], 10);
    else if (arg === '--delay-min' && args[i + 1]) options.delayMin = parseFloat(args[++i]);
    else if (arg === '--delay-max' && args[i + 1]) options.delayMax = parseFloat(args[++i]);
    else if (arg === '--cooldown' && args[i + 1]) options.cooldown = parseInt(args[++i], 10);
    else if (arg === '--rate-limit' && args[i + 1]) options.rateLimit = args[++i];
    else if (arg === '--format' && args[i + 1]) options.format = args[++i].toLowerCase();
    else if (arg === '--proxy' && args[i + 1]) options.proxy = args[++i];
    else if (arg === '--max-duration' && args[i + 1]) options.maxDuration = parseInt(args[++i], 10);
  }

  return options;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomJitter(minSec, maxSec) {
  const min = Math.max(0, minSec) * 1000;
  const max = Math.max(min, maxSec * 1000);
  return Math.floor(min + Math.random() * (max - min));
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatDuration(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Initialize or load manifest
function loadOrCreateManifest() {
  if (!fs.existsSync(LIBRARY_FILE)) {
    throw new Error(`YourLibrary.json not found at: ${LIBRARY_FILE}`);
  }

  const libData = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
  const rawTracks = [...(libData.tracks || [])];

  const PLAYLIST_FILE = path.resolve(DEFAULTS_DIR, 'Playlist1.json');
  if (fs.existsSync(PLAYLIST_FILE)) {
    try {
      const plData = JSON.parse(fs.readFileSync(PLAYLIST_FILE, 'utf8'));
      const existingUris = new Set(rawTracks.map((t) => t.uri));
      for (const pl of plData.playlists || []) {
        for (const item of pl.items || []) {
          const t = item.track;
          if (t && t.trackUri && !existingUris.has(t.trackUri)) {
            existingUris.add(t.trackUri);
            rawTracks.push({
              uri: t.trackUri,
              artist: t.artistName || 'Unknown Artist',
              track: t.trackName || 'Unknown Track',
              album: t.albumName || '',
            });
          }
        }
      }
    } catch (err) {
      console.warn(`[WARN] Could not parse Playlist1.json: ${err.message}`);
    }
  }

  let manifest = [];
  if (fs.existsSync(MANIFEST_FILE)) {
    try {
      manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
    } catch (err) {
      console.warn(`[WARN] Could not parse existing manifest, creating backup. Error: ${err.message}`);
      fs.copyFileSync(MANIFEST_FILE, `${MANIFEST_FILE}.bak`);
      manifest = [];
    }
  }

  const manifestMap = new Map();
  for (const item of manifest) {
    if (item.uri) manifestMap.set(item.uri, item);
  }

  const updatedManifest = rawTracks.map((t, idx) => {
    const existing = manifestMap.get(t.uri);
    if (existing) {
      return {
        ...existing,
        index: idx,
        artist: t.artist || existing.artist,
        track: t.track || existing.track,
        album: t.album || existing.album,
      };
    }

    return {
      index: idx,
      uri: t.uri || `track_${idx}`,
      artist: t.artist || 'Unknown Artist',
      track: t.track || 'Unknown Track',
      album: t.album || '',
      status: 'pending', // 'pending' | 'downloaded' | 'failed' | 'skipped'
      videoId: t.pinnedVideoId || null,
      videoTitle: t.pinnedTitle || null,
      channel: t.pinnedChannel || null,
      durationText: t.pinnedDuration || null,
      durationSeconds: null,
      localFile: null,
      fileSizeBytes: null,
      downloadedAt: null,
      attempts: 0,
      lastError: null,
    };
  });

  // Verify against audio folder on disk
  if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
  }

  const diskFiles = fs.readdirSync(AUDIO_DIR);
  const diskFileMap = new Map();
  for (const f of diskFiles) {
    const base = path.basename(f, path.extname(f));
    const full = path.join(AUDIO_DIR, f);
    try {
      const stat = fs.statSync(full);
      if (stat.isFile() && stat.size > 50000) {
        diskFileMap.set(base, { filename: f, size: stat.size });
      }
    } catch {
      // ignore
    }
  }

  for (const item of updatedManifest) {
    if (item.videoId && diskFileMap.has(item.videoId)) {
      const diskInfo = diskFileMap.get(item.videoId);
      item.status = 'downloaded';
      item.localFile = diskInfo.filename;
      item.fileSizeBytes = diskInfo.size;
    }
  }

  saveManifest(updatedManifest);
  return updatedManifest;
}

function saveManifest(manifest) {
  try {
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf8');
  } catch (err) {
    console.error(`[ERROR] Failed to save manifest: ${err.message}`);
  }
}

// Print status summary
function printStatus(manifest) {
  const total = manifest.length;
  const downloaded = manifest.filter((m) => m.status === 'downloaded');
  const pending = manifest.filter((m) => m.status === 'pending');
  const failed = manifest.filter((m) => m.status === 'failed');

  let totalBytes = 0;
  for (const d of downloaded) {
    totalBytes += d.fileSizeBytes || 0;
  }

  const percent = total > 0 ? ((downloaded.length / total) * 100).toFixed(1) : 0;

  console.log('\n======================================================');
  console.log('🎵 BANDITA PLAYER: ОФФЛАЙН-БИБЛИОТЕКА (СТАТИСТИКА)');
  console.log('======================================================');
  console.log(`Всего треков:         ${total}`);
  console.log(`✅ Скачано:           ${downloaded.length} (${percent}%)`);
  console.log(`⏳ В очереди:         ${pending.length}`);
  console.log(`❌ Ошибок/Пропущено:   ${failed.length}`);
  console.log(`💾 Размер на диске:    ${formatBytes(totalBytes)}`);
  console.log(`📁 Папка аудио:       ${AUDIO_DIR}`);
  console.log('======================================================\n');
}

// Sync pinned tracks back into YourLibrary.json
function syncLibrary(manifest) {
  if (!fs.existsSync(LIBRARY_FILE)) return;
  const libData = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
  const tracks = libData.tracks || [];

  const manifestMap = new Map();
  for (const item of manifest) {
    if (item.status === 'downloaded' && item.videoId) {
      manifestMap.set(item.uri, item);
    }
  }

  let synced = 0;
  for (const t of tracks) {
    const item = manifestMap.get(t.uri);
    if (item) {
      t.pinnedVideoId = item.videoId;
      t.pinnedTitle = item.videoTitle || t.track;
      t.pinnedChannel = item.channel || t.artist;
      t.pinnedDuration = item.durationText || '';
      synced++;
    }
  }

  fs.writeFileSync(LIBRARY_FILE, JSON.stringify(libData, null, 2), 'utf8');
  console.log(`[SYNC] Синхронизировано ${synced} треков с YourLibrary.json`);
}

// Build yt-dlp format string
function getFormatSelector(format) {
  switch (format) {
    case 'm4a':
      return '140/ba[ext=m4a]/ba';
    case 'mp3':
      return 'ba/b';
    case 'webm':
    default:
      return '251/ba[ext=webm]/ba';
  }
}

function cleanQueryString(artist, track) {
  const cleanTrack = track
    .replace(/\s*\/.*$/, '')
    .replace(/\s*-\s*(Radio Edit|Single|Extended Mix|Mixed|Remastered|Original Mix).*$/i, '')
    .replace(/\s*\(.*?\)/g, '')
    .replace(/\s*\[.*?\]/g, '')
    .trim();
  return `${artist} ${cleanTrack}`.trim();
}

// Download a single track using yt-dlp with fallback queries & retry
async function downloadTrack(item, options) {
  const cleanTitle = cleanQueryString(item.artist, item.track);
  const queries = [
    `${item.artist} ${item.track} audio`,
    `${cleanTitle} audio`,
    cleanTitle,
  ];

  if (item.album) {
    queries.push(`${cleanTitle} ${item.album}`);
  }

  // Deduplicate queries
  const uniqueQueries = Array.from(new Set(queries.filter(Boolean)));
  let lastErr = null;

  for (let qIdx = 0; qIdx < uniqueQueries.length; qIdx++) {
    const query = uniqueQueries[qIdx];
    const res = await executeYtDlpDownload(item, query, options);

    if (res.rateLimited) {
      return res; // Stop immediately on rate limit / bot check
    }

    if (res.success) {
      // Validate: full song must be >= 40s and >= 400KB
      if (res.durationSec < 40 || (!options.dryRun && res.fileSizeBytes < 400000)) {
        console.warn(`[WARN] Трек "${res.videoTitle}" подозрительно короткий/маленький (${res.durationSec}s, ${formatBytes(res.fileSizeBytes)}), пробуем альтернативный поиск...`);
        if (res.localFile) {
          try {
            fs.unlinkSync(path.join(AUDIO_DIR, res.localFile));
          } catch {}
        }
        continue;
      }
      return res;
    }

    lastErr = res.error;
    // If transient error or not found, try next query after brief pause
    if (qIdx < uniqueQueries.length - 1) {
      await sleep(1500);
    }
  }

  return {
    success: false,
    rateLimited: false,
    error: lastErr || 'No matches found',
  };
}

function executeYtDlpDownload(item, query, options) {
  return new Promise((resolve) => {
    const formatSpec = getFormatSelector(options.format);
    const outTemplate = path.join(AUDIO_DIR, '%(id)s.%(ext)s');

    const args = [
      '--proxy', options.proxy,
      '--js-runtimes', 'node',
      '--no-playlist',
      '--retries', '3',
      '--fragment-retries', '3',
      '--limit-rate', options.rateLimit,
      '--match-filter', `duration >= 40 & duration <= ${options.maxDuration} & !is_live`,
      '-f', formatSpec,
      '-o', outTemplate,
    ];

    if (options.dryRun) {
      args.push('--simulate');
    } else {
      args.push('--no-simulate');
    }

    args.push(
      '--max-downloads', '1',
      '--print', 'RESULT:%(id)s|||%(title)s|||%(uploader)s|||%(duration)s',
      `ytsearch5:${query}`
    );

    const child = spawn(YT_DLP_BIN, args, {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));

    child.on('close', (code) => {
      const isRateLimited =
        stderr.includes('429') ||
        stderr.includes('Too Many Requests') ||
        stderr.includes('Sign in to confirm you’re not a bot') ||
        stdout.includes('Sign in to confirm you’re not a bot');

      if (isRateLimited) {
        return resolve({
          success: false,
          rateLimited: true,
          error: 'Rate limit / Bot check detected (HTTP 429)',
        });
      }

      const resultMatch = stdout.match(/RESULT:(.+?)\|\|\|(.+?)\|\|\|(.+?)\|\|\|(\d+)/);
      if ((code === 0 || code === 101) && resultMatch) {
        const videoId = resultMatch[1].trim();
        const videoTitle = resultMatch[2].trim();
        const channel = resultMatch[3].trim();
        const durationSec = parseInt(resultMatch[4].trim(), 10);
        const durationText = formatDuration(durationSec);

        let localFile = null;
        let fileSizeBytes = 0;

        if (!options.dryRun) {
          const expectedExtensions = ['.webm', '.m4a', '.mp3', '.ogg'];
          for (const ext of expectedExtensions) {
            const checkPath = path.join(AUDIO_DIR, `${videoId}${ext}`);
            if (fs.existsSync(checkPath)) {
              localFile = `${videoId}${ext}`;
              fileSizeBytes = fs.statSync(checkPath).size;
              break;
            }
          }
        }

        return resolve({
          success: true,
          videoId,
          videoTitle,
          channel,
          durationSec,
          durationText,
          localFile,
          fileSizeBytes,
        });
      }

      const errDetail = stderr.trim().split('\n').slice(-3).join(' ') || `yt-dlp exited with code ${code}`;
      resolve({
        success: false,
        rateLimited: false,
        error: errDetail,
      });
    });

    child.on('error', (err) => {
      resolve({
        success: false,
        rateLimited: false,
        error: err.message,
      });
    });
  });
}

// Queue execution with concurrency and jitter
async function runBatch(itemsToProcess, manifest, options) {
  let completedCount = 0;
  let activeWorkers = 0;
  let indexInQueue = 0;
  let hasEncounteredRateLimit = false;

  console.log(`\n🚀 Запуск пачки: ${itemsToProcess.length} треков`);
  console.log(`⚙️ Параллельность: ${options.concurrency} | Задержка: ${options.delayMin}-${options.delayMax} сек | Лимит: ${options.rateLimit}`);
  console.log(`🌐 Прокси: ${options.proxy} | Формат: ${options.format.toUpperCase()}\n`);

  return new Promise((resolve) => {
    function processNext() {
      if (hasEncounteredRateLimit) {
        if (activeWorkers === 0) resolve({ rateLimited: true });
        return;
      }

      if (indexInQueue >= itemsToProcess.length) {
        if (activeWorkers === 0) resolve({ rateLimited: false });
        return;
      }

      const item = itemsToProcess[indexInQueue++];
      activeWorkers++;

      (async () => {
        // Random jitter before download
        const jitterMs = randomJitter(options.delayMin, options.delayMax);
        console.log(`[#${item.index + 1}/${manifest.length}] Ожидание ${(jitterMs / 1000).toFixed(1)}s: "${item.artist} - ${item.track}"...`);
        await sleep(jitterMs);

        if (hasEncounteredRateLimit) {
          activeWorkers--;
          processNext();
          return;
        }

        const t0 = Date.now();
        item.attempts = (item.attempts || 0) + 1;
        const res = await downloadTrack(item, options);
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

        if (res.rateLimited) {
          hasEncounteredRateLimit = true;
          item.lastError = res.error;
          console.error(`\n⚠️ [RATE LIMIT ALERT] YouTube вернул 429 или капчу на треке #${item.index + 1}!`);
          console.error(`Останавливаем текущую пачку для защиты от блокировки.\n`);
          activeWorkers--;
          saveManifest(manifest);
          if (activeWorkers === 0) resolve({ rateLimited: true });
          return;
        }

        if (res.success) {
          item.status = 'downloaded';
          item.videoId = res.videoId;
          item.videoTitle = res.videoTitle;
          item.channel = res.channel;
          item.durationSeconds = res.durationSec;
          item.durationText = res.durationText;
          item.localFile = res.localFile;
          item.fileSizeBytes = res.fileSizeBytes;
          item.downloadedAt = Date.now();
          item.lastError = null;

          completedCount++;
          console.log(
            `✅ [#${item.index + 1}] [${elapsed}s] "${item.artist} - ${item.track}" -> ${res.videoTitle} (${formatBytes(res.fileSizeBytes)})`
          );
        } else {
          item.status = 'failed';
          item.lastError = res.error;
          console.warn(`❌ [#${item.index + 1}] Ошибка "${item.artist} - ${item.track}": ${res.error.slice(0, 100)}`);
        }

        saveManifest(manifest);
        activeWorkers--;
        processNext();
      })();
    }

    for (let i = 0; i < options.concurrency; i++) {
      processNext();
    }
  });
}

// Main runner
async function main() {
  const options = parseArgs();

  if (options.help) {
    console.log(`
Использование: node scripts/download-tracks.mjs [параметры]

Параметры:
  --status                 Показать статус загрузки библиотеки и размер файлов
  --batch-size <число>     Размер пачки (по умолчанию: 25 треков)
  --batch <номер>          Номер конкретной пачки (1, 2, 3...)
  --limit <число>          Максимальное число треков для обработки за раз (для тестов)
  --offset <число>         Начать с указанного индекса трека
  --concurrency <число>    Количество параллельных потоков (по умолчанию: 2)
  --delay-min <секунды>    Минимальная пауза между треками (по умолчанию: 3)
  --delay-max <секунды>    Максимальная пауза между треками (по умолчанию: 7)
  --cooldown <секунды>     Пауза между пачками в auto-loop (по умолчанию: 120)
  --rate-limit <скорость>  Ограничение скорости yt-dlp (по умолчанию: 2M)
  --format <webm|m4a|mp3>  Формат аудио (по умолчанию: webm Opus 160k)
  --proxy <URL>            HTTP/SOCKS прокси (по умолчанию: http://127.0.0.1:10809)
  --auto-loop              Непрерывный цикл по пачкам с кулдауном
  --sync-library           Записать pinnedVideoId в YourLibrary.json
  --dry-run                Тестовый поиск без загрузки аудио
    `);
    process.exit(0);
  }

  const manifest = loadOrCreateManifest();

  if (options.status) {
    printStatus(manifest);
    process.exit(0);
  }

  const onlySyncRequested = process.argv.slice(2).every((a) => a === '--sync-library');
  if (options.syncLibrary && onlySyncRequested) {
    syncLibrary(manifest);
    process.exit(0);
  }

  // Graceful shutdown handling
  let isExiting = false;
  const onSignal = () => {
    if (isExiting) process.exit(1);
    isExiting = true;
    console.log('\n\n[INFO] Прерывание процесса... Сохраняю манифест...');
    saveManifest(manifest);
    syncLibrary(manifest);
    printStatus(manifest);
    process.exit(0);
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  printStatus(manifest);

  // Filter items to download
  let queue = [];

  if (options.batchIndex !== null) {
    const start = (options.batchIndex - 1) * options.batchSize;
    const end = start + options.batchSize;
    queue = manifest.slice(start, end).filter((m) => m.status !== 'downloaded');
    console.log(`[INFO] Выбрана пачка #${options.batchIndex} (индексы ${start}..${end - 1}, к загрузке: ${queue.length})`);
  } else {
    // Pick pending or single-attempt failed items starting from offset
    const available = manifest.slice(options.offset).filter(
      (m) => m.status === 'pending' || (m.status === 'failed' && (m.attempts || 0) < 2)
    );
    const take = options.limit ? options.limit : options.batchSize;
    queue = available.slice(0, take);
  }

  if (queue.length === 0) {
    console.log('🎉 Все запрошенные треки уже скачаны!');
    syncLibrary(manifest);
    process.exit(0);
  }

  if (options.autoLoop || (options.limit && options.limit > options.batchSize)) {
    const totalToProcess = options.limit || Infinity;
    let processedCount = 0;
    console.log(`[BATCH-RUNNER] Запуск загрузки ${totalToProcess === Infinity ? 'всех оставшихся' : totalToProcess} треков пачками по ${options.batchSize} с кулдауном ${options.cooldown}s.`);

    while (processedCount < totalToProcess) {
      const pendingItems = manifest.filter(
        (m) => m.status === 'pending' || (m.status === 'failed' && (m.attempts || 0) < 2)
      );
      if (pendingItems.length === 0) {
        console.log('🎉 Поздравляем! Все доступные треки успешно скачаны!');
        break;
      }

      const chunkSize = Math.min(options.batchSize, totalToProcess - processedCount);
      const currentBatch = pendingItems.slice(0, chunkSize);
      const res = await runBatch(currentBatch, manifest, options);
      processedCount += currentBatch.length;
      syncLibrary(manifest);

      if (res.rateLimited) {
        console.log(`[COOLOFF] Пауза на 10 минут из-за ограничения YouTube...`);
        await sleep(10 * 60 * 1000);
      } else {
        const remaining = manifest.filter((m) => m.status !== 'downloaded').length;
        if (remaining > 0 && processedCount < totalToProcess) {
          console.log(`\n⏳ Пачка завершена (${processedCount}/${totalToProcess} треков). Пауза отдыха (cooldown) ${options.cooldown} секунд...`);
          console.log(`Осталось в общей библиотеке: ${remaining} / ${manifest.length}`);
          await sleep(options.cooldown * 1000);
        }
      }
    }
  } else {
    const res = await runBatch(queue, manifest, options);
    syncLibrary(manifest);

    if (res.rateLimited) {
      console.log('\n[ALERT] Обнаружен 429. Рекомендуется подождать 1-2 часа перед следующим запуском.');
    }
  }

  printStatus(manifest);
}

main().catch((err) => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
