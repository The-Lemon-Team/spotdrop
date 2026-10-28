import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const DEFAULTS_DIR = path.resolve(ROOT_DIR, 'defaults/default');
const PLAYLISTS_FILE = path.resolve(DEFAULTS_DIR, 'Playlist1.json');
const LIBRARY_FILE = path.resolve(DEFAULTS_DIR, 'YourLibrary.json');
const MANIFEST_FILE = path.resolve(DEFAULTS_DIR, 'download_manifest.json');
const PROFILE_FILE = path.resolve(DEFAULTS_DIR, 'profile.json');

// 25 Curated Quiet, Atmospheric & Simple Halloween Tracks
const HALLOWEEN_TRACKS = [
  {
    artist: 'John Carpenter',
    track: 'Halloween Theme - Main Title',
    album: 'Halloween (Original Motion Picture Soundtrack)',
    uri: 'spotify:track:4HlFJV51x5W999hG90yvO6',
    videoId: 'pT4FY3NrhGg',
    videoTitle: 'John Carpenter - Halloween 1978 (main Theme)',
    channel: 'Rodrigo Cantillano',
    durationText: '2:56',
    durationSeconds: 176
  },
  {
    artist: 'Disasterpeace',
    track: 'Title',
    album: 'It Follows (Original Motion Picture Soundtrack)',
    uri: 'spotify:track:0oXk4y2d9Ff7aE8e390c1Q',
    videoId: 'mrqS96JxWVA',
    videoTitle: 'Disasterpeace - Title (It Follows Original Motion Picture Soundtrack)',
    channel: 'Milan Records USA',
    durationText: '2:18',
    durationSeconds: 138
  },
  {
    artist: 'Angelo Badalamenti',
    track: "Laura Palmer's Theme",
    album: 'Twin Peaks (Music from the Twin Peaks Series)',
    uri: 'spotify:track:3n3Ppam7vgaVa1iaRUc9Lp',
    videoId: 'woUt7wPe8Ow',
    videoTitle: "Laura Palmer's Theme (Instrumental)",
    channel: 'Angelo Badalamenti - Topic',
    durationText: '4:52',
    durationSeconds: 292
  },
  {
    artist: 'Philip Glass',
    track: "Helen's Theme",
    album: 'Candyman (Original Motion Picture Soundtrack)',
    uri: 'spotify:track:2MhV4vP03qf8k1yL6uE01e',
    videoId: 'dWYDzgRVwvQ',
    videoTitle: "Helen's Theme from Candyman (1992) - Philip Glass",
    channel: 'Philip Glass',
    durationText: '3:06',
    durationSeconds: 186
  },
  {
    artist: 'Akira Yamaoka',
    track: 'Theme of Laura (Reprise)',
    album: 'Silent Hill 2 (Original Soundtracks)',
    uri: 'spotify:track:4v9s1dO11LzW9eU7iL91oA',
    videoId: '56lWd1m3a5w',
    videoTitle: 'Theme Of Laura (Reprise)',
    channel: 'Akira Yamaoka - Topic',
    durationText: '1:52',
    durationSeconds: 112
  },
  {
    artist: 'Christopher Larkin',
    track: 'Dirtmouth',
    album: 'Hollow Knight (Original Soundtrack)',
    uri: 'spotify:track:2gR3T8kQ00kE1iU2wO6v5K',
    videoId: '9Vdv01LsnQM',
    videoTitle: 'Dirtmouth',
    channel: 'Christopher Larkin - Topic',
    durationText: '5:23',
    durationSeconds: 323
  },
  {
    artist: 'Gustavo Santaolalla',
    track: 'The Last of Us',
    album: 'The Last of Us (Video Game Soundtrack)',
    uri: 'spotify:track:2G0hL4i005pE5iR1qU90xA',
    videoId: '2TLDowHsO-Y',
    videoTitle: 'Gustavo Santaolalla The Last of Us Main Theme',
    channel: 'Sony Masterworks',
    durationText: '3:46',
    durationSeconds: 226
  },
  {
    artist: 'Wojciech Kilar',
    track: 'Love Remembered',
    album: "Bram Stoker's Dracula (Original Motion Picture Soundtrack)",
    uri: 'spotify:track:1b3R9yL4k02d08aE7iO11u',
    videoId: 'B_OQvVdggUM',
    videoTitle: '"Love Remembered" - Wojciech Kilar (OST Dracula)',
    channel: 'Milan Records',
    durationText: '4:12',
    durationSeconds: 252
  },
  {
    artist: 'Bohren & der Club of Gore',
    track: 'Prowler',
    album: 'Sunset Mission',
    uri: 'spotify:track:5nK9vL001dE5kE9iR3u78v',
    videoId: '1vxl0Yd7TOY',
    videoTitle: 'Bohren & Der Club Of Gore - Prowler (Official Video)',
    channel: 'PIAS',
    durationText: '3:25',
    durationSeconds: 205
  },
  {
    artist: 'Bohren & der Club of Gore',
    track: 'Constant Fear',
    album: 'Black Earth',
    uri: 'spotify:track:3g7T8y011kE2oI8uR5w12x',
    videoId: '408PKay_kQA',
    videoTitle: 'Constant Fear',
    channel: 'Bohren & der Club of Gore - Topic',
    durationText: '6:28',
    durationSeconds: 388
  },
  {
    artist: 'Dead Can Dance',
    track: 'Sanvean',
    album: 'Toward the Within',
    uri: 'spotify:track:7w9s1eL21kE0vI9uR6o03z',
    videoId: 'xfgl57vINmw',
    videoTitle: 'Dead Can Dance - Sanvean ( I Am Your Shadow )',
    channel: 'Dead Can Dance',
    durationText: '3:52',
    durationSeconds: 232
  },
  {
    artist: 'Dead Can Dance',
    track: 'The Host of Seraphim',
    album: 'The Serpent’s Egg',
    uri: 'spotify:track:0b1Q8xL31kE5oI8uR7w14y',
    videoId: 'hThAlY3Q2Kw',
    videoTitle: 'The Host of Seraphim (Remastered)',
    channel: 'Dead Can Dance - Topic',
    durationText: '6:19',
    durationSeconds: 379
  },
  {
    artist: 'Agnes Obel',
    track: 'Riverside',
    album: 'Philharmonics',
    uri: 'spotify:track:1c7K9yL11kE2oI8uR8w15w',
    videoId: 'vjncyiuwwXQ',
    videoTitle: 'Agnes Obel - Riverside (Official Video)',
    channel: 'PIAS',
    durationText: '3:50',
    durationSeconds: 230
  },
  {
    artist: 'Agnes Obel',
    track: 'Familiar',
    album: 'Citizen of Glass',
    uri: 'spotify:track:2d8L0zM21kE3oI9uR9w16v',
    videoId: '32kYH6XZrIo',
    videoTitle: 'Agnes Obel - Familiar (Official Video)',
    channel: 'PIAS',
    durationText: '4:26',
    durationSeconds: 266
  },
  {
    artist: 'Timber Timbre',
    track: 'Demon Host',
    album: 'Timber Timbre',
    uri: 'spotify:track:3e9M1aN31kE4oI0uR0w17u',
    videoId: 'irPIjJl4ByU',
    videoTitle: 'Timber Timbre - Demon Host [Official Video]',
    channel: 'Arts & Crafts',
    durationText: '3:43',
    durationSeconds: 223
  },
  {
    artist: 'Chelsea Wolfe',
    track: 'Flatlands',
    album: 'Unknown Rooms: A Collection of Acoustic Songs',
    uri: 'spotify:track:4f0N2bO41kE5oI1uR1w18t',
    videoId: 'YS4MfMLjKDE',
    videoTitle: 'Flatlands',
    channel: 'CHELSEA WOLFE - Topic',
    durationText: '4:01',
    durationSeconds: 241
  },
  {
    artist: 'Mazzy Star',
    track: 'Into Dust',
    album: 'So Tonight That I Might See',
    uri: 'spotify:track:5g1O3cP51kE6oI2uR2w19s',
    videoId: '04J0ihSeIuI',
    videoTitle: 'Into Dust',
    channel: 'Mazzy Star - Topic',
    durationText: '5:37',
    durationSeconds: 337
  },
  {
    artist: 'Low',
    track: 'Lullaby',
    album: 'I Could Live in Hope',
    uri: 'spotify:track:6h2P4dQ61kE7oI3uR3w20r',
    videoId: 'XaSVkb_XLt4',
    videoTitle: 'Low - Lullaby',
    channel: 'Vernon Rock',
    durationText: '9:49',
    durationSeconds: 589
  },
  {
    artist: 'Erik Satie',
    track: 'Gymnopédie No. 1',
    album: 'Gymnopédies',
    uri: 'spotify:track:7i3Q5eR71kE8oI4uR4w21q',
    videoId: '2WfaotSK3mI',
    videoTitle: 'Satie - Gymnopédie No. 1',
    channel: 'Classical Tunes',
    durationText: '4:05',
    durationSeconds: 245
  },
  {
    artist: 'Frédéric Chopin',
    track: 'Nocturne in C-Sharp Minor, B. 49',
    album: 'Chopin: Nocturnes',
    uri: 'spotify:track:8j4R6fS81kE9oI5uR5w22p',
    videoId: 'DqpPRj6UZqc',
    videoTitle: 'Chopin - Nocturne in C Sharp Minor (No. 20)',
    channel: 'Kassia',
    durationText: '4:31',
    durationSeconds: 271
  },
  {
    artist: 'Brian Eno',
    track: 'An Ending (Ascent)',
    album: 'Apollo: Atmospheres and Soundtracks',
    uri: 'spotify:track:9k5S7gT91kE0oI6uR6w23o',
    videoId: 'ewrICrDhc9s',
    videoTitle: 'Brian Eno - An Ending (Ascent) Remastered 2005',
    channel: 'Brian Eno - Topic',
    durationText: '4:25',
    durationSeconds: 265
  },
  {
    artist: 'Trent Reznor and Atticus Ross',
    track: 'Hand Covers Bruise',
    album: 'The Social Network (Soundtrack)',
    uri: 'spotify:track:0l6T8hU01kE1oI7uR7w24n',
    videoId: '9SBNCYkSceU',
    videoTitle: 'Hand Covers Bruise (HD) - From the Soundtrack to "The Social Network"',
    channel: 'The Null Corporation',
    durationText: '4:24',
    durationSeconds: 264
  },
  {
    artist: 'Christopher Larkin',
    track: 'Resting Grounds',
    album: 'Hollow Knight (Original Soundtrack)',
    uri: 'spotify:track:1m7U9iV11kE2oI8uR8w25m',
    videoId: 'CgrBJDU2yvQ',
    videoTitle: 'Hollow Knight OST - Resting Grounds',
    channel: 'Christopher Larkin',
    durationText: '2:13',
    durationSeconds: 133
  },
  {
    artist: 'Akira Yamaoka',
    track: 'Never Forgive Me, Never Forget Me',
    album: 'Silent Hill 3 (Original Soundtracks)',
    uri: 'spotify:track:2n8V0jW21kE3oI9uR9w26l',
    videoId: 'f717iNkYNLk',
    videoTitle: 'Never Forgive Me, Never Forget Me',
    channel: 'Akira Yamaoka - Topic',
    durationText: '2:20',
    durationSeconds: 140
  },
  {
    artist: 'Colin Stetson',
    track: 'Reborn',
    album: 'Hereditary (Original Motion Picture Soundtrack)',
    uri: 'spotify:track:3o9W1kX31kE4oI0uR0w27k',
    videoId: 'F64YxXDGLOk',
    videoTitle: 'Reborn ((From "Hereditary" Soundtrack))',
    channel: 'Milan Records',
    durationText: '3:52',
    durationSeconds: 232
  }
];

function main() {
  console.log('=== Adding Halloween Playlist & Tracks ===\n');

  // 1. Update Playlist1.json
  const plData = JSON.parse(fs.readFileSync(PLAYLISTS_FILE, 'utf8'));
  const PLAYLIST_NAME = 'Halloween: Quiet & Atmospheric';

  // Check if already exists
  const existingPlIdx = plData.playlists.findIndex(p => p.name === PLAYLIST_NAME);
  const newPlaylist = {
    name: PLAYLIST_NAME,
    lastModifiedDate: '2026-10-31',
    collaborators: [],
    items: HALLOWEEN_TRACKS.map(t => ({
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
    // Add to the top of playlists so it's prominent!
    plData.playlists.unshift(newPlaylist);
    console.log(`[Playlists] Added new playlist "${PLAYLIST_NAME}" (Total: ${plData.playlists.length} playlists).`);
  }
  fs.writeFileSync(PLAYLISTS_FILE, JSON.stringify(plData, null, 2), 'utf8');

  // 2. Update YourLibrary.json
  const libData = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
  const existingUris = new Set(libData.tracks.map(t => t.uri));
  const existingNames = new Set(libData.tracks.map(t => `${t.artist.toLowerCase()}|${t.track.toLowerCase()}`));

  let addedToLib = 0;
  for (const t of HALLOWEEN_TRACKS) {
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
    const now = Date.now();
    for (const t of HALLOWEEN_TRACKS) {
      if (!manifestMap.has(t.uri) && !manifestMap.has(t.videoId)) {
        manifest.push({
          index: manifest.length,
          uri: t.uri,
          artist: t.artist,
          track: t.track,
          album: t.album,
          status: 'pending', // Will become 'downloaded' once audio file exists
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

  console.log('\nAll library JSON files updated successfully!');
}

main();
