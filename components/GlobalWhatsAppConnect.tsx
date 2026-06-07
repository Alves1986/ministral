import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode, CheckCircle2, Loader2, MessageCircle, Wifi, WifiOff,
  RefreshCw, Trash2, Power
} from 'lucide-react';
import { getSupabase } from '../services/supabase/client';
import { useToast } from './Toast';

interface Instance {
  instanceName: string;
  state: 'open' | 'close' | 'connecting' | string;
  phone?: string;
}

export const GlobalWhatsAppConnect: React.FC = () => {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'qr' | 'connected'>('idle');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [showAlreadyConnected, setShowAlreadyConnected] = useState(false);
  const [instancesLoading, setInstancesLoading] = useState(false);
  const isMounted = useRef(true);
  const pollDelay = useRef(3000);
  const { addToast } = useToast();

  const supabase = getSupabase();

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    fetchInstances();
    // Poll de instâncias a cada 30s
    const interval = setInterval(fetchInstances, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchInstances = async () => {
    if (!supabase) return;
    setInstancesLoading(true);
    try {
      // Chama whatsapp-connect com action='list' para listar instâncias da Evolution API
      const { data, error } = await supabase.functions.invoke('whatsapp-connect', {
        body: { action: 'list' },
      });
      if (!isMounted.current) return;
      if (!error && Array.isArray(data?.instances)) {
        setInstances(data.instances);
        const hasOpen = data.instances.some((i: Instance) => i.state === 'open');
        if (hasOpen) setStatus('connected');
        else if (status === 'connected') setStatus('idle');
      }
    } catch (err) {
      console.error('[GlobalWhatsAppConnect] fetchInstances error:', err);
    } finally {
      if (isMounted.current) setInstancesLoading(false);
    }
  };

  const pollConnectionStatus = async (instName: string): Promise<boolean> => {
    if (!supabase) return false;
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-status', {
        body: { instance_name: instName },
      });
      if (!isMounted.current) return false;
      if (error) throw error;
      if (data?.state === 'open' || data?.connected) {
        setStatus('connected');
        fetchInstances();
        return true;
      }
    } catch (err) {
      console.error('[GlobalWhatsAppConnect] pollStatus error:', err);
    }
    return false;
  };

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (status === 'qr' && instanceName) {
      setPollCount(0);
      setShowAlreadyConnected(false);
      pollDelay.current = 3000;

      const alreadyTimeout = setTimeout(() => setShowAlreadyConnected(true), 15000);

      const scheduleNextPoll = () => {
        timeoutId = setTimeout(async () => {
          if (!isMounted.current) return;
          setPollCount(prev => {
            const next = prev + 1;
            if (next > 25) { setShowAlreadyConnected(true); return prev; }
            return next;
          });
          if (instanceName && isMounted.current) {
            const isConnected = await pollConnectionStatus(instanceName);
            if (!isConnected && isMounted.current) {
              pollDelay.current = Math.min(pollDelay.current * 1.5, 20000);
              scheduleNextPoll();
            }
          }
        }, pollDelay.current);
      };

      scheduleNextPoll();
      return () => {
        clearTimeout(timeoutId);
        clearTimeout(alreadyTimeout);
      };
    }
  }, [status, instanceName]);

  const handleConnect = async () => {
    if (!supabase) return;
    setStatus('loading');
    setQrCode(null);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-connect', {
        body: { instance_name: 'ministral-global-v2' },
      });

      if (error) throw new Error(error.message || 'Erro ao chamar Edge Function');

      if (data?.connected) {
        setStatus('connected');
        fetchInstances();
      } else if (data?.qrcode) {
        setQrCode(data.qrcode);
        setInstanceName(data.instanceName || 'ministral-global-v2');
        setStatus('qr');
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        throw new Error('QR Code não retornado. Verifique os logs da Edge Function.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao conectar.';
      addToast(msg, 'error');
      setStatus('idle');
    }
  };

  const handleDisconnect = async (instName: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.functions.invoke('whatsapp-disconnect', {
        body: { instance_name: instName, ministry_id: 'global' },
      });
      if (error) throw error;
      addToast('Instância desconectada com sucesso.', 'success');
      setStatus('idle');
      setQrCode(null);
      setInstanceName(null);
      fetchInstances();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao desconectar.';
      addToast(msg, 'error');
    }
  };

  const connectedInstances = instances.filter(i => i.state === 'open');
  const disconnectedInstances = instances.filter(i => i.state !== 'open');

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4
                      p-6 bg-gradient-to-br from-[#0f1f3d] via-[#152a52] to-[#0f1f3d]
                      rounded-3xl border border-[#c9a84c]/20 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#c9a84c]/10 border border-[#c9a84c]/30
                          flex items-center justify-center">
            <MessageCircle size={28} className="text-[#c9a84c]" />
          </div>
          <div>
            <h3 className="text-white font-black text-xl tracking-tight">WhatsApp Global</h3>
            <p className="text-slate-400 text-sm mt-0.5">
              Instância central da Evolution API — gerenciada pelo Super Admin
            </p>
          </div>
        </div>
        <button
          onClick={fetchInstances}
          disabled={instancesLoading}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20
                     text-white text-xs font-bold rounded-xl transition-colors border border-white/10"
        >
          <RefreshCw size={14} className={instancesLoading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* Instâncias Conectadas */}
      {connectedInstances.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <Wifi size={14} className="text-emerald-500" /> Conectadas ({connectedInstances.length})
          </h4>
          {connectedInstances.map(inst => (
            <div
              key={inst.instanceName}
              className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-900/10
                         border border-emerald-200 dark:border-emerald-500/20 rounded-2xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20
                                flex items-center justify-center">
                  <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="font-bold text-emerald-900 dark:text-emerald-100 text-sm">
                    {inst.instanceName}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                      {inst.phone || 'Online'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDisconnect(inst.instanceName)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-red-500 hover:text-red-700
                           bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700
                           hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-xs font-bold
                           transition-all"
              >
                <Trash2 size={13} /> Desconectar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Instâncias Desconectadas */}
      {disconnectedInstances.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <WifiOff size={14} className="text-red-400" /> Desconectadas ({disconnectedInstances.length})
          </h4>
          {disconnectedInstances.map(inst => (
            <div
              key={inst.instanceName}
              className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/30
                         border border-zinc-200 dark:border-zinc-700/50 rounded-2xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-700
                                flex items-center justify-center">
                  <WifiOff size={18} className="text-zinc-400" />
                </div>
                <div>
                  <p className="font-bold text-zinc-700 dark:text-zinc-300 text-sm">
                    {inst.instanceName}
                  </p>
                  <span className="text-xs text-zinc-400 font-medium capitalize">{inst.state}</span>
                </div>
              </div>
              <button
                onClick={() => handleDisconnect(inst.instanceName)}
                className="px-3 py-1.5 text-zinc-400 hover:text-red-500 border border-zinc-200
                           dark:border-zinc-700 rounded-xl text-xs font-bold transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Painel de Conexão */}
      <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm p-6">
        <h4 className="text-sm font-black text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-5 flex items-center gap-2">
          <Power size={15} /> Nova Conexão
        </h4>

        {status === 'idle' && (
          <div className="flex flex-col items-center py-6">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center mb-6 max-w-sm">
              Conecte a instância global <strong>ministral-global-v2</strong> à Evolution API.
              Todos os ministérios Enterprise usarão esta conexão para envios automáticos.
            </p>
            <button
              onClick={handleConnect}
              disabled={!supabase}
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600
                         disabled:opacity-50 disabled:cursor-not-allowed
                         text-white px-6 py-3 rounded-xl font-black text-sm
                         transition-colors shadow-lg shadow-green-500/25"
            >
              <QrCode size={18} /> Conectar / Gerar QR Code
            </button>
          </div>
        )}

        {status === 'loading' && (
          <div className="flex flex-col items-center py-10">
            <Loader2 size={32} className="text-green-500 animate-spin mb-4" />
            <p className="text-zinc-500 dark:text-zinc-400 font-medium text-sm">
              Conectando à Evolution API...
            </p>
          </div>
        )}

        {status === 'qr' && qrCode && (
          <div className="flex flex-col items-center">
            <h5 className="text-zinc-900 dark:text-white font-bold mb-2">Escaneie o QR Code</h5>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center mb-6">
              Abra o WhatsApp do número dedicado → Dispositivos Conectados → Escanear.
            </p>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 mb-6">
              <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
            </div>
            <div className="flex items-center gap-2 text-green-500 mb-4">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm font-medium">
                Aguardando conexão... ({pollCount}/25)
              </span>
            </div>
            <div className="flex flex-col items-center gap-3">
              {showAlreadyConnected && (
                <button
                  onClick={async () => {
                    if (!instanceName) return;
                    const ok = await pollConnectionStatus(instanceName);
                    if (!ok) fetchInstances();
                  }}
                  className="bg-green-100 hover:bg-green-200 text-green-700
                             dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-400
                             px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                >
                  Já conectei ✓
                </button>
              )}
              <button
                onClick={() => { setStatus('idle'); setQrCode(null); }}
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white
                           transition-colors text-sm font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {status === 'connected' && instances.length > 0 && (
          <div className="flex flex-col items-center py-6">
            <CheckCircle2 size={40} className="text-emerald-500 mb-3" />
            <p className="font-bold text-emerald-700 dark:text-emerald-400 text-lg">Sistema Online</p>
            <p className="text-sm text-zinc-500 mt-1">
              {connectedInstances.length} instância(s) ativa(s)
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
