import React, { useState, useEffect } from 'react';
import { X, Search, Pin, Play, Check, RotateCcw } from 'lucide-react';
import type { TrackCell, YouTubeCandidate } from '../types';
import { pinYouTubeMatch, unpinYouTubeMatch } from '../db/banditaDb';
import { usePlayer } from '../player/playerContext';
import { apiFetch } from '../auth/authManager';

interface CellVersionPickerModalProps {
  track: TrackCell | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export const CellVersionPickerModal: React.FC<CellVersionPickerModalProps> = React.memo(
  function CellVersionPickerModal({ track, isOpen, onClose, onUpdated }) {
    const { playCandidateForTrack } = usePlayer();
    const [query, setQuery] = useState('');
    const [candidates, setCandidates] = useState<YouTubeCandidate[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    useEffect(() => {
      if (isOpen && track) {
        const initialQuery = `${track.artist} ${track.title} audio`;
        setQuery(initialQuery);
        fetchRealCandidates(initialQuery);
      }
    }, [isOpen, track?.id]);

    if (!isOpen || !track) return null;

  async function fetchRealCandidates(searchQuery: string) {
    setIsLoading(true);
    setSearchError(null);

    try {
      const res = await apiFetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error(`Search request failed (${res.statusText})`);
      const data = await res.json();
      setCandidates(data.candidates || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error searching YouTube';
      setSearchError(msg);
      setCandidates([]);
    } finally {
      setIsLoading(false);
    }
  }

  const handlePin = async (candidate: YouTubeCandidate) => {
    await pinYouTubeMatch(track.id, candidate);
    onUpdated();
  };

  const handleUnpin = async () => {
    await unpinYouTubeMatch(track.id);
    onUpdated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl bg-[#0D0E15] border border-[#2B2F42] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#2B2F42] bg-[#161822]/60">
          <div>
            <h2 className="text-lg font-bold text-[#00E5FF] flex items-center space-x-2">
              <span>Track Cell: Match Resolver</span>
            </h2>
            <p className="text-xs text-[#B2B9C8] mt-0.5">
              {track.artist} <span className="text-[#8E95A5]">•</span> {track.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8E95A5] hover:text-[#F3F4F6] hover:bg-[#212433] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* Query Edit Bar */}
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchRealCandidates(query)}
                placeholder="YouTube search query..."
                className="w-full pl-3.5 pr-9 py-2.5 bg-[#161822] border border-[#2B2F42] focus:border-[#00E5FF] rounded-xl text-sm text-[#F3F4F6] placeholder-[#8E95A5] outline-none"
              />
            </div>
            <button
              onClick={() => fetchRealCandidates(query)}
              className="px-4 py-2.5 bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-[#0D0E15] font-bold text-sm rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shrink-0"
            >
              <Search className="w-4 h-4" />
              <span>Search</span>
            </button>
          </div>

          {/* Current Pin Banner */}
          {track.pinnedVideoId ? (
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#212433] border border-[#00E5FF]/30 text-xs">
              <div className="flex items-center space-x-2 min-w-0 pr-2">
                <Pin className="w-4 h-4 text-[#00E5FF] shrink-0" />
                <span className="text-[#F3F4F6] truncate">
                  Pinned to: <strong className="text-[#00E5FF]">{track.pinnedTitle || track.title}</strong>
                </span>
              </div>
              <button
                onClick={handleUnpin}
                className="text-[#FF2E93] hover:underline font-bold text-xs shrink-0 flex items-center space-x-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Auto</span>
              </button>
            </div>
          ) : (
            <div className="text-xs text-[#8E95A5] flex items-center space-x-1 px-1">
              <span>⚡ Using automatic first-match strategy. Pin a version below to override.</span>
            </div>
          )}

          {/* Candidates List */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-[#8E95A5] uppercase tracking-wider flex items-center justify-between">
              <span>Live YouTube Versions</span>
              <span className="text-[10px] text-[#00E5FF] font-mono">Proxy: 127.0.0.1:10809</span>
            </p>

            {searchError && (
              <div className="p-3 bg-[#FF2E93]/10 border border-[#FF2E93]/30 rounded-xl text-xs text-[#FF2E93]">
                {searchError}
              </div>
            )}

            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-2 text-[#8E95A5]">
                <div className="w-6 h-6 border-2 border-[#00E5FF] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">Searching YouTube over proxy...</span>
              </div>
            ) : candidates.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#8E95A5]">
                No YouTube matches found. Try modifying the query above.
              </div>
            ) : (
              candidates.map((cand) => {
                const isPinned = track.pinnedVideoId === cand.videoId;
                return (
                  <div
                    key={cand.videoId}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      isPinned
                        ? 'bg-[#1D2130] border-[#00E5FF]'
                        : 'bg-[#161822] hover:bg-[#1A1D2A] border-[#2B2F42]'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <img
                        src={cand.thumbnailUrl}
                        alt=""
                        className="w-16 h-11 object-cover rounded-lg shrink-0 border border-[#2B2F42]"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-semibold text-[#F3F4F6] truncate leading-snug">
                          {cand.title}
                        </h4>
                        <p className="text-[11px] text-[#B2B9C8] truncate">
                          {cand.channel}
                          {cand.durationText && (
                            <>
                              {' '}
                              <span className="text-[#8E95A5]">•</span> {cand.durationText}
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 ml-2 shrink-0">
                      <button
                        onClick={() => playCandidateForTrack(track, cand)}
                        className="p-2 rounded-lg bg-[#212433] hover:bg-[#00E5FF] hover:text-[#0D0E15] text-[#00E5FF] transition-all cursor-pointer"
                        title="Stream & Preview Audio"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>

                      <button
                        onClick={() => handlePin(cand)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                          isPinned
                            ? 'bg-[#00E5FF] text-[#0D0E15]'
                            : 'bg-[#2B2F42] hover:bg-[#00E5FF]/20 text-[#F3F4F6] hover:text-[#00E5FF]'
                        }`}
                      >
                        {isPinned ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Pinned</span>
                          </>
                        ) : (
                          <>
                            <Pin className="w-3.5 h-3.5" />
                            <span>Pin</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#2B2F42] bg-[#161822]/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#212433] hover:bg-[#2B2F42] text-[#F3F4F6] font-semibold text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
});
