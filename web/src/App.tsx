import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useDeferredValue,
} from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Shuffle, ListMusic, Sparkles, Heart, Music, FolderPlus, Share2, Headphones } from 'lucide-react';
import { db, toggleFavoriteTrack, removeTrackFromPlaylist } from './db/banditaDb';
import { loadProfileBySlug, ensurePlaylistsSynced } from './importer/spotifyImporter';
import { isTauriEnvironment } from './auth/authManager';
import { Header } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { TagsBar } from './components/TagsBar';
import { TrackCellCard } from './components/TrackCellCard';
import { CellVersionPickerModal } from './components/CellVersionPickerModal';
import { ProfileModal } from './components/ProfileModal';
import { BottomPlayerBar } from './components/BottomPlayerBar';
import { PlaylistDrawer } from './components/PlaylistDrawer';
import { TailscaleInfoModal } from './components/TailscaleInfoModal';
import { LandingScreen } from './components/LandingScreen';
import { AddToPlaylistModal } from './components/AddToPlaylistModal';
import { PlaylistsView } from './components/PlaylistsView';
import { PlaylistDetailView } from './components/PlaylistDetailView';
import { Toast, type ToastData } from './components/Toast';
import { DesktopSettingsModal } from './components/DesktopSettingsModal';
import { usePlayer } from './player/playerContext';
import type { TrackCell, Playlist } from './types';

const PAGE_SIZE = 50;

type NavTab = 'tracks' | 'playlists' | 'playlist_detail' | 'favorites';

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
    togglePlayPause,
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
  const [isDesktopSettingsOpen, setIsDesktopSettingsOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [activeNavTab, setActiveNavTab] = useState<NavTab>('tracks');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [trackForPlaylistModal, setTrackForPlaylistModal] = useState<TrackCell | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  const [view, setView] = useState<'landing' | 'player'>('landing');
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(false);

  const hasCheckedSharedTrack = useRef(false);

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

  // Live query for all playlists belonging to current profile
  const playlists =
    useLiveQuery(
      () => db.playlists.where('profileId').equals(profileId).toArray(),
      [profileId]
    ) || [];

  const selectedPlaylist = useMemo(() => {
    if (!selectedPlaylistId) return null;
    return playlists.find((p) => p.id === selectedPlaylistId) || null;
  }, [playlists, selectedPlaylistId]);

  const favoritesCount = useMemo(() => {
    return rawTracks.filter((t) => t.isFavorite).length;
  }, [rawTracks]);

  // Toast notifier helper
  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ id: Date.now(), message, type });
  }, []);

  // Routing on mount & popstate
  useEffect(() => {
    const initApp = async () => {
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
          // Also sync playlists if needed
          ensurePlaylistsSynced(profileId).catch(() => {});
        } else if (isTauriEnvironment()) {
          // Pre-installed Bandita Library on desktop!
          setIsLoadingProfile(true);
          try {
            const success = await loadProfileBySlug('bandita');
            if (success) {
              setView('player');
            } else {
              setView('landing');
            }
          } catch (err) {
            console.error('Failed to pre-load Bandita library:', err);
            setView('landing');
          } finally {
            setIsLoadingProfile(false);
          }
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
  }, [profileId]);

  // Check URL parameters for shared track or shared playlist
  useEffect(() => {
    if (hasCheckedSharedTrack.current || rawTracks.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    const trackParam = params.get('track');
    const playlistParam = params.get('playlist');

    if (playlistParam) {
      setSelectedPlaylistId(playlistParam);
      setActiveNavTab('playlist_detail');
      hasCheckedSharedTrack.current = true;
    } else if (trackParam) {
      const found = rawTracks.find(
        (t) => t.id === trackParam || t.id.toLowerCase().includes(trackParam.toLowerCase())
      );
      if (found) {
        hasCheckedSharedTrack.current = true;
        playTrack(found, rawTracks);
        showToast(`Воспроизведение трека: «${found.title}»`, 'info');
      }
    }
  }, [rawTracks, playTrack, showToast]);

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

  // Filtered tracks based on search query, active tag, or favorites tab
  const filteredTracks = useMemo(() => {
    let result = rawTracks;

    if (activeNavTab === 'favorites') {
      result = result.filter((t) => t.isFavorite);
    } else if (selectedTag && selectedTag !== '#all') {
      result = result.filter((t) => t.tags && t.tags.includes(selectedTag));
    }

    const q = deferredSearchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((t) => {
        const norm = searchIndex.get(t.id);
        return norm !== undefined && norm.includes(q);
      });
    }

    return result;
  }, [rawTracks, activeNavTab, selectedTag, deferredSearchQuery, searchIndex]);

  // Reset pagination when filter or search changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedTag, deferredSearchQuery, activeNavTab]);

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

  const currentTrackRef = useRef(currentTrack);
  currentTrackRef.current = currentTrack;
  const filteredTracksRef = useRef(filteredTracks);
  filteredTracksRef.current = filteredTracks;

  const handlePlayTrack = useCallback(
    (track: TrackCell) => {
      if (currentTrackRef.current?.id === track.id) {
        togglePlayPause();
      } else {
        playTrack(track, filteredTracksRef.current);
      }
    },
    [playTrack, togglePlayPause]
  );

  const handleOpenPicker = useCallback((t: TrackCell) => {
    setInspectingTrack(t);
  }, []);

  const handleToggleFavorite = useCallback((id: string) => {
    toggleFavoriteTrack(id);
  }, []);

  // Share Track Action
  const handleShareTrack = useCallback(
    async (track: TrackCell) => {
      const currentSlug = profileId === 'profile_default' ? 'bandita' : profileId;
      const shareUrl = `${window.location.origin}/p/${currentSlug}?track=${encodeURIComponent(track.id)}`;

      if (navigator.share) {
        try {
          await navigator.share({
            title: `${track.artist} - ${track.title}`,
            text: `Послушай трек «${track.title}» (${track.artist}) на SpotDrop`,
            url: shareUrl,
          });
          showToast('Ссылка отправлена!', 'info');
          return;
        } catch (err: any) {
          if (err.name === 'AbortError') return;
        }
      }

      try {
        await navigator.clipboard.writeText(shareUrl);
        showToast(`Ссылка на «${track.title}» скопирована!`, 'info');
      } catch {
        showToast('Не удалось скопировать ссылку', 'error');
      }
    },
    [profileId, showToast]
  );

  // Share Playlist Action
  const handleSharePlaylist = useCallback(
    async (playlist: Playlist) => {
      const currentSlug = profileId === 'profile_default' ? 'bandita' : profileId;
      const shareUrl = `${window.location.origin}/p/${currentSlug}?playlist=${encodeURIComponent(playlist.id)}`;

      if (navigator.share) {
        try {
          await navigator.share({
            title: `Плейлист ${playlist.name}`,
            text: `Послушай плейлист «${playlist.name}» на SpotDrop`,
            url: shareUrl,
          });
          showToast('Ссылка на плейлист отправлена!', 'info');
          return;
        } catch (err: any) {
          if (err.name === 'AbortError') return;
        }
      }

      try {
        await navigator.clipboard.writeText(shareUrl);
        showToast(`Ссылка на плейлист «${playlist.name}» скопирована!`, 'info');
      } catch {
        showToast('Не удалось скопировать ссылку', 'error');
      }
    },
    [profileId, showToast]
  );

  // Play full Playlist
  const handlePlayPlaylist = useCallback(
    (playlist: Playlist, shuffle: boolean = false) => {
      const trackMap = new Map<string, TrackCell>();
      for (const t of rawTracks) {
        trackMap.set(t.id, t);
        const normKey = `${t.artist.toLowerCase().trim()}|${t.title.toLowerCase().trim()}`;
        trackMap.set(normKey, t);
      }

      const playlistTracks: TrackCell[] = [];
      const ids = Array.isArray(playlist.trackIds) ? playlist.trackIds : [];
      for (const id of ids) {
        const match = trackMap.get(id);
        if (match) playlistTracks.push(match);
      }

      if (playlistTracks.length === 0) {
        showToast('В этом плейлисте пока нет треков', 'error');
        return;
      }

      if (shuffle) {
        shuffleAndPlay(playlistTracks);
        showToast(`Перемешан плейлист «${playlist.name}»`, 'success');
      } else {
        playTrack(playlistTracks[0], playlistTracks);
        showToast(`Воспроизведение: «${playlist.name}»`, 'success');
      }
    },
    [rawTracks, playTrack, shuffleAndPlay, showToast]
  );

  // Remove track from selected playlist
  const handleRemoveFromPlaylist = useCallback(
    async (trackId: string) => {
      if (!selectedPlaylistId) return;
      await removeTrackFromPlaylist(selectedPlaylistId, trackId);
      showToast('Трек удален из плейлиста', 'info');
    },
    [selectedPlaylistId, showToast]
  );

  // Loading Splash Screen (e.g. initial setup of pre-bundled Bandita library)
  if (isLoadingProfile && view === 'landing') {
    return (
      <div className="min-h-screen bg-[#0D0E15] text-[#F3F4F6] flex flex-col items-center justify-center p-6 text-center space-y-4 selection:bg-[#00E5FF]/20 selection:text-[#00E5FF]">
        <div className="w-16 h-16 rounded-2xl bg-[#161822] border border-[#00E5FF]/40 flex items-center justify-center shadow-xl shadow-[#00E5FF]/10 text-[#00E5FF] animate-pulse">
          <Headphones className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-white tracking-wide">Подготовка SpotDrop</h2>
          <p className="text-xs text-[#B2B9C8]">Инициализация предустановленной библиотеки Bandita (1,600+ треков)...</p>
        </div>
        <div className="w-6 h-6 border-2 border-[#00E5FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
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
        onOpenDesktopSettingsModal={() => setIsDesktopSettingsOpen(true)}
        onOpenLanding={handleGoToLanding}
      />

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 w-full flex-1 flex flex-col pt-4 sm:pt-5 space-y-4">
        {/* Navigation Switch Tabs */}
        <div className="flex items-center space-x-2 border-b border-[#2B2F42]/60 pb-3 overflow-x-auto scrollbar-none no-scrollbar">
          <button
            onClick={() => {
              setActiveNavTab('tracks');
              setSelectedPlaylistId(null);
            }}
            className={`flex items-center space-x-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeNavTab === 'tracks'
                ? 'bg-[#00E5FF] text-[#0D0E15] shadow-lg shadow-[#00E5FF]/20'
                : 'bg-[#161822] hover:bg-[#212433] text-[#B2B9C8] hover:text-white border border-[#2B2F42]'
            }`}
          >
            <Music className="w-4 h-4" />
            <span>Все треки</span>
            <span className="font-mono text-[11px] opacity-80">({rawTracks.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveNavTab('playlists');
              setSelectedPlaylistId(null);
            }}
            className={`flex items-center space-x-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeNavTab === 'playlists' || activeNavTab === 'playlist_detail'
                ? 'bg-[#00E5FF] text-[#0D0E15] shadow-lg shadow-[#00E5FF]/20'
                : 'bg-[#161822] hover:bg-[#212433] text-[#B2B9C8] hover:text-white border border-[#2B2F42]'
            }`}
          >
            <ListMusic className="w-4 h-4" />
            <span>Плейлисты Spotify</span>
            <span className="font-mono text-[11px] opacity-80">({playlists.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveNavTab('favorites');
              setSelectedPlaylistId(null);
            }}
            className={`flex items-center space-x-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeNavTab === 'favorites'
                ? 'bg-[#FF2E93] text-white shadow-lg shadow-[#FF2E93]/20'
                : 'bg-[#161822] hover:bg-[#212433] text-[#B2B9C8] hover:text-white border border-[#2B2F42]'
            }`}
          >
            <Heart className="w-4 h-4 fill-current/30" />
            <span>Избранное</span>
            <span className="font-mono text-[11px] opacity-80">({favoritesCount})</span>
          </button>
        </div>

        {/* View Content Branching */}
        {activeNavTab === 'playlists' ? (
          <PlaylistsView
            profileId={profileId}
            onSelectPlaylist={(plId) => {
              setSelectedPlaylistId(plId);
              setActiveNavTab('playlist_detail');
            }}
            onPlayPlaylist={handlePlayPlaylist}
            onSharePlaylist={handleSharePlaylist}
            onToast={showToast}
          />
        ) : activeNavTab === 'playlist_detail' && selectedPlaylist ? (
          <PlaylistDetailView
            playlist={selectedPlaylist}
            tracks={rawTracks}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onBack={() => {
              setActiveNavTab('playlists');
              setSelectedPlaylistId(null);
            }}
            onPlayTrack={handlePlayTrack}
            onPlayAll={(shuffle) => handlePlayPlaylist(selectedPlaylist, shuffle)}
            onOpenPicker={handleOpenPicker}
            onToggleFavorite={handleToggleFavorite}
            onAddToPlaylist={(t) => setTrackForPlaylistModal(t)}
            onShareTrack={handleShareTrack}
            onSharePlaylist={handleSharePlaylist}
            onRemoveFromPlaylist={handleRemoveFromPlaylist}
          />
        ) : (
          /* Tracks / Favorites View */
          <>
            {/* Search Bar */}
            <SearchBar value={searchQuery} onChange={setSearchQuery} />

            {/* Tags Bar (Only in Tracks view) */}
            {activeNavTab === 'tracks' && (
              <TagsBar
                selectedTag={selectedTag}
                onSelectTag={setSelectedTag}
                availableTags={tags}
              />
            )}

            {/* Action Header / Counts */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#F3F4F6]">
                  {searchQuery.trim()
                    ? `Результаты по запросу «${searchQuery}»`
                    : activeNavTab === 'favorites'
                    ? 'Любимые треки'
                    : `${selectedTag} треки`}
                </h2>
                <p className="text-xs text-[#8E95A5]">
                  {filteredTracks.length.toLocaleString()} трек
                  {filteredTracks.length === 1 ? '' : filteredTracks.length > 4 ? 'ов' : 'а'} доступно
                  {visibleCount < filteredTracks.length && ` (показано ${visibleTracks.length})`}
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
                    title={isQueueView ? 'Свернуть очередь' : 'Показать очередь'}
                  >
                    <ListMusic className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Очередь</span>
                    <span className="text-[#00E5FF] font-mono font-bold">({queue.length})</span>
                  </button>
                )}

                <button
                  onClick={() => shuffleAndPlay(filteredTracks)}
                  disabled={filteredTracks.length === 0}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-full bg-[#00E5FF] hover:bg-[#00E5FF]/90 disabled:opacity-50 text-[#0D0E15] font-bold text-xs shadow-md shadow-[#00E5FF]/15 transition-all active:scale-95 cursor-pointer"
                  title="Перемешать и воспроизвести"
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
                        onPlay={handlePlayTrack}
                        onOpenPicker={handleOpenPicker}
                        onToggleFavorite={handleToggleFavorite}
                        onAddToPlaylist={(t) => setTrackForPlaylistModal(t)}
                        onShareTrack={handleShareTrack}
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
          </>
        )}
      </main>

      {/* Version Picker Modal */}
      <CellVersionPickerModal
        isOpen={Boolean(inspectingTrack)}
        track={inspectingTrack}
        onClose={() => setInspectingTrack(null)}
        onUpdated={() => setInspectingTrack(null)}
      />

      {/* Add To Playlist Modal */}
      <AddToPlaylistModal
        isOpen={Boolean(trackForPlaylistModal)}
        track={trackForPlaylistModal}
        profileId={profileId}
        onClose={() => setTrackForPlaylistModal(null)}
        onToast={showToast}
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
      />

      {/* Desktop Cache & Gateway Settings Modal */}
      <DesktopSettingsModal
        isOpen={isDesktopSettingsOpen}
        onClose={() => setIsDesktopSettingsOpen(false)}
        onToast={showToast}
      />

      {/* Playlist & Queue Drawer */}
      <PlaylistDrawer
        isOpen={isQueueView}
        onClose={() => setIsQueueView(false)}
        onOpenPicker={(t) => setInspectingTrack(t)}
        onToggleFavorite={(id) => toggleFavoriteTrack(id)}
        onShareTrack={handleShareTrack}
        onAddToPlaylist={(t) => setTrackForPlaylistModal(t)}
      />

      {/* Persistent Bottom Player Bar */}
      <BottomPlayerBar
        onShareTrack={handleShareTrack}
        onAddToPlaylist={(t) => setTrackForPlaylistModal(t)}
        onToggleFavorite={handleToggleFavorite}
      />

      {/* Toast Notifier */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default App;
