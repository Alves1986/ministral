
import React from 'react';
import { CheckCircle2, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  data: {
    key: string;
    memberName: string;
    eventName: string;
    date: string;
    role: string;
  } | null;
}

export const ConfirmationModal: React.FC<Props> = ({ isOpen, onClose, onConfirm, data }) => {
  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden transform transition-all scale-100">
        <div className="bg-gradient-to-r from-ministral-500 to-ministral-600 p-6 text-center">
          <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md mb-3">
             <CheckCircle2 size={32} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">Confirmar Presença</h2>
          <p className="text-ministral-100 text-sm mt-1">Ministral</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-center">
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-1">Olá,</p>
            <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">{data.memberName}</h3>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-700/50 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Função:</span>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{data.role}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Data:</span>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{data.date}</span>
            </div>
          </div>

          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            Você confirma que estará presente neste evento?
          </p>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button 
              onClick={onClose}
              className="py-3 px-4 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 font-medium rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={onConfirm}
              className="py-3 px-4 bg-ministral-500 hover:bg-ministral-600 text-white font-bold rounded-xl shadow-lg shadow-ministral-500/20 transition-transform active:scale-95"
            >
              SIM, Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};