export interface TrackCell {
  id: string; // Spotify URI (spotify:track:...) or unique hash
  profileId: string;
  title: string;
  artist: string;
  album: string;
  tags: string[]; // e.g. ["#all", "#summer", "#xx"]
  isFavorite: boolean;
  pinnedVideoId?: string;
  pinnedTitle?: string;
  pinnedChannel?: string;
  pinnedDuration?: string;
  pinnedThumbnail?: string;
  playCount: number;
  addedAt: number;
}

export interface MusicProfile {
  id: string;
  name: string;
  avatarEmoji: string;
  isCurrent: boolean;
  trackCount?: number;
  playlistCount?: number;
  createdAt: number;
  isMaster?: boolean;
  cacheAudio?: boolean;
}

export interface Playlist {
  id: string;
  profileId: string;
  name: string;
  trackCount: number;
  trackIds: string[]; // Ordered track keys/URIs
  lastModifiedDate?: string;
  createdAt?: number;
  description?: string;
  coverGradient?: string;
}

export interface YouTubeCandidate {
  videoId: string;
  title: string;
  channel: string;
  durationText: string;
  durationSeconds?: number;
  thumbnailUrl: string;
  isPinned?: boolean;
}

export enum PlayStrategy {
  FIRST_MATCH = 'FIRST_MATCH',
  PINNED_ONLY = 'PINNED_ONLY'
}
