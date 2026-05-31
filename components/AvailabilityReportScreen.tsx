
import React, { useState, useMemo, useEffect } from 'react';
import { AvailabilityMap, TeamMemberProfile, MemberMap } from '../types';
import { getMonthName, adjustMonth } from '../utils/dateUtils';
import { CalendarSearch, Search, Filter, CalendarX, RefreshCw, AlertOctagon, Sun, Moon } from 'lucide-react';

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
            <CalendarSearch className="text-ministral-500"/> Relatório de Disponibilidade
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            Visualize os apontamentos da equipe para o mês selecionado.
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportData.length === 0 ? (
          <div className="col-span-full py-12 text-center text-zinc-400">
             <CalendarX size={48} className="mx-auto mb-3 opacity-20"/>
             <p>Nenhum membro encontrado.</p>
          </div>
        ) : (
          reportData.map((item) => (
            <div key={item.id} className={`bg-white dark:bg-zinc-800 rounded-xl border p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col ${item.isBlocked ? 'border-red-200 dark:border-red-900/50 bg-red-50/10' : 'border-zinc-200 dark:border-zinc-700'}`}>
               <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                     {item.avatar_url ? (
                        <img src={item.avatar_url} alt={item.name} className="w-10 h-10 rounded-full object-cover" />
                     ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-ministral-500 to-ministral-600 flex items-center justify-center text-white font-bold text-sm">
                           {item.name.charAt(0).toUpperCase()}
                        </div>
                     )}
                     <div>
                        <h3 className="font-bold text-zinc-800 dark:text-white leading-tight">{item.name}</h3>
                        <div className="flex flex-wrap gap-1 mt-1">
                           {item.ministry_functions.length > 0 ? item.ministry_functions.map(r => (
                              <span key={r} className="text-[10px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-700 rounded text-zinc-600 dark:text-zinc-300 font-medium">{r}</span>
                           )) : (
                             <span className="text-[10px] text-zinc-400 italic">Sem função</span>
                           )}
                        </div>
                     </div>
                  </div>
                  
                  {item.isBlocked ? (
                      <div className="px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800 flex items-center gap-1">
                          <AlertOctagon size={12} /> BLOQUEADO
                      </div>
                  ) : (
                      <div className={`px-2 py-1 rounded text-xs font-bold ${item.count > 0 ? 'bg-ministral-50 text-ministral-500 dark:bg-ministral-600/10 dark:text-ministral-100' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'}`}>
                         {item.count > 0 ? `${item.count} dias` : 'Pendente'}
                      </div>
                  )}
               </div>

               <div className="flex-1 pt-4 border-t border-zinc-100 dark:border-zinc-700/50">
                  {item.isBlocked ? (
                      <div className="text-center py-2 text-red-400 text-xs italic flex items-center justify-center gap-2 font-medium">
                          Membro solicitou não ser escalado este mês.
                      </div>
                  ) : item.days.length > 0 ? (
                     <div className="flex flex-wrap gap-1.5">
                        {item.days.map(({day, type}) => {
                           const dateStr = `${currentMonth}-${day.toString().padStart(2, '0')}`;
                           const isSunday = new Date(dateStr + 'T12:00:00').getDay() === 0;
                           
                           let bgClass = "bg-secondary text-white"; // Default Green para FULL e outros dias
                           
                           if (isSunday) {
                               if (type === 'M') {
                                   bgClass = "bg-ministral-gold text-white"; 
                               } else if (type === 'N') {
                                   bgClass = "bg-ministral-600 text-white"; // Azul escuro (Secondary Blue)
                               }
                           }
                           
                           return (
                              <div key={`${day}_${type}`} className={`w-8 h-8 flex flex-col items-center justify-center rounded-lg shadow-sm ${bgClass}`}>
                                 <span className="text-xs font-bold">{day}</span>
                                 {type === 'M' && <span className="text-[8px] leading-none opacity-80"><Sun size={8} fill="currentColor"/></span>}
                                 {type === 'N' && <span className="text-[8px] leading-none opacity-80"><Moon size={8} fill="currentColor"/></span>}
                              </div>
                           )
                        })}
                     </div>
                  ) : (
                     <div className="text-center py-2 text-zinc-400 text-xs italic flex items-center justify-center gap-2">
                        <CalendarX size={14}/> Aguardando resposta
                     </div>
                  )}
               </div>

               {/* General Observation */}
               {item.note && (
                   <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-100 dark:border-zinc-800">
                       <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Observação:</p>
                       <p className="text-xs text-zinc-600 dark:text-zinc-300 italic">"{item.note}"</p>
                   </div>
               )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};