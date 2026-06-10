
import React, { useMemo, useState } from 'react';
import { 
  FileText, TrendingUp, AlertCircle, CheckCircle2, 
  ArrowUpRight, ArrowDownRight, User, Download, 
  Calendar, RefreshCcw, Filter, Search, Award
} from 'lucide-react';
import { ScheduleMap, AttendanceMap, SwapRequest, TeamMemberProfile } from '../types';
import { getMonthName, adjustMonth } from '../utils/dateUtils';

interface Props {
  currentMonth: string;
  onMonthChange: (newMonth: string) => void;
  schedule: ScheduleMap;
  attendance: AttendanceMap;
  swapRequests: SwapRequest[];
  members: TeamMemberProfile[];
  events: { id?: string; iso: string }[];
}

export const MonthlyReportScreen: React.FC<Props> = ({ 
  currentMonth, onMonthChange, schedule, attendance, 
  swapRequests, members, events 
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<'name' | 'rate' | 'scheduled'>('name');

  // Cálculo das Métricas
  const reportData = useMemo(() => {
    // 1. Filtrar eventos do mês
    const monthEventIds = events
      .filter(e => e.iso.startsWith(currentMonth))
      .map(e => e.id);

    // 2. Processar dados por membro
    const data = members.map(member => {
      let scheduledCount = 0;
      let confirmedCount = 0;
      
      // Analisar Escala e Presença
      Object.entries(schedule).forEach(([key, assignedName]) => {
        const isThisMonth = monthEventIds.some(id => id && key.startsWith(`${id}|`));

        if (isThisMonth && assignedName === member.name) {
          scheduledCount++;
          if (attendance[key]) {
            confirmedCount++;
          }
        }
      });

      // Analisar Trocas (Engajamento)
      const swapsRequested = swapRequests.filter(req => 
        req.requesterName === member.name && 
        req.eventIso.startsWith(currentMonth)
      ).length;

      const swapsCovered = swapRequests.filter(req => 
        req.takenByName === member.name && 
        req.eventIso.startsWith(currentMonth) &&
        req.status === 'completed'
      ).length;

      const attendanceRate = scheduledCount > 0 
        ? Math.round((confirmedCount / scheduledCount) * 100) 
        : 0;

      let engagementScore = attendanceRate;
      engagementScore += (swapsCovered * 5);
      engagementScore -= (swapsRequested * 5);
      engagementScore = Math.min(Math.max(engagementScore, 0), 100);

      return {
        id: member.id,
        name: member.name,
        avatar_url: member.avatar_url,
        scheduled: scheduledCount,
        confirmed: confirmedCount,
        absent: scheduledCount - confirmedCount,
        rate: attendanceRate,
        swapsRequested,
        swapsCovered,
        score: engagementScore
      };
    });

    // 3. Filtragem e Ordenação
    return data
      .filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'rate') return b.rate - a.rate;
        if (sortBy === 'scheduled') return b.scheduled - a.scheduled;
        return a.name.localeCompare(b.name);
      });

  }, [schedule, attendance, swapRequests, members, currentMonth, events, searchTerm, sortBy]);

  // Totais Gerais
  const totalScales = reportData.reduce((acc, curr) => acc + curr.scheduled, 0);
  const totalConfirmed = reportData.reduce((acc, curr) => acc + curr.confirmed, 0);
  const totalRate = totalScales > 0 ? Math.round((totalConfirmed / totalScales) * 100) : 0;
  const activeMembers = reportData.filter(d => d.scheduled > 0).length;

  const handlePrevMonth = () => onMonthChange(adjustMonth(currentMonth, -1));
  const handleNextMonth = () => onMonthChange(adjustMonth(currentMonth, 1));

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto pb-28">
      
      {/* Header e Controles */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
            <FileText className="text-ministral-500"/> Relatório Mensal
          </h2>
          <p className="text-zinc-500 text-sm mt-1">
            Análise de rendimento e engajamento da equipe.
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <button onClick={() => window.print()} className="hidden md:flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-lg text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors" title="Exportar PDF">
                <Download size={16}/> PDF
            </button>
            <div className="flex items-center gap-4 bg-white dark:bg-zinc-800 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm w-full md:w-auto justify-center">
                <button onClick={handlePrevMonth} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md text-zinc-500">←</button>
                <div className="text-center min-w-[100px]">
                    <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Referência</span>
                    <span className="block text-sm font-bold text-zinc-800 dark:text-zinc-100">{getMonthName(currentMonth)}</span>
                </div>
                <button onClick={handleNextMonth} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md text-zinc-500">→</button>
            </div>
        </div>
      </div>

      {/* Cards de Resumo - Grid 2x2 no Mobile */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                  <div className="p-1.5 md:p-2 bg-ministral-50 dark:bg-ministral-600/20 text-ministral-600 rounded-lg"><Calendar size={18}/></div>
              </div>
              <div>
                  <span className="text-xl md:text-2xl font-bold text-zinc-800 dark:text-white">{totalScales}</span>
                  <p className="text-[10px] md:text-xs text-zinc-500 font-medium">Escalas Totais</p>
              </div>
          </div>

          <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                  <div className={`p-1.5 md:p-2 rounded-lg ${totalRate >= 80 ? 'bg-ministral-50 dark:bg-ministral-600/20 text-ministral-600' : 'bg-ministral-gold/10 dark:bg-ministral-gold/20 text-ministral-gold'}`}>
                      <TrendingUp size={18}/>
                  </div>
              </div>
              <div>
                  <div className="flex items-end gap-2">
                      <span className={`text-xl md:text-2xl font-bold ${totalRate >= 80 ? 'text-ministral-600 dark:text-ministral-400' : 'text-ministral-gold dark:text-ministral-gold'}`}>{totalRate}%</span>
                  </div>
                  <p className="text-[10px] md:text-xs text-zinc-500 font-medium">Taxa de Presença</p>
              </div>
          </div>

          <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                  <div className="p-1.5 md:p-2 bg-ministral-50 dark:bg-ministral-600/20 text-ministral-600 rounded-lg"><User size={18}/></div>
              </div>
              <div>
                  <span className="text-xl md:text-2xl font-bold text-zinc-800 dark:text-white">{activeMembers}</span>
                  <p className="text-[10px] md:text-xs text-zinc-500 font-medium">Membros Ativos</p>
              </div>
          </div>

          <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                  <div className="p-1.5 md:p-2 bg-ministral-gold/10 dark:bg-ministral-gold/20 text-ministral-gold rounded-lg"><RefreshCcw size={18}/></div>
              </div>
              <div>
                  <span className="text-xl md:text-2xl font-bold text-zinc-800 dark:text-white">{swapRequests.filter(r => r.eventIso.startsWith(currentMonth)).length}</span>
                  <p className="text-[10px] md:text-xs text-zinc-500 font-medium">Trocas Solicitadas</p>
              </div>
          </div>
      </div>

      {/* Toolbar - Search & Sort */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"/>
              <input 
                  type="text" 
                  placeholder="Filtrar membro..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ministral-500 text-zinc-800 dark:text-zinc-200"
              />
          </div>
          <div className="flex items-center gap-2">
              <div className="relative w-full md:w-auto">
                  <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"/>
                  <select 
                      value={sortBy} 
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="w-full md:w-auto bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg pl-8 pr-8 py-2 text-xs font-bold outline-none cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 appearance-none"
                  >
                      <option value="name">Nome (A-Z)</option>
                      <option value="rate">Melhor Rendimento</option>
                      <option value="scheduled">Mais Escalados</option>
                  </select>
              </div>
          </div>
      </div>

      {/* --- DESKTOP VIEW: Table --- */}
      <div className="hidden md:block bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-sm text-left">
                  <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-700">
                      <tr>
                          <th className="px-6 py-4 font-bold">Membro</th>
                          <th className="px-6 py-4 font-bold text-center">Escalas</th>
                          <th className="px-6 py-4 font-bold text-center">Presença</th>
                          <th className="px-6 py-4 font-bold text-center">Trocas</th>
                          <th className="px-6 py-4 font-bold text-right">Rendimento</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
                      {reportData.map((row) => (
                          <tr key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors group">
                              <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                      {row.avatar_url ? (
                                          <img src={row.avatar_url} className="w-9 h-9 rounded-full object-cover border border-zinc-200 dark:border-zinc-700" alt="" />
                                      ) : (
                                          <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-500">
                                              {row.name.charAt(0)}
                                          </div>
                                      )}
                                      <div>
                                          <p className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">{row.name}</p>
                                          {row.scheduled === 0 && <span className="text-[10px] text-zinc-400">Não escalado</span>}
                                      </div>
                                  </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                  <span className="font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900 px-3 py-1 rounded-full text-xs">{row.scheduled}</span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                      <span className="text-green-600 dark:text-green-400 font-bold flex items-center gap-1 text-xs bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full border border-green-100 dark:border-green-800/30" title="Confirmado">
                                          <CheckCircle2 size={12}/> {row.confirmed}
                                      </span>
                                      {row.absent > 0 && (
                                          <span className="text-red-500 font-bold flex items-center gap-1 text-xs bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full border border-red-100 dark:border-red-800/30" title="Não confirmado">
                                              <AlertCircle size={12}/> {row.absent}
                                          </span>
                                      )}
                                  </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                  <div className="flex flex-col items-center gap-1 text-xs">
                                      {row.swapsRequested > 0 ? (
                                          <span className="text-amber-600 flex items-center gap-1"><ArrowUpRight size={12}/> Pediu: {row.swapsRequested}</span>
                                      ) : <span className="text-zinc-300">-</span>}
                                      
                                      {row.swapsCovered > 0 && (
                                          <span className="text-ministral-500 flex items-center gap-1"><ArrowDownRight size={12}/> Cobriu: {row.swapsCovered}</span>
                                      )}
                                  </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                  <div className="flex flex-col items-end gap-1">
                                      {row.scheduled > 0 ? (
                                          <>
                                              <div className="flex items-center gap-2">
                                                  <span className={`text-sm font-black ${row.rate >= 90 ? 'text-ministral-500' : row.rate >= 70 ? 'text-ministral-600' : 'text-red-500'}`}>
                                                      {row.rate}%
                                                  </span>
                                                  <div className="w-16 h-1.5 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                                                      <div 
                                                          className={`h-full rounded-full ${row.rate >= 90 ? 'bg-ministral-500' : row.rate >= 70 ? 'bg-ministral-600' : 'bg-red-500'}`} 
                                                          style={{ width: `${row.rate}%` }}
                                                      ></div>
                                                  </div>
                                              </div>
                                              <span className="text-[10px] text-zinc-400">Score: {row.score}</span>
                                          </>
                                      ) : (
                                          <span className="text-xs text-zinc-300 dark:text-zinc-600 font-medium">N/A</span>
                                      )}
                                  </div>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>

      {/* --- MOBILE VIEW: Cards --- */}
      <div className="md:hidden space-y-3">
          {reportData.map((row) => (
              <div key={row.id} className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex flex-col gap-3">
                  {/* Card Header: Avatar & Main Stat */}
                  <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                          {row.avatar_url ? (
                              <img src={row.avatar_url} className="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-700" alt="" />
                          ) : (
                              <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-zinc-500 font-bold">
                                  {row.name.charAt(0)}
                              </div>
                          )}
                          <div>
                              <p className="font-bold text-zinc-800 dark:text-zinc-100 text-sm">{row.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] bg-zinc-100 dark:bg-zinc-700 px-2 py-0.5 rounded text-zinc-500 dark:text-zinc-400 font-bold">Score: {row.score}</span>
                                  {row.rate >= 90 && <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-500 px-1.5 py-0.5 rounded flex items-center gap-1 font-bold"><Award size={10}/> Top</span>}
                              </div>
                          </div>
                      </div>
                      
                      {row.scheduled > 0 ? (
                          <div className="text-right">
                              <span className={`text-xl font-black ${row.rate >= 90 ? 'text-ministral-500' : row.rate >= 70 ? 'text-ministral-600' : 'text-red-500'}`}>
                                  {row.rate}%
                              </span>
                              <p className="text-[10px] text-zinc-400 uppercase font-bold">Rendimento</p>
                          </div>
                      ) : (
                          <span className="text-xs text-zinc-400 italic">Sem escalas</span>
                      )}
                  </div>

                  <hr className="border-zinc-100 dark:border-zinc-700/50"/>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded-lg">
                          <span className="block text-[10px] text-zinc-400 uppercase font-bold mb-1">Escalas</span>
                          <span className="block text-sm font-bold text-zinc-800 dark:text-white">{row.scheduled}</span>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/10 p-2 rounded-lg border border-green-100 dark:border-green-900/20">
                          <span className="block text-[10px] text-green-600 dark:text-green-400 uppercase font-bold mb-1">Presença</span>
                          <span className="block text-sm font-bold text-green-700 dark:text-green-300">{row.confirmed}</span>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/10 p-2 rounded-lg border border-red-100 dark:border-red-900/20">
                          <span className="block text-[10px] text-red-600 dark:text-red-400 uppercase font-bold mb-1">Faltas</span>
                          <span className="block text-sm font-bold text-red-700 dark:text-red-300">{row.absent}</span>
                      </div>
                  </div>

                  {/* Swaps Info (if any) */}
                  {(row.swapsRequested > 0 || row.swapsCovered > 0) && (
                      <div className="flex gap-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-900 p-2 rounded-lg justify-center">
                          {row.swapsRequested > 0 && <span className="text-amber-600 flex items-center gap-1"><ArrowUpRight size={12}/> Pediu: {row.swapsRequested}</span>}
                          {row.swapsRequested > 0 && row.swapsCovered > 0 && <span className="text-zinc-300">|</span>}
                          {row.swapsCovered > 0 && <span className="text-ministral-600 flex items-center gap-1"><ArrowDownRight size={12}/> Cobriu: {row.swapsCovered}</span>}
                      </div>
                  )}
              </div>
          ))}
      </div>

      {reportData.length === 0 && (
          <div className="p-12 text-center text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700">
              <Search className="mx-auto mb-3 opacity-20" size={48}/>
              <p>Nenhum dado encontrado para o período selecionado.</p>
          </div>
      )}
    </div>
  );
};