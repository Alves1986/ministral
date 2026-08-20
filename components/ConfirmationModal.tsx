
import React, { useEffect, useRef } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from './ui';

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
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setTimeout(() => modalRef.current?.focus(), 0);
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" role="presentation">
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        tabIndex={-1}
        className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden transform transition-all scale-100 outline-none"
      >
        <div className="bg-gradient-to-r from-ministral-500 to-ministral-600 p-6 text-center">
          <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md mb-3">
             <CheckCircle2 size={32} className="text-white" />
          </div>
          <h2 id="confirm-modal-title" className="text-xl font-bold text-white">Confirmar Presença</h2>
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

          <div className="grid grid-cols-1 gap-3 mt-4 sm:grid-cols-2">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={onClose}
              aria-label="Cancelar confirmação"
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              fullWidth
              onClick={onConfirm}
              aria-label="Confirmar presença"
              className="rounded-xl"
            >
              SIM, Confirmar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};