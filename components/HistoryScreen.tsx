
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Calendar, CheckCircle2, Clock, Filter, Search, ChevronRight, History as HistoryIcon, CalendarDays, Briefcase } from 'lucide-react';
import { fetchMemberScheduleHistory } from '../services/supabase/misc';
import { useToast } from './Toast';

interface Props {
  user: User;
}

export const HistoryScreen: React.FC<Props> = ({ user }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const { addToast } = useToast();

  useEffect(() => {
    const loadHistory = async () => {
      if (!user.id || !user.ministryId || !user.organizationId) return;
      setLoading(true);
      try {
        const data = await fetchMemberScheduleHistory(user.id, user.ministryId, user.organizationId);
        setHistory(data);
      } catch (e) {
        console.error("Erro ao carregar histórico:", e);
        addToast("Erro ao carregar histórico de escalas", "error");
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, [user.id, user.ministryId, user.organizationId]);

  const availableMonths = React.useMemo(() => {
    const months = new Set<string>();
    history.forEach(item => {
      if (item.event_date) {
        months.add(item.event_date.substring(0, 7)); // YYYY-MM
      }
    });
    return Array.from(months).sort().reverse();
  }, [history]);

  const filteredHistory = history.filter(item => {
    const matchesFilter = 
      filter === 'all' || 
      (filter === 'confirmed' && item.confirmed) || 
      (filter === 'pending' && !item.confirmed);
    
    const matchesSearch = 
      (item.event_rules?.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.role || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesMonth = selectedMonth === 'all' || (item.event_date && item.event_date.startsWith(selectedMonth));

    return matchesFilter && matchesSearch && matchesMonth;
  });

  const monthlyHistory = selectedMonth === 'all' 
    ? history 
    : history.filter(item => item.event_date && item.event_date.startsWith(selectedMonth));

  const stats = {
    total: monthlyHistory.length,
    confirmed: monthlyHistory.filter(h => h.confirmed).length,
    pending: monthlyHistory.filter(h => !h.confirmed).length
  };

  return (
    <div className="animate-fade-in max-w-5xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-black text-zinc-900 dark:text-white flex items-center gap-3 tracking-tight uppercase">
            <HistoryIcon className="text-ministral-500" size={32} /> Meu Histórico
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1 font-medium">Veja todas as suas participações e escalas passadas.</p>
        </div>

        <div className="flex items-center gap-3 bg-white dark:bg-zinc-800 p-2 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
          <div className="flex flex-col items-center px-4 border-r border-zinc-100 dark:border-zinc-700">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Total</span>
            <span className="text-lg font-black text-zinc-900 dark:text-white">{stats.total}</span>
          </div>
          <div className="flex flex-col items-center px-4 border-r border-zinc-100 dark:border-zinc-700">
            <span className="text-[10px] font-black text-ministral-500 uppercase tracking-widest">Confirmadas</span>
            <span className="text-lg font-black text-ministral-600 dark:text-ministral-400">{stats.confirmed}</span>
          </div>
          <div className="flex flex-col items-center px-4">
            <span className="text-[10px] font-black text-ministral-gold uppercase tracking-widest">Pendentes</span>
            <span className="text-lg font-black text-ministral-gold dark:text-ministral-gold/80">{stats.pending}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-zinc-800 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <Filter size={14}/> Filtros
            </h3>
            
            <div className="space-y-2">
              <button 
                onClick={() => setFilter('all')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all ${filter === 'all' ? 'bg-ministral-500 text-white shadow-lg shadow-ministral-500/20' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
              >
                <span>Todas</span>
                <ChevronRight size={14} className={filter === 'all' ? 'opacity-100' : 'opacity-0'} />
              </button>
              <button 
                onClick={() => setFilter('confirmed')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all ${filter === 'confirmed' ? 'bg-ministral-500 text-white shadow-lg shadow-ministral-500/20' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
              >
                <span>Confirmadas</span>
                <ChevronRight size={14} className={filter === 'confirmed' ? 'opacity-100' : 'opacity-0'} />
              </button>
              <button 
                onClick={() => setFilter('pending')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all ${filter === 'pending' ? 'bg-ministral-gold text-white shadow-lg shadow-ministral-gold/20' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900'}`}
              >
                <span>Pendentes</span>
                <ChevronRight size={14} className={filter === 'pending' ? 'opacity-100' : 'opacity-0'} />
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-700">
               <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <CalendarDays size={14}/> Mês
               </h3>
               <div className="relative">
                 <select 
                   value={selectedMonth} 
                   onChange={e => setSelectedMonth(e.target.value)}
                   className="w-full pl-4 pr-10 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-ministral-500 transition-all appearance-none cursor-pointer"
                 >
                   <option value="all">Todos os meses</option>
                   {availableMonths.map(month => {
                      const [year, m] = month.split('-');
                      const date = new Date(Number(year), Number(m) - 1, 1);
                      const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                      return <option key={month} value={month}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>
                   })}
                 </select>
                 <ChevronRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none rotate-90" />
               </div>
            </div>

            <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-700">
              <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <Search size={14}/> Busca
              </h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                <input 
                  type="text"
                  placeholder="Buscar evento ou função..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-ministral-500 transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-800 rounded-3xl border border-zinc-200 dark:border-zinc-700 border-dashed">
              <div className="w-10 h-10 border-4 border-ministral-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Carregando seu histórico...</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-800 rounded-3xl border border-zinc-200 dark:border-zinc-700 border-dashed text-center px-6">
              <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-2xl flex items-center justify-center text-zinc-400 mb-4">
                <HistoryIcon size={32} />
              </div>
              <h3 className="text-lg font-bold text-zinc-800 dark:text-white mb-1">Nenhuma escala encontrada</h3>
              <p className="text-zinc-500 text-sm max-w-xs">Não encontramos registros que correspondam aos seus filtros ou busca.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredHistory.map((item, idx) => {
                const date = new Date(item.event_date + 'T12:00:00');
                const day = date.getDate();
                const month = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
                const year = date.getFullYear();

                return (
                  <div 
                    key={idx} 
                    className="group bg-white dark:bg-zinc-800 p-4 rounded-3xl border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-xl hover:shadow-zinc-200/50 dark:hover:shadow-black/20 transition-all duration-300 flex flex-col sm:flex-row items-center gap-6"
                  >
                    <div className="flex flex-col items-center justify-center w-16 h-16 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-700 shrink-0 group-hover:border-ministral-500/30 transition-colors">
                      <span className="text-[10px] font-black text-ministral-500 dark:text-ministral-400 leading-none">{month}</span>
                      <span className="text-2xl font-black text-zinc-900 dark:text-white leading-none mt-1">{day}</span>
                      <span className="text-[8px] font-bold text-zinc-400 leading-none mt-1">{year}</span>
                    </div>

                    <div className="flex-1 text-center sm:text-left min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                        <h4 className="text-base font-black text-zinc-900 dark:text-white truncate uppercase tracking-tight">
                          {item.event_rules?.title || 'Evento Especial'}
                        </h4>
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest self-center sm:self-auto ${
                          item.confirmed 
                            ? 'bg-ministral-50 dark:bg-ministral-600/10 text-ministral-500 dark:text-ministral-100' 
                            : 'bg-ministral-gold/10 dark:bg-ministral-gold/20 text-ministral-gold dark:text-ministral-gold'
                        }`}>
                          {item.confirmed ? <CheckCircle2 size={10}/> : <Clock size={10}/>}
                          {item.confirmed ? 'Confirmada' : 'Pendente'}
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap justify-center sm:justify-start gap-4">
                        <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                          <Briefcase size={14} className="text-ministral-500" />
                          <span className="text-xs font-bold uppercase tracking-tight">{item.role}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                          <CalendarDays size={14} className="text-zinc-400" />
                          <span className="text-xs font-medium">{date.toLocaleDateString('pt-BR', { weekday: 'long' })}</span>
                        </div>
                        {item.event_rules?.time && (
                          <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                            <Clock size={14} className="text-zinc-400" />
                            <span className="text-xs font-medium">{item.event_rules.time.slice(0, 5)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 hidden sm:block">
                       <div className="w-10 h-10 rounded-full bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-zinc-300 group-hover:text-ministral-500 transition-colors">
                          <ChevronRight size={20} />
                       </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
