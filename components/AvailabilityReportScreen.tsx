
import React, { useState, useMemo, useEffect } from 'react';
import { AvailabilityMap, TeamMemberProfile, MemberMap } from '../types';
import { getMonthName, adjustMonth } from '../utils/dateUtils';
import { CalendarSearch, Search, Filter, CalendarX, RefreshCw, AlertOctagon, Sun, Moon, Ban, Check, FileText } from 'lucide-react';

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
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
      if (onRefresh) {
          setIsRefreshing(true);
          await onRefresh();
          setTimeout(() => setIsRefreshing(false), 500);
      }
  };

  const normalizeString = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  const reportData = useMemo(() => {
    const data = registeredMembers.map((profile) => {
      // FIX CRÍTICO: Usa as funções reais do membro (vindas de ministry_members.functions).
      // Não filtra mais contra 'availableRoles' para evitar "Sem função" se a config estiver desatualizada.
      let functions: string[] = [];
      
      if (profile.ministry_functions && profile.ministry_functions.length > 0) {
        functions = Array.from(new Set(profile.ministry_functions)); 
      } else {
        // Fallback apenas se o array functions vier vazio do banco
        Object.entries(membersMap).forEach(([role, members]) => {
          if ((members as string[]).some(m => normalizeString(m) === normalizeString(profile.name))) {
              functions.push(role);
          }
        });
        functions = Array.from(new Set(functions));
      }

      const dates = availability[profile.id] || [];
      const isBlocked = dates.some(d => d.startsWith(currentMonth) && (d.includes('BLK') || d.includes('BLOCKED')));

      const dayMap = new Map<number, Set<string>>();
      dates.forEach(d => {
         if (d.startsWith(currentMonth) && !d.includes('BLK')) {
             const parts = d.split('_');
             const dayNum = parseInt(parts[0].split('-')[2]); // Ensure we split from the date part
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

      // Get general note for this member and month
      const noteKey = `${profile.id}_${currentMonth}-00`;
      const note = availabilityNotes[noteKey] || "";

      return {
        id: profile.id,
        name: profile.name,
        avatar_url: profile.avatar_url,
        ministry_functions: functions,
        days: monthDates,
        count: monthDates.length,
        isBlocked,
        note
      };
    });

    return data
      .filter(item => {
        const matchesSearch = normalizeString(item.name).includes(normalizeString(searchTerm));
        const matchesRole = selectedRole === "Todos" || item.ministry_functions.includes(selectedRole);
        return matchesSearch && matchesRole;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

  }, [registeredMembers, availability, availabilityNotes, currentMonth, membersMap, searchTerm, selectedRole]);

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
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
            <button onClick={handleManualRefresh} className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-400 transition-colors">
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

      <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
         <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input type="text" placeholder="Buscar por nome..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ministral-500" />
         </div>
         <div className="relative min-w-[200px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg pl-10 pr-8 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ministral-500 appearance-none text-zinc-700 dark:text-zinc-200">
               <option value="Todos">Todas as Funções</option>
               {availableRoles.map(role => <option key={role} value={role}>{role}</option>)}
            </select>
         </div>
      </div>

      {/* Legenda de Cores igual à aba de ausência */}
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
             <div className="w-3 h-3 rounded bg-zinc-300 dark:bg-zinc-700 shadow-sm border border-zinc-400 dark:border-zinc-600"></div> Disponível
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {reportData.length === 0 ? (
          <div className="col-span-full py-10 text-center text-zinc-400">
             <CalendarX size={40} className="mx-auto mb-2 opacity-20"/>
             <p className="text-xs sm:text-sm">Nenhum membro encontrado.</p>
          </div>
        ) : (
          reportData.map((item) => (
            <div key={item.id} className={`bg-white dark:bg-zinc-800 rounded-xl border p-3 sm:p-3.5 shadow-sm hover:shadow-md transition-shadow flex flex-col ${item.isBlocked ? 'border-red-300 dark:border-red-900/60 bg-red-50/15' : 'border-zinc-200 dark:border-zinc-700'}`}>
               <div className="flex items-start justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                     {item.avatar_url ? (
                        <img src={item.avatar_url} alt={item.name} className="w-8 h-8 rounded-full object-cover" />
                     ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-ministral-500 to-ministral-600 flex items-center justify-center text-white font-bold text-xs">
                           {item.name.charAt(0).toUpperCase()}
                        </div>
                     )}
                     <div>
                        <h3 className="font-bold text-xs sm:text-sm text-zinc-800 dark:text-white leading-tight">{item.name}</h3>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                           {item.ministry_functions.length > 0 ? item.ministry_functions.map(r => (
                              <span key={r} className="text-[9px] px-1 py-0.2 bg-zinc-100 dark:bg-zinc-700 rounded text-zinc-600 dark:text-zinc-300 font-medium">{r}</span>
                           )) : (
                             <span className="text-[9px] text-zinc-400 italic">Sem função</span>
                           )}
                        </div>
                     </div>
                  </div>
                  
                  {item.isBlocked ? (
                      <div className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800 flex items-center gap-1">
                          <AlertOctagon size={10} /> BLOQUEADO
                      </div>
                  ) : (
                      <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          item.count > 0 
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800' 
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                      }`}>
                         {item.count > 0 ? `${item.count} ${item.count === 1 ? 'dia ausente' : 'dias ausentes'}` : 'Disponível'}
                      </div>
                  )}
               </div>

               <div className="flex-1 pt-2.5 border-t border-zinc-100 dark:border-zinc-700/50">
                  {item.isBlocked ? (
                      <div className="text-center py-1.5 text-red-500 text-[11px] italic flex items-center justify-center gap-1.5 font-medium">
                          Mês inteiro indisponível.
                      </div>
                  ) : item.days.length > 0 ? (
                     <div className="flex flex-wrap gap-1">
                        {item.days.map(({day, type}) => {
                           // Cores sincronizadas com a aba de ausência (AvailabilityScreen)
                           let bgClass = "bg-red-500 text-white border border-red-600 shadow-sm"; // Dia inteiro indisponível
                           let periodLabel = "Dia inteiro";

                           if (type === 'M') {
                               bgClass = "bg-amber-500 text-white border border-amber-600 shadow-sm"; // Manhã indisponível
                               periodLabel = "Manhã";
                           } else if (type === 'N') {
                               bgClass = "bg-indigo-600 text-white border border-indigo-700 shadow-sm"; // Noite indisponível
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
                  ) : (
                     <div className="text-center py-2 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-center gap-2 font-medium">
                        <Check size={14}/> Disponível para todas as escalas
                     </div>
                  )}
               </div>

               {/* Justificativa / Observação */}
               {item.note && (
                   <div className="mt-4 p-3 bg-red-50/40 dark:bg-red-950/20 rounded-lg border border-red-200/50 dark:border-red-900/30">
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