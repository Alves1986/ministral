import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, Info, AlertOctagon } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType) => void;
  confirmAction: (title: string, message: string, onConfirm: () => void) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

export const ToastProvider = ({ children }: { children?: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const confirmAction = useCallback((title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(null);
      }
    });
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, confirmAction }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div 
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 min-w-[300px] p-4 rounded-lg shadow-lg border animate-slide-up ${
              toast.type === 'success' ? 'bg-white dark:bg-zinc-800 border-green-500 text-zinc-800 dark:text-zinc-100' :
              toast.type === 'error' ? 'bg-white dark:bg-zinc-800 border-red-500 text-zinc-800 dark:text-zinc-100' :
              'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100'
            }`}
          >
            {toast.type === 'success' && <CheckCircle size={20} className="text-green-500" />}
            {toast.type === 'error' && <AlertOctagon size={20} className="text-red-500" />}
            {toast.type === 'info' && <Info size={20} className="text-blue-500" />}
            <p className="text-sm font-medium flex-1">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="text-zinc-400 hover:text-zinc-600">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Custom Confirm Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-sm border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="flex items-center gap-3 mb-4 text-amber-500">
              <AlertTriangle size={28} />
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{confirmModal.title}</h3>
            </div>
            <p className="text-zinc-600 dark:text-zinc-300 mb-6">{confirmModal.message}</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-md transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};