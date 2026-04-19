
import React from 'react';
import { Loader2 } from 'lucide-react';
import { getLoadingLogo } from '../utils/branding';

export const LoadingScreen = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 transition-colors duration-500">
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

      <div className="relative flex flex-col items-center">
        {/* Logo Container com Glow */}
        <div className="relative w-28 h-28 mb-8">
            {/* Logo Image */}
            <div className="relative w-full h-full rounded-3xl flex items-center justify-center overflow-hidden z-10">
                <img src={getLoadingLogo('dark')} alt="Logo" className="w-full h-full object-contain opacity-90 scale-110" onError={(e) => e.currentTarget.style.display = 'none'} />
            </div>
        </div>

        {/* Texto de Carregamento */}
        <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 tracking-tight animate-fade-in mt-4">
          Ministral
        </h2>
        <div className="flex items-center gap-2 mt-2 text-sm text-zinc-500 font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-ministral-500" />
          <span>Sincronizando dados...</span>
        </div>

        {/* Barra de Progresso em Movimento */}
        <div className="w-48 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full mt-8 overflow-hidden relative">
            <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-ministral-500 to-ministral-600 rounded-full animate-indeterminate w-full"></div>
        </div>
      </div>
      
      <div className="absolute bottom-8 text-[10px] text-zinc-400 uppercase tracking-widest font-bold opacity-60">
        Sistema Seguro & Criptografado
      </div>
    </div>
  );
};
