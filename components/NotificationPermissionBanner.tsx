import React, { useState, useEffect } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { subscribeUserToPush } from '../utils/pushUtils';

const PREF_KEY = 'ministral_push_notification_pref';

type Pref = 'granted' | 'denied' | 'dismissed' | null;

export const NotificationPermissionBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Não exibe se o browser não suporta push
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return;
    }

    // Se já concedido, não exibe
    if (Notification.permission === 'granted') {
      localStorage.setItem(PREF_KEY, 'granted');
      return;
    }

    // Se bloqueado pelo browser, não exibe (o browser impede mesmo)
    if (Notification.permission === 'denied') {
      localStorage.setItem(PREF_KEY, 'denied');
      return;
    }

    // Verificar preferência salva
    const saved = localStorage.getItem(PREF_KEY) as Pref;
    if (saved === 'dismissed' || saved === 'denied' || saved === 'granted') {
      return;
    }

    // Exibe após 3 segundos para não atrapalhar o carregamento
    const timer = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const sub = await subscribeUserToPush();
      if (sub) {
        localStorage.setItem(PREF_KEY, 'granted');
        setVisible(false);
      } else {
        // Permissão negada pelo usuário no popup do OS
        localStorage.setItem(PREF_KEY, 'denied');
        setVisible(false);
      }
    } catch (e) {
      console.error('[NotificationBanner] Erro ao ativar push:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(PREF_KEY, 'dismissed');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm
                 animate-slide-up"
      role="dialog"
      aria-label="Ativar notificações"
    >
      <div className="bg-[#0f1f3d] border border-[#c9a84c]/30 rounded-2xl shadow-2xl shadow-black/40
                      p-4 flex items-start gap-3">
        {/* Ícone */}
        <div className="w-10 h-10 rounded-xl bg-[#c9a84c]/10 border border-[#c9a84c]/30
                        flex items-center justify-center shrink-0 mt-0.5">
          <Bell size={20} className="text-[#c9a84c]" />
        </div>

        {/* Texto */}
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-bold leading-tight">
            Ativar notificações?
          </p>
          <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">
            Receba avisos de escala, comunicados e trocas direto no seu celular ou PC.
          </p>

          {/* Botões */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleEnable}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#c9a84c] hover:bg-[#b8953f]
                         text-[#0f1f3d] text-xs font-black rounded-lg transition-all
                         active:scale-95 disabled:opacity-60"
            >
              {loading ? (
                <span className="w-3 h-3 border-2 border-[#0f1f3d]/40 border-t-[#0f1f3d]
                                 rounded-full animate-spin" />
              ) : (
                <Bell size={12} />
              )}
              Ativar
            </button>
            <button
              onClick={handleDismiss}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-white/5 hover:bg-white/10
                         text-slate-400 text-xs font-bold rounded-lg transition-all active:scale-95"
            >
              <BellOff size={12} />
              Agora não
            </button>
          </div>
        </div>

        {/* Fechar */}
        <button
          onClick={handleDismiss}
          className="text-slate-600 hover:text-slate-400 transition-colors shrink-0"
          aria-label="Fechar"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
