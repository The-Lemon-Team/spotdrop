import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import {
  Sparkles,
  UploadCloud,
  FileJson,
  PlayCircle,
  ExternalLink,
  ShieldCheck,
  Headphones,
  Share2,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Music,
} from 'lucide-react';
import { createAndUploadProfile } from '../importer/spotifyImporter';

interface LandingScreenProps {
  onOpenProfile: (profileId: string) => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ onOpenProfile }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [libraryFile, setLibraryFile] = useState<File | null>(null);
  const [playlistsFile, setPlaylistsFile] = useState<File | null>(null);
  const [profileName, setProfileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFileList = (files: FileList | File[]) => {
    setErrorMessage(null);
    let foundLib = false;
    let foundPl = false;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const name = file.name.toLowerCase();

      if (name.includes('yourlibrary') || name.includes('library')) {
        setLibraryFile(file);
        foundLib = true;
      } else if (name.includes('playlist')) {
        setPlaylistsFile(file);
        foundPl = true;
      } else if (name.endsWith('.json')) {
        // Fallback: guess by content or assign to library if not filled
        if (!libraryFile && !foundLib) {
          setLibraryFile(file);
          foundLib = true;
        } else if (!playlistsFile && !foundPl) {
          setPlaylistsFile(file);
          foundPl = true;
        }
      }
    }

    if (!foundLib && !foundPl && files.length > 0) {
      setErrorMessage('Пожалуйста, загрузите файлы YourLibrary.json или Playlist1.json из архива Spotify.');
    }
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

  const handleStartImport = async () => {
    if (!libraryFile && !playlistsFile) {
      setErrorMessage('Выберите хотя бы один файл: YourLibrary.json или Playlist1.json');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const libText = libraryFile ? await libraryFile.text() : null;
      const plText = playlistsFile ? await playlistsFile.text() : null;

      const fallbackName =
        profileName.trim() ||
        (libraryFile?.name.replace(/\.[^/.]+$/, '') || 'My Spotify Collection');

      const result = await createAndUploadProfile(fallbackName, '🎵', libText, plText);
      onOpenProfile(result.profileId);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Ошибка при обработке файлов Spotify export'
      );
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0E15] text-[#F3F4F6] flex flex-col justify-between selection:bg-[#00E5FF]/20 selection:text-[#00E5FF]">
      {/* Top Bar */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-[#2B2F42]/40 bg-[#161822]/60 backdrop-blur">
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

        <button
          onClick={() => onOpenProfile('bandita')}
          className="flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#161822] hover:bg-[#212433] border border-[#00E5FF]/30 hover:border-[#00E5FF] transition-all text-xs text-[#00E5FF] font-semibold cursor-pointer shadow-sm"
        >
          <Headphones className="w-3.5 h-3.5" />
          <span>Демо-библиотека (1,600+ треков)</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </header>

      {/* Hero Content */}
      <main className="max-w-5xl mx-auto px-4 py-8 sm:py-12 w-full flex-1">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#00E5FF]/10 border border-[#00E5FF]/30 text-[#00E5FF] text-xs font-medium mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ноль платных подписок • Ноль API-ключей • 100% Client-Side</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight text-white mb-4">
            Ваша музыка не умерла вместе с подпиской Spotify
          </h2>
          <p className="text-sm sm:text-base text-[#B2B9C8] leading-relaxed">
            Превратите архив персональных данных Spotify (JSON) в персональный потоковый плеер.
            Перетащите файлы экспорта — мы сопоставим каждый трек с аудиопотоками YouTube на лету!
          </p>
        </div>

        {/* Dropzone & Import Section */}
        <div className="bg-[#161822]/90 border border-[#2B2F42] rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden mb-12">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".json,.zip"
            className="hidden"
            onChange={handleFileInputChange}
          />

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-all cursor-pointer ${
              isDragging
                ? 'border-[#00E5FF] bg-[#00E5FF]/10 scale-[0.99]'
                : 'border-[#2B2F42] hover:border-[#00E5FF]/50 hover:bg-[#212433]/50'
            }`}
          >
            <div className="w-16 h-16 rounded-2xl bg-[#0D0E15] border border-[#2B2F42] flex items-center justify-center mx-auto mb-4 text-[#00E5FF]">
              <UploadCloud className="w-8 h-8 animate-bounce" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              Перетащите сюда YourLibrary.json или Playlist1.json
            </h3>
            <p className="text-xs sm:text-sm text-[#B2B9C8] max-w-md mx-auto mb-4">
              Либо нажмите, чтобы выбрать файлы экспорта с компьютера. Файлы обрабатываются локально.
            </p>

            <span className="inline-flex items-center px-4 py-2 rounded-lg bg-[#00E5FF] text-[#0D0E15] text-xs font-bold shadow-lg shadow-[#00E5FF]/20">
              Выбрать файлы
            </span>
          </div>

          {/* Files Selected Feedback */}
          {(libraryFile || playlistsFile) && (
            <div className="mt-6 pt-6 border-t border-[#2B2F42]/60">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#B2B9C8] mb-3">
                Выбранные файлы экспорта:
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div
                  className={`flex items-center space-x-3 p-3 rounded-lg border ${
                    libraryFile
                      ? 'border-emerald-500/40 bg-emerald-500/5'
                      : 'border-[#2B2F42] bg-[#0D0E15]'
                  }`}
                >
                  <FileJson
                    className={`w-5 h-5 ${libraryFile ? 'text-emerald-400' : 'text-[#B2B9C8]'}`}
                  />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-xs font-semibold truncate text-white">
                      {libraryFile ? libraryFile.name : 'YourLibrary.json'}
                    </p>
                    <p className="text-[11px] text-[#B2B9C8]">
                      {libraryFile ? `${(libraryFile.size / 1024).toFixed(1)} KB` : 'Не выбран (опционально)'}
                    </p>
                  </div>
                  {libraryFile && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                </div>

                <div
                  className={`flex items-center space-x-3 p-3 rounded-lg border ${
                    playlistsFile
                      ? 'border-emerald-500/40 bg-emerald-500/5'
                      : 'border-[#2B2F42] bg-[#0D0E15]'
                  }`}
                >
                  <FileJson
                    className={`w-5 h-5 ${playlistsFile ? 'text-emerald-400' : 'text-[#B2B9C8]'}`}
                  />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-xs font-semibold truncate text-white">
                      {playlistsFile ? playlistsFile.name : 'Playlist1.json'}
                    </p>
                    <p className="text-[11px] text-[#B2B9C8]">
                      {playlistsFile ? `${(playlistsFile.size / 1024).toFixed(1)} KB` : 'Не выбран (опционально)'}
                    </p>
                  </div>
                  {playlistsFile && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                </div>
              </div>

              {/* Profile Name & Submit */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="text"
                  placeholder="Название вашей коллекции (например: Моя музыка)"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full sm:flex-1 bg-[#0D0E15] border border-[#2B2F42] focus:border-[#00E5FF] rounded-xl px-4 py-3 text-sm text-white placeholder-[#5C6479] outline-none"
                />

                <button
                  disabled={isProcessing}
                  onClick={handleStartImport}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-[#0D0E15] font-bold text-sm flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg shadow-[#00E5FF]/20 shrink-0 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <span>Создание плеера...</span>
                  ) : (
                    <>
                      <span>Запустить мой SpotDrop</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
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
                Spotify пришлет ссылку на `.zip`. Внутри будут файлы `YourLibrary.json` и `Playlist1.json`.
              </p>
            </div>

            <div className="bg-[#161822]/60 border border-[#2B2F42]/60 rounded-xl p-4 text-left">
              <span className="w-6 h-6 rounded-full bg-[#00E5FF]/10 text-[#00E5FF] text-xs font-black flex items-center justify-center mb-3">
                4
              </span>
              <h4 className="font-semibold text-sm text-white mb-1">Слушайте & Делитесь</h4>
              <p className="text-xs text-[#B2B9C8]">
                Перетащите файлы сюда, получите постоянную ссылку `/p/:id` и слушайте свои треки где угодно.
              </p>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
          <div className="flex items-start space-x-3.5 p-4 rounded-xl bg-[#161822]/40 border border-[#2B2F42]/40">
            <Share2 className="w-5 h-5 text-[#00E5FF] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-white mb-1">Уникальный URL для каждого</h4>
              <p className="text-xs text-[#B2B9C8]">
                Каждый импортированный архив изолирован и получает свой URL. Поделитесь им с друзьями!
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3.5 p-4 rounded-xl bg-[#161822]/40 border border-[#2B2F42]/40">
            <PlayCircle className="w-5 h-5 text-[#00E5FF] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-white mb-1">Мгновенный стриминг</h4>
              <p className="text-xs text-[#B2B9C8]">
                Потоковое воспроизведение из YouTube без ожидания и без засорения памяти сервера.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3.5 p-4 rounded-xl bg-[#161822]/40 border border-[#2B2F42]/40">
            <ShieldCheck className="w-5 h-5 text-[#00E5FF] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-white mb-1">100% Приватность</h4>
              <p className="text-xs text-[#B2B9C8]">
                База данных хранится в вашем браузере (IndexedDB). Никаких сторонних аккаунтов и слежки.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-6 border-t border-[#2B2F42]/40 text-center text-xs text-[#5C6479]">
        <p>
          SpotDrop • Open-source проект от The Lemon Team • Совместим со Spotify GDPR Export
        </p>
      </footer>
    </div>
  );
};
