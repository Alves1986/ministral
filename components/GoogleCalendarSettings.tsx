import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Link2, PlusCircle, CheckCircle, RotateCcw } from 'lucide-react';
import { initAuth, googleSignIn, logoutGoogle, getAccessToken, syncEventToGoogleCalendar } from '../services/googleCalendar';
import { User } from 'firebase/auth';

interface Props {
  myEvents: any[];
  allEvents: any[];
  ministryName: string;
}

export const GoogleCalendarSettings: React.FC<Props> = ({ myEvents, allEvents, ministryName }) => {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncFilter, setSyncFilter] = useState<'my' | 'all'>('my');

  useEffect(() => {
    const unsubscribe = initAuth(
      (u, token) => {
        setNeedsAuth(false);
        setUser(u);
      },
      () => {
        setNeedsAuth(true);
        setUser(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setNeedsAuth(false);
        setUser(result.user);
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      if (err.message.includes('auth/popup-closed-by-user')) {
        setSyncStatus('O login foi cancelado.');
      } else {
        setSyncStatus('Falha ao conectar com o Google.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSyncAll = async () => {
      const token = await getAccessToken();
      const targetEvents = syncFilter === 'my' ? myEvents : allEvents;
      
      if (!token) {
          setSyncStatus('Sessão expirada. Faça login novamente.');
          setNeedsAuth(true);
          return;
      }
      if (targetEvents.length === 0) {
          setSyncStatus('Nenhum evento futuro encontrado para sincronizar.');
          return;
      }

      setIsSyncing(true);
      setSyncStatus(`Aguardando confirmação para sincronizar ${targetEvents.length} eventos...`);
      
      const confirmed = window.confirm(
        `Deseja inserir ou atualizar ${targetEvents.length} evento(s) no seu Google Agenda? Essa ação não pode ser desfeita e pode criar eventos duplicados se não for a primeira vez.`
      );
      
      if (!confirmed) {
          setIsSyncing(false);
          setSyncStatus('Sincronização cancelada.');
          return;
      }

      let successCount = 0;
      setSyncStatus(`Sincronizando 0 de ${targetEvents.length}...`);
      
      try {
          for (let i = 0; i < targetEvents.length; i++) {
              const ev = targetEvents[i];
              const dateStr = ev.iso ? ev.iso : `${ev.date}T${ev.time || '19:00:00'}`;
              
              await syncEventToGoogleCalendar(token, {
                  title: `${ministryName} - ${ev.eventName || ev.title}`,
                  isoDate: dateStr,
                  description: `Ministério: ${ministryName}\nGerado via App Gestão Escala.`
              });
              successCount++;
              setSyncStatus(`Sincronizando ${successCount} de ${targetEvents.length}...`);
          }
          setSyncStatus(`Sucesso! ${successCount} eventos sincronizados.`);
      } catch (e: any) {
         console.error('Erro ao sincronizar', e);
         setSyncStatus(`Erro: ${e.message}`);
      } finally {
         setIsSyncing(false);
      }
  };

  return (
    <div className="flex flex-col p-6 bg-white dark:bg-zinc-800 rounded-3xl shadow border border-zinc-200 dark:border-zinc-700 gap-4 mb-6">
      <div>
        <h3 className="text-lg font-bold text-zinc-800 dark:text-white flex items-center gap-2">
          <CalendarIcon className="text-blue-500" />
          Sincronização com Google Agenda
        </h3>
        <p className="text-sm text-zinc-500 mt-1">
          Integre seus eventos do ministério automaticamente ao seu Google Calendar com apenas alguns cliques.
        </p>
      </div>
      
      <div className="flex flex-col sm:flex-row items-center gap-4 mt-2">
        {needsAuth ? (
            <button 
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="gsi-material-button flex items-center bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition py-2 px-4 shadow-sm w-full sm:w-auto font-medium"
            >
                {isLoggingIn ? 'Conectando...' : (
                    <>
                        <svg className="w-5 h-5 mr-3" version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                            <path fill="none" d="M0 0h48v48H0z"></path>
                        </svg>
                        <span>Entrar com Google</span>
                    </>
                )}
            </button>
        ) : (
            <div className="flex flex-col gap-3 w-full">
                <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700">
                   {user?.photoURL && <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full shadow-sm" />}
                   <div>
                       <span className="font-semibold block text-zinc-800 dark:text-zinc-200">{user?.displayName || 'Usuário Conectado'}</span>
                       <span className="text-xs">{user?.email}</span>
                   </div>
                   <button onClick={logoutGoogle} className="ml-auto text-red-500 text-xs font-bold bg-red-100 hover:bg-red-200 dark:bg-red-500/10 dark:hover:bg-red-500/20 px-3 py-1.5 rounded-full transition-colors uppercase">Sair</button>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                  <select 
                      value={syncFilter}
                      onChange={(e) => setSyncFilter(e.target.value as 'my' | 'all')}
                      className="w-full sm:w-auto bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                      <option value="my">Sincronizar minhas escalas ({myEvents.length})</option>
                      <option value="all">Sincronizar todo o mistério ({allEvents.length})</option>
                  </select>
                  
                  <button 
                    onClick={handleSyncAll}
                    disabled={isSyncing}
                    className="group flex justify-center items-center gap-2 w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-xl font-bold transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                  >
                      {isSyncing ? <RotateCcw className="animate-spin" size={20} /> : <CheckCircle className="group-hover:scale-110 transition-transform" size={20} />}
                      Sincronizar Eventos
                  </button>
                </div>
                {syncStatus && <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mt-2">{syncStatus}</p>}
            </div>
        )}
      </div>
    </div>
  );
};
