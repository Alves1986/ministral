import React, { useState, useEffect } from 'react';
import { Bell, Save, Loader2, MessageCircle } from 'lucide-react';
import { fetchWhatsAppSettings, upsertWhatsAppSettings } from '../services/supabase/misc';
import { WhatsAppSettings, MinistryDef } from '../types';
import { WhatsAppTestPanel } from './WhatsAppTestPanel';

interface Props {
  orgId: string;
  ministries: MinistryDef[];
  onShowToast?: (message: string, type: 'success' | 'error') => void;
}

export const WhatsAppNotificationSettings: React.FC<Props> = ({ orgId, ministries, onShowToast }) => {
  const [settings, setSettings] = useState<WhatsAppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchWhatsAppSettings(orgId);
        if (data) {
          setSettings({
            ...data,
            // make sure we don't drop milliseconds if it was returned
            send_time: data.send_time.slice(0, 5) // "09:00:00" -> "09:00"
          });
        } else {
          setSettings({
            id: '',
            org_id: orgId,
            enabled: true,
            send_days_before: 0,
            send_time: '09:00',
            updated_at: ''
          });
        }
      } catch (e) {
        console.error("Error fetching whatsapp settings:", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [orgId]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await upsertWhatsAppSettings(orgId, {
        enabled: settings.enabled,
        send_days_before: settings.send_days_before,
        send_time: settings.send_time + ':00'
      });
      onShowToast?.("Configurações de WhatsApp salvas com sucesso!", "success");
    } catch (e) {
      console.error(e);
      onShowToast?.("Erro ao salvar configurações", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin text-ministral-500" />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="bg-white dark:bg-ministral-dark border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center text-green-500">
          <MessageCircle size={20} />
        </div>
        <div>
          <h2 className="font-bold text-slate-800 dark:text-white">Notificações WhatsApp</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Configure os alertas enviados via Evolution API</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Toggle Geral */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold dark:text-white mb-1">Habilitar Notificações</h3>
            <p className="text-xs text-slate-500">Liga ou desliga todos os lembretes do WhatsApp.</p>
          </div>
          <button
            onClick={() => setSettings(s => s ? { ...s, enabled: !s.enabled } : s)}
            className={`w-12 h-6 rounded-full transition-colors relative ${settings.enabled ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-700'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${settings.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {settings.enabled && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Dias de Antecedencia */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Dias de antecedência</label>
                <select
                  value={settings.send_days_before}
                  onChange={e => setSettings(s => s ? { ...s, send_days_before: Number(e.target.value) } : s)}
                  className="w-full bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value={0}>No dia do evento</option>
                  <option value={1}>1 dia antes</option>
                  <option value={2}>2 dias antes</option>
                  <option value={3}>3 dias antes</option>
                </select>
              </div>

              {/* Horario de Envio */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Horário de envio</label>
                <input
                  type="time"
                  value={settings.send_time}
                  onChange={e => setSettings(s => s ? { ...s, send_time: e.target.value } : s)}
                  className="w-full bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          </>
        )}

        <div className="pt-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-ministral-500 hover:bg-ministral-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-70"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Salvar Preferências
          </button>
        </div>
      </div>
      
      {settings.enabled && (
        <WhatsAppTestPanel orgId={orgId} onShowToast={onShowToast} />
      )}
    </div>
  );
};
