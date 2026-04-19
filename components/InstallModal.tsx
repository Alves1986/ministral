
import React, { useEffect, useState } from 'react';
import { Share, PlusSquare, X, Smartphone, Globe } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden relative">
        <button 
            onClick={onClose} 
            className="absolute top-3 right-3 p-1 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition-colors"
        >
            <X size={20} />
        </button>

        <div className="p-6 text-center">
            <div className="w-16 h-16 bg-ministral-50 dark:bg-ministral-900/30 text-ministral-500 dark:text-ministral-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-ministral-500/10">
                <Smartphone size={32} />
            </div>
            
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Instalar App</h2>
            
            {isIOS ? (
                <div className="space-y-4 text-left mt-4">
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 text-center mb-4">
                        Para instalar no iPhone/iPad:
                    </p>
                    <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
                        <Share size={24} className="text-ministral-500" />
                        <span className="text-sm text-zinc-600 dark:text-zinc-300">1. Toque no botão <strong>Compartilhar</strong></span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
                        <PlusSquare size={24} className="text-ministral-500" />
                        <span className="text-sm text-zinc-600 dark:text-zinc-300">2. Selecione <strong>Adicionar à Tela de Início</strong></span>
                    </div>
                </div>
            ) : (
                <div className="space-y-4 mt-4">
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">
                        Parece que seu navegador não suporta a instalação automática ou você já tem o app instalado.
                    </p>
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50 text-sm text-zinc-500">
                        <Globe className="mx-auto mb-2 text-zinc-400" size={24}/>
                        Tente abrir este link no <strong>Google Chrome</strong> (Android/PC) ou <strong>Safari</strong> (iOS).
                    </div>
                </div>
            )}
            
            <button 
                onClick={onClose}
                className="mt-6 w-full py-3 bg-ministral-500 hover:bg-ministral-600 text-white font-bold rounded-xl transition-colors"
            >
                Entendi
            </button>
        </div>
      </div>
    </div>
  );
};
