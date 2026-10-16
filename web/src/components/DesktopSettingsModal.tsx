import React, { useState, useEffect } from 'react';
import { X, HardDrive, Server, FolderOpen, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { isTauriEnvironment, apiFetch } from '../auth/authManager';

interface DesktopSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export const DesktopSettingsModal: React.FC<DesktopSettingsModalProps> = ({
  isOpen,
  onClose,
  onToast,
}) => {
  const [cacheDir, setCacheDir] = useState<string>('');
  const [gatewayUrl, setGatewayUrl] = useState<string>('http://127.0.0.1:3055');
  const [cachedCount, setCachedCount] = useState<number | null>(null);
  const [totalSizeMb, setTotalSizeMb] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch current config from embedded server
      const cfgRes = await apiFetch('/api/config');
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        setCacheDir(cfg.cache_dir || '');
        setGatewayUrl(cfg.gateway_url || 'http://127.0.0.1:3055');
      }

      // 2. Fetch offline cache stats
      const statRes = await apiFetch('/api/offline-status');
      if (statRes.ok) {
        const stat = await statRes.json();
        setCachedCount(stat.cachedCount || 0);
        setTotalSizeMb(Math.round(((stat.totalSizeBytes || 0) / (1024 * 1024)) * 10) / 10);
      }
    } catch (err) {
      console.warn('Failed to load desktop settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const handlePickFolder = async () => {
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const selected = await invoke<string | null>('pick_cache_folder');
        if (selected) {
          setCacheDir(selected);
          return;
        }
      } catch (err: any) {
        console.warn('invoke pick_cache_folder failed, trying plugin-dialog:', err);
      }

      try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const selected = await open({
          directory: true,
          multiple: false,
          title: 'Выберите папку с аудио-файлами (кэш)',
        });
        if (selected && typeof selected === 'string') {
          setCacheDir(selected);
          return;
        }
      } catch (dialogErr: any) {
        console.warn('plugin-dialog open failed:', dialogErr);
      }
    }

    const manual = window.prompt('Укажите абсолютный путь к папке кэша аудио:', cacheDir);
    if (manual) {
      setCacheDir(manual.trim());
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const cleanCache = cacheDir.trim();
      const cleanGateway = gatewayUrl.trim();

      // 1. Update via Rust IPC if available
      if (isTauriEnvironment()) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('update_app_config', {
            cacheDir: cleanCache,
            gatewayUrl: cleanGateway,
          });
        } catch (ipcErr) {
          console.warn('update_app_config IPC failed:', ipcErr);
        }
      }

      // 2. Update embedded Axum HTTP server state
      await apiFetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cache_dir: cleanCache,
          gateway_url: cleanGateway,
        }),
      });

      onToast?.('Настройки успешно применены!', 'success');
      await loadData();
      onClose();
    } catch (err: any) {
      onToast?.(`Не удалось сохранить: ${err?.message || err}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#12141D] border border-[#2B2F42] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2B2F42]/60 bg-[#161822]">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-[#00E5FF]/10 text-[#00E5FF]">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Десктоп Настройки & Кэш</h3>
              <p className="text-xs text-[#B2B9C8]">SpotDrop Tauri Desktop</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#B2B9C8] hover:text-white hover:bg-[#2B2F42]/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Audio Cache Stats Banner */}
          <div className="p-4 rounded-xl bg-[#0D0E15] border border-[#2B2F42] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#B2B9C8] uppercase tracking-wider">
                Локальный аудио-кэш
              </p>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-2xl font-black text-[#00E5FF]">
                  {cachedCount !== null ? cachedCount.toLocaleString() : '...'}
                </span>
                <span className="text-xs text-white">файлов</span>
                {totalSizeMb !== null && (
                  <span className="text-xs text-[#B2B9C8]">({totalSizeMb} МБ)</span>
                )}
              </div>
            </div>
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2 rounded-lg bg-[#161822] hover:bg-[#212433] text-[#B2B9C8] hover:text-[#00E5FF] transition-all cursor-pointer"
              title="Обновить статус кэша"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Cache Directory Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#B2B9C8] flex items-center justify-between">
              <span>Папка с аудио (кэш / defaults)</span>
              <span className="text-[10px] text-emerald-400 lowercase font-normal">
                {cachedCount && cachedCount > 0 ? 'активна' : 'пусто'}
              </span>
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={cacheDir}
                onChange={(e) => setCacheDir(e.target.value)}
                placeholder="C:\path\to\spotdrop\defaults\default\audio"
                className="flex-1 bg-[#0D0E15] border border-[#2B2F42] focus:border-[#00E5FF] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#5C6479] outline-none font-mono"
              />
              <button
                type="button"
                onClick={handlePickFolder}
                className="px-3.5 py-2.5 rounded-xl bg-[#161822] hover:bg-[#212433] border border-[#2B2F42] hover:border-[#00E5FF]/60 text-xs font-semibold text-white flex items-center space-x-1.5 shrink-0 transition-all cursor-pointer"
                title="Обзор папки"
              >
                <FolderOpen className="w-4 h-4 text-[#00E5FF]" />
                <span>Обзор</span>
              </button>
            </div>
            <p className="text-[11px] text-[#5C6479]">
              Файлы ищутся по схеме <code className="text-[#B2B9C8]">&lt;videoId&gt;.webm / .mp3</code>. Если трек есть на диске, он играет мгновенно без сети.
            </p>
          </div>

          {/* Media Gateway URL Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#B2B9C8] flex items-center space-x-1.5">
              <Server className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span>Media Gateway API (Docker / bandita-gateway)</span>
            </label>
            <input
              type="text"
              value={gatewayUrl}
              onChange={(e) => setGatewayUrl(e.target.value)}
              placeholder="http://127.0.0.1:3055"
              className="w-full bg-[#0D0E15] border border-[#2B2F42] focus:border-[#00E5FF] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#5C6479] outline-none font-mono"
            />
            <p className="text-[11px] text-[#5C6479]">
              Адрес шлюза для онлайн-поиска и стриминга треков, которых нет в локальном кэше.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-[#2B2F42]/60 bg-[#161822]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#B2B9C8] hover:text-white transition-colors cursor-pointer"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-[#00E5FF] hover:bg-[#00E5FF]/90 text-[#0D0E15] text-xs font-bold flex items-center space-x-1.5 shadow-lg shadow-[#00E5FF]/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{isSaving ? 'Сохранение...' : 'Применить'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
