import React, { useState, useEffect, useCallback } from 'react';
import { Calendar as CalendarIcon, CheckCircle, RotateCcw, LogIn, LogOut, Wifi, WifiOff, AlertCircle } from 'lucide-react';
import {
  connectGoogleCalendar,
  captureCalendarTokenFromSession,
  getCalendarToken,
  getCalendarUserInfo,
  isCalendarConnected,
  disconnectGoogleCalendar,
  syncEventToGoogleCalendar,
} from '../services/googleCalendar';

interface Props {
  myEvents: any[];
  allEvents: any[];
  ministryName: string;
}

export const GoogleCalendarSettings: React.FC<Props> = ({ myEvents, allEvents, ministryName }) => {
  const [connected, setConnected] = useState(false);
  const [userInfo, setUserInfo] = useState<{ name: string; email: string; avatar?: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [syncFilter, setSyncFilter] = useState<'my' | 'all'>('my');

  const refreshState = useCallback(() => {
    setConnected(isCalendarConnected());
    setUserInfo(getCalendarUserInfo());
  }, []);

  useEffect(() => {
    // Verifica se voltamos de um callback OAuth do Google Calendar
    const params = new URLSearchParams(window.location.search);
    if (params.get('calendar_connected') === 'true') {
      // Captura e persiste o provider_token da sessão Supabase
      captureCalendarTokenFromSession().then((success) => {
        if (success) {
          setSyncStatus({ type: 'success', message: 'Google Agenda conectado com sucesso!' });
        } else {
          setSyncStatus({ type: 'error', message: 'Não foi possível capturar o token. Tente novamente.' });
        }
        // Limpa o parâmetro da URL sem recarregar a página
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('calendar_connected');
        window.history.replaceState({}, '', newUrl.toString());
        refreshState();
      });
    } else {
      refreshState();
    }
  }, [refreshState]);

  const handleConnect = async () => {
    setIsConnecting(true);
    setSyncStatus(null);
    try {
      await connectGoogleCalendar();
      // O redirect acontece aqui — a função redireciona para o Google
    } catch (err: any) {
      setSyncStatus({ type: 'error', message: err.message || 'Falha ao conectar com o Google.' });
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnectGoogleCalendar();
    setSyncStatus({ type: 'info', message: 'Google Agenda desconectado.' });
    refreshState();
  };

  const handleSyncAll = async () => {
    const token = getCalendarToken();
    const targetEvents = syncFilter === 'my' ? myEvents : allEvents;

    if (!token) {
      setSyncStatus({ type: 'error', message: 'Sessão expirada. Reconecte o Google Agenda.' });
      disconnectGoogleCalendar();
      refreshState();
      return;
    }

    if (targetEvents.length === 0) {
      setSyncStatus({ type: 'info', message: 'Nenhum evento futuro encontrado para sincronizar.' });
      return;
    }

    const confirmed = window.confirm(
      `Deseja inserir ${targetEvents.length} evento(s) no seu Google Agenda?\n\nIssa ação pode criar duplicatas se já foram sincronizados antes.`
    );
    if (!confirmed) return;

    setIsSyncing(true);
    setSyncStatus({ type: 'info', message: `Sincronizando 0 de ${targetEvents.length}...` });

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < targetEvents.length; i++) {
      const ev = targetEvents[i];
      const dateStr = ev.iso ? ev.iso : `${ev.date}T${ev.time || '19:00:00'}`;
      try {
        await syncEventToGoogleCalendar(token, {
          title: `${ministryName} — ${ev.eventName || ev.title}`,
          isoDate: dateStr,
          description: `Ministério: ${ministryName}\nGerado via Ministral.`,
        });
        successCount++;
        setSyncStatus({ type: 'info', message: `Sincronizando ${successCount} de ${targetEvents.length}...` });
      } catch (e: any) {
        // Token expirado
        if (e.message?.includes('expirada')) {
          setSyncStatus({ type: 'error', message: e.message });
          refreshState();
          setIsSyncing(false);
          return;
        }
        errorCount++;
        console.error('[GoogleCalendar] Falha ao sincronizar evento:', ev, e);
      }
    }

    if (errorCount === 0) {
      setSyncStatus({ type: 'success', message: `✓ ${successCount} evento(s) sincronizados com sucesso!` });
    } else {
      setSyncStatus({ type: 'error', message: `${successCount} sincronizados, ${errorCount} com falha. Verifique o console.` });
    }
    setIsSyncing(false);
  };

  const statusColors = {
    success: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
    error: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    info: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  };

  return (
    <div className="flex flex-col p-6 bg-white dark:bg-zinc-800 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-700 gap-5 mb-6">
      {/* Cabeçalho */}
      <div className="flex items-start gap-3">
        <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-2xl shrink-0">
          <CalendarIcon className="text-blue-500" size={22} />
        </div>
        <div>
          <h3 className="text-base font-bold text-zinc-800 dark:text-white">
            Sincronização com Google Agenda
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Exporte os eventos do ministério diretamente para o seu Google Agenda.
          </p>
        </div>
        {/* Indicador de status */}
        <div className="ml-auto shrink-0">
          {connected
            ? <Wifi size={18} className="text-emerald-500" />
            : <WifiOff size={18} className="text-zinc-400" />
          }
        </div>
      </div>

      {/* Conteúdo */}
      {!connected ? (
        /* Estado: Não conectado */
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Conecte sua conta Google para sincronizar eventos.
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
              Você será redirecionado ao Google para autorizar o acesso.
            </p>
          </div>
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="flex items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 transition py-2.5 px-5 rounded-2xl shadow-sm font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isConnecting ? (
              <RotateCcw size={18} className="animate-spin text-zinc-400" />
            ) : (
              /* Ícone Google */
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
            )}
            <span>{isConnecting ? 'Redirecionando...' : 'Entrar com Google'}</span>
            {!isConnecting && <LogIn size={14} className="text-zinc-400" />}
          </button>
        </div>
      ) : (
        /* Estado: Conectado */
        <div className="flex flex-col gap-3">
          {/* Card do usuário Google conectado */}
          <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-900 px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700">
            {userInfo?.avatar ? (
              <img src={userInfo.avatar} alt={userInfo.name} className="w-9 h-9 rounded-full shadow-sm shrink-0 border-2 border-white dark:border-zinc-700" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <span className="text-blue-600 dark:text-blue-400 font-black text-sm">
                  {userInfo?.name?.charAt(0).toUpperCase() || 'G'}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-zinc-800 dark:text-zinc-200 truncate">
                {userInfo?.name || 'Conta Google'}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{userInfo?.email}</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
              <CheckCircle size={14} />
              <span className="hidden sm:inline">Conectado</span>
            </div>
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1.5 text-xs font-bold text-red-500 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 px-3 py-1.5 rounded-xl transition-colors ml-2 shrink-0"
              title="Desconectar Google Agenda"
            >
              <LogOut size={12} />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>

          {/* Controles de sincronização */}
          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            <select
              value={syncFilter}
              onChange={(e) => setSyncFilter(e.target.value as 'my' | 'all')}
              className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:flex-1"
            >
              <option value="my">Minhas escalas ({myEvents.length} evento{myEvents.length !== 1 ? 's' : ''})</option>
              <option value="all">Todo o ministério ({allEvents.length} evento{allEvents.length !== 1 ? 's' : ''})</option>
            </select>

            <button
              onClick={handleSyncAll}
              disabled={isSyncing}
              className="group flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2.5 px-5 rounded-xl font-bold text-sm transition shadow-md hover:shadow-lg disabled:cursor-not-allowed sm:flex-1"
            >
              {isSyncing
                ? <RotateCcw size={16} className="animate-spin" />
                : <CheckCircle size={16} className="group-hover:scale-110 transition-transform" />
              }
              {isSyncing ? 'Sincronizando...' : 'Sincronizar Eventos'}
            </button>
          </div>
        </div>
      )}

      {/* Mensagem de status */}
      {syncStatus && (
        <div className={`flex items-start gap-2 text-sm font-medium px-4 py-3 rounded-xl border ${statusColors[syncStatus.type]}`}>
          {syncStatus.type === 'error' && <AlertCircle size={16} className="shrink-0 mt-0.5" />}
          {syncStatus.type === 'success' && <CheckCircle size={16} className="shrink-0 mt-0.5" />}
          <span>{syncStatus.message}</span>
        </div>
      )}
    </div>
  );
};
