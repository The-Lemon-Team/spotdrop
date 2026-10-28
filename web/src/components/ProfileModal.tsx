import React, { useState } from 'react';
import { X, Upload, Plus, Check, Music2, RefreshCw, Sparkles } from 'lucide-react';
import type { MusicProfile } from '../types';
import { db, setCurrentProfile } from '../db/banditaDb';
import { importSpotifyData, initializeDefaultsIfEmpty } from '../importer/spotifyImporter';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: MusicProfile[];
  currentProfile: MusicProfile | null;
  onProfilesChanged: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = React.memo(function ProfileModal({
  isOpen,
  onClose,
  profiles,
  currentProfile,
  onProfilesChanged,
}) {
  const [newProfileName, setNewProfileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) return;
    const newId = `profile_${Math.random().toString(36).substring(2, 9)}`;
    const newProf: MusicProfile = {
      id: newId,
      name: newProfileName.trim(),
      avatarEmoji: '🎧',
      isCurrent: true,
      createdAt: Date.now(),
    };

    await db.profiles.add(newProf);
    await setCurrentProfile(newId);
    setNewProfileName('');
    onProfilesChanged();
  };

  const handleSwitchProfile = async (id: string) => {
    await setCurrentProfile(id);
    const slug = id === 'profile_default' ? 'beta' : id;
    window.history.pushState({}, '', `/p/${slug}`);
    onProfilesChanged();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentProfile) return;

    setIsImporting(true);
    setImportMessage(`Чтение и парсинг ${files.length} файл(ов)...`);

    try {
      let libJson: string | null = null;
      const playlistInputs: Array<{ name: string; content: string }> = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const text = await file.text();
        const lowerName = file.name.toLowerCase();

        if (lowerName.includes('yourlibrary') || lowerName.includes('library')) {
          libJson = text;
        } else if (lowerName.includes('playlist')) {
          playlistInputs.push({ name: file.name, content: text });
        } else {
          // Check JSON structure
          try {
            const parsed = JSON.parse(text);
            if (parsed.playlists) {
              playlistInputs.push({ name: file.name, content: text });
            } else if (parsed.tracks) {
              libJson = text;
            } else {
              playlistInputs.push({ name: file.name, content: text });
            }
          } catch {
            // skip malformed
          }
        }
      }

      const result = await importSpotifyData(currentProfile.id, libJson, playlistInputs.length > 0 ? playlistInputs : null);
      setImportMessage(
        `Успешно! Импортировано ${result.tracksImported} треков и ${result.playlistsImported} плейлистов.`
      );
      onProfilesChanged();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setImportMessage(`Ошибка импорта: ${errorMsg}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleReloadDefaults = async () => {
    setIsImporting(true);
    setImportMessage('Загрузка тестового Beta-плейлиста...');
    try {
      await initializeDefaultsIfEmpty();
      setImportMessage('Успешно загружен тестовый Beta-плейлист (1,600+ треков)!');
      onProfilesChanged();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setImportMessage(`Не удалось загрузить Beta-плейлист: ${errorMsg}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl bg-[#0D0E15] border border-[#2B2F42] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#2B2F42] bg-[#161822]/60">
          <div>
            <h2 className="text-lg font-bold text-[#F3F4F6] flex items-center space-x-2">
              <Music2 className="w-5 h-5 text-[#00E5FF]" />
              <span>Music Profiles & Spotify Binding</span>
            </h2>
            <p className="text-xs text-[#B2B9C8] mt-0.5">
              100% Client-side library stored locally in your browser (IndexedDB).
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8E95A5] hover:text-[#F3F4F6] hover:bg-[#212433] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-6">
          {/* Profiles Section */}
          <div>
            <h3 className="text-xs font-bold text-[#8E95A5] uppercase tracking-wider mb-2.5">
              Local Profiles
            </h3>
            <div className="space-y-2">
              {profiles.map((prof) => {
                const isSelected = prof.id === currentProfile?.id;
                return (
                  <div
                    key={prof.id}
                    onClick={() => handleSwitchProfile(prof.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#1D2130] border-[#00E5FF] shadow-sm'
                        : 'bg-[#161822] hover:bg-[#1A1D2A] border-[#2B2F42]'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-[#0D0E15] border border-[#2B2F42] flex items-center justify-center text-lg">
                        {prof.avatarEmoji || '🎧'}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-[#F3F4F6]">{prof.name}</h4>
                        <p className="text-xs text-[#8E95A5]">
                          {isSelected ? (
                            <span className="text-[#00E5FF] font-medium">Active Profile</span>
                          ) : (
                            'Click to switch'
                          )}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-[#00E5FF] flex items-center justify-center text-[#0D0E15]">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Create Profile */}
            <div className="flex items-center space-x-2 mt-3">
              <input
                type="text"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateProfile()}
                placeholder="New profile name..."
                className="flex-1 px-3.5 py-2 bg-[#161822] border border-[#2B2F42] focus:border-[#00E5FF] rounded-xl text-xs text-[#F3F4F6] placeholder-[#8E95A5] outline-none"
              />
              <button
                onClick={handleCreateProfile}
                className="px-3.5 py-2 bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-[#0D0E15] font-bold text-xs rounded-xl flex items-center space-x-1 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Spotify JSON Binding */}
          <div className="p-4 rounded-xl bg-[#161822] border border-[#2B2F42] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#F3F4F6] flex items-center space-x-2">
                <Upload className="w-4 h-4 text-[#00E5FF]" />
                <span>Bind Spotify Export JSON</span>
              </h3>
              <span className="text-[10px] text-[#00E5FF] font-mono px-2 py-0.5 rounded bg-[#00E5FF]/10">
                Offline Parsing
              </span>
            </div>
            <p className="text-xs text-[#B2B9C8] leading-relaxed">
              Импортируйте <code className="text-[#00E5FF]">YourLibrary.json</code> и файлы{' '}
              <code className="text-[#00E5FF]">Playlist1.json, Playlist2.json...</code> прямо в этот профиль.
            </p>

            <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-[#2B2F42] hover:border-[#00E5FF] rounded-xl bg-[#0D0E15]/50 hover:bg-[#0D0E15] cursor-pointer transition-all group">
              <Upload className="w-7 h-7 text-[#8E95A5] group-hover:text-[#00E5FF] mb-2 transition-colors" />
              <span className="text-xs font-semibold text-[#F3F4F6] group-hover:text-[#00E5FF]">
                Нажмите или перетащите файлы Spotify JSON сюда
              </span>
              <span className="text-[11px] text-[#8E95A5] mt-0.5">
                Поддерживаются YourLibrary.json и множественные Playlist*.json
              </span>
              <input
                type="file"
                multiple
                accept=".json,application/json"
                onChange={handleFileUpload}
                disabled={isImporting}
                className="hidden"
              />
            </label>

            {importMessage && (
              <div className="p-2.5 rounded-lg bg-[#212433] text-xs font-medium text-[#00E5FF]">
                {importMessage}
              </div>
            )}
          </div>

          {/* Quick Actions / Reset defaults */}
          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="text-[#8E95A5]">Нужен тестовый образец?</span>
            <button
              onClick={handleReloadDefaults}
              disabled={isImporting}
              className="text-[#00E5FF] hover:underline font-semibold flex items-center space-x-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Загрузить тестовый Beta-плейлист</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#2B2F42] bg-[#161822]/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-[#0D0E15] font-bold text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
});
