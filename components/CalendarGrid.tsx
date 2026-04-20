import React from 'react';
import { ScheduleMap, Role } from '../types';
import { getLocalDateISOString } from '../utils/dateUtils';

interface Props {
  currentMonth: string;
  events: { id: string; iso: string; dateDisplay: string; title: string }[];
  schedule: ScheduleMap;
  roles: Role[];
  onEventClick?: (event: { id: string; iso: string; title: string; dateDisplay: string }) => void;
}

export const CalendarGrid: React.FC<Props> = ({ currentMonth, events, schedule, roles, onEventClick }) => {
  const [year, month] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0 = Sun

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfWeek }, (_, i) => i);

  const getEventsForDay = (day: number) => {
    const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.iso.startsWith(dateStr)).sort((a, b) => a.iso.localeCompare(b.iso));
  };

  const getAssignedStats = (event: { id: string }) => {
      let assignedCount = 0;
      roles.forEach(r => {
          // CORREÇÃO CRÍTICA: Usar event.id (ruleId_date) para lookup no schedule
          // Chave: ruleId|date|role
          const key = `${event.id}|${r}`;
          if (schedule[key]) assignedCount++;
      });
      return { 
          count: assignedCount, 
          total: roles.length,
          isFull: roles.length > 0 && assignedCount >= roles.length,
          percent: roles.length > 0 ? (assignedCount / roles.length) * 100 : 0
      };
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl p-2 md:p-6 shadow-sm border border-zinc-200 dark:border-zinc-700">
      {/* Weekday Headers */}
      <div className="grid grid-cols-7 mb-2">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
          <div key={`${d}-${i}`} className="text-center text-[10px] md:text-xs font-bold text-zinc-400 uppercase tracking-wider py-1">{d}</div>
        ))}
      </div>
      
      {/* Grid */}
      <div className="grid grid-cols-7 gap-1 md:gap-3 auto-rows-fr">
        {blanks.map(i => <div key={`blank-${i}`} className="min-h-[80px] md:min-h-[120px]" />)}
        
        {days.map(day => {
          const dayEvents = getEventsForDay(day);
          const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
          const isToday = getLocalDateISOString() === dateStr;
          
          return (
             <div 
                key={day} 
                className={`relative min-h-[85px] md:min-h-[120px] bg-zinc-50 dark:bg-zinc-900/50 rounded-lg md:rounded-xl border p-1 md:p-2 flex flex-col transition-all
                    ${isToday 
                        ? 'border-ministral-300 dark:border-ministral-700 bg-ministral-50/50 dark:bg-ministral-900/10 ring-1 ring-ministral-400/30' 
                        : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600'
                    }
                `}
             >
                {/* Day Number */}
                <span className={`text-[10px] md:text-sm font-bold mb-1 block text-center md:text-left
                    ${isToday 
                        ? 'text-ministral-600 dark:text-ministral-400 bg-ministral-100 dark:bg-ministral-900/30 rounded-full w-5 h-5 md:w-6 md:h-6 flex items-center justify-center mx-auto md:mx-0' 
                        : 'text-zinc-500'
                    }`}
                >
                    {day}
                </span>

                {/* Events Container */}
                <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                  {dayEvents.map(evt => {
                    const stats = getAssignedStats(evt);
                    const time = evt.iso.split('T')[1].slice(0, 5);
                    const statusColor = stats.isFull 
                        ? 'bg-ministral-500 text-white border-ministral-600 dark:bg-ministral-600 dark:text-white dark:border-ministral-500 hover:dark:bg-ministral-500' 
                        : 'bg-ministral-50 text-ministral-800 border-ministral-100 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 hover:dark:bg-zinc-700';
                    
                    const statusDot = stats.isFull ? 'bg-white' : 'bg-ministral-500';

                    return (
                        <button 
                            key={evt.id} // UUID Stable Key (ruleId_date)
                            onClick={() => onEventClick && onEventClick(evt)}
                            className={`w-full text-left rounded md:rounded-lg p-1 md:px-2 md:py-1.5 border transition-all active:scale-95 group overflow-hidden ${statusColor}`}
                        >
                           {/* Mobile View: Tiny Dot */}
                           <div className="md:hidden flex flex-col items-center">
                                <div className={`w-1.5 h-1.5 rounded-full mb-0.5 ${statusDot}`}></div>
                                <span className="text-[8px] font-bold leading-none">{time}</span>
                           </div>

                           {/* Desktop View: Full Pill */}
                           <div className="hidden md:flex items-center gap-2">
                               <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot}`}></div>
                               <div className="min-w-0">
                                   <div className="text-[10px] font-bold truncate leading-none mb-0.5">{evt.title}</div>
                                   <div className="text-[9px] opacity-80 leading-none">{time}</div>
                               </div>
                           </div>
                        </button>
                    );
                  })}
                </div>
             </div>
          );
        })}
      </div>
    </div>
  );
};