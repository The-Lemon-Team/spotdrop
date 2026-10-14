import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useDeferredValue,
} from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Shuffle, ListMusic, Sparkles } from 'lucide-react';
import { db, toggleFavoriteTrack } from './db/banditaDb';
import { loadProfileBySlug } from './importer/spotifyImporter';
import { Header } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { TagsBar } from './components/TagsBar';
import { TrackCellCard } from './components/TrackCellCard';
import { CellVersionPickerModal } from './components/CellVersionPickerModal';
import { ProfileModal } from './components/ProfileModal';
import { BottomPlayerBar } from './components/BottomPlayerBar';
import { PlaylistDrawer } from './components/PlaylistDrawer';
import { TokenAuthScreen } from './components/TokenAuthScreen';
import { TailscaleInfoModal } from './components/TailscaleInfoModal';
import { LandingScreen } from './components/LandingScreen';
import { getStoredToken, verifyToken, apiFetch } from './auth/authManager';
import { usePlayer } from './player/playerContext';
import type { TrackCell } from './types';

const PAGE_SIZE = 50;

function getSlugFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname;
  const match = path.match(/^\/p\/([^/?#]+)/);
  if (match) return decodeURIComponent(match[1]).toLowerCase();

  const params = new URLSearchParams(window.location.search);
  const p = params.get('p') || params.get('profile');
  if (p) return p.toLowerCase().trim();

  return null;
}

export function App() {
  const {
    currentTrack,
    isPlaying,
    playTrack,
    shuffleAndPlay,
    queue,
    isQueueView,
    setIsQueueView,
  } = usePlayer();

  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedTag, setSelectedTag] = useState('#all');
  const [inspectingTrack, setInspectingTrack] = useState<TrackCell | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isTailscaleModalOpen, setIsTailscaleModalOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  const [view, setView] = useState<'landing' | 'player'>('landing');
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(false);

  // Reactive queries from Dexie.js (IndexedDB)
  const profiles = useLiveQuery(() => db.profiles.toArray()) || [];
  const currentProfile = useMemo(() => {
    return profiles.find((p) => p.isCurrent) || profiles[0] || null;
  }, [profiles]);

  const profileId = currentProfile?.id || 'profile_default';

  // Live query for all tracks belonging to current profile
  const rawTracks =
    useLiveQuery(
      () => db.tracks.where('profileId').equals(profileId).toArray(),
      [profileId]
    ) || [];

  // Check auth and initial routing on mount
  useEffect(() => {
    const initApp = async () => {
      // 1. Check if server requires auth
      try {
        const verifyRes = await apiFetch('/api/auth/verify');
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          if (!verifyData.authRequired) {
            setIsAuthenticated(true);
          } else {
            setIsAuthenticated(verifyData.valid);
          }
        } else {
          const token = getStoredToken();
          if (token) {
            const res = await verifyToken();
            setIsAuthenticated(res.valid);
          } else {
            setIsAuthenticated(false);
          }
        }
      } catch {
        setIsAuthenticated(true); // Allow local usage if offline
      } finally {
        setIsAuthChecking(false);
      }

      // 2. Route resolution
      const slug = getSlugFromUrl();
      if (slug) {
        setIsLoadingProfile(true);
        try {
          const success = await loadProfileBySlug(slug);
          if (success) {
            setView('player');
          } else {
            setView('landing');
          }
        } catch (err) {
          console.error('Error loading profile from URL:', err);
          setView('landing');
        } finally {
          setIsLoadingProfile(false);
        }
      } else {
        const count = await db.tracks.count();
        if (count > 0) {
          setView('player');
        } else {
          setView('landing');
        }
      }
    };

    initApp();

    // Handle browser back/forward buttons
    const onPopState = async () => {
      const slug = getSlugFromUrl();
      if (slug) {
        await loadProfileBySlug(slug);
        setView('player');
      } else {
        setView('landing');
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleOpenProfileFromLanding = async (slug: string) => {
    setIsLoadingProfile(true);
    try {
      const targetSlug = slug === 'profile_default' ? 'bandita' : slug;
      window.history.pushState({}, '', `/p/${targetSlug}`);
      const success = await loadProfileBySlug(targetSlug);
      if (success) {
        setView('player');
      }
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleGoToLanding = () => {
    window.history.pushState({}, '', '/');
    setView('landing');
  };

  // Pre-normalized search index for O(1) string lookup per track
  const searchIndex = useMemo(() => {
    const map = new Map<string, string>();
    for (let i = 0; i < rawTracks.length; i++) {
      const t = rawTracks[i];
      const norm = `${t.title.toLowerCase()} ${t.artist.toLowerCase()} ${t.album.toLowerCase()}`;
      map.set(t.id, norm);
    }
    return map;
  }, [rawTracks]);

  // Dynamic tags computed from current profile tracks
  const tags = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < rawTracks.length; i++) {
      const trackTags = rawTracks[i].tags;
      if (trackTags) {
        for (let j = 0; j < trackTags.length; j++) {
          set.add(trackTags[j]);
        }
      }
    }
    const arr = Array.from(set);
    return arr.sort((a, b) => {
      if (a === '#all') return -1;
      if (b === '#all') return 1;
      if (a === '#favorites') return -1;
      if (b === '#favorites') return 1;
      return a.localeCompare(b);
    });
  }, [rawTracks]);

  // Filtered tracks based on search query and active tag
  const filteredTracks = useMemo(() => {
    let result = rawTracks;

    // Filter by tag
    if (selectedTag && selectedTag !== '#all') {
      result = result.filter((t) => t.tags && t.tags.includes(selectedTag));
    }

    // Filter by search query
    const q = deferredSearchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((t) => {
        const norm = searchIndex.get(t.id);
        return norm !== undefined && norm.includes(q);
      });
    }

    return result;
  }, [rawTracks, selectedTag, deferredSearchQuery, searchIndex]);

  // Reset pagination when filter or search changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedTag, deferredSearchQuery]);

  // Infinite scrolling observer
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
        { rootMargin: '400px' }
      );

      observerRef.current.observe(node);
    },
    [filteredTracks.length]
  );

  const visibleTracks = useMemo(() => {
    return filteredTracks.slice(0, visibleCount);
  }, [filteredTracks, visibleCount]);

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#0D0E15] flex flex-col items-center justify-center text-[#00E5FF] p-4">
        <div className="w-12 h-12 rounded-2xl bg-[#161822] border border-[#2B2F42] flex items-center justify-center animate-pulse mb-4 shadow-xl shadow-[#00E5FF]/10">
          <Sparkles className="w-6 h-6 text-[#00E5FF]" />
        </div>
        <p className="text-sm font-semibold tracking-wider text-[#B2B9C8]">Загрузка SpotDrop...</p>
      </div>
    );
  }

  // Token Auth Screen only if server explicitly enforces secret token
  if (!isAuthenticated) {
    return <TokenAuthScreen onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  // Landing / Onboarding View
  if (view === 'landing') {
    return (
      <LandingScreen
        onOpenProfile={(slug) => {
          handleOpenProfileFromLanding(slug);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0E15] text-[#F3F4F6] flex flex-col selection:bg-[#00E5FF]/20 selection:text-[#00E5FF] pb-28">
      {/* Top Header */}
      <Header
        currentProfile={currentProfile}
        trackCount={rawTracks.length}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
        onOpenTailscaleModal={() => setIsTailscaleModalOpen(true)}
        onOpenLanding={handleGoToLanding}
      />

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 w-full flex-1 flex flex-col pt-5 space-y-4">
        {/* Search Bar */}
        <SearchBar value={searchQuery} onChange={setSearchQuery} />

        {/* Tags Bar */}
        <TagsBar
          selectedTag={selectedTag}
          onSelectTag={setSelectedTag}
          availableTags={tags}
        />

        {/* Action Header / Counts */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#F3F4F6]">
              {searchQuery.trim()
                ? `Results for "${searchQuery}"`
                : `${selectedTag} Tracks`}
            </h2>
            <p className="text-xs text-[#8E95A5]">
              {filteredTracks.length.toLocaleString()} song
              {filteredTracks.length === 1 ? '' : 's'} available
              {visibleCount < filteredTracks.length && ` (showing ${visibleTracks.length})`}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {queue.length > 0 && (
              <button
                onClick={() => setIsQueueView(!isQueueView)}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-full border text-xs font-semibold transition-all cursor-pointer ${
                  isQueueView
                    ? 'bg-[#00E5FF]/20 border-[#00E5FF]/60 text-[#00E5FF] shadow-sm shadow-[#00E5FF]/20'
                    : 'bg-[#161822] hover:bg-[#212433] border-[#2B2F42] hover:border-[#00E5FF]/40 text-[#B2B9C8] hover:text-[#00E5FF]'
                }`}
                title={isQueueView ? 'Свернуть плейлист' : 'Показать плейлист'}
              >
                <ListMusic className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Плейлист</span>
                <span className="text-[#00E5FF] font-mono font-bold">({queue.length})</span>
              </button>
            )}

            <button
              onClick={() => shuffleAndPlay(filteredTracks)}
              disabled={filteredTracks.length === 0}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-full bg-[#00E5FF] hover:bg-[#00E5FF]/90 disabled:opacity-50 text-[#0D0E15] font-bold text-xs shadow-md shadow-[#00E5FF]/15 transition-all active:scale-95 cursor-pointer"
              title="Перемешать плейлист и начать воспроизведение"
            >
              <Shuffle className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Shuffle</span>
            </button>
          </div>
        </div>

        {/* Tracks List */}
        <div className="flex-1">
          {isLoadingProfile ? (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <div className="w-10 h-10 border-2 border-[#00E5FF] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm font-semibold text-[#B2B9C8]">Загрузка библиотеки...</p>
            </div>
          ) : rawTracks.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-[#161822] border border-[#2B2F42] flex items-center justify-center mb-4 text-[#00E5FF]">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Фонотека пуста</h3>
              <p className="text-xs text-[#B2B9C8] max-w-sm mb-6">
                В этом профиле пока нет треков. Загрузите файлы экспорта Spotify или перейдите к мастер-библиотеке.
              </p>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleGoToLanding}
                  className="px-4 py-2 rounded-xl bg-[#00E5FF] text-[#0D0E15] font-bold text-xs cursor-pointer shadow-lg shadow-[#00E5FF]/20"
                >
                  Загрузить экспорт
                </button>
                <button
                  onClick={() => handleOpenProfileFromLanding('bandita')}
                  className="px-4 py-2 rounded-xl bg-[#161822] border border-[#2B2F42] hover:border-[#00E5FF]/50 text-[#F3F4F6] text-xs font-semibold cursor-pointer"
                >
                  Слушать демо
                </button>
              </div>
            </div>
          ) : filteredTracks.length === 0 ? (
            <div className="py-16 text-center text-[#B2B9C8]">
              <p className="text-sm">Ничего не найдено по запросу «{searchQuery}»</p>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleTracks.map((track) => {
                const isCurrent = currentTrack?.id === track.id;
                return (
                  <TrackCellCard
                    key={track.id}
                    track={track}
                    isCurrent={isCurrent}
                    isPlaying={isCurrent && isPlaying}
                    onPlay={(t) => playTrack(t, filteredTracks)}
                    onOpenPicker={(t) => setInspectingTrack(t)}
                    onToggleFavorite={(id) => toggleFavoriteTrack(id)}
                  />
                );
              })}
            </div>
          )}

          {/* Sentinel for infinite scroll */}
          {visibleCount < filteredTracks.length && (
            <div ref={sentinelRef} className="py-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-[#00E5FF] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </main>

      {/* Version Picker Modal */}
      <CellVersionPickerModal
        isOpen={Boolean(inspectingTrack)}
        track={inspectingTrack}
        onClose={() => setInspectingTrack(null)}
        onUpdated={() => setInspectingTrack(null)}
      />

      {/* Profiles Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        profiles={profiles}
        currentProfile={currentProfile}
        onProfilesChanged={() => {}}
      />

      {/* Tailscale / Network Info Modal */}
      <TailscaleInfoModal
        isOpen={isTailscaleModalOpen}
        onClose={() => setIsTailscaleModalOpen(false)}
        onLogout={() => setIsAuthenticated(false)}
      />

      {/* Playlist & Queue Drawer */}
      <PlaylistDrawer
        isOpen={isQueueView}
        onClose={() => setIsQueueView(false)}
        onOpenPicker={(t) => setInspectingTrack(t)}
        onToggleFavorite={(id) => toggleFavoriteTrack(id)}
      />

      {/* Persistent Bottom Player Bar */}
      <BottomPlayerBar />
    </div>
  );
}

export default App;
