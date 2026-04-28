import React, { useState } from 'react';
import { Beaker, Send, Loader2, Calendar } from 'lucide-react';
import { getSupabase } from '../services/supabase/client';

interface Props {
  orgId: string;
  onShowToast?: (message: string, type: 'success' | 'error') => void;
}

export const WhatsAppTestPanel: React.FC<Props> = ({ orgId, onShowToast }) => {
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Olá! Esta é uma mensagem de teste do Ministral 🎶\nSuas notificações de escala estão funcionando! ✅');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendingSimulation, setSendingSimulation] = useState(false);

  const supabase = getSupabase();

  const handleSendMessage = async () => {
    if (!testPhone) {
      onShowToast?.('Por favor, informe o número de teste.', 'error');
      return;
    }
    
    setSendingMessage(true);
    try {
      if (!supabase) throw new Error('Supabase not initialized');
      
      const { data, error } = await supabase.functions.invoke('whatsapp-test', {
        body: {
          mode: 'message',
          phone: testPhone,
          message: testMessage
        }
      });
      
      if (error) throw error;
      onShowToast?.('Mensagem de teste enviada com sucesso!', 'success');
    } catch (e: any) {
      console.error('Error sending test message:', e);
      onShowToast?.(`Erro ao enviar mensagem: ${e.message}`, 'error');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSimulate = async () => {
    setSendingSimulation(true);
    try {
       if (!supabase) throw new Error('Supabase not initialized');
      
      const { data, error } = await supabase.functions.invoke('whatsapp-test', {
        body: {
          mode: 'simulate',
          org_id: orgId
        }
      });
      
      if (error) throw error;
      onShowToast?.(`Simulação concluída! ${data?.sent || 0} enviados, ${data?.skipped || 0} ignorados.`, 'success');
    } catch (e: any) {
      console.error('Error simulating reminders:', e);
      onShowToast?.(`Erro na simulação: ${e.message}`, 'error');
    } finally {
      setSendingSimulation(false);
    }
  };

  return (
    <div className="bg-white dark:bg-ministral-dark border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm mt-6">
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-500">
          <Beaker size={20} />
        </div>
        <div>
          <h2 className="font-bold text-slate-800 dark:text-white">Teste de Notificações</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Envie mensagens avulsas ou simule alertas da escala</p>
        </div>
      </div>
      
      <div className="p-6 space-y-6">
        {/* Envio Avulso */}
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Número de teste</label>
                <input
                  type="text"
                  placeholder="(11) 99999-9999"
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">Dica: Digite o número que receberá a mensagem de teste</p>
            </div>
            
            <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Mensagem de teste</label>
                <textarea
                  rows={3}
                  value={testMessage}
                  onChange={e => setTestMessage(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            
            <button
                onClick={handleSendMessage}
                disabled={sendingMessage}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-70 w-full sm:w-auto mt-2"
            >
                {sendingMessage ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                Enviar Mensagem de Teste
            </button>
        </div>
        
        <hr className="border-slate-100 dark:border-slate-800" />
        
        {/* Simulação Automatizada */}
        <div>
            <h3 className="font-bold text-slate-800 dark:text-white mb-2">Testar Lembrete de Escala</h3>
            <p className="text-xs text-slate-500 mb-4 cursor-default">
              Dica: Busca membros escalados para HOJE e envia as mensagens como se fosse o disparo automático.
            </p>
            
            <button
                onClick={handleSimulate}
                disabled={sendingSimulation}
                className="bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-70 w-full sm:w-auto"
            >
                {sendingSimulation ? <Loader2 size={18} className="animate-spin" /> : <Calendar size={18} />}
                Disparar Lembretes Agora
            </button>
        </div>
      </div>
    </div>
  );
};
