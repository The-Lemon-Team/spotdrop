import React, { memo, useState } from 'react';
import { User, Music, Share2, Check, Sparkles, Network } from 'lucide-react';
import type { MusicProfile } from '../types';

interface HeaderProps {
  currentProfile: MusicProfile | null;
  trackCount: number;
  onOpenProfileModal: () => void;
  onOpenTailscaleModal: () => void;
  onOpenLanding: () => void;
}

export const Header: React.FC<HeaderProps> = memo(function Header({
  currentProfile,
  trackCount,
  onOpenProfileModal,
  onOpenTailscaleModal,
  onOpenLanding,
}) {
  const [copied, setCopied] = useState(false);

  const handleShareClick = async () => {
    try {
      const shareUrl = window.location.href;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-3.5 border-b border-[#2B2F42]/40 bg-[#0D0E15]/80 backdrop-blur sticky top-0 z-30">
      {/* Brand & Active Profile */}
      <div className="flex items-center space-x-3 min-w-0">
        <button
          onClick={onOpenLanding}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#161822] hover:bg-[#212433] border border-[#00E5FF]/30 flex items-center justify-center shrink-0 shadow-lg shadow-[#00E5FF]/5 transition-all cursor-pointer"
          title="SpotDrop Главная / Импорт"
        >
          <Music className="w-5 h-5 text-[#00E5FF]" />
        </button>
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <h1
              onClick={onOpenLanding}
              className="text-lg sm:text-xl font-black tracking-widest text-[#00E5FF] leading-tight select-none truncate cursor-pointer hover:opacity-90"
            >
              SPOTDROP
            </h1>
            {currentProfile?.isMaster && (
              <span className="hidden xs:inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/30">
                MASTER
              </span>
            )}
          </div>
          <p className="text-[11px] sm:text-xs text-[#B2B9C8] font-medium flex items-center space-x-1.5 truncate">
            <span className="truncate">{currentProfile?.name || 'Spotify Library'}</span>
            <span>•</span>
            <span className="text-[#00E5FF] shrink-0">{trackCount.toLocaleString()} tracks</span>
          </p>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex items-center space-x-1.5 sm:space-x-2.5 shrink-0">
        {/* Share Profile Link Button */}
        <button
          onClick={handleShareClick}
          className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-[#161822] hover:bg-[#212433] border border-[#2B2F42] hover:border-[#00E5FF]/50 transition-all text-xs font-medium text-[#F3F4F6] cursor-pointer"
          title="Скопировать ссылку на эту библиотеку"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-300 text-[11px] font-semibold">Скопировано!</span>
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span className="hidden sm:inline text-xs text-[#B2B9C8]">Поделиться</span>
            </>
          )}
        </button>

        {/* New Import / Dropzone Button */}
        <button
          onClick={onOpenLanding}
          className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-[#161822] hover:bg-[#212433] border border-[#2B2F42] hover:border-[#00E5FF]/50 transition-all text-xs font-semibold text-[#00E5FF] cursor-pointer"
          title="Загрузить новый Spotify Export"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Новый импорт</span>
        </button>

        {/* Network & Tailscale Pill Button */}
        <button
          onClick={onOpenTailscaleModal}
          className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-[#161822] hover:bg-[#212433] border border-[#2B2F42] hover:border-[#00E5FF]/50 transition-all text-xs text-[#B2B9C8] cursor-pointer"
          title="Сеть & Tailscale Funnel"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <Network className="w-3.5 h-3.5 text-emerald-400 hidden xs:block" />
          <span className="text-emerald-300 font-semibold text-[11px] hidden sm:inline">Online</span>
        </button>

        {/* Profile Switcher Button */}
        <button
          onClick={onOpenProfileModal}
          className="flex items-center space-x-1.5 sm:space-x-2 px-3 py-1.5 sm:py-2 rounded-full bg-[#161822] hover:bg-[#212433] border border-[#2B2F42] hover:border-[#00E5FF]/50 transition-all text-sm font-medium text-[#F3F4F6] group cursor-pointer"
          title="Профили"
        >
          <span className="text-sm sm:text-base">{currentProfile?.avatarEmoji || '🎧'}</span>
          <span className="hidden lg:inline font-semibold text-xs tracking-wider uppercase text-[#B2B9C8] group-hover:text-[#00E5FF]">
            Profiles
          </span>
          <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#00E5FF]" />
        </button>
      </div>
    </header>
  );
});
