import React, { memo } from 'react';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Volume2, VolumeX, Pin, ListMusic, ChevronDown, ChevronUp } from 'lucide-react';
import { usePlayer, usePlayerTime } from '../player/playerContext';

export const BottomPlayerBar: React.FC = memo(function BottomPlayerBar() {
  const {
    currentTrack,
    activeCandidate,
    isPlaying,
    isBuffering,
    togglePlayPause,
    playNext,
    playPrevious,
    seekTo,
    isShuffle,
    toggleShuffle,
    isQueueView,
    toggleQueueView,
    queue,
    volume,
    setVolume,
    audioError,
  } = usePlayer();

  const { currentTime, duration, progressPercent } = usePlayerTime();

  if (!currentTrack) return null;

  const formatTime = (secs: number) => {
    if (!Number.isFinite(secs) || isNaN(secs) || secs <= 0) {
      return '0:00';
    }
    const totalSeconds = Math.floor(secs);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const remaining = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${mins < 10 ? '0' : ''}${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
    }
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!Number.isFinite(duration) || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const targetSeconds = (clickX / rect.width) * duration;
    seekTo(Math.max(0, Math.min(duration, targetSeconds)));
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-[#161822] border-t border-[#2B2F42] shadow-2xl backdrop-blur-md">
      {/* Clickable Progress Bar */}
      <div
        onClick={handleSeek}
        className="w-full h-1.5 bg-[#2B2F42] hover:h-2 transition-all cursor-pointer group relative"
      >
        <div
          className="h-full bg-[#00E5FF] transition-[width] duration-150 ease-linear relative"
          style={{ width: `${progressPercent}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      <div className="px-4 py-2.5 flex items-center justify-between max-w-7xl mx-auto">
        {/* Left: Track Info & Artwork (Click to expand/collapse playlist) */}
        <div
          onClick={toggleQueueView}
          className="flex items-center space-x-3 min-w-0 max-w-[40%] sm:max-w-xs cursor-pointer group select-none"
          title={isQueueView ? 'Свернуть плейлист' : 'Открыть плейлист'}
        >
          <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-[#2B2F42] group-hover:border-[#00E5FF]/60 bg-[#0D0E15] transition-colors">
            {activeCandidate?.thumbnailUrl ? (
              <img
                src={activeCandidate.thumbnailUrl}
                alt=""
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl">🎵</div>
            )}
            {isBuffering && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-[#00E5FF] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {/* Subtle expand indicator icon on hover */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[#00E5FF]">
              {isQueueView ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-[#F3F4F6] group-hover:text-[#00E5FF] transition-colors truncate">
              {currentTrack.title}
            </h4>
            <div className="flex items-center space-x-1.5 text-xs text-[#B2B9C8]">
              <span className="truncate">{currentTrack.artist}</span>
              <span className="text-[#8E95A5]">•</span>
              {currentTrack.pinnedVideoId ? (
                <span className="text-[#00E5FF] font-medium shrink-0 flex items-center space-x-0.5">
                  <Pin className="w-2.5 h-2.5 fill-current" />
                  <span>Pinned</span>
                </span>
              ) : (
                <span className="text-[#8E95A5] shrink-0">Auto</span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Playback Controls */}
        <div className="flex flex-col items-center space-y-1">
          <div className="flex items-center space-x-3 sm:space-x-5">
            <button
              onClick={toggleShuffle}
              className={`p-1.5 transition-all cursor-pointer hidden sm:flex items-center justify-center rounded-lg ${
                isShuffle
                  ? 'text-[#00E5FF] bg-[#00E5FF]/15 shadow-[0_0_12px_rgba(0,229,255,0.25)]'
                  : 'text-[#8E95A5] hover:text-[#00E5FF]'
              }`}
              title={isShuffle ? 'Shuffle включен (нажмите для выключения)' : 'Shuffle выключен (нажмите для включения)'}
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button
              onClick={playPrevious}
              className="p-1.5 text-[#B2B9C8] hover:text-[#F3F4F6] transition-colors cursor-pointer"
              title="Previous"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            <button
              onClick={togglePlayPause}
              className="w-10 h-10 rounded-full bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-[#0D0E15] flex items-center justify-center shadow-lg shadow-[#00E5FF]/20 transition-transform active:scale-95 cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 ml-0.5 fill-current" />
              )}
            </button>

            <button
              onClick={playNext}
              className="p-1.5 text-[#B2B9C8] hover:text-[#F3F4F6] transition-colors cursor-pointer"
              title="Next"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
          </div>

          {audioError ? (
            <div className="text-[11px] text-[#FF2E93] font-semibold truncate max-w-xs">
              ⚠️ {audioError}
            </div>
          ) : (
            <div className="text-[11px] font-mono text-[#8E95A5] hidden sm:block">
              <span>{formatTime(currentTime)}</span>
              <span className="mx-1">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          )}
        </div>

        {/* Right: Volume & Queue (Desktop/Mobile) */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          <button
            onClick={toggleQueueView}
            className={`p-2 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
              isQueueView
                ? 'text-[#00E5FF] bg-[#00E5FF]/20 border border-[#00E5FF]/40 shadow-[0_0_12px_rgba(0,229,255,0.25)]'
                : 'text-[#8E95A5] hover:text-[#F3F4F6] hover:bg-[#2B2F42]/50'
            }`}
            title={isQueueView ? 'Свернуть плейлист' : `Открыть плейлист (${queue.length} треков)`}
          >
            {isQueueView ? <ChevronDown className="w-4 h-4" /> : <ListMusic className="w-4 h-4" />}
            {queue.length > 0 && (
              <span className="text-[10px] font-mono font-bold leading-none hidden sm:inline">
                {queue.length}
              </span>
            )}
          </button>

          <div className="hidden md:flex items-center space-x-2">
            <button
              onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
              className="text-[#8E95A5] hover:text-[#F3F4F6] transition-colors cursor-pointer"
            >
              {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-20 accent-[#00E5FF] cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
});
