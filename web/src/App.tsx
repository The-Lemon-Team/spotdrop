import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useDeferredValue,
} from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Shuffle, ListMusic, Sparkles, Heart, Music, FolderPlus, Headphones, ArrowUpDown } from 'lucide-react';
import { db, toggleFavoriteTrack, removeTrackFromPlaylist } from './db/banditaDb';
import { loadProfileBySlug, ensurePlaylistsSynced, ensureSpotifyOrderSynced } from './importer/spotifyImporter';
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
import { YouTubePlaylistView } from './components/YouTubePlaylistView';
import { YouTubeIcon } from './components/YouTubeIcon';
import { SpotifyIcon } from './components/SpotifyIcon';
import { Toast, type ToastData } from './components/Toast';
import { DesktopSettingsModal } from './components/DesktopSettingsModal';
import { usePlayer } from './player/playerContext';
import type { TrackCell, Playlist } from './types';

const PAGE_SIZE = 50;

type NavTab = 'tracks' | 'spotify_order' | 'playlists' | 'playlist_detail' | 'favorites' | 'youtube_playlist';

export interface ParsedRoute {
  slug: string | null;
  tab: NavTab | null;
  playlistId: string | null;
  trackId: string | null;
  tag: string | null;
}

export function parseRouteFromUrl(): ParsedRoute {
  if (typeof window === 'undefined') {
    return { slug: null, tab: null, playlistId: null, trackId: null, tag: null };
  }

  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);

  let slug: string | null = null;
  let tab: NavTab | null = null;

  // Pattern 1: /p/:slug/youtube, /p/:slug/playlists etc.
  const matchProfileWithSub = path.match(/^\/p\/([^/?#]+)\/([^/?#]+)/);
  if (matchProfileWithSub) {
    slug = decodeURIComponent(matchProfileWithSub[1]).toLowerCase();
    const sub = decodeURIComponent(matchProfileWithSub[2]).toLowerCase();
    if (sub === 'youtube' || sub === 'youtube_playlist') {
      tab = 'youtube_playlist';
    } else if (sub === 'playlists') {
      tab = 'playlists';
    } else if (sub === 'favorites') {
      tab = 'favorites';
    } else if (sub === 'spotify_order') {
      tab = 'spotify_order';
    }
  } else {
    // Pattern 2: /p/:slug
    const matchProfile = path.match(/^\/p\/([^/?#]+)/);
    if (matchProfile) {
      slug = decodeURIComponent(matchProfile[1]).toLowerCase();
    } else if (path === '/youtube' || path.startsWith('/youtube/')) {
      tab = 'youtube_playlist';
    }
  }

  // Query parameter overrides or fallbacks
  const p = params.get('p') || params.get('profile');
  if (p) {
    slug = p.toLowerCase().trim();
  }

  const tabParam = params.get('tab') || params.get('view');
  if (tabParam) {
    const t = tabParam.toLowerCase().trim();
    if (t === 'youtube' || t === 'youtube_playlist') {
      tab = 'youtube_playlist';
    } else if (t === 'playlists') {
      tab = 'playlists';
    } else if (t === 'favorites') {
      tab = 'favorites';
    } else if (t === 'spotify_order') {
      tab = 'spotify_order';
    } else if (t === 'tracks') {
      tab = 'tracks';
    }
  }

  const playlistId = params.get('playlist');
  const trackId = params.get('track');
  const rawTag = params.get('tag');
  const tag = rawTag ? (rawTag.startsWith('#') ? rawTag : `#${rawTag}`) : null;

  return { slug, tab, playlistId, trackId, tag };
}

export function buildRouteUrl(
  slug: string | null,
  tab: NavTab,
  options?: { playlistId?: string | null; youtubeSourcePlaylistId?: string | null }
): string {
  const profileSlug = slug && slug !== 'profile_default' ? slug : 'beta';

  if (tab === 'youtube_playlist') {
    const base = `/p/${profileSlug}/youtube`;
    if (options?.youtubeSourcePlaylistId && options.youtubeSourcePlaylistId !== 'all') {
      return `${base}?playlist=${encodeURIComponent(options.youtubeSourcePlaylistId)}`;
    }
    return base;
  }

  if (tab === 'playlist_detail' && options?.playlistId) {
    return `/p/${profileSlug}?playlist=${encodeURIComponent(options.playlistId)}`;
  }

  if (tab === 'playlists') {
    return `/p/${profileSlug}?tab=playlists`;
  }

  if (tab === 'favorites') {
    return `/p/${profileSlug}?tab=favorites`;
  }

  if (tab === 'spotify_order') {
    return `/p/${profileSlug}?tab=spotify_order`;
  }

  // Default: tracks
  return `/p/${profileSlug}`;
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
  const [spotifyOrderSortDesc, setSpotifyOrderSortDesc] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [youtubeSourcePlaylistId, setYoutubeSourcePlaylistId] = useState<string | null>(null);
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
    const cleanTarget = selectedPlaylistId.toLowerCase().trim();
    return (
      playlists.find(
        (p) =>
          p.id === selectedPlaylistId ||
          p.name.toLowerCase().trim() === cleanTarget ||
          p.name.toLowerCase().includes(cleanTarget) ||
          p.id.toLowerCase().includes(cleanTarget)
      ) || null
    );
  }, [playlists, selectedPlaylistId]);

  const favoritesCount = useMemo(() => {
    return rawTracks.filter((t) => t.isFavorite).length;
  }, [rawTracks]);

  const spotifyOrderCount = useMemo(() => {
    return rawTracks.filter((t) => t.spotifyOrder !== undefined || t.isFavorite).length;
  }, [rawTracks]);

  const youtubePinnedCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < rawTracks.length; i++) {
      if (rawTracks[i].pinnedVideoId) count++;
    }
    return count;
  }, [rawTracks]);

  // Toast notifier helper
  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ id: Date.now(), message, type });
  }, []);

  // Centralized tab/route navigation with browser history sync
  const navigateToTab = useCallback(
    (
      tab: NavTab,
      opts?: {
        playlistId?: string | null;
        youtubeSourcePlaylistId?: string | null;
        replace?: boolean;
      }
    ) => {
      const currentSlug = profileId === 'profile_default' ? 'beta' : profileId;
      const targetPlId =
        opts?.playlistId !== undefined
          ? opts.playlistId
          : tab === 'playlist_detail'
          ? selectedPlaylistId
          : null;
      const targetYtPlId =
        opts?.youtubeSourcePlaylistId !== undefined
          ? opts.youtubeSourcePlaylistId
          : tab === 'youtube_playlist'
          ? youtubeSourcePlaylistId
          : null;

      const targetUrl = buildRouteUrl(currentSlug, tab, {
        playlistId: targetPlId,
        youtubeSourcePlaylistId: targetYtPlId,
      });

      if (opts?.replace) {
        window.history.replaceState(
          { tab, playlistId: targetPlId, youtubeSourcePlaylistId: targetYtPlId },
          '',
          targetUrl
        );
      } else {
        window.history.pushState(
          { tab, playlistId: targetPlId, youtubeSourcePlaylistId: targetYtPlId },
          '',
          targetUrl
        );
      }

      setActiveNavTab(tab);
      if (tab !== 'playlist_detail') {
        setSelectedPlaylistId(null);
      } else if (targetPlId) {
        setSelectedPlaylistId(targetPlId);
      }

      if (tab === 'youtube_playlist' && targetYtPlId !== undefined) {
        setYoutubeSourcePlaylistId(targetYtPlId);
      }
    },
    [profileId, selectedPlaylistId, youtubeSourcePlaylistId]
  );

  // Routing on mount & popstate
  useEffect(() => {
    const initApp = async () => {
      const route = parseRouteFromUrl();
      const activeSlug = route.slug;

      if (activeSlug) {
        setIsLoadingProfile(true);
        try {
          const success = await loadProfileBySlug(activeSlug);
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
          // Also sync playlists and spotifyOrder if needed
          ensurePlaylistsSynced(profileId).catch(() => {});
          ensureSpotifyOrderSynced(profileId).catch(() => {});
        } else if (isTauriEnvironment() || route.tab === 'youtube_playlist') {
          // Pre-installed SpotDrop Beta Library on desktop or direct /youtube route!
          setIsLoadingProfile(true);
          try {
            const success = await loadProfileBySlug('beta');
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

      // Restore view tab & playlist from URL route
      if (route.tag) {
        setSelectedTag(route.tag);
      }
      if (route.tag) {
        setSelectedTag(route.tag);
      }
      if (route.tab === 'youtube_playlist') {
        setActiveNavTab('youtube_playlist');
        if (route.playlistId) {
          setYoutubeSourcePlaylistId(route.playlistId);
        }
      } else if (route.playlistId) {
        setSelectedPlaylistId(route.playlistId);
        setActiveNavTab('playlist_detail');
      } else if (route.tab) {
        setActiveNavTab(route.tab);
      }
    };

    initApp();

    // Handle browser back/forward buttons
    const onPopState = async () => {
      const route = parseRouteFromUrl();
      if (route.slug) {
        await loadProfileBySlug(route.slug);
        setView('player');
      } else {
        const count = await db.tracks.count();
        if (count > 0 || isTauriEnvironment()) {
          setView('player');
        } else {
          setView('landing');
          return;
        }
      }

      if (route.tag) {
        setSelectedTag(route.tag);
      }
      if (route.tab === 'youtube_playlist') {
        setActiveNavTab('youtube_playlist');
        setYoutubeSourcePlaylistId(route.playlistId || null);
        setSelectedPlaylistId(null);
      } else if (route.playlistId) {
        setSelectedPlaylistId(route.playlistId);
        setActiveNavTab('playlist_detail');
      } else if (route.tab) {
        setActiveNavTab(route.tab);
        setSelectedPlaylistId(null);
      } else {
        setActiveNavTab('tracks');
        setSelectedPlaylistId(null);
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [profileId]);

  // Check URL parameters for shared track
  useEffect(() => {
    if (hasCheckedSharedTrack.current || rawTracks.length === 0) return;

    const route = parseRouteFromUrl();
    if (route.trackId) {
      const found = rawTracks.find(
        (t) => t.id === route.trackId || t.id.toLowerCase().includes(route.trackId!.toLowerCase())
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
      const targetSlug = slug === 'profile_default' ? 'beta' : slug;
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

  // Filtered tracks based on search query, active tag, favorites tab, or spotify order tab
  const filteredTracks = useMemo(() => {
    let result = rawTracks;

    if (activeNavTab === 'spotify_order') {
      result = rawTracks
        .filter((t) => t.spotifyOrder !== undefined || t.isFavorite)
        .slice()
        .sort((a, b) => {
          const orderA = a.spotifyOrder ?? 999999;
          const orderB = b.spotifyOrder ?? 999999;
          const diff = orderA - orderB;
          return spotifyOrderSortDesc ? -diff : diff;
        });
    } else if (activeNavTab === 'favorites') {
      result = result
        .filter((t) => t.isFavorite)
        .slice()
        .sort((a, b) => {
          const orderA = a.spotifyOrder ?? 999999;
          const orderB = b.spotifyOrder ?? 999999;
          return orderA - orderB;
        });
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
  }, [rawTracks, activeNavTab, selectedTag, deferredSearchQuery, searchIndex, spotifyOrderSortDesc]);

  // Reset pagination when filter or search changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedTag, deferredSearchQuery, activeNavTab, spotifyOrderSortDesc]);

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
  const queueRef = useRef(queue);
  queueRef.current = queue;

  const handlePlayTrack = useCallback(
    (track: TrackCell, newQueue?: TrackCell[], startIndex?: number) => {
      const targetQueue = newQueue || filteredTracksRef.current;
      const isSameTrack = currentTrackRef.current?.id === track.id;

      if (isSameTrack) {
        if (newQueue) {
          const isSameQueue =
            queueRef.current.length === newQueue.length &&
            (queueRef.current === newQueue ||
              newQueue.every(
                (t, i) =>
                  queueRef.current[i]?.id === t.id ||
                  queueRef.current.some((q) => q.id === t.id)
              ));
          if (isSameQueue) {
            togglePlayPause();
            return;
          }
        } else {
          togglePlayPause();
          return;
        }
      }

      playTrack(track, targetQueue, startIndex);
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
      const currentSlug = profileId === 'profile_default' ? 'beta' : profileId;
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
      const currentSlug = profileId === 'profile_default' ? 'beta' : profileId;
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

  const handleOpenAddToPlaylistModal = useCallback((t: TrackCell) => {
    setTrackForPlaylistModal(t);
  }, []);

  const handleShareYouTubePlaylist = useCallback(
    async (playlistTitle: string, sourcePlaylistId: string | null) => {
      const currentSlug = profileId === 'profile_default' ? 'beta' : profileId;
      let shareUrl = `${window.location.origin}/p/${currentSlug}/youtube`;
      if (sourcePlaylistId && sourcePlaylistId !== 'all') {
        shareUrl += `?playlist=${encodeURIComponent(sourcePlaylistId)}`;
      }

      if (navigator.share) {
        try {
          await navigator.share({
            title: `YouTube Плейлист: ${playlistTitle}`,
            text: `Послушай плейлист «${playlistTitle}» на YouTube через SpotDrop`,
            url: shareUrl,
          });
          showToast('Ссылка на YouTube-плейлист отправлена!', 'info');
          return;
        } catch (err: any) {
          if (err.name === 'AbortError') return;
        }
      }

      try {
        await navigator.clipboard.writeText(shareUrl);
        showToast('Ссылка на YouTube-плейлист скопирована!', 'success');
      } catch {
        showToast('Не удалось скопировать ссылку', 'error');
      }
    },
    [profileId, showToast]
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
            onClick={() => navigateToTab('tracks')}
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
            onClick={() => navigateToTab('spotify_order')}
            className={`flex items-center space-x-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeNavTab === 'spotify_order'
                ? 'bg-[#1ED760] text-[#0D0E15] shadow-lg shadow-[#1ED760]/20'
                : 'bg-[#161822] hover:bg-[#212433] text-[#B2B9C8] hover:text-[#1ED760] border border-[#2B2F42]'
            }`}
          >
            <SpotifyIcon className="w-4 h-4" />
            <span>Порядок Spotify</span>
            <span className="font-mono text-[11px] opacity-80">({spotifyOrderCount})</span>
          </button>

          <button
            onClick={() => navigateToTab('playlists')}
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
            onClick={() => navigateToTab('favorites')}
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

          <button
            onClick={() => navigateToTab('youtube_playlist')}
            className={`flex items-center space-x-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeNavTab === 'youtube_playlist'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                : 'bg-[#161822] hover:bg-[#212433] text-[#B2B9C8] hover:text-white border border-[#2B2F42]'
            }`}
          >
            <YouTubeIcon className="w-4 h-4" />
            <span>YouTube Плейлист</span>
            <span className="font-mono text-[11px] opacity-80">
              ({youtubePinnedCount})
            </span>
          </button>
        </div>

        {/* View Content Branching */}
        {activeNavTab === 'youtube_playlist' ? (
          <YouTubePlaylistView
            tracks={rawTracks}
            playlists={playlists}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            profileSlug={profileId === 'profile_default' ? 'bandita' : profileId}
            selectedPlaylistId={youtubeSourcePlaylistId}
            onSelectPlaylistId={(newSource) => {
              setYoutubeSourcePlaylistId(newSource);
              navigateToTab('youtube_playlist', {
                youtubeSourcePlaylistId: newSource,
                replace: true,
              });
            }}
            onPlayTrack={handlePlayTrack}
            onShuffleAndPlay={shuffleAndPlay}
            onOpenPicker={handleOpenPicker}
            onToggleFavorite={handleToggleFavorite}
            onAddToPlaylist={handleOpenAddToPlaylistModal}
            onShareTrack={handleShareTrack}
            onShareYouTubePlaylist={handleShareYouTubePlaylist}
            onToast={showToast}
          />
        ) : activeNavTab === 'playlists' ? (
          <PlaylistsView
            profileId={profileId}
            onSelectPlaylist={(plId) => {
              navigateToTab('playlist_detail', { playlistId: plId });
            }}
            onPlayPlaylist={handlePlayPlaylist}
            onSharePlaylist={handleSharePlaylist}
            onToast={showToast}
            onOpenAsYouTubePlaylist={(pl) => {
              navigateToTab('youtube_playlist', { youtubeSourcePlaylistId: pl.id });
            }}
          />
        ) : activeNavTab === 'playlist_detail' && selectedPlaylist ? (
          <PlaylistDetailView
            playlist={selectedPlaylist}
            tracks={rawTracks}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onBack={() => {
              navigateToTab('playlists');
            }}
            onPlayTrack={handlePlayTrack}
            onPlayAll={(shuffle) => handlePlayPlaylist(selectedPlaylist, shuffle)}
            onOpenPicker={handleOpenPicker}
            onToggleFavorite={handleToggleFavorite}
            onAddToPlaylist={handleOpenAddToPlaylistModal}
            onShareTrack={handleShareTrack}
            onSharePlaylist={handleSharePlaylist}
            onRemoveFromPlaylist={handleRemoveFromPlaylist}
            onOpenAsYouTubePlaylist={(pl) => {
              navigateToTab('youtube_playlist', { youtubeSourcePlaylistId: pl.id });
            }}
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
                    : activeNavTab === 'spotify_order'
                    ? 'Любимые треки (Порядок Spotify)'
                    : activeNavTab === 'favorites'
                    ? 'Любимые треки'
                    : `${selectedTag} треки`}
                </h2>
                <p className="text-xs text-[#8E95A5]">
                  {activeNavTab === 'spotify_order' && !searchQuery.trim()
                    ? `${filteredTracks.length.toLocaleString()} треков в оригинальном порядке из Spotify`
                    : `${filteredTracks.length.toLocaleString()} трек${
                        filteredTracks.length === 1 ? '' : filteredTracks.length > 4 ? 'ов' : 'а'
                      } доступно`}
                  {visibleCount < filteredTracks.length && ` (показано ${visibleTracks.length})`}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                {activeNavTab === 'spotify_order' && (
                  <button
                    onClick={() => setSpotifyOrderSortDesc(!spotifyOrderSortDesc)}
                    className="flex items-center space-x-1.5 px-3 py-2 rounded-full bg-[#161822] hover:bg-[#212433] border border-[#2B2F42] hover:border-[#1ED760]/50 text-[#B2B9C8] hover:text-[#1ED760] font-semibold text-xs transition-all cursor-pointer"
                    title={
                      spotifyOrderSortDesc
                        ? 'Порядок: с конца к началу (N → 1). Нажмите для переключения (1 → N)'
                        : 'Порядок: с начала к концу (1 → N). Нажмите для переключения (N → 1)'
                    }
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    <span className="font-mono">{spotifyOrderSortDesc ? 'N → 1' : '1 → N'}</span>
                  </button>
                )}

                {queue.length > 0 && (
                  <button
                    onClick={() => setIsQueueView(!isQueueView)}
                    className={`hidden sm:flex items-center space-x-1.5 px-3 py-2 rounded-full border text-xs font-semibold transition-all cursor-pointer ${
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
                  {visibleTracks.map((track, idx) => {
                    const isCurrent = currentTrack?.id === track.id;
                    const trackNum =
                      activeNavTab === 'spotify_order'
                        ? track.spotifyOrder !== undefined
                          ? track.spotifyOrder + 1
                          : idx + 1
                        : undefined;

                    return (
                      <TrackCellCard
                        key={track.id}
                        track={track}
                        trackNumber={trackNum}
                        isCurrent={isCurrent}
                        isPlaying={isCurrent && isPlaying}
                        onPlay={handlePlayTrack}
                        onOpenPicker={handleOpenPicker}
                        onToggleFavorite={handleToggleFavorite}
                        onAddToPlaylist={(t) => setTrackForPlaylistModal(t)}
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
        onAddToPlaylist={(t) => setTrackForPlaylistModal(t)}
      />

      {/* Persistent Bottom Player Bar */}
      <BottomPlayerBar
        onAddToPlaylist={(t) => setTrackForPlaylistModal(t)}
        onToggleFavorite={handleToggleFavorite}
      />

      {/* Toast Notifier */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default App;
