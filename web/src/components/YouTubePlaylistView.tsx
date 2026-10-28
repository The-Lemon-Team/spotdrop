import React, { useState, useMemo, useRef, useCallback, useDeferredValue, memo } from 'react';
import {
  Play,
  Pause,
  Shuffle,
  Share2,
  Copy,
  ExternalLink,
  Search,
  SlidersHorizontal,
  Check,
  Heart,
  FolderPlus,
  Sparkles,
  Clock,
  Music2,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import type { TrackCell, Playlist } from '../types';
import { YouTubeIcon } from './YouTubeIcon';
import { YouTubeApiModal } from './YouTubeApiModal';
import { YouTubeExportModal } from './YouTubeExportModal';

interface YouTubePlaylistViewProps {
  tracks: TrackCell[];
  playlists: Playlist[];
  currentTrack: TrackCell | null;
  isPlaying: boolean;
  profileSlug?: string;
  selectedPlaylistId?: string | null;
  onSelectPlaylistId?: (id: string | null) => void;
  onPlayTrack: (track: TrackCell, playlistTracks: TrackCell[]) => void;
  onShuffleAndPlay: (tracks: TrackCell[]) => void;
  onOpenPicker: (track: TrackCell) => void;
  onToggleFavorite: (trackId: string) => void;
  onAddToPlaylist: (track: TrackCell) => void;
  onShareTrack: (track: TrackCell) => void;
  onShareYouTubePlaylist?: (playlistTitle: string, playlistId: string | null) => void;
  onToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

const PAGE_SIZE = 35;

function parseDurationSeconds(text?: string | null): number {
  if (!text || typeof text !== 'string') return 0;
  const parts = text.trim().split(':').map((p) => parseInt(p, 10));
  if (parts.some((p) => isNaN(p) || p < 0)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
}

function formatTotalDuration(seconds: number): string {
  if (seconds <= 0) return '0 мин';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours} ч ${minutes} мин`;
  }
  return `${minutes} мин`;
}

type SortOption = 'default' | 'title' | 'channel' | 'duration_desc' | 'duration_asc';

interface YouTubeTrackRowProps {
  track: TrackCell;
  index: number;
  isCurrent: boolean;
  isTrackPlaying: boolean;
  onPlay: (track: TrackCell) => void;
  onCopyUrl: (videoId: string) => void;
  onOpenPicker: (track: TrackCell) => void;
  onAddToPlaylist: (track: TrackCell) => void;
  onToggleFavorite: (trackId: string) => void;
}

const YouTubeTrackRow = memo(function YouTubeTrackRow({
  track,
  index,
  isCurrent,
  isTrackPlaying,
  onPlay,
  onCopyUrl,
  onOpenPicker,
  onAddToPlaylist,
  onToggleFavorite,
}: YouTubeTrackRowProps) {
  const videoId = track.pinnedVideoId;
  const videoTitle = track.pinnedTitle || `${track.artist} - ${track.title}`;
  const channel = track.pinnedChannel || track.artist;
  const duration = track.pinnedDuration;
  const thumbnail =
    track.pinnedThumbnail ||
    (videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : undefined);
  const youtubeWatchUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;

  const handleRowClick = () => {
    onPlay(track);
  };

  const handlePlayBtn = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPlay(track);
  };

  const handleCopyBtn = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoId) onCopyUrl(videoId);
  };

  const handlePickerBtn = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenPicker(track);
  };

  const handleAddToPlaylistBtn = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToPlaylist(track);
  };

  const handleFavoriteBtn = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(track.id);
  };

  return (
    <div
      onClick={handleRowClick}
      className={`content-visibility-auto group flex items-center justify-between p-2.5 sm:p-3 rounded-2xl border transition-[background-color,border-color,box-shadow] duration-150 cursor-pointer ${
        isCurrent
          ? 'bg-[#1D1B24] border-red-500/60 shadow-lg shadow-red-500/10'
          : 'bg-[#161822] hover:bg-[#1D202D] border-[#2B2F42] hover:border-red-500/30'
      }`}
    >
      {/* Left Side: Index + 16:9 Thumbnail + Info */}
      <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
        {/* Position number or Equalizer */}
        <div className="w-6 sm:w-8 flex items-center justify-center shrink-0">
          {isTrackPlaying ? (
            <div className="flex items-end justify-center space-x-0.5 h-4">
              <span className="w-1 h-full bg-red-500 rounded-full animate-soundwave-1" />
              <span className="w-1 h-full bg-red-500 rounded-full animate-soundwave-2" />
              <span className="w-1 h-full bg-red-500 rounded-full animate-soundwave-3" />
            </div>
          ) : (
            <>
              <span className="text-xs font-mono font-semibold text-[#8E95A5] group-hover:hidden">
                {index + 1}
              </span>
              <Play className="w-4 h-4 fill-current text-white hidden group-hover:block ml-0.5" />
            </>
          )}
        </div>

        {/* 16:9 Video Thumbnail */}
        <div className="relative w-28 sm:w-36 aspect-video rounded-xl overflow-hidden shrink-0 bg-[#0D0E15] border border-white/5 shadow-md group-hover:border-red-500/40 transition-colors">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-lg bg-[#12141C] text-[#8E95A5]">
              🎵
            </div>
          )}

          {/* Duration badge */}
          {duration && (
            <span className="absolute right-1.5 bottom-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono font-bold text-white shadow-sm">
              {duration}
            </span>
          )}

          {/* YouTube brand corner indicator */}
          <div className="absolute left-1.5 top-1 opacity-80 group-hover:opacity-100">
            <YouTubeIcon className="w-3.5 h-3.5 drop-shadow" />
          </div>
        </div>

        {/* Video Meta Info */}
        <div className="min-w-0 flex-1 space-y-1">
          <h3
            className={`text-xs sm:text-sm font-bold line-clamp-1 sm:line-clamp-2 transition-colors ${
              isCurrent ? 'text-red-400' : 'text-[#F3F4F6] group-hover:text-white'
            }`}
            title={videoTitle}
          >
            {videoTitle}
          </h3>

          {/* Channel & Spotify sub-info */}
          <div className="flex items-center space-x-2 text-[11px] text-[#8E95A5] truncate flex-wrap">
            <span className="font-semibold text-[#B2B9C8] flex items-center space-x-1">
              <span>{channel}</span>
            </span>

            <span>•</span>

            <span className="text-[#8E95A5] truncate">
              Spotify: {track.artist} — {track.title}
            </span>
          </div>

          {/* Links & Badges */}
          <div className="flex items-center space-x-2 pt-0.5">
            {youtubeWatchUrl ? (
              <a
                href={youtubeWatchUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center space-x-1 text-[10px] font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2 py-0.5 rounded border border-red-500/25 transition-colors"
                title="Открыть видео на YouTube"
              >
                <YouTubeIcon className="w-3 h-3" />
                <span>Смотреть на YouTube</span>
                <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
              </a>
            ) : (
              <button
                onClick={handlePickerBtn}
                className="inline-flex items-center space-x-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/25 transition-colors cursor-pointer"
              >
                <span>⚡ Найти на YouTube</span>
              </button>
            )}

            {track.isFavorite && (
              <span className="text-[10px] text-pink-400 bg-pink-500/10 px-1.5 py-0.5 rounded">
                ★ Избранное
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right Side Actions */}
      <div className="flex items-center space-x-1 sm:space-x-2 shrink-0 ml-2">
        {/* Play Button */}
        <button
          onClick={handlePlayBtn}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
            isTrackPlaying
              ? 'bg-red-600 text-white'
              : 'bg-[#212433] hover:bg-red-600 text-red-400 hover:text-white'
          }`}
          title={isTrackPlaying ? 'Пауза' : 'Слушать'}
        >
          {isTrackPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 ml-0.5 fill-current" />
          )}
        </button>

        {/* Copy Link */}
        {videoId && (
          <button
            onClick={handleCopyBtn}
            className="p-2 rounded-lg text-[#8E95A5] hover:text-white hover:bg-[#212433] transition-colors cursor-pointer"
            title="Скопировать ссылку на YouTube"
          >
            <Copy className="w-4 h-4" />
          </button>
        )}

        {/* Match / Version Resolver */}
        <button
          onClick={handlePickerBtn}
          className="p-2 rounded-lg text-[#8E95A5] hover:text-[#00E5FF] hover:bg-[#212433] transition-colors cursor-pointer"
          title="Выбрать другую версию / привязать YouTube"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>

        {/* Add to Playlist */}
        <button
          onClick={handleAddToPlaylistBtn}
          className="p-2 rounded-lg text-[#8E95A5] hover:text-white hover:bg-[#212433] transition-colors cursor-pointer"
          title="Добавить в плейлист"
        >
          <FolderPlus className="w-4 h-4" />
        </button>

        {/* Favorite */}
        <button
          onClick={handleFavoriteBtn}
          className={`p-2 rounded-lg transition-colors cursor-pointer ${
            track.isFavorite
              ? 'text-pink-500 hover:text-pink-400'
              : 'text-[#8E95A5] hover:text-pink-500 hover:bg-[#212433]'
          }`}
          title="В избранное"
        >
          <Heart className={`w-4 h-4 ${track.isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>
    </div>
  );
});

export const YouTubePlaylistView: React.FC<YouTubePlaylistViewProps> = ({
  tracks,
  playlists,
  currentTrack,
  isPlaying,
  profileSlug = 'beta',
  selectedPlaylistId = null,
  onSelectPlaylistId,
  onPlayTrack,
  onShuffleAndPlay,
  onOpenPicker,
  onToggleFavorite,
  onAddToPlaylist,
  onShareTrack: _onShareTrack,
  onShareYouTubePlaylist,
  onToast,
}) => {
  const [activeSourceId, setActiveSourceId] = useState<string>(selectedPlaylistId || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const [onlyPinned, setOnlyPinned] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Modals state
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [copiedLinks, setCopiedLinks] = useState(false);

  // Sync external selectedPlaylistId if passed
  React.useEffect(() => {
    if (selectedPlaylistId) {
      setActiveSourceId(selectedPlaylistId);
    } else {
      setActiveSourceId('all');
    }
  }, [selectedPlaylistId]);

  const handleSourceChange = (newSource: string) => {
    setActiveSourceId(newSource);
    setVisibleCount(PAGE_SIZE);
    if (onSelectPlaylistId) {
      onSelectPlaylistId(newSource === 'all' ? null : newSource);
    }
  };

  // Resolve active playlist object
  const activePlaylist = useMemo(() => {
    if (activeSourceId === 'all') return null;
    return playlists.find((p) => p.id === activeSourceId) || null;
  }, [activeSourceId, playlists]);

  // Pre-normalized track lookup map (O(1))
  const trackMap = useMemo(() => {
    const map = new Map<string, TrackCell>();
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      map.set(t.id, t);
      const normKey = `${t.artist.toLowerCase().trim()}|${t.title.toLowerCase().trim()}`;
      map.set(normKey, t);
    }
    return map;
  }, [tracks]);

  // Source tracks based on active source
  const sourceTracks = useMemo(() => {
    if (!activePlaylist) {
      return tracks;
    }

    const list: TrackCell[] = [];
    const ids = Array.isArray(activePlaylist.trackIds) ? activePlaylist.trackIds : [];
    for (let i = 0; i < ids.length; i++) {
      const match = trackMap.get(ids[i]);
      if (match) {
        list.push(match);
      }
    }
    return list;
  }, [activePlaylist, tracks, trackMap]);

  // Separate tracks with YouTube link vs without
  const linkedTracks = useMemo(() => {
    return sourceTracks.filter((t) => Boolean(t.pinnedVideoId));
  }, [sourceTracks]);

  const unlinkedCount = sourceTracks.length - linkedTracks.length;

  // Pre-normalized search index for fast substring search
  const searchIndex = useMemo(() => {
    const map = new Map<string, string>();
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      const norm = `${t.pinnedTitle || ''} ${t.pinnedChannel || ''} ${t.title} ${t.artist} ${t.album} ${t.pinnedVideoId || ''}`.toLowerCase();
      map.set(t.id, norm);
    }
    return map;
  }, [tracks]);

  // Count total pinned in library memoized
  const totalPinnedInLibrary = useMemo(() => {
    let count = 0;
    for (let i = 0; i < tracks.length; i++) {
      if (tracks[i].pinnedVideoId) count++;
    }
    return count;
  }, [tracks]);

  // Filter & sort
  const filteredTracks = useMemo(() => {
    let list = onlyPinned ? linkedTracks : sourceTracks;

    const q = deferredSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => {
        const norm = searchIndex.get(t.id);
        return norm !== undefined && norm.includes(q);
      });
    }

    if (sortOption !== 'default') {
      list = [...list].sort((a, b) => {
        if (sortOption === 'title') {
          const tA = (a.pinnedTitle || a.title).toLowerCase();
          const tB = (b.pinnedTitle || b.title).toLowerCase();
          return tA.localeCompare(tB);
        }
        if (sortOption === 'channel') {
          const cA = (a.pinnedChannel || a.artist).toLowerCase();
          const cB = (b.pinnedChannel || b.artist).toLowerCase();
          return cA.localeCompare(cB);
        }
        if (sortOption === 'duration_desc') {
          return parseDurationSeconds(b.pinnedDuration) - parseDurationSeconds(a.pinnedDuration);
        }
        if (sortOption === 'duration_asc') {
          return parseDurationSeconds(a.pinnedDuration) - parseDurationSeconds(b.pinnedDuration);
        }
        return 0;
      });
    }

    return list;
  }, [onlyPinned, linkedTracks, sourceTracks, deferredSearchQuery, searchIndex, sortOption]);

  // Compute total duration of linked tracks
  const totalDurationSeconds = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < linkedTracks.length; i++) {
      sum += parseDurationSeconds(linkedTracks[i].pinnedDuration);
    }
    return sum;
  }, [linkedTracks]);

  const visibleTracks = useMemo(() => {
    return filteredTracks.slice(0, visibleCount);
  }, [filteredTracks, visibleCount]);

  // Reset pagination when search query or sort option changes
  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [deferredSearchQuery, sortOption, onlyPinned]);

  // Infinite scroll
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredTracks.length));
          }
        },
        { rootMargin: '350px' }
      );

      observerRef.current.observe(node);
    },
    [filteredTracks.length]
  );

  // Copy all YouTube URLs
  const handleCopyAllUrls = async () => {
    const urls = linkedTracks
      .map((t) => `https://www.youtube.com/watch?v=${t.pinnedVideoId}`)
      .join('\n');

    if (!urls) {
      onToast('Нет доступных YouTube ссылок', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(urls);
      setCopiedLinks(true);
      onToast(`Скопировано ${linkedTracks.length} YouTube ссылок!`, 'success');
      setTimeout(() => setCopiedLinks(false), 2000);
    } catch {
      onToast('Не удалось скопировать ссылки', 'error');
    }
  };

  // Copy single YouTube link
  const handleCopySingleUrl = useCallback(
    async (videoId: string) => {
      try {
        await navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${videoId}`);
        onToast('YouTube ссылка скопирована!', 'success');
      } catch {
        onToast('Не удалось скопировать ссылку', 'error');
      }
    },
    [onToast]
  );

  // Stable play track for individual rows
  const linkedTracksRef = useRef(linkedTracks);
  linkedTracksRef.current = linkedTracks;

  const handleRowPlay = useCallback(
    (track: TrackCell) => {
      onPlayTrack(track, linkedTracksRef.current);
    },
    [onPlayTrack]
  );

  // Play All
  const handlePlayAll = (shuffle: boolean = false) => {
    if (linkedTracks.length === 0) {
      onToast('В плейлисте нет треков с известными YouTube ссылками', 'error');
      return;
    }

    if (shuffle) {
      onShuffleAndPlay(linkedTracks);
      onToast(`Перемешан YouTube-плейлист (${linkedTracks.length} видео)`, 'success');
    } else {
      onPlayTrack(linkedTracks[0], linkedTracks);
      onToast(`Воспроизведение YouTube-плейлиста (${linkedTracks.length} видео)`, 'success');
    }
  };

  const playlistTitle = activePlaylist ? activePlaylist.name : 'Все треки фонотеки';

  // Share YouTube Playlist Direct Link
  const handleSharePlaylistDirect = async () => {
    if (onShareYouTubePlaylist) {
      onShareYouTubePlaylist(playlistTitle, activeSourceId === 'all' ? null : activeSourceId);
      return;
    }

    const currentSlug = profileSlug === 'profile_default' ? 'beta' : profileSlug;
    let shareUrl = `${window.location.origin}/p/${currentSlug}/youtube`;
    if (activeSourceId && activeSourceId !== 'all') {
      shareUrl += `?playlist=${encodeURIComponent(activeSourceId)}`;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: `YouTube Плейлист: ${playlistTitle}`,
          text: `Послушай плейлист «${playlistTitle}» на YouTube через SpotDrop`,
          url: shareUrl,
        });
        onToast('Ссылка на YouTube-плейлист отправлена!', 'info');
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      onToast('Ссылка на YouTube-плейлист скопирована!', 'success');
    } catch {
      onToast('Не удалось скопировать ссылку', 'error');
    }
  };

  // Top lead video for hero artwork
  const leadTrack = linkedTracks[0];
  const leadThumbnail =
    leadTrack?.pinnedThumbnail ||
    (leadTrack?.pinnedVideoId
      ? `https://i.ytimg.com/vi/${leadTrack.pinnedVideoId}/hqdefault.jpg`
      : undefined);

  // Video IDs memoized for API modal
  const apiVideoIds = useMemo(() => {
    if (!isApiModalOpen) return [];
    return linkedTracks.map((t) => t.pinnedVideoId!).filter(Boolean);
  }, [isApiModalOpen, linkedTracks]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Source Switcher Toolbar */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto scrollbar-none pb-1 no-scrollbar">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleSourceChange('all')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeSourceId === 'all'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/25'
                : 'bg-[#161822] hover:bg-[#212433] text-[#B2B9C8] hover:text-white border border-[#2B2F42]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Вся фонотека</span>
            <span className="font-mono text-[11px] opacity-80">
              ({totalPinnedInLibrary})
            </span>
          </button>

          {playlists.map((pl) => {
            const isSelected = activeSourceId === pl.id;
            const count = pl.trackCount || pl.trackIds?.length || 0;
            return (
              <button
                key={pl.id}
                onClick={() => handleSourceChange(pl.id)}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/25'
                    : 'bg-[#161822] hover:bg-[#212433] text-[#B2B9C8] hover:text-white border border-[#2B2F42]'
                }`}
              >
                <Music2 className="w-3.5 h-3.5" />
                <span className="max-w-[120px] truncate">{pl.name}</span>
                <span className="font-mono text-[11px] opacity-75">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Hero / YouTube Playlist Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1F1215] via-[#161822] to-[#12141C] border border-red-500/20 p-5 sm:p-7 shadow-2xl">
        {/* Glow backdrop with GPU transform containment */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-red-600/10 rounded-full blur-3xl pointer-events-none transform-gpu will-change-transform" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-[#00E5FF]/5 rounded-full blur-3xl pointer-events-none transform-gpu will-change-transform" />

        <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6">
          {/* YouTube-styled Playlist Artwork Stack */}
          <div className="relative group shrink-0 w-44 sm:w-56 aspect-video sm:aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#0D0E15]">
            {leadThumbnail ? (
              <img
                src={leadThumbnail}
                alt="Playlist cover"
                loading="eager"
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-red-950 to-[#161822] text-red-500">
                <YouTubeIcon className="w-12 h-12" />
              </div>
            )}

            {/* YouTube Overlay badge */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-between p-2.5">
              <div className="self-start px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/15 text-[10px] font-bold text-white flex items-center space-x-1">
                <YouTubeIcon className="w-3.5 h-3.5" />
                <span>ПЛЕЙЛИСТ</span>
              </div>

              <div className="flex items-center justify-between text-white text-xs font-semibold">
                <span className="font-mono bg-black/70 px-2 py-0.5 rounded-md">
                  {linkedTracks.length} видео
                </span>
                <span className="font-mono text-[11px] text-[#B2B9C8]">
                  {formatTotalDuration(totalDurationSeconds)}
                </span>
              </div>
            </div>

            {/* Play hover button */}
            <button
              onClick={() => handlePlayAll(false)}
              className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-red-600/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100 shadow-xl cursor-pointer"
              title="Воспроизвести всё"
            >
              <Play className="w-6 h-6 fill-current ml-0.5" />
            </button>
          </div>

          {/* Playlist Info & Meta */}
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                <YouTubeIcon className="w-3.5 h-3.5" />
                <span>YouTube Плейлист</span>
              </span>

              <span className="hidden sm:inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/5 text-[#8E95A5] border border-white/10">
                <span>⚡ Без задержек</span>
              </span>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight truncate">
                {playlistTitle}
              </h1>
              <p className="text-xs sm:text-sm text-[#B2B9C8] mt-1 max-w-xl">
                Плейлист составлен из уже известных треков и найденных под ними ссылок на YouTube.
                Готов к моментальному прослушиванию и выгрузке.
              </p>
            </div>

            {/* Stats row */}
            <div className="flex items-center space-x-3 text-xs text-[#8E95A5] flex-wrap gap-y-1">
              <span className="text-white font-bold">{linkedTracks.length} видео</span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Длительность: {formatTotalDuration(totalDurationSeconds)}</span>
              </span>
              {unlinkedCount > 0 && !onlyPinned && (
                <>
                  <span>•</span>
                  <span className="text-amber-400">
                    {unlinkedCount} трек{unlinkedCount === 1 ? '' : 'ов'} без видео
                  </span>
                </>
              )}
            </div>

            {/* Actions Bar */}
            <div className="flex items-center space-x-2 sm:space-x-2.5 pt-1 flex-wrap gap-y-2">
              <button
                onClick={() => handlePlayAll(false)}
                disabled={linkedTracks.length === 0}
                className="flex items-center space-x-1.5 px-4 sm:px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition-all active:scale-95 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
                <span>Слушать всё</span>
              </button>

              <button
                onClick={() => handlePlayAll(true)}
                disabled={linkedTracks.length === 0}
                className="flex items-center space-x-1.5 px-3.5 sm:px-4 py-2.5 rounded-xl bg-[#212433] hover:bg-[#2B2F42] disabled:opacity-40 text-white font-semibold text-xs border border-[#2B2F42] transition-colors cursor-pointer"
                title="Перемешать и воспроизвести"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Перемешать</span>
              </button>

              <button
                onClick={handleSharePlaylistDirect}
                className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-[#212433] hover:bg-[#2B2F42] text-[#B2B9C8] hover:text-[#00E5FF] font-semibold text-xs border border-[#2B2F42] transition-colors cursor-pointer"
                title="Поделиться прямой ссылкой на этот YouTube плейлист"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Поделиться</span>
              </button>

              <button
                onClick={handleCopyAllUrls}
                disabled={linkedTracks.length === 0}
                className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-[#212433] hover:bg-[#2B2F42] disabled:opacity-40 text-[#B2B9C8] hover:text-white font-semibold text-xs border border-[#2B2F42] transition-colors cursor-pointer"
                title="Скопировать все YouTube ссылки"
              >
                {copiedLinks ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Скопировано!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Копировать ссылки</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setIsExportModalOpen(true)}
                disabled={linkedTracks.length === 0}
                className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-[#212433] hover:bg-[#2B2F42] disabled:opacity-40 text-[#B2B9C8] hover:text-white font-semibold text-xs border border-[#2B2F42] transition-colors cursor-pointer"
                title="Экспортировать плейлист в TXT / M3U / JSON"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Экспорт</span>
              </button>

              {/* YouTube API Integration Button */}
              <button
                onClick={() => setIsApiModalOpen(true)}
                className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-red-600/20 to-amber-600/20 hover:from-red-600/30 hover:to-amber-600/30 text-red-300 hover:text-white font-bold text-xs border border-red-500/30 transition-all cursor-pointer"
                title="Подключить YouTube API Key для выгрузки в Google аккаунт"
              >
                <YouTubeIcon className="w-4 h-4" />
                <span>Google API</span>
                <span className="text-[10px] bg-red-500/30 text-red-200 px-1.5 py-0.2 rounded font-mono">
                  Скоро
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#8E95A5] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={`Поиск по названию видео, каналу, артисту среди ${filteredTracks.length} треков...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#161822] border border-[#2B2F42] focus:border-red-500 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-[#8E95A5] outline-none transition-colors"
          />
        </div>

        {/* Sort & Filter controls */}
        <div className="flex items-center space-x-2 shrink-0">
          <div className="flex items-center space-x-1.5 bg-[#161822] border border-[#2B2F42] rounded-xl px-3 py-2 text-xs text-[#B2B9C8]">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#8E95A5]" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="bg-transparent text-white outline-none cursor-pointer text-xs"
            >
              <option value="default" className="bg-[#161822]">
                Порядок плейлиста
              </option>
              <option value="title" className="bg-[#161822]">
                По названию видео
              </option>
              <option value="channel" className="bg-[#161822]">
                По автору / каналу
              </option>
              <option value="duration_desc" className="bg-[#161822]">
                Длинные сначала
              </option>
              <option value="duration_asc" className="bg-[#161822]">
                Короткие сначала
              </option>
            </select>
          </div>

          {unlinkedCount > 0 && (
            <button
              onClick={() => setOnlyPinned(!onlyPinned)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                onlyPinned
                  ? 'bg-red-500/15 border-red-500/40 text-red-300'
                  : 'bg-[#161822] border-[#2B2F42] text-[#8E95A5]'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{onlyPinned ? 'Только с YouTube' : 'Все треки'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Videos List */}
      {filteredTracks.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-[#161822] border border-[#2B2F42] flex items-center justify-center mb-3 text-red-500">
            <YouTubeIcon className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">
            {deferredSearchQuery.trim() ? 'Ничего не найдено' : 'Нет доступных YouTube ссылок'}
          </h3>
          <p className="text-xs text-[#8E95A5] max-w-sm mb-4">
            {deferredSearchQuery.trim()
              ? `По запросу «${deferredSearchQuery}» ничего не найдено в этом YouTube плейлисте`
              : 'Для треков в этом плейлисте пока нет закрепленных ссылок на YouTube'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleTracks.map((track, idx) => {
            const isCurrent = currentTrack?.id === track.id;
            const isTrackPlaying = isCurrent && isPlaying;

            return (
              <YouTubeTrackRow
                key={track.id}
                track={track}
                index={idx}
                isCurrent={isCurrent}
                isTrackPlaying={isTrackPlaying}
                onPlay={handleRowPlay}
                onCopyUrl={handleCopySingleUrl}
                onOpenPicker={onOpenPicker}
                onAddToPlaylist={onAddToPlaylist}
                onToggleFavorite={onToggleFavorite}
              />
            );
          })}
        </div>
      )}

      {/* Sentinel for infinite scroll */}
      {visibleCount < filteredTracks.length && (
        <div ref={sentinelRef} className="py-8 flex justify-center">
          <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Google YouTube API Modal */}
      <YouTubeApiModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        playlistTitle={playlistTitle}
        videoIds={apiVideoIds}
        onToast={onToast}
      />

      {/* YouTube Export Modal */}
      <YouTubeExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        playlistTitle={playlistTitle}
        tracks={linkedTracks}
        onToast={onToast}
      />
    </div>
  );
};
