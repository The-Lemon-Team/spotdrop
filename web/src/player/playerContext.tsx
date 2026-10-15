import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import type { TrackCell, YouTubeCandidate } from '../types';
import { db } from '../db/banditaDb';
import { apiFetch, getAudioStreamUrl } from '../auth/authManager';

export interface PlayerContextType {
  currentTrack: TrackCell | null;
  activeCandidate: YouTubeCandidate | null;
  isPlaying: boolean;
  isBuffering: boolean;
  queue: TrackCell[];
  queueIndex: number;
  isShuffle: boolean;
  isQueueView: boolean;
  setIsQueueView: (show: boolean) => void;
  toggleQueueView: () => void;
  volume: number;
  setVolume: (vol: number) => void;
  playTrack: (track: TrackCell, newQueue?: TrackCell[]) => void;
  shuffleAndPlay: (tracks: TrackCell[]) => void;
  playFromQueue: (index: number) => void;
  playCandidateForTrack: (track: TrackCell, candidate: YouTubeCandidate) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrevious: () => void;
  seekTo: (seconds: number) => void;
  toggleShuffle: () => void;
  shuffleQueue: () => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  audioError: string | null;
}

export interface PlayerTimeContextType {
  currentTime: number;
  duration: number;
  progressPercent: number;
}

const PlayerContext = createContext<PlayerContextType | null>(null);
const PlayerTimeContext = createContext<PlayerTimeContextType>({
  currentTime: 0,
  duration: 0,
  progressPercent: 0,
});

export function parseDurationText(text?: string | null): number {
  if (!text || typeof text !== 'string') return 0;
  const parts = text.trim().split(':').map((p) => parseInt(p, 10));
  if (parts.some((p) => isNaN(p) || p < 0)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
}

export function fisherYatesShuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

function PlayerTimeProvider({
  audio,
  activeCandidate,
  currentTrack,
  children,
}: {
  audio: HTMLAudioElement;
  activeCandidate: YouTubeCandidate | null;
  currentTrack: TrackCell | null;
  children: React.ReactNode;
}) {
  const fallbackDuration = useMemo(() => {
    return parseDurationText(activeCandidate?.durationText || currentTrack?.pinnedDuration);
  }, [activeCandidate?.durationText, currentTrack?.pinnedDuration]);

  const [timeState, setTimeState] = useState({ currentTime: 0, duration: 0 });

  // Whenever the active track/candidate changes, reset currentTime and seed duration with candidate duration if available
  useEffect(() => {
    setTimeState({
      currentTime: 0,
      duration: fallbackDuration > 0 ? fallbackDuration : 0,
    });
  }, [currentTrack?.id, activeCandidate?.videoId, fallbackDuration]);

  useEffect(() => {
    const resolveDuration = (prevDuration: number) => {
      if (audio.duration && Number.isFinite(audio.duration) && audio.duration > 0) {
        return audio.duration;
      }
      if (fallbackDuration > 0) {
        return fallbackDuration;
      }
      return prevDuration > 0 ? prevDuration : 0;
    };

    const onTimeUpdate = () => {
      setTimeState((prev) => {
        const cur = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
        const dur = resolveDuration(prev.duration);
        if (Math.abs(prev.currentTime - cur) < 0.25 && prev.duration === dur) {
          return prev;
        }
        return {
          currentTime: cur,
          duration: dur,
        };
      });
    };

    const onDurationOrMetadataChange = () => {
      setTimeState((prev) => {
        const dur = resolveDuration(prev.duration);
        if (prev.duration === dur) return prev;
        return { ...prev, duration: dur };
      });
    };

    const onReset = () => {
      setTimeState({
        currentTime: 0,
        duration: fallbackDuration > 0 ? fallbackDuration : 0,
      });
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationOrMetadataChange);
    audio.addEventListener('loadedmetadata', onDurationOrMetadataChange);
    audio.addEventListener('canplay', onDurationOrMetadataChange);
    audio.addEventListener('emptied', onReset);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationOrMetadataChange);
      audio.removeEventListener('loadedmetadata', onDurationOrMetadataChange);
      audio.removeEventListener('canplay', onDurationOrMetadataChange);
      audio.removeEventListener('emptied', onReset);
    };
  }, [audio, fallbackDuration]);

  const progressPercent = useMemo(() => {
    if (!Number.isFinite(timeState.duration) || timeState.duration <= 0) return 0;
    const cur = Number.isFinite(timeState.currentTime) ? timeState.currentTime : 0;
    return Math.max(0, Math.min(100, (cur / timeState.duration) * 100));
  }, [timeState.currentTime, timeState.duration]);

  const value = useMemo(
    () => ({
      currentTime: Number.isFinite(timeState.currentTime) ? timeState.currentTime : 0,
      duration: Number.isFinite(timeState.duration) ? timeState.duration : 0,
      progressPercent,
    }),
    [timeState.currentTime, timeState.duration, progressPercent]
  );

  return <PlayerTimeContext.Provider value={value}>{children}</PlayerTimeContext.Provider>;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [audio] = useState(() => new Audio());
  const [currentTrack, setCurrentTrack] = useState<TrackCell | null>(null);
  const [activeCandidate, setActiveCandidate] = useState<YouTubeCandidate | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [queue, setQueue] = useState<TrackCell[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(0);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [isQueueView, setIsQueueView] = useState<boolean>(false);
  const [volume, setVolumeState] = useState<number>(0.8);
  const [audioError, setAudioError] = useState<string | null>(null);

  const queueRef = useRef<TrackCell[]>([]);
  const queueIndexRef = useRef<number>(0);
  const originalQueueRef = useRef<TrackCell[]>([]);
  const playRequestIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const playCountTimerRef = useRef<number | null>(null);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    queueIndexRef.current = queueIndex;
  }, [queueIndex]);

  // Update volume
  const setVolume = useCallback(
    (vol: number) => {
      setVolumeState(vol);
      audio.volume = vol;
    },
    [audio]
  );

  const playTrackInternalRef = useRef<(track: TrackCell) => Promise<void>>(async () => {});

  // Initialize audio element events
  useEffect(() => {
    audio.volume = volume;

    const onPlaying = () => {
      setIsPlaying(true);
      setIsBuffering(false);
      setAudioError(null);
    };

    const onPause = () => {
      setIsPlaying(false);
    };

    const onWaiting = () => {
      setIsBuffering(true);
    };

    const onEnded = () => {
      setIsPlaying(false);
      const curQ = queueRef.current;
      if (curQ.length > 0) {
        const nextIdx = (queueIndexRef.current + 1) % curQ.length;
        queueIndexRef.current = nextIdx;
        setQueueIndex(nextIdx);
        const nextTrack = curQ[nextIdx];
        if (nextTrack) {
          playTrackInternalRef.current(nextTrack);
        }
      }
    };

    const onError = () => {
      // Ignore if src was cleared or superseded by next track load
      if (!audio.src || (audio.error && audio.error.code === MediaError.MEDIA_ERR_ABORTED)) {
        return;
      }
      setIsBuffering(false);
      setIsPlaying(false);
      setAudioError('Failed to stream audio from proxy. Check proxy connection.');
    };

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [audio, volume]);

  const startPlaybackWithCandidate = useCallback(
    (track: TrackCell, candidate: YouTubeCandidate, requestId: number) => {
      if (requestId !== playRequestIdRef.current) return;

      setCurrentTrack(track);
      setActiveCandidate(candidate);
      setIsBuffering(true);
      setAudioError(null);

      // Debounce play count increment in IndexedDB (only commit if track plays for at least 7 seconds)
      if (playCountTimerRef.current) {
        clearTimeout(playCountTimerRef.current);
      }
      playCountTimerRef.current = window.setTimeout(() => {
        db.tracks.where('id').equals(track.id).modify((t) => {
          t.playCount = (t.playCount || 0) + 1;
        }).catch(() => {});
      }, 7000);

      const streamEndpoint = getAudioStreamUrl(candidate.videoId, track.profileId);

      try {
        audio.pause();
      } catch {
        // ignore
      }

      audio.src = streamEndpoint;
      audio.load();
      audio
        .play()
        .then(() => {
          if (requestId === playRequestIdRef.current) {
            setIsBuffering(false);
            setIsPlaying(true);

            // Background prefetch for next track in queue to ensure zero-lag switching
            const curQ = queueRef.current;
            const curIdx = queueIndexRef.current;
            if (curQ.length > 1) {
              const nextTrack = curQ[(curIdx + 1) % curQ.length];
              if (nextTrack) {
                if (nextTrack.pinnedVideoId) {
                  fetch(getAudioStreamUrl(nextTrack.pinnedVideoId, nextTrack.profileId), { method: 'HEAD' }).catch(() => {});
                } else {
                  const nextQuery = `${nextTrack.artist} ${nextTrack.title} audio`;
                  apiFetch(`/api/search?q=${encodeURIComponent(nextQuery)}`).catch(() => {});
                }
              }
            }
          }
        })
        .catch((err) => {
          if (err?.name === 'AbortError') {
            // Expected interruption when a newer track load started
            return;
          }
          if (requestId !== playRequestIdRef.current) return;

          console.warn('Playback autoplay waiting or error:', err);
          setIsBuffering(false);
          if (err?.name === 'NotAllowedError') {
            setAudioError('Нажмите Play для воспроизведения (ограничение автоплея мобильного браузера)');
          }
        });
    },
    [audio]
  );

  const playTrackInternal = useCallback(
    async (track: TrackCell) => {
      const requestId = ++playRequestIdRef.current;

      // Abort in-flight network search if any
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setCurrentTrack(track);
      setIsBuffering(true);
      setAudioError(null);

      // Strategy: Pinned version vs Auto Match
      if (track.pinnedVideoId) {
        const candidate: YouTubeCandidate = {
          videoId: track.pinnedVideoId,
          title: track.pinnedTitle || track.title,
          channel: track.pinnedChannel || track.artist,
          durationText: track.pinnedDuration || '',
          thumbnailUrl:
            track.pinnedThumbnail ||
            `https://i.ytimg.com/vi/${track.pinnedVideoId}/hqdefault.jpg`,
          isPinned: true,
        };
        startPlaybackWithCandidate(track, candidate, requestId);
      } else {
        // Query search candidate over local proxy
        try {
          const query = `${track.artist} ${track.title} audio`;
          const res = await apiFetch(`/api/search?q=${encodeURIComponent(query)}`, {
            signal: controller.signal,
          });
          if (!res.ok) throw new Error(`Search error: ${res.statusText}`);
          const data = await res.json();

          if (requestId !== playRequestIdRef.current) return;

          const first = data.candidates?.[0];
          if (first && first.videoId) {
            startPlaybackWithCandidate(
              track,
              {
                videoId: first.videoId,
                title: first.title,
                channel: first.channel,
                durationText: first.durationText,
                thumbnailUrl: first.thumbnailUrl,
                isPinned: false,
              },
              requestId
            );
          } else {
            throw new Error('No YouTube matches found');
          }
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'AbortError') {
            // Cancelled cleanly because newer track was clicked
            return;
          }
          if (requestId !== playRequestIdRef.current) return;

          const errorMsg = err instanceof Error ? err.message : 'Error resolving candidate';
          setAudioError(errorMsg);
          setIsBuffering(false);
        }
      }
    },
    [startPlaybackWithCandidate]
  );

  useEffect(() => {
    playTrackInternalRef.current = playTrackInternal;
  }, [playTrackInternal]);

  const playTrack = useCallback(
    (track: TrackCell, newQueue?: TrackCell[]) => {
      if (newQueue) {
        originalQueueRef.current = newQueue;
        if (isShuffle) {
          // If shuffle is active, keep this track first and shuffle remainder
          const others = newQueue.filter((t) => t.id !== track.id);
          const shuffled = [track, ...fisherYatesShuffle(others)];
          setQueue(shuffled);
          queueRef.current = shuffled;
          setQueueIndex(0);
          queueIndexRef.current = 0;
        } else {
          setQueue(newQueue);
          queueRef.current = newQueue;
          const idx = newQueue.findIndex((t) => t.id === track.id);
          const resolvedIdx = idx >= 0 ? idx : 0;
          setQueueIndex(resolvedIdx);
          queueIndexRef.current = resolvedIdx;
        }
      }
      playTrackInternal(track);
    },
    [isShuffle, playTrackInternal]
  );

  // Header "Shuffle Play" action: shuffles given tracks with Fisher-Yates and starts playing immediately
  const shuffleAndPlay = useCallback(
    (tracks: TrackCell[]) => {
      if (!tracks || tracks.length === 0) return;

      originalQueueRef.current = tracks;
      setIsShuffle(true);

      const startIndex = Math.floor(Math.random() * tracks.length);
      const startTrack = tracks[startIndex];
      const otherTracks = tracks.filter((_, idx) => idx !== startIndex);
      const shuffledOthers = fisherYatesShuffle(otherTracks);

      const newQueue = [startTrack, ...shuffledOthers];
      setQueue(newQueue);
      queueRef.current = newQueue;
      setQueueIndex(0);
      queueIndexRef.current = 0;

      playTrackInternal(startTrack);
    },
    [playTrackInternal]
  );

  // Bottom player bar "Shuffle Toggle": switches shuffle mode ON / OFF without stopping playback
  const toggleShuffle = useCallback(() => {
    const curQ = queueRef.current;
    if (curQ.length === 0) return;

    if (!isShuffle) {
      // Turn Shuffle ON
      if (originalQueueRef.current.length === 0) {
        originalQueueRef.current = curQ;
      }
      const current = currentTrack;
      if (current) {
        const others = originalQueueRef.current.filter((t) => t.id !== current.id);
        const shuffled = [current, ...fisherYatesShuffle(others)];
        setQueue(shuffled);
        queueRef.current = shuffled;
        setQueueIndex(0);
        queueIndexRef.current = 0;
      } else {
        const shuffled = fisherYatesShuffle(curQ);
        setQueue(shuffled);
        queueRef.current = shuffled;
      }
      setIsShuffle(true);
    } else {
      // Turn Shuffle OFF: restore original order from originalQueue
      const orig = originalQueueRef.current;
      if (orig && orig.length > 0) {
        const current = currentTrack;
        let newIdx = 0;
        if (current) {
          const foundIdx = orig.findIndex((t) => t.id === current.id);
          if (foundIdx >= 0) newIdx = foundIdx;
        }
        setQueue(orig);
        queueRef.current = orig;
        setQueueIndex(newIdx);
        queueIndexRef.current = newIdx;
      }
      setIsShuffle(false);
    }
  }, [isShuffle, currentTrack]);

  // Play a specific track directly from the current active queue by its index
  const playFromQueue = useCallback(
    (index: number) => {
      const curQ = queueRef.current;
      if (index < 0 || index >= curQ.length) return;
      setQueueIndex(index);
      queueIndexRef.current = index;
      const track = curQ[index];
      if (track) {
        playTrackInternal(track);
      }
    },
    [playTrackInternal]
  );

  const toggleQueueView = useCallback(() => {
    setIsQueueView((prev) => !prev);
  }, []);

  const removeFromQueue = useCallback(
    (index: number) => {
      const curQ = queueRef.current;
      if (index < 0 || index >= curQ.length) return;
      const removedTrack = curQ[index];
      const newQ = curQ.filter((_, i) => i !== index);
      setQueue(newQ);
      queueRef.current = newQ;
      originalQueueRef.current = originalQueueRef.current.filter((t) => t.id !== removedTrack.id);

      if (index < queueIndexRef.current) {
        const nextIdx = Math.max(0, queueIndexRef.current - 1);
        setQueueIndex(nextIdx);
        queueIndexRef.current = nextIdx;
      } else if (index === queueIndexRef.current) {
        if (newQ.length === 0) {
          setQueueIndex(0);
          queueIndexRef.current = 0;
        } else if (index >= newQ.length) {
          setQueueIndex(newQ.length - 1);
          queueIndexRef.current = newQ.length - 1;
        }
      }
    },
    []
  );

  const clearQueue = useCallback(() => {
    if (currentTrack) {
      setQueue([currentTrack]);
      queueRef.current = [currentTrack];
      setQueueIndex(0);
      queueIndexRef.current = 0;
      originalQueueRef.current = [currentTrack];
    } else {
      setQueue([]);
      queueRef.current = [];
      setQueueIndex(0);
      queueIndexRef.current = 0;
      originalQueueRef.current = [];
    }
  }, [currentTrack]);

  const playCandidateForTrack = useCallback(
    (track: TrackCell, candidate: YouTubeCandidate) => {
      const requestId = ++playRequestIdRef.current;
      startPlaybackWithCandidate(track, candidate, requestId);
    },
    [startPlaybackWithCandidate]
  );

  const togglePlayPause = useCallback(() => {
    if (!currentTrack) return;
    if (audio.paused) {
      audio.play().catch(console.error);
    } else {
      audio.pause();
    }
  }, [audio, currentTrack]);

  const playNext = useCallback(() => {
    const curQ = queueRef.current;
    if (curQ.length === 0) return;
    const nextIdx = (queueIndexRef.current + 1) % curQ.length;
    queueIndexRef.current = nextIdx;
    setQueueIndex(nextIdx);
    const track = curQ[nextIdx];
    if (track) {
      playTrackInternal(track);
    }
  }, [playTrackInternal]);

  const playPrevious = useCallback(() => {
    const curQ = queueRef.current;
    if (curQ.length === 0) return;
    const prevIdx = queueIndexRef.current - 1 < 0 ? curQ.length - 1 : queueIndexRef.current - 1;
    queueIndexRef.current = prevIdx;
    setQueueIndex(prevIdx);
    const track = curQ[prevIdx];
    if (track) {
      playTrackInternal(track);
    }
  }, [playTrackInternal]);

  const seekTo = useCallback(
    (seconds: number) => {
      if (!Number.isFinite(seconds) || isNaN(seconds) || seconds < 0) return;
      try {
        audio.currentTime = seconds;
      } catch (err) {
        console.warn('seekTo error:', err);
      }
    },
    [audio]
  );

  const shuffleQueue = useCallback(() => {
    if (!isShuffle) {
      toggleShuffle();
    } else {
      const curQ = queueRef.current;
      const current = currentTrack;
      if (current) {
        const others = curQ.filter((t) => t.id !== current.id);
        const reshuffled = [current, ...fisherYatesShuffle(others)];
        setQueue(reshuffled);
        queueRef.current = reshuffled;
        setQueueIndex(0);
        queueIndexRef.current = 0;
      } else {
        const reshuffled = fisherYatesShuffle(curQ);
        setQueue(reshuffled);
        queueRef.current = reshuffled;
      }
    }
  }, [isShuffle, toggleShuffle, currentTrack]);

  // Update MediaSession API for OS controls (Windows, macOS, Mobile)
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    const artworkUrl =
      activeCandidate?.thumbnailUrl ||
      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=60';

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album,
      artwork: [{ src: artworkUrl, sizes: '512x512', type: 'image/jpeg' }],
    });

    navigator.mediaSession.setActionHandler('play', () => {
      audio.play().catch(console.error);
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      audio.pause();
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      playNext();
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      playPrevious();
    });
  }, [currentTrack, activeCandidate, audio, playNext, playPrevious]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  const contextValue = useMemo(
    () => ({
      currentTrack,
      activeCandidate,
      isPlaying,
      isBuffering,
      queue,
      queueIndex,
      isShuffle,
      isQueueView,
      setIsQueueView,
      toggleQueueView,
      volume,
      setVolume,
      playTrack,
      shuffleAndPlay,
      playFromQueue,
      playCandidateForTrack,
      togglePlayPause,
      playNext,
      playPrevious,
      seekTo,
      toggleShuffle,
      shuffleQueue,
      removeFromQueue,
      clearQueue,
      audioError,
    }),
    [
      currentTrack,
      activeCandidate,
      isPlaying,
      isBuffering,
      queue,
      queueIndex,
      isShuffle,
      isQueueView,
      setIsQueueView,
      toggleQueueView,
      volume,
      setVolume,
      playTrack,
      shuffleAndPlay,
      playFromQueue,
      playCandidateForTrack,
      togglePlayPause,
      playNext,
      playPrevious,
      seekTo,
      toggleShuffle,
      shuffleQueue,
      removeFromQueue,
      clearQueue,
      audioError,
    ]
  );

  return (
    <PlayerContext.Provider value={contextValue}>
      <PlayerTimeProvider
        audio={audio}
        activeCandidate={activeCandidate}
        currentTrack={currentTrack}
      >
        {children}
      </PlayerTimeProvider>
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within PlayerProvider');
  return context;
}

export function usePlayerTime() {
  return useContext(PlayerTimeContext);
}
