import React, {
  memo,
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import {
  ChevronDown,
  Play,
  Pause,
  Shuffle,
  Trash2,
  Sliders,
  Heart,
  X,
  Pin,
  ListMusic,
  Search,
  Sparkles,
  LocateFixed,
} from 'lucide-react';
import { usePlayer, usePlayerTime, parseDurationText } from '../player/playerContext';
import type { TrackCell } from '../types';

interface PlaylistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPicker: (track: TrackCell) => void;
  onToggleFavorite: (trackId: string) => void;
}

type TabMode = 'all' | 'upcoming' | 'favorites';

export const PlaylistDrawer = memo<PlaylistDrawerProps>(function PlaylistDrawer({
  isOpen,
  onClose,
  onOpenPicker,
  onToggleFavorite,
}) {
  const {
    currentTrack,
    activeCandidate,
    isPlaying,
    queue,
    queueIndex,
    isShuffle,
    toggleShuffle,
    shuffleQueue,
    playFromQueue,
    removeFromQueue,
    clearQueue,
    togglePlayPause,
    playNext,
  } = usePlayer();

  const { currentTime, duration } = usePlayerTime();

  const [activeTab, setActiveTab] = useState<TabMode>('all');
  const [filterQuery, setFilterQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const activeTrackRef = useRef<HTMLDivElement | null>(null);
  const touchStartY = useRef<number>(0);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Touch gesture for mobile pull-to-close
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const deltaY = e.touches[0].clientY - touchStartY.current;
    if (deltaY > 80) {
      onClose();
    }
  };

  // Scroll to active playing track
  const scrollToCurrentTrack = useCallback(() => {
    if (activeTrackRef.current) {
      activeTrackRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, []);

  // Format seconds to mm:ss or hh:mm:ss
  const formatSeconds = (secs: number) => {
    if (!Number.isFinite(secs) || isNaN(secs) || secs <= 0) return '0:00';
    const total = Math.floor(secs);
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const rem = total % 60;
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${rem < 10 ? '0' : ''}${rem}`;
    }
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  // Calculate estimated total remaining duration of queue
  const totalQueueDurationText = useMemo(() => {
    let totalSecs = 0;
    for (let i = 0; i < queue.length; i++) {
      const dur = parseDurationText(queue[i].pinnedDuration);
      totalSecs += dur > 0 ? dur : 210; // fallback ~3.5m
    }
    const mins = Math.round(totalSecs / 60);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `~${hrs} ч ${remMins} мин`;
    }
    return `~${mins} мин`;
  }, [queue]);

  // Filtered queue items based on active tab and search query
  const displayedItems = useMemo(() => {
    let items = queue.map((track, originalIndex) => ({ track, originalIndex }));

    if (activeTab === 'upcoming') {
      items = items.slice(queueIndex + 1);
    } else if (activeTab === 'favorites') {
      items = items.filter((item) => item.track.isFavorite);
    }

    if (filterQuery.trim()) {
      const q = filterQuery.trim().toLowerCase();
      items = items.filter(
        (item) =>
          item.track.title.toLowerCase().includes(q) ||
          item.track.artist.toLowerCase().includes(q) ||
          item.track.album.toLowerCase().includes(q)
      );
    }

    return items;
  }, [queue, queueIndex, activeTab, filterQuery]);

  const upcomingCount = Math.max(0, queue.length - queueIndex - 1);

  return (
    <>
      {/* Dimmed backdrop overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* Slide-up Playlist Drawer from Footer */}
      <div
        className={`fixed inset-x-0 bottom-0 z-45 flex flex-col justify-end pointer-events-none transition-all duration-300 ease-out`}
      >
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          className={`pointer-events-auto w-full max-w-4xl mx-auto h-[82vh] max-h-[820px] bg-[#12141F]/98 backdrop-blur-2xl border-t border-x border-[#2B2F42] rounded-t-3xl shadow-[0_-16px_50px_rgba(0,0,0,0.85)] flex flex-col mb-[66px] sm:mb-[72px] transition-transform duration-300 cubic-bezier(0.16, 1, 0.3, 1) transform ${
            isOpen ? 'translate-y-0' : 'translate-y-[calc(100%+80px)]'
          }`}
        >
          {/* Top Pill / Drag Handle for touch dismissal */}
          <div
            onClick={onClose}
            className="w-full pt-2.5 pb-1 flex justify-center cursor-pointer group"
            title="Нажмите или потяните вниз, чтобы свернуть"
          >
            <div className="w-12 h-1.5 bg-[#2B2F42] group-hover:bg-[#00E5FF]/60 rounded-full transition-colors" />
          </div>

          {/* Drawer Header */}
          <div className="px-4 sm:px-6 py-2.5 border-b border-[#2B2F42]/80 flex items-center justify-between shrink-0">
            {/* Title & Stats */}
            <div className="flex items-center space-x-3 min-w-0">
              <button
                onClick={onClose}
                className="p-1.5 -ml-1 text-[#8E95A5] hover:text-[#00E5FF] hover:bg-[#212433] rounded-xl transition-all cursor-pointer"
                title="Свернуть плейлист"
              >
                <ChevronDown className="w-5 h-5" />
              </button>

              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <h3 className="text-base sm:text-lg font-bold text-[#F3F4F6] truncate flex items-center space-x-2">
                    <ListMusic className="w-4 h-4 text-[#00E5FF] shrink-0" />
                    <span>Очередь воспроизведения</span>
                  </h3>
                  {isShuffle && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30 hidden sm:inline-flex">
                      Shuffle
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#8E95A5] truncate">
                  <span>{queue.length} треков</span>
                  <span className="mx-1.5">•</span>
                  <span>{totalQueueDurationText}</span>
                  {queueIndex >= 0 && queueIndex < queue.length && (
                    <>
                      <span className="mx-1.5 hidden sm:inline">•</span>
                      <span className="text-[#00E5FF] hidden sm:inline">
                        Играет #{queueIndex + 1}
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Quick Actions in Header */}
            <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
              {/* Search Toggle */}
              <button
                onClick={() => {
                  setShowSearch(!showSearch);
                  if (showSearch) setFilterQuery('');
                }}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  showSearch || filterQuery
                    ? 'text-[#00E5FF] bg-[#00E5FF]/15 border border-[#00E5FF]/30'
                    : 'text-[#8E95A5] hover:text-[#F3F4F6] hover:bg-[#212433]'
                }`}
                title="Поиск в плейлисте"
              >
                <Search className="w-4 h-4" />
              </button>

              {/* Scroll to current track */}
              {currentTrack && (
                <button
                  onClick={scrollToCurrentTrack}
                  className="p-2 text-[#8E95A5] hover:text-[#00E5FF] hover:bg-[#212433] rounded-xl transition-all cursor-pointer hidden sm:flex"
                  title="Перейти к текущему треку"
                >
                  <LocateFixed className="w-4 h-4" />
                </button>
              )}

              {/* Shuffle button */}
              <button
                onClick={isShuffle ? shuffleQueue : toggleShuffle}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isShuffle
                    ? 'text-[#00E5FF] bg-[#00E5FF]/15 border border-[#00E5FF]/40 shadow-[0_0_12px_rgba(0,229,255,0.2)]'
                    : 'text-[#8E95A5] hover:text-[#F3F4F6] bg-[#212433] hover:bg-[#2B2F42]'
                }`}
                title={isShuffle ? 'Перемешать очередь заново' : 'Включить Shuffle'}
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {isShuffle ? 'Перемешать' : 'Shuffle'}
                </span>
              </button>

              {/* Clear Queue */}
              {queue.length > 1 && (
                <button
                  onClick={clearQueue}
                  className="p-2 text-[#8E95A5] hover:text-[#FF2E93] hover:bg-[#FF2E93]/10 rounded-xl transition-all cursor-pointer"
                  title="Очистить очередь (оставить текущий трек)"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Optional In-Drawer Search Input */}
          {showSearch && (
            <div className="px-4 sm:px-6 py-2 bg-[#161822] border-b border-[#2B2F42] flex items-center space-x-2 shrink-0 animate-fadeIn">
              <Search className="w-4 h-4 text-[#8E95A5] shrink-0" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Поиск по названию, артисту или альбому в очереди..."
                autoFocus
                className="w-full bg-transparent text-sm text-[#F3F4F6] placeholder-[#8E95A5] outline-none"
              />
              {filterQuery && (
                <button
                  onClick={() => setFilterQuery('')}
                  className="text-xs text-[#8E95A5] hover:text-[#F3F4F6] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Filter Tabs: Все / Далее / Избранные */}
          <div className="px-4 sm:px-6 pt-3 pb-2 flex items-center space-x-2 shrink-0 border-b border-[#2B2F42]/50 text-xs">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40'
                  : 'text-[#8E95A5] hover:text-[#F3F4F6] hover:bg-[#212433]'
              }`}
            >
              Все ({queue.length})
            </button>
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === 'upcoming'
                  ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40'
                  : 'text-[#8E95A5] hover:text-[#F3F4F6] hover:bg-[#212433]'
              }`}
            >
              Далее ({upcomingCount})
            </button>
            <button
              onClick={() => setActiveTab('favorites')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === 'favorites'
                  ? 'bg-[#FF2E93]/20 text-[#FF2E93] border border-[#FF2E93]/40'
                  : 'text-[#8E95A5] hover:text-[#F3F4F6] hover:bg-[#212433]'
              }`}
            >
              Избранные ({queue.filter((t) => t.isFavorite).length})
            </button>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 space-y-4">
            {/* Section 1: "СЕЙЧАС ИГРАЕТ" (Now Playing Card) */}
            {currentTrack && activeTab !== 'upcoming' && !filterQuery && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#8E95A5] uppercase tracking-wider">
                  <span className="flex items-center space-x-1.5 text-[#00E5FF]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Сейчас играет</span>
                  </span>
                  <span className="text-[11px] font-mono text-[#8E95A5]">
                    {formatSeconds(currentTime)} / {formatSeconds(duration)}
                  </span>
                </div>

                <div
                  ref={activeTrackRef}
                  className="p-3.5 rounded-2xl bg-gradient-to-r from-[#171B2B] via-[#1A1F33] to-[#141624] border border-[#00E5FF]/50 shadow-[0_4px_24px_rgba(0,229,255,0.12)] flex items-center justify-between space-x-3 group"
                >
                  <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                    {/* Artwork with live equalizer animation */}
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-[#00E5FF]/40 bg-[#0D0E15]">
                      {activeCandidate?.thumbnailUrl ? (
                        <img
                          src={activeCandidate.thumbnailUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl">
                          🎵
                        </div>
                      )}

                      {/* Animated Soundwave Equalizer overlay */}
                      {isPlaying && (
                        <div className="absolute inset-0 bg-black/45 flex items-end justify-center pb-2.5 space-x-1">
                          <div className="w-1 bg-[#00E5FF] rounded-full animate-soundwave-1" />
                          <div className="w-1 bg-[#00E5FF] rounded-full animate-soundwave-2" />
                          <div className="w-1 bg-[#00E5FF] rounded-full animate-soundwave-3" />
                          <div className="w-1 bg-[#00E5FF] rounded-full animate-soundwave-4" />
                        </div>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-[#00E5FF] truncate">
                        {currentTrack.title}
                      </h4>
                      <p className="text-xs text-[#F3F4F6] truncate mt-0.5">
                        {currentTrack.artist}
                        <span className="text-[#8E95A5] mx-1.5">•</span>
                        <span className="text-[#B2B9C8]">{currentTrack.album}</span>
                      </p>

                      <div className="flex items-center space-x-2 mt-1">
                        {currentTrack.pinnedVideoId ? (
                          <span className="inline-flex items-center space-x-1 text-[10px] font-semibold text-[#00E5FF] bg-[#00E5FF]/10 px-1.5 py-0.5 rounded border border-[#00E5FF]/20">
                            <Pin className="w-2.5 h-2.5 fill-current" />
                            <span>Pinned</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-[10px] font-medium text-[#8E95A5] bg-[#212433] px-1.5 py-0.5 rounded">
                            <span>Auto Match</span>
                          </span>
                        )}
                        {currentTrack.tags
                          .filter((t) => t !== '#all')
                          .slice(0, 2)
                          .map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] text-[#FF2E93] bg-[#FF2E93]/10 px-1.5 py-0.5 rounded border border-[#FF2E93]/20"
                            >
                              {tag}
                            </span>
                          ))}
                      </div>
                    </div>
                  </div>

                  {/* Controls on Now Playing card */}
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                      onClick={() => onToggleFavorite(currentTrack.id)}
                      className={`p-2 rounded-xl transition-colors cursor-pointer ${
                        currentTrack.isFavorite
                          ? 'text-[#FF2E93] hover:text-[#FF2E93]/80'
                          : 'text-[#8E95A5] hover:text-[#F3F4F6]'
                      }`}
                      title={
                        currentTrack.isFavorite
                          ? 'Удалить из избранного'
                          : 'Добавить в избранное'
                      }
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          currentTrack.isFavorite ? 'fill-[#FF2E93]' : ''
                        }`}
                      />
                    </button>

                    <button
                      onClick={() => onOpenPicker(currentTrack)}
                      className="p-2 rounded-xl text-[#00E5FF] hover:bg-[#00E5FF]/15 border border-[#00E5FF]/30 transition-all cursor-pointer"
                      title="Выбрать версию YouTube"
                    >
                      <Sliders className="w-4 h-4" />
                    </button>

                    <button
                      onClick={togglePlayPause}
                      className="w-10 h-10 rounded-full bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-[#0D0E15] flex items-center justify-center shadow-md shadow-[#00E5FF]/30 transition-transform active:scale-95 cursor-pointer ml-1"
                      title={isPlaying ? 'Пауза' : 'Воспроизведение'}
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 ml-0.5 fill-current" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Section 2: "ДАЛЕЕ В ОЧЕРЕДИ" / Track List */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs font-semibold text-[#8E95A5] uppercase tracking-wider">
                <span>
                  {activeTab === 'upcoming'
                    ? `Далее в очереди (${displayedItems.length})`
                    : activeTab === 'favorites'
                    ? `Избранные треки в очереди (${displayedItems.length})`
                    : `Все треки в очереди (${displayedItems.length})`}
                </span>
                {activeTab === 'all' && (
                  <span className="text-[11px] text-[#8E95A5] lowercase font-normal">
                    нажмите на трек для перехода
                  </span>
                )}
              </div>

              {displayedItems.length === 0 ? (
                <div className="py-12 text-center space-y-2 bg-[#161822]/40 rounded-2xl border border-[#2B2F42] p-6">
                  <div className="w-10 h-10 mx-auto rounded-full bg-[#212433] flex items-center justify-center text-lg">
                    {filterQuery ? '🔍' : '🔀'}
                  </div>
                  <h4 className="text-sm font-semibold text-[#F3F4F6]">
                    {filterQuery ? 'Ничего не найдено' : 'В этой секции нет треков'}
                  </h4>
                  <p className="text-xs text-[#8E95A5]">
                    {filterQuery
                      ? 'Попробуйте изменить поисковый запрос'
                      : activeTab === 'upcoming'
                      ? 'Очередь подошла к концу или играет последний трек'
                      : 'Добавьте треки в очередь или перемешайте плейлист'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {displayedItems.map(({ track, originalIndex }) => {
                    const isCurrent = currentTrack?.id === track.id;
                    const isPassed = originalIndex < queueIndex;

                    return (
                      <div
                        key={`${track.id}-${originalIndex}`}
                        onClick={() => playFromQueue(originalIndex)}
                        className={`group flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-[#1A1F33] border-[#00E5FF]/60 shadow-md shadow-[#00E5FF]/10'
                            : isPassed
                            ? 'bg-[#141622]/60 hover:bg-[#1A1D2B] border-[#232738] opacity-65 hover:opacity-100'
                            : 'bg-[#161822] hover:bg-[#1D2130] border-[#2B2F42] hover:border-[#00E5FF]/30'
                        }`}
                      >
                        {/* Left: Index / Play Icon & Track Details */}
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          {/* Number or Equalizer / Play icon */}
                          <div className="w-7 text-center shrink-0 flex items-center justify-center">
                            {isCurrent && isPlaying ? (
                              <div className="flex items-end justify-center space-x-0.5 h-3.5">
                                <div className="w-0.5 bg-[#00E5FF] rounded-full animate-soundwave-1" />
                                <div className="w-0.5 bg-[#00E5FF] rounded-full animate-soundwave-2" />
                                <div className="w-0.5 bg-[#00E5FF] rounded-full animate-soundwave-3" />
                              </div>
                            ) : (
                              <>
                                <span
                                  className={`text-xs font-mono font-semibold group-hover:hidden ${
                                    isCurrent ? 'text-[#00E5FF]' : 'text-[#8E95A5]'
                                  }`}
                                >
                                  {originalIndex + 1}
                                </span>
                                <Play
                                  className={`w-3.5 h-3.5 hidden group-hover:block fill-current ${
                                    isCurrent ? 'text-[#00E5FF]' : 'text-[#F3F4F6]'
                                  }`}
                                />
                              </>
                            )}
                          </div>

                          {/* Compact Thumbnail */}
                          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-[#0D0E15] border border-[#2B2F42]/80">
                            {track.pinnedThumbnail ? (
                              <img
                                src={track.pinnedThumbnail}
                                alt=""
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-[#8E95A5]">
                                🎵
                              </div>
                            )}
                          </div>

                          {/* Track Title & Artist */}
                          <div className="min-w-0 flex-1">
                            <h5
                              className={`text-xs sm:text-sm font-semibold truncate ${
                                isCurrent
                                  ? 'text-[#00E5FF]'
                                  : 'text-[#F3F4F6] group-hover:text-white'
                              }`}
                            >
                              {track.title}
                            </h5>
                            <p className="text-[11px] text-[#B2B9C8] truncate">
                              {track.artist}
                              {track.album && (
                                <>
                                  <span className="text-[#8E95A5] mx-1">•</span>
                                  <span className="text-[#8E95A5]">{track.album}</span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Right: Duration & Hover Actions */}
                        <div className="flex items-center space-x-1.5 ml-2 shrink-0">
                          {/* Duration */}
                          {track.pinnedDuration && (
                            <span className="text-xs font-mono text-[#8E95A5] mr-1 hidden sm:inline">
                              {track.pinnedDuration}
                            </span>
                          )}

                          {/* Favorite toggle */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFavorite(track.id);
                            }}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              track.isFavorite
                                ? 'text-[#FF2E93] hover:text-[#FF2E93]/80'
                                : 'text-[#8E95A5] opacity-0 group-hover:opacity-100 hover:text-[#F3F4F6]'
                            }`}
                            title={
                              track.isFavorite
                                ? 'Удалить из избранного'
                                : 'Добавить в избранное'
                            }
                          >
                            <Heart
                              className={`w-3.5 h-3.5 ${
                                track.isFavorite ? 'fill-[#FF2E93]' : ''
                              }`}
                            />
                          </button>

                          {/* YouTube Version Selector */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenPicker(track);
                            }}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                              track.pinnedVideoId
                                ? 'text-[#00E5FF] bg-[#00E5FF]/10 hover:bg-[#00E5FF]/20'
                                : 'text-[#8E95A5] opacity-0 group-hover:opacity-100 hover:text-[#00E5FF] hover:bg-[#212433]'
                            }`}
                            title="Выбрать версию YouTube"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>

                          {/* Remove from queue */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromQueue(originalIndex);
                            }}
                            className="p-1.5 rounded-lg text-[#8E95A5] opacity-0 group-hover:opacity-100 hover:text-[#FF2E93] hover:bg-[#FF2E93]/10 transition-all cursor-pointer"
                            title="Удалить из очереди"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
});
