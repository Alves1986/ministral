import React, { useState, useEffect } from 'react';
import { QrCode, X, CheckCircle2, RotateCw, Loader2, MessageCircle } from 'lucide-react';
import { getSupabase } from '../services/supabase/client';

interface Props {
  ministryId: string;
  orgId: string;
  ministryName?: string;
}

export const MinistryWhatsAppConnect: React.FC<Props> = ({ ministryId, orgId, ministryName }) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'qr' | 'connected'>('idle');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [showAlreadyConnected, setShowAlreadyConnected] = useState(false);
  const [resolvedMinistryName, setResolvedMinistryName] = useState<string | null>(null);

  const supabase = getSupabase();

  useEffect(() => {
    if (!ministryName && ministryId && supabase) {
      supabase
        .from('organization_ministries')
        .select('*')
        .eq('id', ministryId)
        .single()
        .then(({ data, error }) => {
          if (data?.label) {
            setResolvedMinistryName(data.label);
          }
        })
        .catch(err => console.error("Error fetching ministry name:", err));
    }
  }, [ministryId, ministryName]);

  useEffect(() => {
    checkConnection();
  }, [ministryId]);

  const checkConnection = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('ministry_whatsapp')
        .select('*')
        .eq('ministry_id', ministryId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setInstanceName(data.instance_name);
        if (data.connected) {
          setStatus('connected');
          setPhoneNumber(data.phone_number);
        } else {
          // If instance exists but not connected, we should probably check its status or allow reconnect
          // For simplicity, we just mark as idle so they can connect again
          if (status !== 'qr') setStatus('idle'); // keep qr if currently showing
        }
      } else {
        if (status !== 'qr') setStatus('idle');
      }
    } catch (err) {
      console.error("Error checking whatsapp connection:", err);
    }
  };

  const pollStatus = async (instName: string) => {
    if (!supabase) return false;
    try {
      const { data: dbData } = await supabase
        .from('ministry_whatsapp')
        .select('connected, phone_number')
        .eq('instance_name', instName)
        .single();

      if (dbData?.connected) {
        setStatus('connected');
        if (dbData.phone_number) setPhoneNumber(dbData.phone_number);
        return true;
      }

      const { data, error } = await supabase.functions.invoke('whatsapp-status', {
        body: { instance_name: instName }
      });
      if (error) throw error;
      
      if (data?.state === 'open') {
        setStatus('connected');
        if (data.phone) setPhoneNumber(data.phone);
        checkConnection(); // Refresh DB state
        return true;
      }
    } catch (err) {
      console.error("Error polling status:", err);
    }
    return false;
  };

  useEffect(() => {
    let interval: any;
    let timeout: any;
    if (status === 'qr' && instanceName) {
      setPollCount(0);
      setShowAlreadyConnected(false);
      
      timeout = setTimeout(() => setShowAlreadyConnected(true), 15000);
      
      interval = setInterval(() => {
        setPollCount(prev => prev + 1);
      }, 3000);
    }
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [status, instanceName]);

  useEffect(() => {
    if (status === 'qr' && pollCount > 0 && instanceName) {
      const runPoll = async () => {
        const isConnected = await pollStatus(instanceName);
        if (!isConnected && pollCount >= 3) {
           await checkConnection(); // fallback
        }
      };
      runPoll();
    }
  }, [pollCount, instanceName, status]);

  useEffect(() => {
    if (status === 'loading') {
      const timeout = setTimeout(() => {
        setStatus('idle');
        setError('Tempo esgotado. Verifique sua conexão e tente novamente.');
      }, 15000);
      return () => clearTimeout(timeout);
    }
  }, [status]);

  const handleConnect = async () => {
    if (!supabase) return;
    setStatus('loading');
    setError(null);
    try {
      const finalName = ministryName || resolvedMinistryName;
      const safeName = finalName
        ? finalName
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            .substring(0, 20)
        : ministryId.substring(0, 8);
      const generatedInstanceName = `min-${safeName}-${orgId.substring(0, 6)}`;

      const { data, error } = await supabase.functions.invoke('whatsapp-connect', {
        body: { ministry_id: ministryId, org_id: orgId, instance_name: generatedInstanceName }
      });
      
      console.log('whatsapp-connect response:', data, error);

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Erro ao chamar Edge Function');
      }
      
      if (data?.qrcode) {
        setQrCode(data.qrcode);
        setInstanceName(data.instanceName);
        setStatus('qr');
      } else if (data?.connected) {
        // Already connected
        setStatus('connected');
        checkConnection();
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        console.error('Resposta inesperada:', data);
        throw new Error("QR Code não foi gerado. Verifique os logs da Edge Function.");
      }
    } catch (err: any) {
      console.error('handleConnect error:', err);
      setError(err.message || "Erro ao conectar. Tente novamente.");
      setStatus('idle');
    }
  };

  const handleDisconnect = async () => {
    if (!supabase || !instanceName) return;
    setStatus('loading');
    try {
      const { error } = await supabase.functions.invoke('whatsapp-disconnect', {
        body: { instance_name: instanceName, ministry_id: ministryId }
      });
      if (error) throw error;
      setStatus('idle');
      setQrCode(null);
      setPhoneNumber(null);
    } catch (err: any) {
      setError(err.message || "Erro ao desconectar.");
      setStatus('connected');
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center text-green-500">
          <MessageCircle size={20} />
        </div>
        <div>
          <h2 className="font-bold text-zinc-800 dark:text-zinc-100">WhatsApp do Ministério</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Configure um número exclusivo para notificações deste ministério</p>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/50 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl mb-6 text-sm">
          {error}
        </div>
      )}

      {status === 'idle' && (
        <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-6 flex flex-col items-center justify-center border border-zinc-100 dark:border-zinc-700/50">
           <p className="text-zinc-500 dark:text-zinc-400 mb-6 text-center text-sm">
             Atenção: Ao conectar um WhatsApp aqui, o ministério utilizará esta conexão exclusiva.<br/>
             Ele será usado para enviar os lembretes e notificações.
           </p>

           {!supabase ? (
              <div className="mb-4 text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1.5 border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/10 px-2.5 py-1 rounded-md">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  Conexão com servidor indisponível
              </div>
           ) : (
              <div className="mb-5 text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  Servidor online
              </div>
           )}

           <button
            onClick={handleConnect}
            disabled={!supabase}
            className="flex items-center space-x-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm"
           >
            <QrCode className="w-5 h-5" />
            <span>Conectar WhatsApp</span>
           </button>
        </div>
      )}

      {status === 'loading' && (
        <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-8 flex flex-col items-center justify-center border border-zinc-100 dark:border-zinc-700/50">
           <Loader2 className="w-8 h-8 text-green-500 animate-spin mb-4" />
           <p className="text-zinc-500 dark:text-zinc-400 font-medium font-sm">Aguarde, configurando conexão...</p>
        </div>
      )}

      {status === 'qr' && qrCode && (
        <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-6 flex flex-col items-center justify-center border border-zinc-100 dark:border-zinc-700/50">
          <h4 className="text-zinc-900 dark:text-white font-bold mb-2">Escaneie o QR Code</h4>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center mb-6">
            Abra o WhatsApp do ministério, vá em Dispositivos Conectados e escaneie o código abaixo.
          </p>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 mb-6">
            <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
          </div>
          <div className="flex flex-col items-center space-y-2 mb-6 text-center">
            <div className="flex items-center space-x-2 text-green-500 dark:text-green-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium">Aguardando aparelho conectar...</span>
            </div>
            {pollCount >= 20 && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 max-w-[250px]">
                Se já escaneou o QR Code, clique em "Já conectei" para verificar.
              </p>
            )}
          </div>
          <div className="flex flex-col items-center gap-3">
             {showAlreadyConnected && (
                <button
                  onClick={async () => {
                    if (!instanceName) return;
                    const isConnected = await pollStatus(instanceName);
                    if (!isConnected) {
                       await checkConnection();
                    }
                  }}
                  className="bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-400 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                >
                  Já conectei
                </button>
             )}
            <button
              onClick={() => setStatus('idle')}
              className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {status === 'connected' && (
        <div className="bg-green-50 dark:bg-green-900/10 rounded-xl p-6 border border-green-200 dark:border-green-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center text-green-600 dark:text-green-500 shadow-sm">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <p className="font-bold text-green-900 dark:text-green-100 text-lg">Conectado</p>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">{ministryName || resolvedMinistryName || phoneNumber || instanceName}</p>
                </div>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleDisconnect}
                className="text-red-500 hover:text-red-700 dark:hover:text-red-400 bg-white dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-900/20 border border-zinc-200 dark:border-zinc-700 transition-all font-bold px-4 py-2 rounded-xl text-sm flex items-center space-x-2 shadow-sm"
              >
                <X className="w-4 h-4" />
                <span>Desconectar Instância</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
