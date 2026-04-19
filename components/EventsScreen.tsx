import React, { useState, useEffect } from 'react';
import { Trash2, Plus, Calendar, Clock, Repeat, CalendarDays, Loader2 } from 'lucide-react';
import { createEventRule, deleteEventRule } from '../services/supabaseService';
import { fetchEventRules } from '../infra/supabase/fetchEventRules';
import { useAppStore } from '../store/appStore';
import { EventRule } from '../domain/events/types';
import { useToast } from './Toast';

export const EventsScreen: React.FC = () => {
  const { ministryId, currentUser } = useAppStore();
  const orgId = currentUser?.organizationId;
  const { addToast, confirmAction } = useToast();
  
  const [rules, setRules] = useState<EventRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form State
  const [type, setType] = useState<'weekly'|'single'>('weekly');
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('19:30');
  const [weekday, setWeekday] = useState(0); // 0 = Dom
  const [date, setDate] = useState('');

  const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  if (!ministryId || !orgId) {
    return <div>Selecione um ministerio para ver as regras de agenda.</div>;
  }

  const loadRules = async () => {
      if (!ministryId || !orgId) return;
      setLoading(true);
      try {
          const data = await fetchEventRules(ministryId, orgId);
          setRules(data);
      } catch (e) {
          console.error(e);
          addToast("Erro ao carregar regras de agenda.", "error");
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      loadRules();
  }, [ministryId, orgId]);

  const handleAdd = async (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!title || !time) {
          addToast("Preencha o título e horário.", "warning");
          return;
      }
      
      if (type === 'single' && !date) {
          addToast("Selecione uma data para o evento único.", "warning");
          return;
      }
      
      if (!orgId || !ministryId) {
          addToast("Erro de identificação do ministério.", "error");
          return;
      }

      setSubmitting(true);
      try {
          // Prepare payload components
          const ruleData = {
              ministryId,
              title,
              time,
              type,
              weekday: type === 'weekly' ? Number(weekday) : undefined,
              date: type === 'single' ? date : undefined
          };

          // Optimistic update
          const tempId = `temp-${Date.now()}`;
          setRules(prev => [...prev, { 
              id: tempId,
              ministry_id: ministryId,
              organization_id: orgId,
              title: ruleData.title,
              time: ruleData.time,
              type: ruleData.type,
              weekday: ruleData.weekday,
              date: ruleData.date,
              duration_minutes: 60,
              active: true
          } as EventRule]);

          // Service call - persistence
          await createEventRule(orgId, ruleData);
          
          addToast("Regra adicionada com sucesso!", "success");
          
          // Reset form
          setTitle('');
          if(type === 'single') setDate('');
          
          // Reload data immediately
          await loadRules();
          
      } catch (e: any) {
          console.error("Failed to add rule:", e);
          addToast(e.message || "Erro ao criar regra.", "error");
          await loadRules(); // Revert on error
      } finally {
          setSubmitting(false);
      }
  };

  const handleDelete = async (id: string, title: string) => {
      if (!orgId) return;
      
      confirmAction(
          "Remover Regra", 
          `Tem certeza que deseja remover "${title}"? Isso afetará a geração automática da escala.`, 
          async () => {
              // Optimistic update
              const previousRules = [...rules];
              setRules(prev => prev.filter(r => r.id !== id));
              try {
                  await deleteEventRule(orgId, id);
                  addToast("Regra removida.", "info");
                  loadRules();
              } catch(e) {
                  addToast("Erro ao remover regra.", "error");
                  setRules(previousRules); // Revert on error
              }
          }
      );
  };

  const weeklyRules = rules.filter(r => r.type === 'weekly').sort((a, b) => (a.weekday || 0) - (b.weekday || 0));
  const singleRules = rules.filter(r => r.type === 'single').sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto pb-24">
        {/* Header */}
        <div className="border-b border-zinc-200 dark:border-zinc-700 pb-4">
            <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                <CalendarDays className="text-ministral-500"/> Regras de Agenda
            </h2>
            <p className="text-zinc-500 text-sm mt-1">
                Configure os eventos fixos (semanais) e eventos especiais da escala.
            </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form Section */}
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm sticky top-6">
                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4">Adicionar Evento</h3>
                    
                    <form onSubmit={handleAdd} className="space-y-4">
                        {/* Type Toggle */}
                        <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg">
                            <button
                                type="button" 
                                onClick={() => setType('weekly')}
                                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${type === 'weekly' ? 'bg-white dark:bg-zinc-700 shadow text-zinc-900 dark:text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                            >
                                <Repeat size={14}/> Semanal
                            </button>
                            <button
                                type="button" 
                                onClick={() => setType('single')}
                                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${type === 'single' ? 'bg-white dark:bg-zinc-700 shadow text-zinc-900 dark:text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                            >
                                <Calendar size={14}/> Único
                            </button>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-zinc-500 uppercase block mb-1.5 ml-1">Título do Evento</label>
                            <input 
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="Ex: Culto de Jovens"
                                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ministral-gold text-zinc-800 dark:text-zinc-200 transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase block mb-1.5 ml-1">Horário</label>
                                <div className="relative group">
                                    <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-ministral-gold transition-colors"/>
                                    <input 
                                        type="time" 
                                        value={time}
                                        onChange={e => setTime(e.target.value)}
                                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl pl-10 pr-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ministral-gold text-zinc-800 dark:text-zinc-200 transition-all min-w-0"
                                    />
                                </div>
                            </div>

                            <div>
                                {type === 'weekly' ? (
                                    <>
                                        <label className="text-xs font-bold text-zinc-500 uppercase block mb-1.5 ml-1">Dia da Semana</label>
                                        <select 
                                            value={weekday}
                                            onChange={e => setWeekday(Number(e.target.value))}
                                            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ministral-gold text-zinc-800 dark:text-zinc-200 cursor-pointer appearance-none transition-all"
                                        >
                                            {weekdays.map((d, i) => <option key={i} value={i}>{d}</option>)}
                                        </select>
                                    </>
                                ) : (
                                    <>
                                        <label className="text-xs font-bold text-zinc-500 uppercase block mb-1.5 ml-1">Data</label>
                                        <div className="relative group">
                                            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-ministral-gold transition-colors"/>
                                            <input 
                                                type="date"
                                                value={date}
                                                onChange={e => setDate(e.target.value)}
                                                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl pl-10 pr-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ministral-gold text-zinc-800 dark:text-zinc-200 transition-all min-w-0"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={submitting}
                            className="w-full bg-ministral-500 hover:bg-ministral-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-ministral-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {submitting ? <Loader2 size={18} className="animate-spin"/> : <Plus size={18}/>}
                            Adicionar Regra
                        </button>
                    </form>
                </div>
            </div>

            {/* List Section */}
            <div className="lg:col-span-2 space-y-8">
                {/* Weekly Rules */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                        <Repeat size={16}/> Eventos Semanais (Padrão)
                    </h3>
                    
                    {loading ? (
                        <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-zinc-400"/></div>
                    ) : weeklyRules.length === 0 ? (
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 border-dashed rounded-xl p-8 text-center text-zinc-400 text-sm">
                            Nenhuma regra semanal cadastrada.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {weeklyRules.map(rule => (
                                <div key={rule.id} className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex justify-between items-center group hover:border-ministral-300 dark:hover:border-ministral-700 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-ministral-50 dark:bg-ministral-600/10 text-ministral-500 dark:text-ministral-100 rounded-xl flex flex-col items-center justify-center border border-ministral-100 dark:border-ministral-500/30">
                                            <span className="text-[10px] font-black uppercase">{weekdays[rule.weekday!].substring(0,3)}</span>
                                            <span className="text-xs font-bold">{rule.time.substring(0, 5)}</span>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-zinc-800 dark:text-white text-sm">{rule.title}</h4>
                                            <p className="text-xs text-zinc-500">Toda {weekdays[rule.weekday!]}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleDelete(rule.id, rule.title)}
                                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                        title="Remover regra"
                                    >
                                        <Trash2 size={18}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Single Rules */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                        <Calendar size={16}/> Eventos Especiais (Únicos)
                    </h3>
                    
                    {loading ? (
                        <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-zinc-400"/></div>
                    ) : singleRules.length === 0 ? (
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 border-dashed rounded-xl p-8 text-center text-zinc-400 text-sm">
                            Nenhum evento especial cadastrado.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {singleRules.map(rule => {
                                const dateObj = rule.date ? new Date(rule.date + 'T12:00:00') : new Date();
                                const isPast = new Date(rule.date || '') < new Date(new Date().toISOString().split('T')[0]);

                                return (
                                    <div key={rule.id} className={`bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex justify-between items-center group transition-colors ${isPast ? 'opacity-60 grayscale' : 'hover:border-ministral-300 dark:hover:border-ministral-700'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center border ${isPast ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 border-zinc-200' : 'bg-ministral-50 dark:bg-ministral-600/10 text-ministral-500 dark:text-ministral-100 border-ministral-100 dark:border-ministral-500/30'}`}>
                                                <span className="text-[10px] font-black uppercase">{dateObj.toLocaleDateString('pt-BR', {day: '2-digit'})}</span>
                                                <span className="text-[8px] font-bold uppercase">{dateObj.toLocaleDateString('pt-BR', {month: 'short'}).replace('.','')}</span>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-zinc-800 dark:text-white text-sm">{rule.title}</h4>
                                                <p className="text-xs text-zinc-500 flex items-center gap-1">
                                                    <Clock size={10}/> {rule.time.substring(0, 5)} • {dateObj.toLocaleDateString('pt-BR')}
                                                </p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleDelete(rule.id, rule.title)}
                                            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title="Remover regra"
                                        >
                                            <Trash2 size={18}/>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};
