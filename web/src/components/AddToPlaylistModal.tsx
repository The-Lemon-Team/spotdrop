import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, Plus, Check, ListMusic, Search, Music, FolderPlus } from 'lucide-react';
import { db, createPlaylist, toggleTrackInPlaylist } from '../db/banditaDb';
import type { TrackCell } from '../types';

interface AddToPlaylistModalProps {
  isOpen: boolean;
  track: TrackCell | null;
  profileId: string;
  onClose: () => void;
  onToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  isOpen,
  track,
  profileId,
  onClose,
  onToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const playlists =
    useLiveQuery(
      () => db.playlists.where('profileId').equals(profileId).toArray(),
      [profileId]
    ) || [];

  const filteredPlaylists = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return playlists;
    return playlists.filter((pl) => pl.name.toLowerCase().includes(q));
  }, [playlists, searchQuery]);

  if (!isOpen || !track) return null;

  const handleCreateNewPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPlaylistName.trim();
    if (!name) return;

    try {
      setIsCreating(true);
      const created = await createPlaylist(profileId, name, [track.id]);
      setNewPlaylistName('');
      if (onToast) {
        onToast(`Плейлист «${created.name}» создан, трек добавлен!`, 'success');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggle = async (playlistId: string, playlistName: string) => {
    const result = await toggleTrackInPlaylist(playlistId, track.id);
    if (onToast) {
      if (result.inPlaylist) {
        onToast(`Трек добавлен в «${playlistName}»`, 'success');
      } else {
        onToast(`Трек удален из «${playlistName}»`, 'info');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-md bg-[#161822] border border-[#2B2F42] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#2B2F42]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#00E5FF]/10 text-[#00E5FF] flex items-center justify-center border border-[#00E5FF]/20">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Добавить в плейлист</h3>
              <p className="text-xs text-[#8E95A5]">Выберите плейлист или создайте новый</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8E95A5] hover:text-white hover:bg-[#212433] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Track Preview */}
        <div className="px-4 py-3 bg-[#11131c] border-b border-[#2B2F42]/60 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-[#212433] flex items-center justify-center shrink-0 overflow-hidden border border-[#2B2F42]">
            {track.pinnedThumbnail ? (
              <img src={track.pinnedThumbnail} alt="" className="w-full h-full object-cover" />
            ) : (
              <Music className="w-5 h-5 text-[#00E5FF]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-semibold text-white truncate">{track.title}</h4>
            <p className="text-xs text-[#8E95A5] truncate">
              {track.artist} <span className="text-[#8E95A5]/60">•</span> {track.album}
            </p>
          </div>
        </div>

        {/* Quick Search & Create New Playlist */}
        <div className="p-4 space-y-3 border-b border-[#2B2F42]/60">
          {/* Create new playlist inline form */}
          <form onSubmit={handleCreateNewPlaylist} className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Название нового плейлиста..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              className="flex-1 bg-[#0D0E15] border border-[#2B2F42] focus:border-[#00E5FF] rounded-xl px-3.5 py-2 text-xs text-white placeholder-[#8E95A5] outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={!newPlaylistName.trim() || isCreating}
              className="px-3.5 py-2 bg-[#00E5FF] hover:bg-[#00E5FF]/90 disabled:opacity-40 text-[#0D0E15] rounded-xl font-bold text-xs flex items-center space-x-1 transition-all cursor-pointer shadow-md shadow-[#00E5FF]/15 shrink-0"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Создать</span>
            </button>
          </form>

          {/* Filter playlists search */}
          {playlists.length > 5 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#8E95A5] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Поиск по плейлистам..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0D0E15]/60 border border-[#2B2F42] focus:border-[#00E5FF]/60 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#8E95A5] outline-none transition-colors"
              />
            </div>
          )}
        </div>

        {/* Playlists List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5 max-h-64 sm:max-h-72 scrollbar-thin">
          {filteredPlaylists.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#8E95A5]">
              {playlists.length === 0
                ? 'Нет созданных плейлистов. Создайте первый выше!'
                : `Ничего не найдено по запросу «${searchQuery}»`}
            </div>
          ) : (
            filteredPlaylists.map((pl) => {
              const inPlaylist = Array.isArray(pl.trackIds) && pl.trackIds.includes(track.id);
              return (
                <div
                  key={pl.id}
                  onClick={() => handleToggle(pl.id, pl.name)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                    inPlaylist
                      ? 'bg-[#00E5FF]/10 border-[#00E5FF]/40 text-white'
                      : 'bg-[#11131c] hover:bg-[#1a1d2b] border-[#2B2F42] text-[#B2B9C8]'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        inPlaylist
                          ? 'bg-[#00E5FF] text-[#0D0E15]'
                          : 'bg-[#212433] text-[#8E95A5]'
                      }`}
                    >
                      <ListMusic className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4
                        className={`text-xs font-semibold truncate ${
                          inPlaylist ? 'text-[#00E5FF]' : 'text-white'
                        }`}
                      >
                        {pl.name}
                      </h4>
                      <p className="text-[11px] text-[#8E95A5]">
                        {pl.trackCount || (pl.trackIds?.length || 0)} трек
                        {(pl.trackCount || 0) === 1 ? '' : (pl.trackCount || 0) > 4 ? 'ов' : 'а'}
                        {pl.lastModifiedDate && ` • ${pl.lastModifiedDate}`}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all shrink-0 ml-2 ${
                      inPlaylist
                        ? 'bg-[#00E5FF] border-[#00E5FF] text-[#0D0E15]'
                        : 'border-[#2B2F42] text-transparent hover:border-[#00E5FF]/60'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#11131c] border-t border-[#2B2F42] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#212433] hover:bg-[#2B2F42] text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};
