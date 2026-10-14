import React, { useState } from 'react';
import { KeyRound, ShieldAlert, Eye, EyeOff, Clipboard, ArrowRight, Loader2, Radio } from 'lucide-react';
import { verifyToken, setStoredToken } from '../auth/authManager';

interface TokenAuthScreenProps {
  onAuthenticated: () => void;
}

export const TokenAuthScreen: React.FC<TokenAuthScreenProps> = ({ onAuthenticated }) => {
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = tokenInput.trim();
    if (!clean) {
      setErrorMsg('Пожалуйста, введите токен доступа');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const result = await verifyToken(clean);
      if (result.valid) {
        setStoredToken(clean);
        onAuthenticated();
      } else {
        setErrorMsg(result.error || 'Неверный токен доступа. Проверьте значение.');
      }
    } catch {
      setErrorMsg('Не удалось подключиться к серверу. Убедитесь, что Tailscale подключен.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setTokenInput(text.trim());
          setErrorMsg(null);
        }
      }
    } catch (err) {
      console.warn('Clipboard read failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0E15] text-[#F3F4F6] flex flex-col justify-center items-center px-4 py-8 select-none">
      {/* Background Neon Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#00E5FF]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-80 h-80 bg-[#FF2E93]/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md z-10">
        {/* Header Branding */}
        <div className="text-center mb-8 space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#161822] border border-[#2B2F42] shadow-2xl shadow-[#00E5FF]/20 flex items-center justify-center">
            <Radio className="w-8 h-8 text-[#00E5FF] animate-pulse" />
          </div>
          <h1 className="text-3xl font-black tracking-widest text-[#00E5FF]">
            BANDITA
          </h1>
          <p className="text-xs text-[#8E95A5] font-medium uppercase tracking-wider">
            Spotify Export Player • Tailscale Mobile
          </p>

          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#161822] border border-[#2B2F42] text-xs text-[#B2B9C8]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-emerald-400 font-semibold">Tailscale Ready</span>
            <span className="text-[#8E95A5]">•</span>
            <span>Mobile Web</span>
          </div>
        </div>

        {/* Auth Card */}
        <div className="bg-[#161822]/90 border border-[#2B2F42] backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/80 space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-[#F3F4F6] flex items-center space-x-2">
              <KeyRound className="w-5 h-5 text-[#00E5FF]" />
              <span>Доступ по токену</span>
            </h2>
            <p className="text-xs text-[#8E95A5]">
              Введите защитный токен доступа для мобильного использования плеера через защищенную сеть Tailscale.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#B2B9C8]">
                Токен доступа (Auth Token)
              </label>

              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={tokenInput}
                  onChange={(e) => {
                    setTokenInput(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Вставьте ваш токен..."
                  autoFocus
                  autoComplete="off"
                  spellCheck="false"
                  className="w-full pl-3.5 pr-20 py-3 bg-[#0D0E15] border border-[#2B2F42] focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF] rounded-xl text-sm font-mono text-[#F3F4F6] placeholder-[#8E95A5] outline-none transition-all"
                />

                <div className="absolute inset-y-0 right-1 flex items-center space-x-1 pr-2">
                  <button
                    type="button"
                    onClick={handlePaste}
                    className="p-1.5 text-[#8E95A5] hover:text-[#00E5FF] transition-colors cursor-pointer"
                    title="Вставить из буфера"
                  >
                    <Clipboard className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="p-1.5 text-[#8E95A5] hover:text-[#F3F4F6] transition-colors cursor-pointer"
                    title={showToken ? 'Скрыть' : 'Показать'}
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-[#FF2E93]/10 border border-[#FF2E93]/30 rounded-xl flex items-start space-x-2.5 text-xs text-[#FF2E93] animate-fadeIn">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !tokenInput.trim()}
              className="w-full py-3.5 px-4 bg-[#00E5FF] hover:bg-[#00E5FF]/90 disabled:opacity-50 text-[#0D0E15] font-bold text-sm rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-[#00E5FF]/20 transition-all active:scale-[0.98] cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Проверка токена...</span>
                </>
              ) : (
                <>
                  <span>Войти в Bandita Player</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </button>
          </form>

          {/* Quick Tip Box */}
          <div className="p-3.5 rounded-xl bg-[#0D0E15]/70 border border-[#2B2F42] text-[11px] text-[#8E95A5] space-y-1.5">
            <p className="font-semibold text-[#B2B9C8]">💡 Как войти быстрее?</p>
            <p>
              Вы можете открыть ссылку сразу с токеном:
            </p>
            <code className="block p-1.5 rounded bg-[#161822] text-[#00E5FF] font-mono text-[10px] break-all select-all">
              http://&lt;tailscale-ip&gt;:3001/?token=bandita_mobile_7f8e12d4a93c
            </code>
            <p className="text-[10px] text-[#8E95A5]">
              Токен настроен в файле конфигурации <span className="text-[#F3F4F6]">web/.env</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
