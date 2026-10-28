import React, { useState, useEffect } from 'react';
import { X, Key, Check, Copy, ExternalLink, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';
import { YouTubeIcon } from './YouTubeIcon';

interface YouTubeApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlistTitle: string;
  videoIds: string[];
  onToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

const STORAGE_KEY = 'spotdrop_youtube_api_key';

export const YouTubeApiModal: React.FC<YouTubeApiModalProps> = ({
  isOpen,
  onClose,
  playlistTitle,
  videoIds,
  onToast,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedIds, setCopiedIds] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem(STORAGE_KEY) || '';
      setApiKey(saved);
      setIsSaved(Boolean(saved));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = apiKey.trim();
    if (clean) {
      localStorage.setItem(STORAGE_KEY, clean);
      setIsSaved(true);
      onToast('YouTube API Key сохранен локально!', 'success');
    } else {
      localStorage.removeItem(STORAGE_KEY);
      setIsSaved(false);
      onToast('YouTube API Key очищен', 'info');
    }
  };

  const payloadPreview = {
    snippet: {
      title: `${playlistTitle} (SpotDrop)`,
      description: `Сгенерировано через SpotDrop • ${videoIds.length} видео`,
      defaultLanguage: 'ru',
    },
    status: {
      privacyStatus: 'private', // 'private' | 'public' | 'unlisted'
    },
    itemCount: videoIds.length,
    videoIds: videoIds.slice(0, 10),
    hasMoreVideos: videoIds.length > 10 ? `+ еще ${videoIds.length - 10} видео` : undefined,
  };

  const handleCopyPayload = async () => {
    try {
      const fullPayload = {
        ...payloadPreview,
        videoIds,
        hasMoreVideos: undefined,
      };
      await navigator.clipboard.writeText(JSON.stringify(fullPayload, null, 2));
      setCopiedPayload(true);
      onToast('JSON для Google YouTube API скопирован!', 'success');
      setTimeout(() => setCopiedPayload(false), 2000);
    } catch {
      onToast('Не удалось скопировать данные', 'error');
    }
  };

  const handleCopyIds = async () => {
    try {
      await navigator.clipboard.writeText(videoIds.join(','));
      setCopiedIds(true);
      onToast(`Скопировано ${videoIds.length} Video IDs!`, 'success');
      setTimeout(() => setCopiedIds(false), 2000);
    } catch {
      onToast('Не удалось скопировать ID', 'error');
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#161822] border border-[#2B2F42] rounded-3xl p-6 shadow-2xl space-y-5 text-white max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2B2F42]">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
              <YouTubeIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center space-x-2">
                <span>Google YouTube API</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
                  Этап 2 (Скоро)
                </span>
              </h3>
              <p className="text-xs text-[#8E95A5]">Создание плейлиста в аккаунте Google</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8E95A5] hover:text-white hover:bg-[#212433] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-red-950/20 via-[#1D2130] to-[#161822] border border-red-500/20 space-y-2.5">
          <div className="flex items-start space-x-3">
            <Sparkles className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs text-[#B2B9C8] space-y-1">
              <p className="font-semibold text-white">
                Локальный плейлист на нашей стороне уже полностью сформирован!
              </p>
              <p>
                Все известные треки и ссылки на видео ({videoIds.length} видео) уже собраны воедино.
                В следующем шаге мы подключим YouTube Data API v3, чтобы в один клик создавать этот плейлист
                прямо в вашем профиле Google / YouTube.
              </p>
            </div>
          </div>
        </div>

        {/* API Key Form */}
        <form onSubmit={handleSaveKey} className="space-y-3">
          <label className="block text-xs font-semibold text-[#B2B9C8]">
            YouTube Data API v3 Key (необязательно, можно сохранить заранее)
          </label>
          <div className="relative">
            <Key className="w-4 h-4 text-[#8E95A5] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="AIzaSy..."
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setIsSaved(false);
              }}
              className="w-full bg-[#0D0E15] border border-[#2B2F42] focus:border-red-500 rounded-xl pl-10 pr-24 py-2.5 text-xs text-white placeholder-[#8E95A5] outline-none font-mono transition-colors"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-md shadow-red-600/20"
            >
              {isSaved ? 'Сохранено' : 'Сохранить'}
            </button>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#8E95A5]">
            <span className="flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ключ хранится только в вашем браузере (LocalStorage)</span>
            </span>
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-400 hover:text-red-300 flex items-center space-x-0.5 underline"
            >
              <span>Получить в Google Cloud</span>
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </a>
          </div>
        </form>

        {/* Payload / Ready data preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#F3F4F6]">
              Готовые данные для YouTube API ({videoIds.length} видео):
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleCopyIds}
                className="text-[11px] font-semibold text-[#8E95A5] hover:text-white flex items-center space-x-1 cursor-pointer"
              >
                {copiedIds ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>ID видео</span>
              </button>
              <button
                type="button"
                onClick={handleCopyPayload}
                className="text-[11px] font-semibold text-[#8E95A5] hover:text-white flex items-center space-x-1 cursor-pointer"
              >
                {copiedPayload ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>JSON</span>
              </button>
            </div>
          </div>

          <pre className="p-3 rounded-xl bg-[#0D0E15] border border-[#2B2F42] text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-40 scrollbar-none">
            {JSON.stringify(payloadPreview, null, 2)}
          </pre>
        </div>

        {/* Footer actions */}
        <div className="pt-2 flex items-center justify-end space-x-2 border-t border-[#2B2F42]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#212433] hover:bg-[#2B2F42] text-[#F3F4F6] text-xs font-semibold cursor-pointer transition-colors"
          >
            Закрыть
          </button>
          <button
            type="button"
            onClick={handleCopyPayload}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/20 cursor-pointer transition-all active:scale-95"
          >
            Скопировать все данные
          </button>
        </div>
      </div>
    </div>
  );
};
