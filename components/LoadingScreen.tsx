
import React from 'react';
import { Loader2 } from 'lucide-react';
import { getLoadingLogo } from '../utils/branding';

export const LoadingScreen = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex min-h-[100svh] flex-col items-center justify-center overflow-y-auto bg-zinc-50 px-6 py-8 dark:bg-zinc-950 transition-colors duration-500 safe-area-pb">
      {/* Styles for the custom progress animation */}
      <style>{`
        @keyframes indeterminate-bar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(20%); width: 50%; }
          100% { transform: translateX(200%); width: 20%; }
        }
        .animate-indeterminate {
          animation: indeterminate-bar 1.5s infinite linear;
        }
      `}</style>

      <div className="relative flex w-full max-w-xs flex-col items-center text-center">
        {/* Logo Container com Glow */}
        <div className="relative mb-6 h-20 w-20 sm:mb-8 sm:h-28 sm:w-28">
            {/* Logo Image */}
            <div className="relative w-full h-full rounded-3xl flex items-center justify-center overflow-hidden z-10">
                <img src={getLoadingLogo('dark')} alt="Logo" className="w-full h-full object-contain opacity-90 scale-110" onError={(e) => e.currentTarget.style.display = 'none'} />
            </div>
        </div>

        {/* Texto de Carregamento */}
        <h2 className="mt-3 text-lg font-bold tracking-tight text-zinc-800 dark:text-zinc-100 animate-fade-in sm:mt-4 sm:text-xl">
          Ministral
        </h2>
        <div className="mt-2 flex min-h-6 items-center justify-center gap-2 text-center text-sm font-medium text-zinc-500">
          <Loader2 className="w-4 h-4 animate-spin text-ministral-500" />
          <span role="status" aria-live="polite">Sincronizando dados...</span>
        </div>

        {/* Barra de Progresso em Movimento */}
        <div className="relative mt-7 h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-ministral-500 to-ministral-600 rounded-full animate-indeterminate w-full"></div>
        </div>
      </div>
      
      <div className="safe-area-pb absolute bottom-4 px-6 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-400 opacity-60 sm:bottom-8">
        Sistema Seguro & Criptografado
      </div>
    </div>
  );
};
