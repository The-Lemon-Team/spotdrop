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

export type PlaylistImportSource =
  | string
  | { name?: string; content: string }
  | RawSpotifyPlaylistsExport;

export async function importSpotifyData(
  profileId: string,
  libraryJson?: string | null,
  playlistsInput?: PlaylistImportSource | PlaylistImportSource[] | null
): Promise<{ tracksImported: number; playlistsImported: number }> {
  const trackMap = new Map<string, TrackCell>();
  const playlistEntities: Playlist[] = [];

  // 1. Parse Playlists JSON (supports multiple Playlist files / exports)
  if (playlistsInput) {
    const rawSources: PlaylistImportSource[] = Array.isArray(playlistsInput)
      ? playlistsInput
      : [playlistsInput];

    let globalPlCounter = 0;

    for (let sIdx = 0; sIdx < rawSources.length; sIdx++) {
      const src = rawSources[sIdx];
      let data: RawSpotifyPlaylistsExport | null = null;

      if (typeof src === 'string') {
        try {
          data = JSON.parse(src);
        } catch (err) {
          console.error(`[Importer] Error parsing playlist #${sIdx}:`, err);
        }
      } else if (typeof src === 'object' && src !== null) {
        if ('content' in src && typeof src.content === 'string') {
          try {
            data = JSON.parse(src.content);
          } catch (err) {
            console.error(`[Importer] Error parsing playlist file ${src.name}:`, err);
          }
        } else {
          data = src as RawSpotifyPlaylistsExport;
        }
      }

      if (!data) continue;
      const playlists = Array.isArray(data.playlists)
        ? data.playlists
        : Array.isArray(data)
        ? (data as any)
        : [];

      for (let i = 0; i < playlists.length; i++) {
        const pl = playlists[i];
        if (!pl) continue;
        const pName = (pl.name || `Playlist #${globalPlCounter + 1}`).trim();
        const cleanSlug = pName
          .toLowerCase()
          .replace(/[^a-z0-9а-яё]/gi, '_')
          .replace(/_+/g, '_')
          .slice(0, 30);
        const pId = `pl_${profileId}_${sIdx}_${i}_${cleanSlug || 'playlist'}`;
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

        globalPlCounter++;
      }
    }
  }

  // 2. Parse Library JSON
  if (libraryJson) {
    try {
      const data: RawSpotifyLibraryExport = JSON.parse(libraryJson);
      const tracks = data.tracks || [];

      for (let i = 0; i < tracks.length; i++) {
        const item = tracks[i];
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
          spotifyOrder: i,
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
 * Creates and uploads a new SpotDrop profile to the backend, then imports into local IndexedDB.
 * Supports multiple Playlist files / exports.
 */
export async function createAndUploadProfile(
  name: string,
  avatarEmoji: string = '⚡',
  libraryJson: string | null = null,
  playlistsData: PlaylistImportSource | PlaylistImportSource[] | null = null
): Promise<{ profileId: string; url: string }> {
  // Format playlist payload for backend
  let playlistFiles: Array<{ name: string; content: string }> = [];
  let singlePlaylistsJson: string | null = null;

  if (Array.isArray(playlistsData)) {
    playlistFiles = playlistsData.map((item, idx) => {
      if (typeof item === 'string') {
        return { name: `Playlist${idx + 1}.json`, content: item };
      }
      if (typeof item === 'object' && item !== null && 'content' in item) {
        return { name: item.name || `Playlist${idx + 1}.json`, content: item.content };
      }
      return { name: `Playlist${idx + 1}.json`, content: JSON.stringify(item) };
    });
  } else if (typeof playlistsData === 'string') {
    singlePlaylistsJson = playlistsData;
  } else if (playlistsData && typeof playlistsData === 'object' && 'content' in playlistsData) {
    playlistFiles = [
      {
        name: (playlistsData as { name?: string; content: string }).name || 'Playlist1.json',
        content: (playlistsData as { name?: string; content: string }).content,
      },
    ];
  }

  const payload = {
    name,
    avatarEmoji,
    libraryJson,
    playlistsJson: singlePlaylistsJson,
    playlistFiles: playlistFiles.length > 0 ? playlistFiles : undefined,
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

  await importSpotifyData(profileId, libraryJson, playlistsData);

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
    const serverOrderMap = new Map<string, number>();
    for (let i = 0; i < serverTracks.length; i++) {
      const st = serverTracks[i];
      if (st.pinnedVideoId) {
        if (st.uri) serverPinnedMap.set(st.uri, st);
        const nameKey = `${(st.artist || '').toLowerCase().trim()}|${(st.track || '').toLowerCase().trim()}`;
        serverPinnedMap.set(nameKey, st);
      }
      if (st.uri) serverOrderMap.set(st.uri, i);
      const nameKey = `${(st.artist || '').toLowerCase().trim()}|${(st.track || '').toLowerCase().trim()}`;
      serverOrderMap.set(nameKey, i);
    }

    if (serverPinnedMap.size === 0 && serverOrderMap.size === 0) return 0;

    const localTracks = await db.tracks.where('profileId').equals(profileId).toArray();
    const tracksToUpdate: TrackCell[] = [];
    const localTrackIds = new Set(localTracks.map((t) => t.id));
    const localNameKeys = new Set(
      localTracks.map((t) => `${t.artist.toLowerCase().trim()}|${t.title.toLowerCase().trim()}`)
    );

    for (const lt of localTracks) {
      const nameKey = `${lt.artist.toLowerCase().trim()}|${lt.title.toLowerCase().trim()}`;
      const match = (lt.id ? serverPinnedMap.get(lt.id) : undefined) || serverPinnedMap.get(nameKey);
      const orderMatch = (lt.id ? serverOrderMap.get(lt.id) : undefined) ?? serverOrderMap.get(nameKey);

      let changed = false;
      const updatedTrack: TrackCell = { ...lt };

      if (!lt.pinnedVideoId && match && match.pinnedVideoId) {
        updatedTrack.pinnedVideoId = match.pinnedVideoId;
        updatedTrack.pinnedTitle = match.pinnedTitle || lt.pinnedTitle || lt.title;
        updatedTrack.pinnedChannel = match.pinnedChannel || lt.pinnedChannel || lt.artist;
        updatedTrack.pinnedDuration = match.pinnedDuration || lt.pinnedDuration || '';
        updatedTrack.pinnedThumbnail =
          match.pinnedThumbnail || lt.pinnedThumbnail || `https://i.ytimg.com/vi/${match.pinnedVideoId}/hqdefault.jpg`;
        changed = true;
      }

      if (orderMatch !== undefined && lt.spotifyOrder !== orderMatch) {
        updatedTrack.spotifyOrder = orderMatch;
        changed = true;
      }

      if (changed) {
        tracksToUpdate.push(updatedTrack);
      }
    }

    // Also insert any new tracks from server YourLibrary.json that aren't in localTracks at all
    for (let i = 0; i < serverTracks.length; i++) {
      const st = serverTracks[i];
      const nameKey = `${(st.artist || '').toLowerCase().trim()}|${(st.track || '').toLowerCase().trim()}`;
      const key = st.uri || nameKey;
      if (!localTrackIds.has(key) && !localNameKeys.has(nameKey)) {
        const tags = new Set<string>(['#all', '#favorites']);
        const aTag = artistToTag(st.artist || '');
        if (aTag) tags.add(aTag);

        tracksToUpdate.push({
          id: key,
          profileId,
          title: st.track || 'Track',
          artist: st.artist || 'Unknown Artist',
          album: st.album || '',
          tags: Array.from(tags),
          isFavorite: true,
          pinnedVideoId: st.pinnedVideoId,
          pinnedTitle: st.pinnedTitle,
          pinnedChannel: st.pinnedChannel,
          pinnedDuration: st.pinnedDuration,
          pinnedThumbnail:
            st.pinnedThumbnail ||
            (st.pinnedVideoId ? `https://i.ytimg.com/vi/${st.pinnedVideoId}/hqdefault.jpg` : undefined),
          playCount: 0,
          addedAt: Date.now(),
          spotifyOrder: i,
        });
        localTrackIds.add(key);
        localNameKeys.add(nameKey);
      }
    }

    if (tracksToUpdate.length > 0) {
      await db.tracks.bulkPut(tracksToUpdate);
      console.log(`[syncPinned] Synchronized ${tracksToUpdate.length} pinned tracks & order from default library.`);
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
    const isMaster =
      profileId === 'beta' || profileId === 'bandita' || profileId === 'default' || profileId === 'profile_default';
    const slug = isMaster ? 'beta' : profileId;

    let plJson = await fetchJsonSafely(`/api/profiles/${slug}/playlists`);
    if (!plJson && isMaster) {
      plJson = await fetchJsonSafely('/defaults/default/Playlist1.json');
    }

    if (!plJson) {
      const existing = await db.playlists.where('profileId').equals(profileId).toArray();
      return existing.length;
    }

    const data: RawSpotifyPlaylistsExport = JSON.parse(plJson);
    const playlists = data.playlists || [];
    const existing = await db.playlists.where('profileId').equals(profileId).toArray();
    const existingMap = new Map<string, Playlist>();
    for (const ep of existing) {
      existingMap.set(ep.name.toLowerCase().trim(), ep);
    }

    const playlistEntities: Playlist[] = [];
    const missingTracksToCreate: TrackCell[] = [];
    const localTracks = await db.tracks.where('profileId').equals(profileId).toArray();
    const localTrackIds = new Set(localTracks.map((t) => t.id));

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
      const playlistTag = normalizeTagName(pName);

      for (const item of items) {
        const t = item.track;
        if (!t) continue;
        const tName = (t.trackName || '').trim();
        const aName = (t.artistName || '').trim();
        const albName = (t.albumName || '').trim();
        const uri = (t.trackUri || '').trim();
        if (!tName) continue;
        const key = uri || `${aName.toLowerCase()}|${tName.toLowerCase()}`;
        trackIds.push(key);

        if (!localTrackIds.has(key)) {
          const tags = new Set<string>(['#all']);
          if (playlistTag) tags.add(playlistTag);
          const aTag = artistToTag(aName);
          if (aTag) tags.add(aTag);

          missingTracksToCreate.push({
            id: key,
            profileId,
            title: tName,
            artist: aName || 'Unknown Artist',
            album: albName || 'Unknown Album',
            tags: Array.from(tags),
            isFavorite: false,
            playCount: 0,
            addedAt: item.addedDate ? new Date(item.addedDate).getTime() : Date.now(),
          });
          localTrackIds.add(key);
        }
      }

      const existingPl = existingMap.get(pName.toLowerCase().trim());
      // If playlist doesn't exist, or has different count, update it
      if (!existingPl || existingPl.trackCount !== trackIds.length) {
        playlistEntities.push({
          id: existingPl?.id || pId,
          profileId,
          name: pName,
          trackCount: trackIds.length,
          trackIds,
          lastModifiedDate: pl.lastModifiedDate || '',
          createdAt: pl.lastModifiedDate ? new Date(pl.lastModifiedDate).getTime() : Date.now(),
        });
      }
    }

    if (missingTracksToCreate.length > 0) {
      await db.tracks.bulkPut(missingTracksToCreate);
      console.log(`[Playlists] Created ${missingTracksToCreate.length} missing tracks for playlists`);
    }

    if (playlistEntities.length > 0) {
      await db.playlists.bulkPut(playlistEntities);
      console.log(`[Playlists] Synced ${playlistEntities.length} updated/new Spotify playlists for ${profileId}`);
    }

    return existing.length + playlistEntities.length;
  } catch (err) {
    console.warn('[Playlists] Synchronization skipped:', err);
    return 0;
  }
}

/**
 * Ensures that tracks for a profile have their spotifyOrder populated
 * from YourLibrary.json (backfills existing IndexedDB databases).
 */
export async function ensureSpotifyOrderSynced(profileId: string): Promise<number> {
  try {
    const isMaster =
      profileId === 'beta' || profileId === 'bandita' || profileId === 'default' || profileId === 'profile_default';
    const slug = isMaster ? 'beta' : profileId;

    // Check if any tracks already have spotifyOrder
    const hasOrder = await db.tracks
      .where('profileId')
      .equals(profileId)
      .filter((t) => t.spotifyOrder !== undefined)
      .first();

    if (hasOrder) {
      return 0;
    }

    let libJson = await fetchJsonSafely(`/api/profiles/${slug}/library`);
    if (!libJson && isMaster) {
      libJson = await fetchJsonSafely('/defaults/default/YourLibrary.json');
    }

    if (!libJson) return 0;

    const data: RawSpotifyLibraryExport = JSON.parse(libJson);
    const tracks = data.tracks || [];
    if (tracks.length === 0) return 0;

    const localTracks = await db.tracks.where('profileId').equals(profileId).toArray();
    if (localTracks.length === 0) return 0;

    const trackMap = new Map<string, TrackCell>();
    for (const lt of localTracks) {
      trackMap.set(lt.id, lt);
      const nameKey = `${lt.artist.toLowerCase().trim()}|${lt.title.toLowerCase().trim()}`;
      trackMap.set(nameKey, lt);
    }

    const tracksToUpdate: TrackCell[] = [];
    for (let i = 0; i < tracks.length; i++) {
      const item = tracks[i];
      const tName = (item.track || '').trim();
      const aName = (item.artist || '').trim();
      const uri = (item.uri || '').trim();
      const nameKey = `${aName.toLowerCase()}|${tName.toLowerCase()}`;

      const matched = (uri ? trackMap.get(uri) : undefined) || trackMap.get(nameKey);
      if (matched && matched.spotifyOrder !== i) {
        matched.spotifyOrder = i;
        if (!matched.isFavorite) matched.isFavorite = true;
        tracksToUpdate.push(matched);
      }
    }

    if (tracksToUpdate.length > 0) {
      await db.tracks.bulkPut(tracksToUpdate);
      console.log(`[SpotifyOrder] Backfilled spotifyOrder for ${tracksToUpdate.length} tracks.`);
      return tracksToUpdate.length;
    }

    return 0;
  } catch (err) {
    console.warn('[SpotifyOrder] Failed to sync spotifyOrder:', err);
    return 0;
  }
}

/**
 * Loads a profile by its slug/id (e.g. 'bandita', 'default', 'spot_xxxxxx')
 */
export async function loadProfileBySlug(slug: string): Promise<boolean> {
  const cleanSlug = slug.toLowerCase().trim();
  const isMaster =
    cleanSlug === 'beta' || cleanSlug === 'bandita' || cleanSlug === 'default' || cleanSlug === 'profile_default';
  const targetId = isMaster ? 'profile_default' : cleanSlug;

  // 1. Check if already in local IndexedDB with tracks
  const existing = await db.profiles.get(targetId);
  if (existing) {
    const count = await db.tracks.where('profileId').equals(targetId).count();
    if (count > 0) {
      await setCurrentProfile(targetId);
      ensurePlaylistsSynced(targetId).catch(() => {});
      ensureSpotifyOrderSynced(targetId).catch(() => {});
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
    name: meta.name || (isMaster ? 'SpotDrop Beta' : 'Spotify Library'),
    avatarEmoji: meta.avatarEmoji || (isMaster ? '⚡' : '🎵'),
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
  return await loadProfileBySlug('beta');
}

