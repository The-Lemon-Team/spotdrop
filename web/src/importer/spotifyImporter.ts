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
        const cleanSlug = pName.toLowerCase().replace(/[^a-z0-9а-яё]/gi, '_').replace(/_+/g, '_').slice(0, 30);
        const pId = `pl_${profileId}_${i}_${cleanSlug || 'playlist'}`;
        const playlistTag = normalizeTagName(pName);
        const items = pl.items || [];
        const playlistTrackIds: string[] = [];

        for (const item of items) {
          const t = item.track;
          if (!t) continue;
          const tName = (t.trackName || '').trim();
          const aName = (t.artistName || '').trim();
          const albName = (t.albumName || '').trim();
          const uri = (t.trackUri || '').trim();

          if (!tName) continue;

          const key = uri || `${aName.toLowerCase()}|${tName.toLowerCase()}`;
          playlistTrackIds.push(key);

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

        playlistEntities.push({
          id: pId,
          profileId,
          name: pName,
          trackCount: playlistTrackIds.length,
          trackIds: playlistTrackIds,
          lastModifiedDate: pl.lastModifiedDate || '',
          createdAt: pl.lastModifiedDate ? new Date(pl.lastModifiedDate).getTime() : Date.now(),
        });
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
 * Background synchronizer for pinned YouTube tracks from YourLibrary.json
 * Ensures that newly downloaded or pinned tracks are updated in IndexedDB.
 */
export async function syncPinnedTracksFromDefaultLibrary(profileId: string): Promise<number> {
  try {
    const res = await apiFetch('/defaults/default/YourLibrary.json');
    if (!res.ok) return 0;
    const data: RawSpotifyLibraryExport = await res.json();
    const serverTracks = data.tracks || [];

    const serverPinnedMap = new Map<string, (typeof serverTracks)[0]>();
    for (const st of serverTracks) {
      if (st.pinnedVideoId) {
        if (st.uri) serverPinnedMap.set(st.uri, st);
        const nameKey = `${(st.artist || '').toLowerCase().trim()}|${(st.track || '').toLowerCase().trim()}`;
        serverPinnedMap.set(nameKey, st);
      }
    }

    if (serverPinnedMap.size === 0) return 0;

    const localTracks = await db.tracks.where('profileId').equals(profileId).toArray();
    const tracksToUpdate: TrackCell[] = [];

    for (const lt of localTracks) {
      if (!lt.pinnedVideoId) {
        const nameKey = `${lt.artist.toLowerCase().trim()}|${lt.title.toLowerCase().trim()}`;
        const match = (lt.id && serverPinnedMap.get(lt.id)) || serverPinnedMap.get(nameKey);
        if (match && match.pinnedVideoId) {
          tracksToUpdate.push({
            ...lt,
            pinnedVideoId: match.pinnedVideoId,
            pinnedTitle: match.pinnedTitle || lt.pinnedTitle || lt.title,
            pinnedChannel: match.pinnedChannel || lt.pinnedChannel || lt.artist,
            pinnedDuration: match.pinnedDuration || lt.pinnedDuration || '',
            pinnedThumbnail: match.pinnedThumbnail || lt.pinnedThumbnail || `https://i.ytimg.com/vi/${match.pinnedVideoId}/hqdefault.jpg`,
          });
        }
      }
    }

    if (tracksToUpdate.length > 0) {
      await db.tracks.bulkPut(tracksToUpdate);
      console.log(`[syncPinned] Synchronized ${tracksToUpdate.length} pinned tracks from default library.`);
    }

    return tracksToUpdate.length;
  } catch (err) {
    console.warn('[syncPinned] Background sync skipped:', err);
    return 0;
  }
}

/**
 * Ensures that playlists with complete trackIds exist for the profile.
 * If playlists are missing or have no trackIds, imports from server / defaults.
 */
export async function ensurePlaylistsSynced(profileId: string): Promise<number> {
  try {
    const existing = await db.playlists.where('profileId').equals(profileId).toArray();
    const hasValidPlaylists =
      existing.length > 0 && existing.some((p) => Array.isArray(p.trackIds) && p.trackIds.length > 0);

    if (hasValidPlaylists) {
      return existing.length;
    }

    const isMaster =
      profileId === 'bandita' || profileId === 'default' || profileId === 'profile_default';
    const slug = isMaster ? 'bandita' : profileId;

    let plJson = await fetchJsonSafely(`/api/profiles/${slug}/playlists`);
    if (!plJson && isMaster) {
      plJson = await fetchJsonSafely('/defaults/default/Playlist1.json');
    }

    if (!plJson) return existing.length;

    const data: RawSpotifyPlaylistsExport = JSON.parse(plJson);
    const playlists = data.playlists || [];
    const playlistEntities: Playlist[] = [];

    for (let i = 0; i < playlists.length; i++) {
      const pl = playlists[i];
      const pName = (pl.name || `Playlist #${i}`).trim();
      const cleanSlug = pName
        .toLowerCase()
        .replace(/[^a-z0-9а-яё]/gi, '_')
        .replace(/_+/g, '_')
        .slice(0, 30);
      const pId = `pl_${profileId}_${i}_${cleanSlug || 'playlist'}`;
      const items = pl.items || [];
      const trackIds: string[] = [];

      for (const item of items) {
        const t = item.track;
        if (!t) continue;
        const tName = (t.trackName || '').trim();
        const aName = (t.artistName || '').trim();
        const uri = (t.trackUri || '').trim();
        if (!tName) continue;
        const key = uri || `${aName.toLowerCase()}|${tName.toLowerCase()}`;
        trackIds.push(key);
      }

      playlistEntities.push({
        id: pId,
        profileId,
        name: pName,
        trackCount: trackIds.length,
        trackIds,
        lastModifiedDate: pl.lastModifiedDate || '',
        createdAt: pl.lastModifiedDate ? new Date(pl.lastModifiedDate).getTime() : Date.now(),
      });
    }

    if (playlistEntities.length > 0) {
      await db.playlists.bulkPut(playlistEntities);
      console.log(`[Playlists] Synced ${playlistEntities.length} Spotify playlists for ${profileId}`);
    }

    return playlistEntities.length;
  } catch (err) {
    console.warn('[Playlists] Synchronization skipped:', err);
    return 0;
  }
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
      ensurePlaylistsSynced(targetId).catch(() => {});
      if (isMaster) {
        // Sync newly pinned tracks from server YourLibrary.json into IndexedDB in background
        syncPinnedTracksFromDefaultLibrary(targetId).catch(() => {});
      }
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
    await ensurePlaylistsSynced(targetId);
    return true;
  }

  return false;
}

/**
 * Initializes default library & playlists if database is currently empty
 */
export async function initializeDefaultsIfEmpty(): Promise<boolean> {
  const current = await getCurrentProfile();
  if (current) {
    const count = await db.tracks.where('profileId').equals(current.id).count();
    if (count > 0) {
      syncPinnedTracksFromDefaultLibrary(current.id).catch(console.warn);
      ensurePlaylistsSynced(current.id).catch(console.warn);
      return false;
    }
  }
  return await loadProfileBySlug('bandita');
}

