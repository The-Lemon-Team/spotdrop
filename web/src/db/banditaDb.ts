import Dexie, { type EntityTable } from 'dexie';
import type { TrackCell, MusicProfile, Playlist } from '../types';

export class BanditaDatabase extends Dexie {
  tracks!: EntityTable<TrackCell, 'id'>;
  profiles!: EntityTable<MusicProfile, 'id'>;
  playlists!: EntityTable<Playlist, 'id'>;

  constructor() {
    super('BanditaPlayerDB');

    this.version(1).stores({
      tracks: 'id, profileId, artist, album, title, isFavorite, playCount, addedAt, *tags',
      profiles: 'id, isCurrent, name, createdAt',
      playlists: 'id, profileId, name',
    });

    this.version(2).stores({
      playlists: 'id, profileId, name, trackCount, lastModifiedDate',
    });
  }
}

export const db = new BanditaDatabase();

// Helper database operations
export async function getCurrentProfile(): Promise<MusicProfile | undefined> {
  const current = await db.profiles.filter((p) => Boolean(p.isCurrent)).first();
  if (current) return current;
  return await db.profiles.toCollection().first();
}

export async function setCurrentProfile(profileId: string): Promise<void> {
  await db.transaction('rw', db.profiles, async () => {
    await db.profiles.toCollection().modify({ isCurrent: false });
    await db.profiles.update(profileId, { isCurrent: true });
  });
}

export async function toggleFavoriteTrack(trackId: string): Promise<boolean> {
  const track = await db.tracks.get(trackId);
  if (!track) return false;
  const newFav = !track.isFavorite;
  await db.tracks.update(trackId, { isFavorite: newFav });
  return newFav;
}

export async function pinYouTubeMatch(
  trackId: string,
  candidate: {
    videoId: string;
    title: string;
    channel: string;
    durationText?: string;
    thumbnailUrl?: string;
  }
): Promise<void> {
  await db.tracks.update(trackId, {
    pinnedVideoId: candidate.videoId,
    pinnedTitle: candidate.title,
    pinnedChannel: candidate.channel,
    pinnedDuration: candidate.durationText,
    pinnedThumbnail: candidate.thumbnailUrl,
  });
}

export async function unpinYouTubeMatch(trackId: string): Promise<void> {
  await db.tracks.update(trackId, {
    pinnedVideoId: undefined,
    pinnedTitle: undefined,
    pinnedChannel: undefined,
    pinnedDuration: undefined,
    pinnedThumbnail: undefined,
  });
}

// Playlist Operations
export async function createPlaylist(
  profileId: string,
  name: string,
  initialTrackIds: string[] = []
): Promise<Playlist> {
  const cleanName = name.trim() || 'Новый плейлист';
  const id = `pl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  const playlist: Playlist = {
    id,
    profileId,
    name: cleanName,
    trackCount: initialTrackIds.length,
    trackIds: [...initialTrackIds],
    lastModifiedDate: dateStr,
    createdAt: now.getTime(),
  };

  await db.playlists.put(playlist);
  return playlist;
}

export async function addTrackToPlaylist(playlistId: string, trackId: string): Promise<boolean> {
  const pl = await db.playlists.get(playlistId);
  if (!pl) return false;

  const currentIds = Array.isArray(pl.trackIds) ? pl.trackIds : [];
  if (currentIds.includes(trackId)) return false;

  const updatedIds = [...currentIds, trackId];
  await db.playlists.update(playlistId, {
    trackIds: updatedIds,
    trackCount: updatedIds.length,
    lastModifiedDate: new Date().toISOString().split('T')[0],
  });
  return true;
}

export async function removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<boolean> {
  const pl = await db.playlists.get(playlistId);
  if (!pl) return false;

  const currentIds = Array.isArray(pl.trackIds) ? pl.trackIds : [];
  if (!currentIds.includes(trackId)) return false;

  const updatedIds = currentIds.filter((id) => id !== trackId);
  await db.playlists.update(playlistId, {
    trackIds: updatedIds,
    trackCount: updatedIds.length,
    lastModifiedDate: new Date().toISOString().split('T')[0],
  });
  return true;
}

export async function toggleTrackInPlaylist(
  playlistId: string,
  trackId: string
): Promise<{ inPlaylist: boolean; count: number }> {
  const pl = await db.playlists.get(playlistId);
  if (!pl) return { inPlaylist: false, count: 0 };

  const currentIds = Array.isArray(pl.trackIds) ? [...pl.trackIds] : [];
  const index = currentIds.indexOf(trackId);
  let inPlaylist = false;

  if (index >= 0) {
    currentIds.splice(index, 1);
    inPlaylist = false;
  } else {
    currentIds.push(trackId);
    inPlaylist = true;
  }

  await db.playlists.update(playlistId, {
    trackIds: currentIds,
    trackCount: currentIds.length,
    lastModifiedDate: new Date().toISOString().split('T')[0],
  });

  return { inPlaylist, count: currentIds.length };
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  await db.playlists.delete(playlistId);
}

export async function renamePlaylist(playlistId: string, newName: string): Promise<void> {
  const clean = newName.trim();
  if (!clean) return;
  await db.playlists.update(playlistId, {
    name: clean,
    lastModifiedDate: new Date().toISOString().split('T')[0],
  });
}
