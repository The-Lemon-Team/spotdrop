import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Copy, Check, Smartphone, Globe, Link2 } from 'lucide-react';
import { getNetworkInfo, type NetworkInfo } from '../auth/authManager';

interface TailscaleInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TailscaleInfoModal: React.FC<TailscaleInfoModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [copiedPublic, setCopiedPublic] = useState(false);
  const [copiedVpn, setCopiedVpn] = useState(false);
  const [copiedCurrent, setCopiedCurrent] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getNetworkInfo().then(setNetworkInfo);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const currentPort = typeof window !== 'undefined' ? window.location.port || '3001' : '3001';
  const tsIp = networkInfo?.tailscaleIp || (currentHost.startsWith('100.') ? currentHost : '100.82.53.11');

  const funnelHost = networkInfo?.funnelHost || 'alovingpc.tail0f092f.ts.net';
  const publicUrl = `https://${funnelHost}`;
  const vpnUrl = `http://${tsIp}:${networkInfo?.port || currentPort}`;
  const currentUrl = typeof window !== 'undefined' ? window.location.href : publicUrl;

  const copyToClipboard = async (text: string, setSuccess: (val: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.warn('Copy failed', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#161822] border border-[#2B2F42] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-4 p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00E5FF]/10 border border-[#00E5FF]/20 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-[#00E5FF]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#F3F4F6]">Подключение & Доступ</h3>
              <p className="text-[11px] text-[#8E95A5]">Доступ по уникальным URL (без токенов)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#8E95A5] hover:text-[#F3F4F6] rounded-lg hover:bg-[#212433] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active Library Link */}
        <div className="p-3.5 bg-gradient-to-r from-[#00E5FF]/15 to-transparent border border-[#00E5FF]/40 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#00E5FF] flex items-center space-x-1.5">
              <Link2 className="w-4 h-4 text-[#00E5FF]" />
              <span>Ссылка на текущую библиотеку</span>
            </label>
            <span className="text-[10px] bg-[#00E5FF]/20 text-[#00E5FF] font-semibold px-2 py-0.5 rounded-full border border-[#00E5FF]/30">
              Поделиться
            </span>
          </div>

          <p className="text-[11px] text-[#B2B9C8]">
            Отправьте эту ссылку друзьям, чтобы они открыли именно этот плейлист:
          </p>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              readOnly
              value={currentUrl}
              className="flex-1 px-3 py-2 bg-[#0D0E15] border border-[#2B2F42] rounded-xl text-xs font-mono text-[#00E5FF] outline-none select-all"
            />
            <button
              onClick={() => copyToClipboard(currentUrl, setCopiedCurrent)}
              className="px-3 py-2 bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-[#0D0E15] font-bold text-xs rounded-xl flex items-center space-x-1 transition-all active:scale-95 cursor-pointer shrink-0"
              title="Скопировать ссылку на библиотеку"
            >
              {copiedCurrent ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Скопировано</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Копировать</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 1. Public HTTPS URL (Funnel) */}
        <div className="p-3.5 bg-[#0D0E15] border border-[#2B2F42] rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[#F3F4F6] flex items-center space-x-1.5">
              <Globe className="w-4 h-4 text-[#00E5FF]" />
              <span>Публичный HTTPS URL (Tailscale Funnel)</span>
            </label>
            <span className="text-[10px] bg-emerald-400/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full">
              Интернет
            </span>
          </div>

          <p className="text-[11px] text-[#B2B9C8]">
            Главная страница SpotDrop для загрузки новых архивов экспорта:
          </p>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              readOnly
              value={publicUrl}
              className="flex-1 px-3 py-2 bg-[#161822] border border-[#2B2F42] rounded-xl text-xs font-mono text-[#F3F4F6] outline-none select-all"
            />
            <button
              onClick={() => copyToClipboard(publicUrl, setCopiedPublic)}
              className="px-3 py-2 bg-[#212433] hover:bg-[#2B2F42] text-[#F3F4F6] font-semibold text-xs rounded-xl flex items-center space-x-1 transition-all active:scale-95 cursor-pointer shrink-0"
              title="Скопировать публичный URL"
            >
              {copiedPublic ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5] text-emerald-400" />
                  <span>Скопировано</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Копировать</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 2. Direct Tailscale VPN URL */}
        <div className="p-3.5 bg-[#0D0E15] border border-[#2B2F42] rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[#F3F4F6] flex items-center space-x-1.5">
              <Smartphone className="w-4 h-4 text-[#B2B9C8]" />
              <span>Прямой Tailscale IP (VPN)</span>
            </label>
            <span className="text-[10px] bg-[#212433] text-[#8E95A5] font-semibold px-2 py-0.5 rounded-full">
              Локальная сеть
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              readOnly
              value={vpnUrl}
              className="flex-1 px-3 py-2 bg-[#161822] border border-[#2B2F42] rounded-xl text-xs font-mono text-[#B2B9C8] outline-none select-all"
            />
            <button
              onClick={() => copyToClipboard(vpnUrl, setCopiedVpn)}
              className="px-3 py-2 bg-[#212433] hover:bg-[#2B2F42] text-[#F3F4F6] font-semibold text-xs rounded-xl flex items-center space-x-1 transition-all active:scale-95 cursor-pointer shrink-0"
              title="Скопировать VPN ссылку"
            >
              {copiedVpn ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5] text-emerald-400" />
                  <span>Скопировано</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Копировать</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex items-center justify-end border-t border-[#2B2F42]/60">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-xs font-bold text-[#0D0E15] rounded-xl transition-colors cursor-pointer"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
};
