import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const DEFAULTS_DIR = path.resolve(ROOT_DIR, 'defaults/default');
const PLAYLISTS_FILE = path.resolve(DEFAULTS_DIR, 'Playlist1.json');
const LIBRARY_FILE = path.resolve(DEFAULTS_DIR, 'YourLibrary.json');
const MANIFEST_FILE = path.resolve(DEFAULTS_DIR, 'download_manifest.json');
const PROFILE_FILE = path.resolve(DEFAULTS_DIR, 'profile.json');

const VIBE_ROOMER_TRACKS = [
  {
    artist: 'Lost In Drifts',
    track: 'Sleepy Hollow (Headless Horseman Ambience & Music)',
    album: 'Sleepy Hollow Legend',
    uri: 'spotify:track:5vAoHtKOiw0oVibeRoomer01',
    videoId: 'vAoHtkOiw0o',
    videoTitle: 'Sleepy Hollow 🎃🐎 | Headless Horseman Ambience & Music',
    channel: 'Lost In Drifts',
    durationText: '3:00:00',
    durationSeconds: 10800
  },
  {
    artist: 'Cozy Cottage',
    track: 'Cozy Autumn Village Halloween Ambience',
    album: 'Autumn Village Halloween',
    uri: 'spotify:track:6vuPhCSunt5UVibeRoomer02',
    videoId: 'vuPhCSunt5U',
    videoTitle: 'Cozy Autumn Village Halloween Ambience 🎃 Scary Halloween Sounds',
    channel: 'Cozy Cottage',
    durationText: '1:19:35',
    durationSeconds: 4775
  },
  {
    artist: 'Lofi Girl',
    track: '8h of Halloween Lofi (Spooky Ambience To Get Chills To)',
    album: 'Halloween Lofi 2024',
    uri: 'spotify:track:7vadHXNBy4jQVibeRoomer03',
    videoId: 'vadHXNBy4jQ',
    videoTitle: '8h of halloween lofi 🎃 spooky ambience to get chills to',
    channel: 'Lofi Girl',
    durationText: '8:00:00',
    durationSeconds: 28800
  },
  {
    artist: 'The Pixel Window',
    track: 'Cozy Ghost Lofi (Pixel Art Corn Field Ambience)',
    album: 'Cozy Ghost Pixel Art',
    uri: 'spotify:track:8iRrtW8NsrIYVibeRoomer04',
    videoId: 'iRrtW8NsrIY',
    videoTitle: 'Cozy Ghost Lofi Pixel Art Corn Field Ambience 🎃 Spooky Halloween Beats for Study & Chill (3 Hours)',
    channel: 'The Pixel Window',
    durationText: '3:00:00',
    durationSeconds: 10800
  },
  {
    artist: 'Lofi Girl',
    track: 'Lofi Girl - Halloween Special Edition',
    album: 'Halloween Lofi Special',
    uri: 'spotify:track:90MiR7bC9B5oVibeRoomer05',
    videoId: '0MiR7bC9B5o',
    videoTitle: 'Lofi Girl - Halloween 2023 🎃',
    channel: 'Lofi Girl',
    durationText: '1:13:28',
    durationSeconds: 4408
  },
  {
    artist: 'Cozy Cottage',
    track: 'Cozy Witch Cottage (Fireplace, Rain & Distant Thunder)',
    album: 'Cozy Witch Cottage Ambience',
    uri: 'spotify:track:1g2Ytq8atf70VibeRoomer06',
    videoId: 'g2Ytq8atf70',
    videoTitle: 'Cozy Witch Cottage - Halloween Ambience with Fireplace, Rain, & Distant Thunder for Relaxation',
    channel: 'Cozy Cottage',
    durationText: '8:03:01',
    durationSeconds: 28981
  }
];

function main() {
  console.log('=== Adding Vibe Roomer Halloween Playlist & Tracks ===\n');

  // 1. Update Playlist1.json
  const plData = JSON.parse(fs.readFileSync(PLAYLISTS_FILE, 'utf8'));
  const PLAYLIST_NAME = 'Halloween: Vibe Roomer Ambience';

  const existingPlIdx = plData.playlists.findIndex(p => p.name === PLAYLIST_NAME);
  const newPlaylist = {
    name: PLAYLIST_NAME,
    lastModifiedDate: '2026-10-31',
    collaborators: [],
    items: VIBE_ROOMER_TRACKS.map(t => ({
      track: {
        trackName: t.track,
        artistName: t.artist,
        albumName: t.album,
        trackUri: t.uri
      },
      addedDate: '2026-10-31'
    })),
    numberOfFollowers: 0
  };

  if (existingPlIdx >= 0) {
    plData.playlists[existingPlIdx] = newPlaylist;
    console.log(`[Playlists] Updated existing "${PLAYLIST_NAME}" playlist.`);
  } else {
    // Add right next to the other Halloween playlist at index 1
    plData.playlists.splice(1, 0, newPlaylist);
    console.log(`[Playlists] Added new playlist "${PLAYLIST_NAME}" (Total: ${plData.playlists.length} playlists).`);
  }
  fs.writeFileSync(PLAYLISTS_FILE, JSON.stringify(plData, null, 2), 'utf8');

  // 2. Update YourLibrary.json
  const libData = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
  const existingUris = new Set(libData.tracks.map(t => t.uri));
  const existingNames = new Set(libData.tracks.map(t => `${t.artist.toLowerCase()}|${t.track.toLowerCase()}`));

  let addedToLib = 0;
  for (const t of VIBE_ROOMER_TRACKS) {
    const nameKey = `${t.artist.toLowerCase()}|${t.track.toLowerCase()}`;
    if (!existingUris.has(t.uri) && !existingNames.has(nameKey)) {
      libData.tracks.push({
        artist: t.artist,
        album: t.album,
        track: t.track,
        uri: t.uri,
        pinnedVideoId: t.videoId,
        pinnedTitle: t.videoTitle,
        pinnedChannel: t.channel,
        pinnedDuration: t.durationText
      });
      existingUris.add(t.uri);
      existingNames.add(nameKey);
      addedToLib++;
    }
  }
  console.log(`[YourLibrary] Added ${addedToLib} tracks to YourLibrary.json (Total: ${libData.tracks.length} tracks).`);
  fs.writeFileSync(LIBRARY_FILE, JSON.stringify(libData, null, 2), 'utf8');

  // 3. Update download_manifest.json
  if (fs.existsSync(MANIFEST_FILE)) {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
    const manifestMap = new Map();
    for (const item of manifest) {
      if (item.uri) manifestMap.set(item.uri, item);
      if (item.videoId) manifestMap.set(item.videoId, item);
    }

    let manifestAdded = 0;
    for (const t of VIBE_ROOMER_TRACKS) {
      if (!manifestMap.has(t.uri) && !manifestMap.has(t.videoId)) {
        manifest.push({
          index: manifest.length,
          uri: t.uri,
          artist: t.artist,
          track: t.track,
          album: t.album,
          status: 'pending',
          videoId: t.videoId,
          videoTitle: t.videoTitle,
          channel: t.channel,
          durationText: t.durationText,
          durationSeconds: t.durationSeconds,
          localFile: `${t.videoId}.webm`,
          fileSizeBytes: 0,
          downloadedAt: null,
          attempts: 0,
          lastError: null
        });
        manifestAdded++;
      }
    }
    console.log(`[Manifest] Added ${manifestAdded} tracks to download_manifest.json (Total: ${manifest.length}).`);
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf8');
  }

  // 4. Update profile.json description
  if (fs.existsSync(PROFILE_FILE)) {
    const profile = JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf8'));
    profile.description = `Default pre-bundled music collection with ${libData.tracks.length} tracks and ${plData.playlists.length} playlists`;
    fs.writeFileSync(PROFILE_FILE, JSON.stringify(profile, null, 2), 'utf8');
    console.log(`[Profile] Updated profile.json description (${plData.playlists.length} playlists).`);
  }

  console.log('\nVibe Roomer Halloween playlist created and added to library successfully!');
}

main();
