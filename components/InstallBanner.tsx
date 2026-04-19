import React from 'react';
import { Download, X, Smartphone } from 'lucide-react';

interface Props {
  isVisible: boolean;
  onInstall: () => void;
  onDismiss: () => void;
  appName: string;
}

export const InstallBanner: React.FC<Props> = ({ isVisible, onInstall, onDismiss, appName }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[999] p-4 animate-slide-up pointer-events-none">
      <div className="max-w-md mx-auto bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 p-4 flex items-center justify-between gap-4 pointer-events-auto ring-1 ring-black/10">
        <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-ministral-500 to-ministral-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-ministral-500/20">
                <Smartphone size={24} />
            </div>
            <div>
                <p className="text-sm font-bold text-zinc-900 dark:text-white">Instalar Aplicativo</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Instale o <strong>{appName}</strong> para acesso rápido e offline.</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <button 
                onClick={onDismiss}
                className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                aria-label="Dispensar"
            >
                <X size={20} />
            </button>
            <button 
                onClick={onInstall}
                className="bg-ministral-500 hover:bg-ministral-600 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-colors shadow-md active:scale-95"
            >
                Instalar
            </button>
        </div>
      </div>
    </div>
  );
};