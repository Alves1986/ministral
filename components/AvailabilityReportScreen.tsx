
import React, { useState, useMemo } from 'react';
import { AvailabilityMap, TeamMemberProfile, MemberMap } from '../types';
import { getMonthName, adjustMonth } from '../utils/dateUtils';
import { 
  CalendarSearch, 
  Search, 
  Filter, 
  CalendarX, 
  RefreshCw, 
  AlertOctagon, 
  Sun, 
  Moon, 
  Ban, 
  Check, 
  FileText,
  Clock,
  CheckCircle2,
  Users
} from 'lucide-react';

interface Props {
  availability: AvailabilityMap;
  availabilityNotes?: Record<string, string>;
  registeredMembers: TeamMemberProfile[];
  membersMap: MemberMap;
  currentMonth: string;
  onMonthChange: (newMonth: string) => void;
  availableRoles: string[];
  onRefresh?: () => Promise<void>;
}

export const AvailabilityReportScreen: React.FC<Props> = ({ 
  availability, 
  availabilityNotes = {},
  registeredMembers, 
  membersMap,
  currentMonth, 
  onMonthChange, 
  availableRoles,
  onRefresh
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("Todos");
  const [statusFilter, setStatusFilter] = useState<'all' | 'absent' | 'free' | 'blocked' | 'pending'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      await onRefresh();
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const normalizeString = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  const { items: reportData, stats } = useMemo(() => {
    const rawData = registeredMembers.map((profile) => {
      let functions: string[] = [];
      
      if (profile.ministry_functions && profile.ministry_functions.length > 0) {
        functions = Array.from(new Set(profile.ministry_functions)); 
      } else {
        Object.entries(membersMap).forEach(([role, members]) => {
          if ((members as string[]).some(m => normalizeString(m) === normalizeString(profile.name))) {
            functions.push(role);
          }
        });
        functions = Array.from(new Set(functions));
      }

      const dates = availability[profile.id] || [];
      const isBlocked = dates.some(d => d.startsWith(currentMonth) && (d.includes('BLK') || d.includes('BLOCKED')));
      const isFreeMonth = dates.some(d => d.startsWith(currentMonth) && (d.includes('FREE') || d.endsWith('-FREE')));

      const dayMap = new Map<number, Set<string>>();
      dates.forEach(d => {
        if (d.startsWith(currentMonth) && !d.includes('BLK') && !d.includes('FREE')) {
          const parts = d.split('_');
          const dayNum = parseInt(parts[0].split('-')[2]);
          if (!isNaN(dayNum) && dayNum > 0 && dayNum <= 31) {
            const type = parts.length > 1 ? parts[1] : 'FULL';
            if (!dayMap.has(dayNum)) {
              dayMap.set(dayNum, new Set());
            }
            dayMap.get(dayNum)!.add(type);
          }
        }
      });

      const monthDates = Array.from(dayMap.entries()).map(([day, types]) => {
        let type = 'FULL';
        if (types.has('FULL')) type = 'FULL';
        else if (types.has('M') && types.has('N')) type = 'FULL';
        else if (types.has('M')) type = 'M';
        else if (types.has('N')) type = 'N';
        else if (types.has('T')) type = 'T';
        return { day, type };
      }).sort((a, b) => a.day - b.day);

      const noteKey = `${profile.id}_${currentMonth}-00`;
      const note = availabilityNotes[noteKey] || "";

      // Membro só respondeu se bloqueou, apontou ausências ou marcou explicitamente "Mês Disponível"
      const hasAnswered = isBlocked || isFreeMonth || monthDates.length > 0;

      return {
        id: profile.id,
        name: profile.name,
        avatar_url: profile.avatar_url,
        ministry_functions: functions,
        days: monthDates,
        count: monthDates.length,
        isBlocked,
        isFreeMonth,
        hasAnswered,
        note
      };
    });

    const total = rawData.length;
    const absent = rawData.filter(i => i.count > 0 && !i.isBlocked).length;
    const free = rawData.filter(i => i.isFreeMonth && !i.isBlocked && i.count === 0).length;
    const blocked = rawData.filter(i => i.isBlocked).length;
    const pending = rawData.filter(i => !i.hasAnswered).length;

    const filtered = rawData
      .filter(item => {
        const matchesSearch = normalizeString(item.name).includes(normalizeString(searchTerm));
        const matchesRole = selectedRole === "Todos" || item.ministry_functions.includes(selectedRole);
        const matchesStatus = 
          statusFilter === 'all' ||
          (statusFilter === 'absent' && item.count > 0 && !item.isBlocked) ||
          (statusFilter === 'free' && item.isFreeMonth && !item.isBlocked && item.count === 0) ||
          (statusFilter === 'blocked' && item.isBlocked) ||
          (statusFilter === 'pending' && !item.hasAnswered);

        return matchesSearch && matchesRole && matchesStatus;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      items: filtered,
      stats: { total, absent, free, blocked, pending }
    };
  }, [registeredMembers, availability, availabilityNotes, currentMonth, membersMap, searchTerm, selectedRole, statusFilter]);

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
            <CalendarSearch className="text-ministral-500"/> Relatório de Indisponibilidade
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            Visualize as datas de ausência e indisponibilidade informadas pela equipe para o mês selecionado.
          </p>
        </div>
        
        <div className="flex items-center gap-2 self-end">
          <button 
            onClick={handleManualRefresh} 
            className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-400 transition-colors"
            title="Atualizar dados"
          >
            <RefreshCw size={20} className={isRefreshing ? "animate-spin" : ""} />
          </button>
          <div className="flex items-center gap-4 bg-white dark:bg-zinc-800 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
            <button onClick={() => onMonthChange(adjustMonth(currentMonth, -1))} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">←</button>
            <div className="text-center min-w-[120px]">
              <span className="block text-xs font-medium text-zinc-500 uppercase">Referência</span>
              <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-100 capitalize">{getMonthName(currentMonth)}</span>
            </div>
            <button onClick={() => onMonthChange(adjustMonth(currentMonth, 1))} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md">→</button>
          </div>
        </div>
      </div>

      {/* CARDS DE RESUMO RÁPIDO */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <button
          onClick={() => setStatusFilter('all')}
          className={`p-3 rounded-xl border text-left transition-all ${
            statusFilter === 'all'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-transparent shadow-sm'
              : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">Total</span>
          <span className="text-xl font-black">{stats.total}</span>
        </button>

        <button
          onClick={() => setStatusFilter('free')}
          className={`p-3 rounded-xl border text-left transition-all ${
            statusFilter === 'free'
              ? 'bg-emerald-600 text-white border-transparent shadow-sm'
              : 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 hover:border-emerald-400'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">Disponíveis</span>
          <span className="text-xl font-black">{stats.free}</span>
        </button>

        <button
          onClick={() => setStatusFilter('absent')}
          className={`p-3 rounded-xl border text-left transition-all ${
            statusFilter === 'absent'
              ? 'bg-red-600 text-white border-transparent shadow-sm'
              : 'bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-800/40 text-red-800 dark:text-red-300 hover:border-red-400'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">Com Ausências</span>
          <span className="text-xl font-black">{stats.absent}</span>
        </button>

        <button
          onClick={() => setStatusFilter('pending')}
          className={`p-3 rounded-xl border text-left transition-all ${
            statusFilter === 'pending'
              ? 'bg-amber-600 text-white border-transparent shadow-sm'
              : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 hover:border-amber-400'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">Não Apontou</span>
          <span className="text-xl font-black">{stats.pending}</span>
        </button>

        <button
          onClick={() => setStatusFilter('blocked')}
          className={`col-span-2 sm:col-span-1 p-3 rounded-xl border text-left transition-all ${
            statusFilter === 'blocked'
              ? 'bg-zinc-700 text-white border-transparent shadow-sm'
              : 'bg-zinc-100 dark:bg-zinc-800/70 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">Bloqueados</span>
          <span className="text-xl font-black">{stats.blocked}</span>
        </button>
      </div>

      {/* FILTROS E BUSCA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white dark:bg-zinc-800 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={17} />
          <input 
            type="text" 
            placeholder="Buscar por nome..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ministral-500" 
          />
        </div>

        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={17} />
          <select 
            value={selectedRole} 
            onChange={(e) => setSelectedRole(e.target.value)} 
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg pl-9 pr-8 py-2 text-sm outline-none focus:ring-2 focus:ring-ministral-500 appearance-none text-zinc-700 dark:text-zinc-200"
          >
            <option value="Todos">Todas as Funções</option>
            {availableRoles.map(role => <option key={role} value={role}>{role}</option>)}
          </select>
        </div>

        <div className="relative">
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value as any)} 
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ministral-500 text-zinc-700 dark:text-zinc-200 font-medium"
          >
            <option value="all">Todas as Situações</option>
            <option value="free">Disponíveis (Confirmados)</option>
            <option value="absent">Com Ausências Apontadas</option>
            <option value="pending">Ainda Não Apontou (Pendente)</option>
            <option value="blocked">Mês Bloqueado</option>
          </select>
        </div>
      </div>

      {/* LEGENDA DE CORES */}
      <div className="flex flex-wrap gap-2 md:gap-4 justify-center bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-[11px] font-medium">
        <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
          <div className="w-3 h-3 rounded bg-red-500 shadow-sm"></div> Indisponível (Dia Inteiro)
        </div>
        <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
          <div className="w-3 h-3 rounded bg-amber-500 shadow-sm"></div> Indisponível (Manhã)
        </div>
        <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
          <div className="w-3 h-3 rounded bg-indigo-600 shadow-sm"></div> Indisponível (Noite)
        </div>
        <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
          <div className="w-3 h-3 rounded bg-emerald-500 shadow-sm"></div> Disponível (Confirmado)
        </div>
        <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
          <div className="w-3 h-3 rounded bg-zinc-300 dark:bg-zinc-600 shadow-sm border border-zinc-400 dark:border-zinc-500"></div> Ainda não apontou
        </div>
      </div>

      {/* GRID DE MEMBROS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {reportData.length === 0 ? (
          <div className="col-span-full py-12 text-center text-zinc-400">
            <CalendarX size={44} className="mx-auto mb-2 opacity-30"/>
            <p className="text-sm font-medium">Nenhum membro encontrado com os filtros atuais.</p>
          </div>
        ) : (
          reportData.map((item) => (
            <div 
              key={item.id} 
              className={`bg-white dark:bg-zinc-800 rounded-xl border p-3 sm:p-3.5 shadow-sm hover:shadow-md transition-shadow flex flex-col ${
                item.isBlocked 
                  ? 'border-red-300 dark:border-red-900/60 bg-red-50/15' 
                  : !item.hasAnswered
                  ? 'border-zinc-200 dark:border-zinc-700/80 bg-zinc-50/40 dark:bg-zinc-800/40'
                  : 'border-zinc-200 dark:border-zinc-700'
              }`}
            >
              {/* TOPO DO CARD: MEMBRO E STATUS */}
              <div className="flex items-start justify-between mb-2.5">
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  {item.avatar_url ? (
                    <img src={item.avatar_url} alt={item.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-ministral-500 to-ministral-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                      {item.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs sm:text-sm text-zinc-800 dark:text-white leading-tight truncate">{item.name}</h3>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {item.ministry_functions.length > 0 ? item.ministry_functions.map(r => (
                        <span key={r} className="text-[9px] px-1 py-0.2 bg-zinc-100 dark:bg-zinc-700 rounded text-zinc-600 dark:text-zinc-300 font-medium">{r}</span>
                      )) : (
                        <span className="text-[9px] text-zinc-400 italic">Sem função</span>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* BADGE DE SITUAÇÃO */}
                <div className="shrink-0">
                  {item.isBlocked ? (
                    <div className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800 flex items-center gap-1">
                      <AlertOctagon size={10} /> BLOQUEADO
                    </div>
                  ) : item.count > 0 ? (
                    <div className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
                      {item.count} {item.count === 1 ? 'dia ausente' : 'dias ausentes'}
                    </div>
                  ) : item.isFreeMonth ? (
                    <div className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                      <Check size={10} /> Disponível
                    </div>
                  ) : (
                    <div className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-500 dark:bg-zinc-700/60 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 flex items-center gap-1">
                      <Clock size={10} /> Não informado
                    </div>
                  )}
                </div>
              </div>

              {/* CORPO DO CARD: AUSÊNCIAS OU MENSAGEM */}
              <div className="flex-1 pt-2.5 border-t border-zinc-100 dark:border-zinc-700/50">
                {item.isBlocked ? (
                  <div className="text-center py-2 text-red-500 text-xs italic flex items-center justify-center gap-1.5 font-medium">
                    <Ban size={13} /> Mês inteiro indisponível.
                  </div>
                ) : item.days.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {item.days.map(({day, type}) => {
                      let bgClass = "bg-red-500 text-white border border-red-600 shadow-sm";
                      let periodLabel = "Dia inteiro";

                      if (type === 'M') {
                        bgClass = "bg-amber-500 text-white border border-amber-600 shadow-sm";
                        periodLabel = "Manhã";
                      } else if (type === 'N') {
                        bgClass = "bg-indigo-600 text-white border border-indigo-700 shadow-sm";
                        periodLabel = "Noite";
                      }
                      
                      return (
                        <div 
                          key={`${day}_${type}`} 
                          className={`w-7 h-7 flex flex-col items-center justify-center rounded-md ${bgClass} transition-transform hover:scale-105`}
                          title={`Dia ${day}: Indisponível (${periodLabel})`}
                        >
                          <span className="text-[11px] font-bold leading-none">{day}</span>
                          {type === 'M' && <span className="text-[7px] leading-none opacity-90 mt-0.5"><Sun size={7} fill="currentColor"/></span>}
                          {type === 'N' && <span className="text-[7px] leading-none opacity-90 mt-0.5"><Moon size={7} fill="currentColor"/></span>}
                        </div>
                      );
                    })}
                  </div>
                ) : item.isFreeMonth ? (
                  <div className="text-center py-2 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-center gap-1.5 font-medium">
                    <Check size={14}/> Disponível para todas as escalas
                  </div>
                ) : (
                  <div className="text-center py-2 text-zinc-400 dark:text-zinc-500 text-xs flex items-center justify-center gap-1.5 font-normal italic">
                    Ainda não apontou as datas ausentes
                  </div>
                )}
              </div>

              {/* JUSTIFICATIVA / OBSERVAÇÃO */}
              {item.note && (
                <div className="mt-3 p-2.5 bg-red-50/40 dark:bg-red-950/20 rounded-lg border border-red-200/50 dark:border-red-900/30">
                  <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase mb-1 flex items-center gap-1">
                    <FileText size={11} /> Justificativa da Ausência:
                  </p>
                  <p className="text-xs text-zinc-700 dark:text-zinc-200 italic">"{item.note}"</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};