import { db, getCurrentProfile, setCurrentProfile } from '../db/banditaDb';
import type { TrackCell, Playlist, MusicProfile } from '../types';
import { apiFetch } from '../auth/authManager';

export function normalizeTagName(name: string): string {
  const clean = name
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]/gi, ' ')
    .trim()
    .split(/\s+/)
    .find((word) => word.length > 2);

  return clean ? `#${clean}` : '';
}

export function artistToTag(artist: string): string {
  const clean = artist
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]/gi, '')
    .slice(0, 15);

  return clean.length > 0 ? `#${clean}` : '';
}

interface RawSpotifyPlaylistsExport {
  playlists?: Array<{
    name: string;
    lastModifiedDate?: string;
    items?: Array<{
      track?: {
        trackName?: string;
        artistName?: string;
        albumName?: string;
        trackUri?: string;
      };
      addedDate?: string;
    }>;
  }>;
}

interface RawSpotifyLibraryExport {
  tracks?: Array<{
    artist?: string;
    album?: string;
    track?: string;
    uri?: string;
    pinnedVideoId?: string;
    pinnedTitle?: string;
    pinnedChannel?: string;
    pinnedDuration?: string;
    pinnedThumbnail?: string;
  }>;
}

export async function importSpotifyData(
  profileId: string,
  libraryJson?: string | null,
  playlistsJson?: string | null
): Promise<{ tracksImported: number; playlistsImported: number }> {
  const trackMap = new Map<string, TrackCell>();
  const playlistEntities: Playlist[] = [];

  // 1. Parse Playlists JSON
  if (playlistsJson) {
    try {
      const data: RawSpotifyPlaylistsExport = JSON.parse(playlistsJson);
      const playlists = data.playlists || [];

      for (let i = 0; i < playlists.length; i++) {
        const pl = playlists[i];
        const pName = (pl.name || `Playlist #${i}`).trim();
        const pId = `pl_${encodeURIComponent(pName.toLowerCase())}`;
        const playlistTag = normalizeTagName(pName);
        const items = pl.items || [];

        playlistEntities.push({
          id: pId,
          profileId,
          name: pName,
          trackCount: items.length,
          lastModifiedDate: pl.lastModifiedDate || '',
        });

        for (const item of items) {
          const t = item.track;
          if (!t) continue;
          const tName = (t.trackName || '').trim();
          const aName = (t.artistName || '').trim();
          const albName = (t.albumName || '').trim();
          const uri = (t.trackUri || '').trim();

          if (!tName) continue;

          const key = uri || `${aName.toLowerCase()}|${tName.toLowerCase()}`;
          const existing = trackMap.get(key);
          const tags = new Set<string>(existing?.tags || []);
          tags.add('#all');
          if (playlistTag) tags.add(playlistTag);
          const aTag = artistToTag(aName);
          if (aTag) tags.add(aTag);

          trackMap.set(key, {
            id: key,
            profileId,
            title: tName,
            artist: aName || 'Unknown Artist',
            album: albName || 'Unknown Album',
            tags: Array.from(tags),
            isFavorite: existing?.isFavorite || false,
            pinnedVideoId: existing?.pinnedVideoId,
            pinnedTitle: existing?.pinnedTitle,
            pinnedChannel: existing?.pinnedChannel,
            pinnedDuration: existing?.pinnedDuration,
            pinnedThumbnail: existing?.pinnedThumbnail,
            playCount: existing?.playCount || 0,
            addedAt: item.addedDate ? new Date(item.addedDate).getTime() : Date.now(),
          });
        }
      }
    } catch (err) {
      console.error('Error parsing playlists JSON:', err);
    }
  }

  // 2. Parse Library JSON
  if (libraryJson) {
    try {
      const data: RawSpotifyLibraryExport = JSON.parse(libraryJson);
      const tracks = data.tracks || [];

      for (const item of tracks) {
        const tName = (item.track || '').trim();
        const aName = (item.artist || '').trim();
        const albName = (item.album || '').trim();
        const uri = (item.uri || '').trim();

        if (!tName) continue;

        const key = uri || `${aName.toLowerCase()}|${tName.toLowerCase()}`;
        const existing = trackMap.get(key);
        const tags = new Set<string>(existing?.tags || []);
        tags.add('#all');
        tags.add('#favorites');
        const aTag = artistToTag(aName);
        if (aTag) tags.add(aTag);

        trackMap.set(key, {
          id: key,
          profileId,
          title: tName,
          artist: aName || 'Unknown Artist',
          album: albName || 'Unknown Album',
          tags: Array.from(tags),
          isFavorite: true,
          pinnedVideoId: item.pinnedVideoId || existing?.pinnedVideoId,
          pinnedTitle: item.pinnedTitle || existing?.pinnedTitle,
          pinnedChannel: item.pinnedChannel || existing?.pinnedChannel,
          pinnedDuration: item.pinnedDuration || existing?.pinnedDuration,
          pinnedThumbnail: item.pinnedThumbnail || existing?.pinnedThumbnail,
          playCount: existing?.playCount || 0,
          addedAt: existing?.addedAt || Date.now(),
        });
      }
    } catch (err) {
      console.error('Error parsing library JSON:', err);
    }
  }

  // 3. Batch upsert into IndexedDB
  const trackList = Array.from(trackMap.values());
  if (trackList.length > 0) {
    await db.tracks.bulkPut(trackList);
  }
  if (playlistEntities.length > 0) {
    await db.playlists.bulkPut(playlistEntities);
  }

  return {
    tracksImported: trackList.length,
    playlistsImported: playlistEntities.length,
  };
}

const fetchJsonSafely = async (url: string): Promise<string | null> => {
  try {
    const res = await apiFetch(url);
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    if (text.startsWith('{') || text.startsWith('[')) {
      return text;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Creates and uploads a new SpotDrop profile to the backend, then imports into local IndexedDB
 */
export async function createAndUploadProfile(
  name: string,
  avatarEmoji: string = '🎵',
  libraryJson: string | null = null,
  playlistsJson: string | null = null
): Promise<{ profileId: string; url: string }> {
  const payload = {
    name,
    avatarEmoji,
    libraryJson,
    playlistsJson,
  };

  const res = await apiFetch('/api/profiles/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Ошибка при сохранении профиля на сервере');
  }

  const data = await res.json();
  const profileId = data.profileId;

  const newProfile: MusicProfile = {
    id: profileId,
    name: name || 'Spotify Import',
    avatarEmoji,
    isCurrent: true,
    createdAt: Date.now(),
    isMaster: false,
    cacheAudio: false,
  };

  await db.transaction('rw', db.profiles, async () => {
    await db.profiles.toCollection().modify({ isCurrent: false });
    await db.profiles.put(newProfile);
  });

  await importSpotifyData(profileId, libraryJson, playlistsJson);

  // Update URL in browser address bar without page reload
  window.history.pushState({}, '', data.url || `/p/${profileId}`);

  return { profileId, url: data.url || `/p/${profileId}` };
}

/**
 * Loads a profile by its slug/id (e.g. 'bandita', 'default', 'spot_xxxxxx')
 */
export async function loadProfileBySlug(slug: string): Promise<boolean> {
  const cleanSlug = slug.toLowerCase().trim();
  const isMaster = cleanSlug === 'bandita' || cleanSlug === 'default' || cleanSlug === 'profile_default';
  const targetId = isMaster ? 'profile_default' : cleanSlug;

  // 1. Check if already in local IndexedDB with tracks
  const existing = await db.profiles.get(targetId);
  if (existing) {
    const count = await db.tracks.where('profileId').equals(targetId).count();
    if (count > 0) {
      await setCurrentProfile(targetId);
      return true;
    }
  }

  // 2. Fetch from server API
  const metaStr = await fetchJsonSafely(`/api/profiles/${cleanSlug}`);
  if (!metaStr) return false;

  let meta: any = {};
  try {
    meta = JSON.parse(metaStr);
  } catch {
    return false;
  }

  const profileEntity: MusicProfile = {
    id: targetId,
    name: meta.name || (isMaster ? 'Bandita Library' : 'Spotify Library'),
    avatarEmoji: meta.avatarEmoji || (isMaster ? '🎧' : '🎵'),
    isCurrent: true,
    createdAt: meta.createdAt || Date.now(),
    isMaster: Boolean(meta.isMaster),
    cacheAudio: Boolean(meta.cacheAudio),
  };

  await db.transaction('rw', db.profiles, async () => {
    await db.profiles.toCollection().modify({ isCurrent: false });
    await db.profiles.put(profileEntity);
  });

  const [libJson, plJson] = await Promise.all([
    fetchJsonSafely(`/api/profiles/${cleanSlug}/library`),
    fetchJsonSafely(`/api/profiles/${cleanSlug}/playlists`),
  ]);

  if (libJson || plJson) {
    await importSpotifyData(targetId, libJson, plJson);
    return true;
  }

  return false;
}

/**
 * Initializes default library & playlists if database is currently empty
 */
export async function initializeDefaultsIfEmpty(): Promise<boolean> {
  return await loadProfileBySlug('bandita');
}
