import React, { useState } from 'react';
import { X, Copy, Check, Download, FileText, List, Code } from 'lucide-react';
import type { TrackCell } from '../types';
import { YouTubeIcon } from './YouTubeIcon';

interface YouTubeExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlistTitle: string;
  tracks: TrackCell[];
  onToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

type ExportFormat = 'urls' | 'formatted' | 'm3u' | 'json';

export const YouTubeExportModal: React.FC<YouTubeExportModalProps> = ({
  isOpen,
  onClose,
  playlistTitle,
  tracks,
  onToast,
}) => {
  const [format, setFormat] = useState<ExportFormat>('urls');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const validTracks = tracks.filter((t) => Boolean(t.pinnedVideoId));

  const generateContent = (): string => {
    switch (format) {
      case 'urls':
        return validTracks
          .map((t) => `https://www.youtube.com/watch?v=${t.pinnedVideoId}`)
          .join('\n');

      case 'formatted':
        return validTracks
          .map(
            (t, i) =>
              `${i + 1}. ${t.pinnedTitle || `${t.artist} - ${t.title}`}\n   https://www.youtube.com/watch?v=${t.pinnedVideoId}`
          )
          .join('\n\n');

      case 'm3u':
        return (
          '#EXTM3U\n' +
          validTracks
            .map((t) => {
              const title = t.pinnedTitle || `${t.artist} - ${t.title}`;
              return `#EXTINF:-1,${title}\nhttps://www.youtube.com/watch?v=${t.pinnedVideoId}`;
            })
            .join('\n')
        );

      case 'json':
        return JSON.stringify(
          validTracks.map((t) => ({
            spotifyId: t.id,
            artist: t.artist,
            title: t.title,
            album: t.album,
            youtube: {
              videoId: t.pinnedVideoId,
              title: t.pinnedTitle,
              channel: t.pinnedChannel,
              duration: t.pinnedDuration,
              url: `https://www.youtube.com/watch?v=${t.pinnedVideoId}`,
              thumbnail:
                t.pinnedThumbnail ||
                `https://i.ytimg.com/vi/${t.pinnedVideoId}/hqdefault.jpg`,
            },
          })),
          null,
          2
        );
    }
  };

  const content = generateContent();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      onToast(`Скопировано (${validTracks.length} видео)!`, 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onToast('Не удалось скопировать', 'error');
    }
  };

  const handleDownload = () => {
    const cleanName = playlistTitle.replace(/[^a-z0-9а-яё]/gi, '_');
    const ext = format === 'm3u' ? 'm3u' : format === 'json' ? 'json' : 'txt';
    const filename = `${cleanName || 'youtube_playlist'}.${ext}`;

    const blob = new Blob([content], {
      type: format === 'json' ? 'application/json' : 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onToast(`Файл «${filename}» скачан!`, 'success');
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-[#161822] border border-[#2B2F42] rounded-3xl p-6 shadow-2xl space-y-4 text-white max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2B2F42] shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
              <YouTubeIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Экспорт YouTube Плейлиста
              </h3>
              <p className="text-xs text-[#8E95A5]">
                {validTracks.length} готовых видео с ссылками
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8E95A5] hover:text-white hover:bg-[#212433] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Selector */}
        <div className="flex items-center space-x-2 overflow-x-auto scrollbar-none pb-1 shrink-0">
          <button
            onClick={() => setFormat('urls')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              format === 'urls'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                : 'bg-[#212433] text-[#B2B9C8] hover:text-white border border-[#2B2F42]'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Только ссылки (URLs)</span>
          </button>

          <button
            onClick={() => setFormat('formatted')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              format === 'formatted'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                : 'bg-[#212433] text-[#B2B9C8] hover:text-white border border-[#2B2F42]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>С названиями</span>
          </button>

          <button
            onClick={() => setFormat('m3u')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              format === 'm3u'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                : 'bg-[#212433] text-[#B2B9C8] hover:text-white border border-[#2B2F42]'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>M3U файл</span>
          </button>

          <button
            onClick={() => setFormat('json')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              format === 'json'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                : 'bg-[#212433] text-[#B2B9C8] hover:text-white border border-[#2B2F42]'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>
        </div>

        {/* Text View */}
        <div className="flex-1 min-h-[220px] max-h-[360px] relative rounded-2xl overflow-hidden border border-[#2B2F42] bg-[#0D0E15]">
          <textarea
            readOnly
            value={content}
            className="w-full h-full p-3.5 font-mono text-xs text-[#B2B9C8] bg-transparent outline-none resize-none scrollbar-thin"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-[#2B2F42] shrink-0">
          <span className="text-xs text-[#8E95A5]">
            Всего {validTracks.length} видео
          </span>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownload}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#212433] hover:bg-[#2B2F42] text-white text-xs font-semibold cursor-pointer border border-[#2B2F42] transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Скачать</span>
            </button>

            <button
              onClick={handleCopy}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/20 cursor-pointer transition-all active:scale-95"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Скопировано!' : 'Копировать всё'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
