import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Wifi, WifiOff, Loader2, Save, Trash2, Sparkles } from 'lucide-react';
import { getSupabase } from '../services/supabase/client';
import { toast } from 'sonner';

interface Props {
  ministryId: string;
  orgId: string;
  ministryName?: string;
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
  const [instructions, setInstructions] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  
  const isMounted = useRef(true);
  const supabase = getSupabase();

  useEffect(() => {
    isMounted.current = true;
    checkSystemStatus();
    loadMinistrySettings();
    const interval = setInterval(checkSystemStatus, 60000);
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [ministryId]);

  const loadMinistrySettings = async () => {
    if (!supabase) return;
    try {
      setIsLoadingSettings(true);
      const { data, error } = await supabase
        .from('ministry_settings')
        .select('whatsapp_custom_instructions')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId)
        .maybeSingle();
      
      if (!error && data) {
        setInstructions(data.whatsapp_custom_instructions || '');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const handleSave = async () => {
    if (!supabase) return;
    try {
      setIsSaving(true);
      const { error } = await supabase.from('ministry_settings').upsert({
        ministry_id: ministryId,
        organization_id: orgId,
        whatsapp_custom_instructions: instructions,
        whatsapp_instructions_updated_at: new Date().toISOString()
      }, { onConflict: 'ministry_id' });
      
      if (error) throw error;
      toast.success('Orientações salvas com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar orientações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    setInstructions('');
  };

  const handleGenerateAI = async () => {
    if (!supabase) return;
    try {
      setIsGenerating(true);
      const { data: mnInfo } = await supabase.from('organization_ministries').select('label, code').eq('id', ministryId).maybeSingle();
      const mName = ministryName || mnInfo?.label || 'Ministério';
      const mType = mnInfo?.code || 'Padrão';
      
      const { data, error } = await supabase.functions.invoke('whatsapp-generate-instructions', {
        body: { ministryName: mName, ministryType: mType }
      });
      
      if (error) throw error;
      if (data?.instructions) {
        setInstructions(data.instructions);
        toast.info('Texto gerado pela IA. Lembre-se de salvar!');
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar instruções com IA.');
    } finally {
      setIsGenerating(false);
    }
  };

  const checkSystemStatus = async () => {
    if (!supabase) {
      setSystemStatus('offline');
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-status', {
        body: { instance_name: 'ministral-global-v2' },
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
    <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm space-y-5">
      <div className="flex items-center gap-3">
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
      <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
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
        <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
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

      {/* Editor de Orientações Customizadas */}
      {whatsappEnabled && !isLoadingSettings && (
        <div className="flex flex-col gap-3 p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
          <div>
            <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
              Orientações Personalizadas (Notificação Antecipada)
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Essas orientações serão enviadas na primeira mensagem de escala. Recomendamos no máximo 4 tópicos. Recomendamos apagar o campo para que a IA busque atualizar conforme o cenário.
            </p>
          </div>
          
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            disabled={isGenerating || isSaving}
            placeholder="Exemplo:&#10;1. Cheguem 30min antes...&#10;2. Ensaio focado será às 18h..."
            className="w-full min-h-[120px] p-3 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500 outline-none"
          />

          <div className="flex items-center justify-between mt-2 flex-wrap gap-3">
             <button
               onClick={handleClear}
               disabled={!instructions || isGenerating || isSaving}
               className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg transition-colors disabled:opacity-50"
             >
               <Trash2 size={14} /> Limpar
             </button>
             
             <div className="flex items-center gap-2">
               <button
                 onClick={handleGenerateAI}
                 disabled={isGenerating || isSaving}
                 className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/40 rounded-lg transition-colors disabled:opacity-50"
               >
                 {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} 
                 Gerar com IA
               </button>
               
               <button
                 onClick={handleSave}
                 disabled={isGenerating || isSaving}
                 className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
               >
                 {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 
                 Salvar
               </button>
             </div>
          </div>
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
