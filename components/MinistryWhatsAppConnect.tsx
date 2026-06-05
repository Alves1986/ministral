import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Wifi, WifiOff, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import { getSupabase } from '../services/supabase/client';

interface Props {
  ministryId: string;
  orgId: string;
  ministryName?: string;
  /** Exibe toggle de ativar/desativar WhatsApp para o ministério */
  whatsappEnabled?: boolean;
  onToggle?: (enabled: boolean) => void;
}

type SystemStatus = 'loading' | 'online' | 'offline';

export const MinistryWhatsAppConnect: React.FC<Props> = ({
  ministryId,
  orgId,
  ministryName,
  whatsappEnabled = true,
  onToggle,
}) => {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>('loading');
  const isMounted = useRef(true);
  const supabase = getSupabase();

  useEffect(() => {
    isMounted.current = true;
    checkSystemStatus();
    // Atualiza o status a cada 60s
    const interval = setInterval(checkSystemStatus, 60000);
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, []);

  const checkSystemStatus = async () => {
    if (!supabase) {
      setSystemStatus('offline');
      return;
    }
    try {
      // Verifica se há alguma instância global conectada consultando a Edge Function de status
      const { data, error } = await supabase.functions.invoke('whatsapp-status', {
        body: { instance_name: 'ministral-global' },
      });
      if (!isMounted.current) return;
      if (!error && (data?.state === 'open' || data?.connected)) {
        setSystemStatus('online');
      } else {
        setSystemStatus('offline');
      }
    } catch {
      if (isMounted.current) setSystemStatus('offline');
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center text-green-500">
          <MessageCircle size={20} />
        </div>
        <div>
          <h2 className="font-bold text-zinc-800 dark:text-zinc-100">WhatsApp do Ministério</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {ministryName ? `Ministério: ${ministryName}` : 'Configurações de envio de mensagens'}
          </p>
        </div>
      </div>

      {/* Status do sistema global */}
      <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50
                      rounded-xl border border-zinc-100 dark:border-zinc-700/50 mb-5">
        <div className="flex items-center gap-3">
          {systemStatus === 'loading' ? (
            <Loader2 size={18} className="text-zinc-400 animate-spin" />
          ) : systemStatus === 'online' ? (
            <Wifi size={18} className="text-emerald-500" />
          ) : (
            <WifiOff size={18} className="text-red-400" />
          )}
          <div>
            <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
              Sistema WhatsApp Global
            </p>
            <p className="text-xs text-zinc-500">
              {systemStatus === 'loading'
                ? 'Verificando conexão...'
                : systemStatus === 'online'
                ? 'Conectado e operacional'
                : 'Offline — contate o administrador'}
            </p>
          </div>
        </div>
        <span
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border
            ${systemStatus === 'online'
              ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/40'
              : systemStatus === 'offline'
              ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40'
              : 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-700 dark:text-zinc-400 dark:border-zinc-600'
            }`}
        >
          {systemStatus === 'loading' ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" />
              Verificando
            </>
          ) : systemStatus === 'online' ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Online
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              Offline
            </>
          )}
        </span>
      </div>

      {/* Toggle para ativar/desativar WhatsApp neste ministério */}
      {onToggle && (
        <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50
                        rounded-xl border border-zinc-100 dark:border-zinc-700/50">
          <div>
            <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
              WhatsApp neste Ministério
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {whatsappEnabled
                ? 'Mensagens automáticas ativas para este ministério.'
                : 'Mensagens desativadas para este ministério.'}
            </p>
          </div>
          <button
            onClick={() => onToggle(!whatsappEnabled)}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors
              ${whatsappEnabled ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow
                ${whatsappEnabled ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </div>
      )}

      {/* Aviso se sistema offline */}
      {systemStatus === 'offline' && (
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400 text-center">
          A conexão global do WhatsApp está offline. Nenhuma mensagem será enviada até que o super administrador reconecte o sistema.
        </p>
      )}
    </div>
  );
};
