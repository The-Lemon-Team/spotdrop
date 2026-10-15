import React, { useEffect } from 'react';
import { CheckCircle2, Share2, AlertCircle, X } from 'lucide-react';

export interface ToastData {
  id: number;
  message: string;
  type?: 'success' | 'info' | 'error';
}

interface ToastProps {
  toast: ToastData | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] max-w-md w-auto px-4 pointer-events-none animate-in fade-in slide-in-from-top-3 duration-200">
      <div className="flex items-center space-x-2.5 px-4 py-2.5 rounded-2xl bg-[#161822]/95 border border-[#00E5FF]/40 shadow-2xl shadow-[#00E5FF]/20 backdrop-blur-md text-white text-xs sm:text-sm font-semibold pointer-events-auto">
        {toast.type === 'error' ? (
          <AlertCircle className="w-4 h-4 text-[#FF2E93] shrink-0" />
        ) : toast.type === 'info' ? (
          <Share2 className="w-4 h-4 text-[#00E5FF] shrink-0" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        )}
        <span className="truncate">{toast.message}</span>
        <button
          onClick={onClose}
          className="ml-2 p-1 text-[#8E95A5] hover:text-white rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
