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
