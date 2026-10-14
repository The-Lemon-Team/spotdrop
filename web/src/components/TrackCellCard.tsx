import React, { memo } from 'react';
import { Play, Pause, Heart, Sliders, Pin } from 'lucide-react';
import type { TrackCell } from '../types';

interface TrackCellCardProps {
  track: TrackCell;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: (track: TrackCell) => void;
  onOpenPicker: (track: TrackCell) => void;
  onToggleFavorite: (trackId: string) => void;
}

export const TrackCellCard = memo<TrackCellCardProps>(function TrackCellCard({
  track,
  isCurrent,
  isPlaying,
  onPlay,
  onOpenPicker,
  onToggleFavorite,
}) {
  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPlay(track);
  };

  return (
    <div
      onClick={handlePlay}
      className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
        isCurrent
          ? 'bg-[#1D2130] border-[#00E5FF]/60 shadow-lg shadow-[#00E5FF]/5'
          : 'bg-[#161822] hover:bg-[#1D202D] border-[#2B2F42] hover:border-[#00E5FF]/30'
      }`}
    >
      <div className="flex items-center space-x-3.5 min-w-0 flex-1">
        {/* Play/Pause Button */}
        <button
          onClick={handlePlay}
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer ${
            isCurrent && isPlaying
              ? 'bg-[#00E5FF] text-[#0D0E15]'
              : 'bg-[#212433] group-hover:bg-[#00E5FF] text-[#00E5FF] group-hover:text-[#0D0E15]'
          }`}
        >
          {isCurrent && isPlaying ? (
            <Pause className="w-5 h-5 fill-current" />
          ) : (
            <Play className="w-5 h-5 ml-0.5 fill-current" />
          )}
        </button>

        {/* Track Info */}
        <div className="min-w-0 flex-1">
          <h3
            className={`text-sm font-semibold truncate ${
              isCurrent ? 'text-[#00E5FF]' : 'text-[#F3F4F6] group-hover:text-white'
            }`}
          >
            {track.title}
          </h3>
          <p className="text-xs text-[#B2B9C8] truncate">
            {track.artist} <span className="text-[#8E95A5]">•</span> {track.album}
          </p>

          {/* Badges & Tags */}
          <div className="flex items-center space-x-2 mt-1 flex-wrap gap-y-1">
            {track.pinnedVideoId ? (
              <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-[#00E5FF] bg-[#00E5FF]/10 px-2 py-0.5 rounded-md border border-[#00E5FF]/20">
                <Pin className="w-2.5 h-2.5 fill-current" />
                <span>Pinned</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 text-[11px] font-medium text-[#8E95A5] bg-[#212433] px-1.5 py-0.5 rounded">
                <span>⚡ Auto Match</span>
              </span>
            )}

            {track.tags
              .filter((t) => t !== '#all')
              .slice(0, 2)
              .map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] font-medium text-[#FF2E93] bg-[#FF2E93]/10 px-1.5 py-0.5 rounded border border-[#FF2E93]/20"
                >
                  {tag}
                </span>
              ))}

            {track.playCount > 0 && (
              <span className="text-[10px] text-[#8E95A5] font-mono">
                {track.playCount} {track.playCount === 1 ? 'play' : 'plays'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-1.5 ml-2 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(track.id);
          }}
          className={`p-2 rounded-lg transition-colors cursor-pointer ${
            track.isFavorite
              ? 'text-[#FF2E93] hover:text-[#FF2E93]/80'
              : 'text-[#8E95A5] hover:text-[#F3F4F6]'
          }`}
          title={track.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart
            className={`w-4 h-4 ${track.isFavorite ? 'fill-[#FF2E93]' : ''}`}
          />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenPicker(track);
          }}
          className={`p-2 rounded-lg transition-all cursor-pointer ${
            track.pinnedVideoId
              ? 'bg-[#00E5FF]/10 text-[#00E5FF] hover:bg-[#00E5FF]/20 border border-[#00E5FF]/30'
              : 'bg-[#212433] text-[#B2B9C8] hover:text-[#00E5FF] hover:bg-[#2A2E40]'
          }`}
          title="Choose YouTube Version"
        >
          <Sliders className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});
