import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ListMusic,
  Play,
  Shuffle,
  Plus,
  Search,
  Share2,
  Trash2,
  Sparkles,
  Clock,
  Music2,
} from 'lucide-react';
import { db, createPlaylist, deletePlaylist } from '../db/banditaDb';
import type { Playlist, TrackCell } from '../types';

interface PlaylistsViewProps {
  profileId: string;
  onSelectPlaylist: (playlistId: string) => void;
  onPlayPlaylist: (playlist: Playlist, shuffle?: boolean) => void;
  onSharePlaylist: (playlist: Playlist) => void;
  onToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

const GRADIENT_PALETTES = [
  'from-cyan-500/30 to-blue-600/30 border-cyan-500/30 text-cyan-400',
  'from-pink-500/30 to-rose-600/30 border-pink-500/30 text-pink-400',
  'from-purple-500/30 to-indigo-600/30 border-purple-500/30 text-purple-400',
  'from-emerald-500/30 to-teal-600/30 border-emerald-500/30 text-emerald-400',
  'from-amber-500/30 to-orange-600/30 border-amber-500/30 text-amber-400',
  'from-fuchsia-500/30 to-violet-600/30 border-fuchsia-500/30 text-fuchsia-400',
];

export const PlaylistsView: React.FC<PlaylistsViewProps> = ({
  profileId,
  onSelectPlaylist,
  onPlayPlaylist,
  onSharePlaylist,
  onToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

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

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPlaylistName.trim();
    if (!name) return;

    try {
      const created = await createPlaylist(profileId, name, []);
      setNewPlaylistName('');
      setShowCreateModal(false);
      onToast(`Плейлист «${created.name}» создан!`, 'success');
      onSelectPlaylist(created.id);
    } catch {
      onToast('Ошибка создания плейлиста', 'error');
    }
  };

  const handleDelete = async (e: React.MouseEvent, pl: Playlist) => {
    e.stopPropagation();
    if (window.confirm(`Удалить плейлист «${pl.name}»?`)) {
      await deletePlaylist(pl.id);
      onToast(`Плейлист «${pl.name}» удален`, 'info');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center space-x-2">
            <span>Плейлисты Spotify</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/20 font-bold">
              {playlists.length}
            </span>
          </h2>
          <p className="text-xs text-[#8E95A5]">
            Точная копия ваших плейлистов из экспорта Spotify с сохранением порядка треков
          </p>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          {/* Create Playlist Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-[#0D0E15] font-bold text-xs shadow-lg shadow-[#00E5FF]/20 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Создать плейлист</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-[#8E95A5] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Поиск по названию плейлиста..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#161822] border border-[#2B2F42] focus:border-[#00E5FF] rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-[#8E95A5] outline-none transition-colors"
        />
      </div>

      {/* Playlists Grid */}
      {filteredPlaylists.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-[#161822] border border-[#2B2F42] flex items-center justify-center mb-3 text-[#00E5FF]">
            <ListMusic className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">
            {searchQuery.trim() ? 'Плейлисты не найдены' : 'Нет доступных плейлистов'}
          </h3>
          <p className="text-xs text-[#8E95A5] max-w-sm mb-4">
            {searchQuery.trim()
              ? `По запросу «${searchQuery}» ничего не найдено`
              : 'Загрузите экспорт Playlist1.json или создайте свой плейлист'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredPlaylists.map((pl, idx) => {
            const palette = GRADIENT_PALETTES[idx % GRADIENT_PALETTES.length];
            const trackCount = pl.trackCount || (pl.trackIds ? pl.trackIds.length : 0);

            return (
              <div
                key={pl.id}
                onClick={() => onSelectPlaylist(pl.id)}
                className="group relative bg-[#161822] hover:bg-[#1D2130] border border-[#2B2F42] hover:border-[#00E5FF]/50 rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-[#00E5FF]/5 flex flex-col justify-between"
              >
                <div>
                  {/* Top Art & Badge */}
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${palette} border flex items-center justify-center shadow-md`}
                    >
                      <ListMusic className="w-6 h-6 fill-current/20" />
                    </div>

                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSharePlaylist(pl);
                        }}
                        className="p-1.5 rounded-lg bg-[#212433] hover:bg-[#2B2F42] text-[#B2B9C8] hover:text-[#00E5FF] transition-colors"
                        title="Поделиться плейлистом"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>

                      {pl.id.startsWith('pl_') && !pl.id.includes('summer') && !pl.id.includes('feb') && (
                        <button
                          onClick={(e) => handleDelete(e, pl)}
                          className="p-1.5 rounded-lg bg-[#212433] hover:bg-rose-950 text-[#8E95A5] hover:text-rose-400 transition-colors"
                          title="Удалить плейлист"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Playlist Name */}
                  <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-[#00E5FF] transition-colors truncate mb-1">
                    {pl.name}
                  </h3>

                  {/* Metadata */}
                  <div className="flex items-center space-x-2 text-xs text-[#8E95A5] mb-4">
                    <span className="text-[#00E5FF] font-semibold">{trackCount} треков</span>
                    {pl.lastModifiedDate && (
                      <>
                        <span>•</span>
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{pl.lastModifiedDate}</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Bottom Quick Play Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-[#2B2F42]/60">
                  <span className="text-[11px] text-[#8E95A5] group-hover:text-[#B2B9C8] transition-colors">
                    Открыть плейлист →
                  </span>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayPlaylist(pl, true);
                      }}
                      disabled={trackCount === 0}
                      className="p-2 rounded-xl bg-[#212433] hover:bg-[#2B2F42] text-[#B2B9C8] hover:text-[#00E5FF] disabled:opacity-40 transition-all cursor-pointer"
                      title="Перемешать и воспроизвести"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayPlaylist(pl, false);
                      }}
                      disabled={trackCount === 0}
                      className="p-2 rounded-xl bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-[#0D0E15] disabled:opacity-40 transition-all active:scale-95 cursor-pointer shadow-md shadow-[#00E5FF]/20"
                      title="Воспроизвести плейлист"
                    >
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-sm bg-[#161822] border border-[#2B2F42] rounded-2xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white mb-1">Создать новый плейлист</h3>
            <p className="text-xs text-[#8E95A5] mb-4">
              Введите название плейлиста для вашей библиотеки
            </p>

            <form onSubmit={handleCreatePlaylist} className="space-y-4">
              <input
                type="text"
                autoFocus
                placeholder="Название плейлиста..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                className="w-full bg-[#0D0E15] border border-[#2B2F42] focus:border-[#00E5FF] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#8E95A5] outline-none"
              />

              <div className="flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-[#212433] hover:bg-[#2B2F42] text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={!newPlaylistName.trim()}
                  className="px-4 py-2 rounded-xl bg-[#00E5FF] hover:bg-[#00E5FF]/90 disabled:opacity-40 text-xs font-bold text-[#0D0E15] transition-all cursor-pointer shadow-md shadow-[#00E5FF]/15"
                >
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
