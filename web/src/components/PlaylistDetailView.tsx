import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Play,
  Pause,
  Shuffle,
  Share2,
  Search,
  ListMusic,
  Clock,
  Heart,
  Sliders,
  Pin,
  Plus,
  Trash2,
  FolderPlus,
} from 'lucide-react';
import type { Playlist, TrackCell } from '../types';

interface PlaylistDetailViewProps {
  playlist: Playlist;
  tracks: TrackCell[];
  currentTrack: TrackCell | null;
  isPlaying: boolean;
  onBack: () => void;
  onPlayTrack: (track: TrackCell) => void;
  onPlayAll: (shuffle?: boolean) => void;
  onOpenPicker: (track: TrackCell) => void;
  onToggleFavorite: (trackId: string) => void;
  onAddToPlaylist: (track: TrackCell) => void;
  onShareTrack: (track: TrackCell) => void;
  onSharePlaylist: (playlist: Playlist) => void;
  onRemoveFromPlaylist: (trackId: string) => void;
}

export const PlaylistDetailView: React.FC<PlaylistDetailViewProps> = ({
  playlist,
  tracks,
  currentTrack,
  isPlaying,
  onBack,
  onPlayTrack,
  onPlayAll,
  onOpenPicker,
  onToggleFavorite,
  onAddToPlaylist,
  onShareTrack,
  onSharePlaylist,
  onRemoveFromPlaylist,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Map tracks preserving exact order from playlist.trackIds
  const orderedTracks = useMemo(() => {
    const trackMap = new Map<string, TrackCell>();
    for (const t of tracks) {
      trackMap.set(t.id, t);
      // Also map normalized key for fallback
      const normKey = `${t.artist.toLowerCase().trim()}|${t.title.toLowerCase().trim()}`;
      trackMap.set(normKey, t);
    }

    const list: TrackCell[] = [];
    const ids = Array.isArray(playlist.trackIds) ? playlist.trackIds : [];

    for (const id of ids) {
      const match = trackMap.get(id);
      if (match) {
        list.push(match);
      }
    }

    return list;
  }, [playlist.trackIds, tracks]);

  const filteredTracks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return orderedTracks;
    return orderedTracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q)
    );
  }, [orderedTracks, searchQuery]);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-xs font-semibold text-[#8E95A5] hover:text-[#00E5FF] transition-colors cursor-pointer group"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
        <span>Назад ко всем плейлистам</span>
      </button>

      {/* Playlist Hero Header */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#161822] via-[#1D2130] to-[#161822] border border-[#2B2F42] shadow-xl flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-tr from-cyan-500/30 to-blue-600/30 border border-cyan-500/30 flex items-center justify-center text-[#00E5FF] shadow-2xl shrink-0">
          <ListMusic className="w-12 h-12" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 text-[11px] font-bold text-[#00E5FF] uppercase tracking-wider mb-1">
            <span>Плейлист Spotify</span>
            <span>•</span>
            <span>GDPR Export</span>
          </div>

          <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight leading-tight truncate mb-2">
            {playlist.name}
          </h1>

          <div className="flex items-center space-x-2 text-xs text-[#8E95A5] flex-wrap gap-y-1">
            <span className="text-white font-semibold">{orderedTracks.length} треков</span>
            {playlist.lastModifiedDate && (
              <>
                <span>•</span>
                <span className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>Изменен {playlist.lastModifiedDate}</span>
                </span>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2.5 mt-4 flex-wrap gap-y-2">
            <button
              onClick={() => onPlayAll(false)}
              disabled={orderedTracks.length === 0}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#00E5FF] hover:bg-[#00E5FF]/90 disabled:opacity-40 text-[#0D0E15] font-bold text-xs shadow-lg shadow-[#00E5FF]/20 transition-all active:scale-95 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
              <span>Слушать всё</span>
            </button>

            <button
              onClick={() => onPlayAll(true)}
              disabled={orderedTracks.length === 0}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#212433] hover:bg-[#2B2F42] disabled:opacity-40 text-[#F3F4F6] font-semibold text-xs border border-[#2B2F42] transition-colors cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>Перемешать</span>
            </button>

            <button
              onClick={() => onSharePlaylist(playlist)}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#212433] hover:bg-[#2B2F42] text-[#B2B9C8] hover:text-[#00E5FF] text-xs font-semibold border border-[#2B2F42] transition-colors cursor-pointer"
              title="Поделиться ссылкой на плейлист"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Поделиться</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search in Playlist */}
      <div className="relative">
        <Search className="w-4 h-4 text-[#8E95A5] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder={`Поиск среди ${orderedTracks.length} треков в «${playlist.name}»...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#161822] border border-[#2B2F42] focus:border-[#00E5FF] rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-[#8E95A5] outline-none transition-colors"
        />
      </div>

      {/* Tracks List */}
      {filteredTracks.length === 0 ? (
        <div className="py-16 text-center text-xs text-[#8E95A5]">
          {orderedTracks.length === 0
            ? 'В этом плейлисте пока нет треков. Добавьте треки с помощью кнопки «+» на любом треке!'
            : `Ничего не найдено по запросу «${searchQuery}»`}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTracks.map((track, idx) => {
            const isCurrent = currentTrack?.id === track.id;
            const isTrackPlaying = isCurrent && isPlaying;

            return (
              <div
                key={track.id + '_' + idx}
                onClick={() => onPlayTrack(track)}
                className={`group flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-[#1D2130] border-[#00E5FF]/60 shadow-lg shadow-[#00E5FF]/5'
                    : 'bg-[#161822] hover:bg-[#1D202D] border-[#2B2F42] hover:border-[#00E5FF]/30'
                }`}
              >
                <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                  {/* Position number / Play button */}
                  <div className="w-8 flex items-center justify-center shrink-0">
                    <span className="text-xs font-mono font-semibold text-[#8E95A5] group-hover:hidden">
                      {idx + 1}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayTrack(track);
                      }}
                      className={`w-7 h-7 rounded-full hidden group-hover:flex items-center justify-center transition-transform active:scale-95 cursor-pointer ${
                        isTrackPlaying
                          ? 'bg-[#00E5FF] text-[#0D0E15]'
                          : 'bg-[#00E5FF] text-[#0D0E15]'
                      }`}
                    >
                      {isTrackPlaying ? (
                        <Pause className="w-3.5 h-3.5 fill-current" />
                      ) : (
                        <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />
                      )}
                    </button>
                  </div>

                  {/* Track Info */}
                  <div className="min-w-0 flex-1">
                    <h3
                      className={`text-sm font-semibold truncate ${
                        isCurrent ? 'text-[#00E5FF]' : 'text-white group-hover:text-[#00E5FF]'
                      }`}
                    >
                      {track.title}
                    </h3>
                    <p className="text-xs text-[#8E95A5] truncate">
                      {track.artist} <span className="text-[#8E95A5]/60">•</span> {track.album}
                    </p>

                    <div className="flex items-center space-x-2 mt-1">
                      {track.pinnedVideoId ? (
                        <span className="inline-flex items-center space-x-1 text-[10px] font-semibold text-[#00E5FF] bg-[#00E5FF]/10 px-1.5 py-0.5 rounded border border-[#00E5FF]/20">
                          <Pin className="w-2.5 h-2.5 fill-current" />
                          <span>Pinned</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-[#8E95A5] bg-[#212433] px-1.5 py-0.5 rounded">
                          ⚡ Auto
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-1.5 ml-2 shrink-0">
                  {/* Share Track */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onShareTrack(track);
                    }}
                    className="p-1.5 rounded-lg text-[#8E95A5] hover:text-[#00E5FF] hover:bg-[#212433] transition-colors cursor-pointer"
                    title="Поделиться треком"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>

                  {/* Add to Playlist */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToPlaylist(track);
                    }}
                    className="p-1.5 rounded-lg text-[#8E95A5] hover:text-[#00E5FF] hover:bg-[#212433] transition-colors cursor-pointer"
                    title="Добавить в плейлист"
                  >
                    <FolderPlus className="w-4 h-4" />
                  </button>

                  {/* Favorite */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(track.id);
                    }}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      track.isFavorite
                        ? 'text-[#FF2E93] hover:text-[#FF2E93]/80'
                        : 'text-[#8E95A5] hover:text-white'
                    }`}
                    title={track.isFavorite ? 'Удалить из избранного' : 'В избранное'}
                  >
                    <Heart className={`w-4 h-4 ${track.isFavorite ? 'fill-[#FF2E93]' : ''}`} />
                  </button>

                  {/* Version Picker */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenPicker(track);
                    }}
                    className="p-1.5 rounded-lg bg-[#212433] text-[#8E95A5] hover:text-[#00E5FF] transition-colors cursor-pointer"
                    title="Выбрать версию на YouTube"
                  >
                    <Sliders className="w-4 h-4" />
                  </button>

                  {/* Remove from this playlist */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFromPlaylist(track.id);
                    }}
                    className="p-1.5 rounded-lg text-[#8E95A5] hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                    title="Удалить из этого плейлиста"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
