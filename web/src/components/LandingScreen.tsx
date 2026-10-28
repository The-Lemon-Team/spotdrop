import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import {
  Sparkles,
  UploadCloud,
  FileJson,
  PlayCircle,
  ExternalLink,
  ShieldCheck,
  Zap,
  Share2,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Music,
  Plus,
  Trash2,
  ListMusic,
  Heart,
  User,
} from 'lucide-react';
import { createAndUploadProfile } from '../importer/spotifyImporter';

interface LandingScreenProps {
  onOpenProfile: (profileId: string) => void;
}

const PRESET_EMOJIS = ['⚡', '🎧', '🎵', '🚀', '🔥', '💎', '🎸', '🌌', '🌴', '💿'];

export const LandingScreen: React.FC<LandingScreenProps> = ({ onOpenProfile }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [libraryFile, setLibraryFile] = useState<File | null>(null);
  const [playlistFiles, setPlaylistFiles] = useState<File[]>([]);
  const [profileName, setProfileName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('⚡');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addPlaylistInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFileList = (files: FileList | File[]) => {
    setErrorMessage(null);
    let newLibFile = libraryFile;
    const newPlaylists: File[] = [...playlistFiles];
    let detectedAny = false;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const name = file.name.toLowerCase();

      if (name.includes('yourlibrary') || name.includes('library')) {
        newLibFile = file;
        detectedAny = true;
      } else if (name.includes('playlist')) {
        // Prevent duplicate files with same name and size
        if (!newPlaylists.some((f) => f.name === file.name && f.size === file.size)) {
          newPlaylists.push(file);
        }
        detectedAny = true;
      } else if (name.endsWith('.json')) {
        // Ambiguous JSON: if library not set, set as library, else add to playlists
        if (!newLibFile) {
          newLibFile = file;
        } else if (!newPlaylists.some((f) => f.name === file.name && f.size === file.size)) {
          newPlaylists.push(file);
        }
        detectedAny = true;
      }
    }

    if (!detectedAny && files.length > 0) {
      setErrorMessage(
        'Пожалуйста, выберите файлы YourLibrary.json или файлы Playlist (Playlist1.json, Playlist2.json...) из архива Spotify.'
      );
      return;
    }

    setLibraryFile(newLibFile);
    setPlaylistFiles(newPlaylists);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFileList(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFileList(e.target.files);
    }
  };

  const handleAddMorePlaylists = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const added: File[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const f = e.target.files[i];
        if (!playlistFiles.some((item) => item.name === f.name && item.size === f.size)) {
          added.push(f);
        }
      }
      setPlaylistFiles((prev) => [...prev, ...added]);
    }
  };

  const removePlaylistFile = (index: number) => {
    setPlaylistFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const removeLibraryFile = () => {
    setLibraryFile(null);
  };

  const handleStartImport = async () => {
    if (!libraryFile && playlistFiles.length === 0) {
      setErrorMessage('Выберите хотя бы один файл: YourLibrary.json или один из файлов Playlist.json');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setProcessingStatus('Чтение файлов экспорта...');

    try {
      // 1. Read library file
      let libText: string | null = null;
      if (libraryFile) {
        setProcessingStatus(`Чтение библиотеки треков (${libraryFile.name})...`);
        libText = await libraryFile.text();
      }

      // 2. Read all playlist files
      const playlistPayloads: Array<{ name: string; content: string }> = [];
      for (let i = 0; i < playlistFiles.length; i++) {
        const pf = playlistFiles[i];
        setProcessingStatus(`Чтение плейлиста ${i + 1} из ${playlistFiles.length} (${pf.name})...`);
        const text = await pf.text();
        playlistPayloads.push({
          name: pf.name,
          content: text,
        });
      }

      // 3. Create profile & upload
      setProcessingStatus('Создание вашего профиля и загрузка данных...');
      const fallbackName =
        profileName.trim() ||
        (libraryFile?.name.replace(/\.[^/.]+$/, '') || 'Моя коллекция Spotify');

      const result = await createAndUploadProfile(
        fallbackName,
        selectedEmoji,
        libText,
        playlistPayloads.length > 0 ? playlistPayloads : null
      );

      setProcessingStatus('Готово! Запуск плеера...');
      onOpenProfile(result.profileId);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Ошибка при обработке файлов Spotify export'
      );
      setIsProcessing(false);
      setProcessingStatus(null);
    }
  };

  const totalFilesCount = (libraryFile ? 1 : 0) + playlistFiles.length;

  return (
    <div className="min-h-screen bg-[#0D0E15] text-[#F3F4F6] flex flex-col justify-between selection:bg-[#00E5FF]/20 selection:text-[#00E5FF]">
      {/* Top Bar */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-[#2B2F42]/40 bg-[#161822]/60 backdrop-blur sticky top-0 z-20">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00E5FF]/20 to-[#161822] border border-[#00E5FF]/40 flex items-center justify-center shadow-lg shadow-[#00E5FF]/10">
            <Music className="w-5 h-5 text-[#00E5FF]" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-widest text-[#00E5FF] leading-tight">
              SPOTDROP
            </h1>
            <p className="text-[11px] text-[#B2B9C8]">Spotify Export ➔ Living Streaming Player</p>
          </div>
        </div>

        {/* Beta Version Button (replacing old Bandita player demo) */}
        <button
          onClick={() => onOpenProfile('beta')}
          className="group flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#161822] hover:bg-[#212433] border border-[#00E5FF]/30 hover:border-[#00E5FF] transition-all text-xs text-[#00E5FF] font-semibold cursor-pointer shadow-sm hover:shadow-[#00E5FF]/20"
          title="Открыть тестовый Beta-плейлист"
        >
          <Zap className="w-3.5 h-3.5 text-[#00E5FF] fill-[#00E5FF]/20" />
          <span>Тестовая Beta-версия</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40">
            BETA
          </span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </header>

      {/* Hero Content */}
      <main className="max-w-5xl mx-auto px-4 py-8 sm:py-12 w-full flex-1">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#00E5FF]/10 border border-[#00E5FF]/30 text-[#00E5FF] text-xs font-medium mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ноль подписок • Поддержка множественных плейлистов • 100% Client-Side</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight text-white mb-4">
            Ваша музыка не умерла вместе с подпиской Spotify
          </h2>
          <p className="text-sm sm:text-base text-[#B2B9C8] leading-relaxed">
            Превратите архив персональных данных Spotify (JSON) в персональный потоковый плеер.
            Загрузите файлы библиотеки и плейлистов — плеер мгновенно свяжет треки со стримами YouTube!
          </p>
        </div>

        {/* Dropzone & Import Section */}
        <div className="bg-[#161822]/90 border border-[#2B2F42] rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden mb-12">
          {/* Hidden inputs */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".json,.zip"
            className="hidden"
            onChange={handleFileInputChange}
          />
          <input
            ref={addPlaylistInputRef}
            type="file"
            multiple
            accept=".json"
            className="hidden"
            onChange={handleAddMorePlaylists}
          />

          {/* Drag & Drop Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 sm:p-10 text-center transition-all cursor-pointer ${
              isDragging
                ? 'border-[#00E5FF] bg-[#00E5FF]/10 scale-[0.99]'
                : 'border-[#2B2F42] hover:border-[#00E5FF]/50 hover:bg-[#212433]/50'
            }`}
          >
            <div className="w-16 h-16 rounded-2xl bg-[#0D0E15] border border-[#2B2F42] flex items-center justify-center mx-auto mb-4 text-[#00E5FF]">
              <UploadCloud className="w-8 h-8 animate-bounce" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              Перетащите сюда файлы экспорта Spotify
            </h3>
            <p className="text-xs sm:text-sm text-[#B2B9C8] max-w-md mx-auto mb-4">
              Поддерживаются <code className="text-[#00E5FF]">YourLibrary.json</code> и множественные файлы плейлистов (<code className="text-[#00E5FF]">Playlist1.json</code>, <code className="text-[#00E5FF]">Playlist2.json</code>...).
            </p>

            <span className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-[#00E5FF] text-[#0D0E15] text-xs font-bold shadow-lg shadow-[#00E5FF]/20">
              <Plus className="w-4 h-4" />
              <span>Выбрать файлы с устройства</span>
            </span>
          </div>

          {/* Selected Files & Profile Setup Area */}
          {totalFilesCount > 0 && (
            <div className="mt-8 pt-8 border-t border-[#2B2F42]/60 space-y-6">
              {/* Files Overview */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#B2B9C8] flex items-center space-x-2">
                    <FileJson className="w-4 h-4 text-[#00E5FF]" />
                    <span>Выбранные файлы экспорта ({totalFilesCount})</span>
                  </h4>

                  <button
                    onClick={() => addPlaylistInputRef.current?.click()}
                    className="flex items-center space-x-1 text-xs text-[#00E5FF] hover:underline cursor-pointer font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Добавить еще плейлист</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Library File Card */}
                  <div className="bg-[#0D0E15] p-3.5 rounded-xl border border-[#2B2F42] flex items-center justify-between">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        libraryFile ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-[#161822] text-[#8E95A5]'
                      }`}>
                        <Heart className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 text-left">
                        <p className="text-xs font-bold text-white truncate">
                          {libraryFile ? libraryFile.name : 'YourLibrary.json'}
                        </p>
                        <p className="text-[11px] text-[#8E95A5]">
                          {libraryFile
                            ? `${(libraryFile.size / 1024).toFixed(1)} KB • Любимые треки`
                            : 'Не выбран (опционально)'}
                        </p>
                      </div>
                    </div>

                    {libraryFile ? (
                      <button
                        onClick={removeLibraryFile}
                        className="p-1.5 rounded-lg text-[#8E95A5] hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Удалить файл библиотеки"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-[10px] text-[#5C6479] italic px-2">пропущено</span>
                    )}
                  </div>

                  {/* Playlists Count Summary */}
                  <div className="bg-[#0D0E15] p-3.5 rounded-xl border border-[#2B2F42] flex items-center justify-between">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        playlistFiles.length > 0 ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' : 'bg-[#161822] text-[#8E95A5]'
                      }`}>
                        <ListMusic className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 text-left">
                        <p className="text-xs font-bold text-white truncate">
                          Плейлисты Spotify
                        </p>
                        <p className="text-[11px] text-[#8E95A5]">
                          {playlistFiles.length > 0
                            ? `${playlistFiles.length} файл(ов) готово к импорту`
                            : 'Файлы плейлистов не выбраны'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => addPlaylistInputRef.current?.click()}
                      className="px-2.5 py-1 rounded-lg bg-[#161822] hover:bg-[#212433] border border-[#2B2F42] text-[11px] text-[#00E5FF] font-semibold cursor-pointer"
                    >
                      + Добавить
                    </button>
                  </div>
                </div>

                {/* List of individual playlist files if multiple */}
                {playlistFiles.length > 0 && (
                  <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {playlistFiles.map((pf, index) => (
                      <div
                        key={`${pf.name}_${index}`}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0D0E15]/60 border border-[#2B2F42]/60 text-xs"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="text-white font-medium truncate">{pf.name}</span>
                          <span className="text-[#8E95A5] text-[10px]">
                            ({(pf.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          onClick={() => removePlaylistFile(index)}
                          className="p-1 rounded text-[#8E95A5] hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Удалить этот файл"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Profile Setup Section */}
              <div className="bg-[#0D0E15] p-5 rounded-xl border border-[#2B2F42] space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#B2B9C8] flex items-center space-x-2">
                  <User className="w-4 h-4 text-[#00E5FF]" />
                  <span>Создание вашего профиля</span>
                </h4>

                <div className="space-y-3">
                  {/* Avatar Picker */}
                  <div>
                    <label className="text-[11px] text-[#8E95A5] font-semibold block mb-1.5">
                      Выберите аватар профиля:
                    </label>
                    <div className="flex items-center flex-wrap gap-2">
                      {PRESET_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setSelectedEmoji(emoji)}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg border transition-all cursor-pointer ${
                            selectedEmoji === emoji
                              ? 'bg-[#00E5FF]/20 border-[#00E5FF] shadow-sm scale-105'
                              : 'bg-[#161822] border-[#2B2F42] hover:bg-[#212433]'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Profile Name & Start CTA */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                    <input
                      type="text"
                      placeholder="Название вашей коллекции (например: Мой плейлист, Night Vibes)"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full sm:flex-1 bg-[#161822] border border-[#2B2F42] focus:border-[#00E5FF] rounded-xl px-4 py-3 text-sm text-white placeholder-[#5C6479] outline-none"
                    />

                    <button
                      disabled={isProcessing}
                      onClick={handleStartImport}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-[#0D0E15] font-bold text-sm flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg shadow-[#00E5FF]/20 shrink-0 disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <span>{processingStatus || 'Создание профиля...'}</span>
                      ) : (
                        <>
                          <span>Создать профиль и запустить SpotDrop</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Try Beta Callout Banner */}
        <div className="bg-gradient-to-r from-[#00E5FF]/10 via-[#161822] to-[#00E5FF]/5 border border-[#00E5FF]/30 rounded-2xl p-5 mb-12 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5 text-left">
            <div className="w-12 h-12 rounded-xl bg-[#00E5FF]/20 border border-[#00E5FF]/40 flex items-center justify-center shrink-0">
              <Zap className="w-6 h-6 text-[#00E5FF]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-sm font-bold text-white">Хотите послушать музыку прямо сейчас?</h4>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-[#00E5FF] text-[#0D0E15]">
                  BETA
                </span>
              </div>
              <p className="text-xs text-[#B2B9C8] mt-0.5">
                Запустите тестовый Beta-плейлист SpotDrop с 1,600+ треками и 30 готовыми плейлистами без загрузки файлов.
              </p>
            </div>
          </div>

          <button
            onClick={() => onOpenProfile('beta')}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#161822] hover:bg-[#212433] border border-[#00E5FF]/50 text-[#00E5FF] hover:border-[#00E5FF] font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer shrink-0 shadow-sm"
          >
            <span>Запустить Beta-плейлист</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 4-Step Guide */}
        <div className="mb-12">
          <h3 className="text-xl font-bold text-white text-center mb-6">
            Как получить экспорт Spotify за 4 шага
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#161822]/60 border border-[#2B2F42]/60 rounded-xl p-4 text-left">
              <span className="w-6 h-6 rounded-full bg-[#00E5FF]/10 text-[#00E5FF] text-xs font-black flex items-center justify-center mb-3">
                1
              </span>
              <h4 className="font-semibold text-sm text-white mb-1">Настройки Spotify</h4>
              <p className="text-xs text-[#B2B9C8]">
                Откройте страницу{' '}
                <a
                  href="https://www.spotify.com/account/privacy/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#00E5FF] inline-flex items-center space-x-0.5 hover:underline"
                >
                  <span>Конфиденциальность</span>
                  <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                </a>
              </p>
            </div>

            <div className="bg-[#161822]/60 border border-[#2B2F42]/60 rounded-xl p-4 text-left">
              <span className="w-6 h-6 rounded-full bg-[#00E5FF]/10 text-[#00E5FF] text-xs font-black flex items-center justify-center mb-3">
                2
              </span>
              <h4 className="font-semibold text-sm text-white mb-1">Запрос данных</h4>
              <p className="text-xs text-[#B2B9C8]">
                В разделе «Загрузка данных» запросите архив персональных данных учетной записи (GDPR).
              </p>
            </div>

            <div className="bg-[#161822]/60 border border-[#2B2F42]/60 rounded-xl p-4 text-left">
              <span className="w-6 h-6 rounded-full bg-[#00E5FF]/10 text-[#00E5FF] text-xs font-black flex items-center justify-center mb-3">
                3
              </span>
              <h4 className="font-semibold text-sm text-white mb-1">Скачивание архива</h4>
              <p className="text-xs text-[#B2B9C8]">
                Spotify пришлет ссылку на `.zip`. Внутри будут `YourLibrary.json` и файлы плейлистов `Playlist*.json`.
              </p>
            </div>

            <div className="bg-[#161822]/60 border border-[#2B2F42]/60 rounded-xl p-4 text-left">
              <span className="w-6 h-6 rounded-full bg-[#00E5FF]/10 text-[#00E5FF] text-xs font-black flex items-center justify-center mb-3">
                4
              </span>
              <h4 className="font-semibold text-sm text-white mb-1">Слушайте & Делитесь</h4>
              <p className="text-xs text-[#B2B9C8]">
                Перетащите все файлы сюда, создайте профиль и слушайте свои треки по уникальному URL где угодно.
              </p>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
          <div className="flex items-start space-x-3.5 p-4 rounded-xl bg-[#161822]/40 border border-[#2B2F42]/40">
            <Share2 className="w-5 h-5 text-[#00E5FF] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-white mb-1">Множественные плейлисты</h4>
              <p className="text-xs text-[#B2B9C8]">
                Загружайте сколько угодно файлов плейлистов. SpotDrop автоматически объединит все треки и теги.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3.5 p-4 rounded-xl bg-[#161822]/40 border border-[#2B2F42]/40">
            <PlayCircle className="w-5 h-5 text-[#00E5FF] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-white mb-1">Мгновенный стриминг</h4>
              <p className="text-xs text-[#B2B9C8]">
                Автономный поиск аудиопотоков YouTube без ожидания и без сторонних API-ключей.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3.5 p-4 rounded-xl bg-[#161822]/40 border border-[#2B2F42]/40">
            <ShieldCheck className="w-5 h-5 text-[#00E5FF] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-white mb-1">100% Приватность</h4>
              <p className="text-xs text-[#B2B9C8]">
                База данных хранится в вашем браузере (IndexedDB). Никаких аккаунтов и трекинга.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-6 border-t border-[#2B2F42]/40 text-center text-xs text-[#5C6479]">
        <p>
          SpotDrop • Production Ready • Open-source проект от The Lemon Team • Совместим со Spotify GDPR Export
        </p>
      </footer>
    </div>
  );
};
