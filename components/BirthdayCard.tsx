

import React from 'react';
import { Gift, CalendarHeart } from 'lucide-react';
import { TeamMemberProfile } from '../types';

interface Props {
  members: TeamMemberProfile[];
  currentMonthIso: string; // YYYY-MM format
}

export const BirthdayCard: React.FC<Props> = ({ members, currentMonthIso }) => {
  const currentMonthIndex = parseInt(currentMonthIso.split('-')[1], 10) - 1; // 0-based
  
  // Get month name
  const monthName = new Date(parseInt(currentMonthIso.split('-')[0]), currentMonthIndex, 1)
    .toLocaleDateString('pt-BR', { month: 'long' });

  // Filter birthdays in this month
  const birthdays = members.filter(m => {
    if (!m.birthDate) return false;
    // birthDate is YYYY-MM-DD
    const [, month, ] = m.birthDate.split('-').map(Number);
    return (month - 1) === currentMonthIndex;
  }).sort((a, b) => {
    const dayA = parseInt(a.birthDate!.split('-')[2], 10);
    const dayB = parseInt(b.birthDate!.split('-')[2], 10);
    return dayA - dayB;
  });

  if (birthdays.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl overflow-hidden shadow-sm border border-ministral-200 dark:border-ministral-900/50 bg-white dark:bg-zinc-800 animate-slide-up">
       <div className="bg-gradient-to-r from-ministral-500 to-ministral-600 p-2.5 sm:p-3 text-white flex items-center gap-2.5">
          <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
             <Gift size={16} className="text-white" />
          </div>
          <div>
             <h3 className="font-bold text-xs sm:text-sm leading-tight">Aniversariantes de {monthName.charAt(0).toUpperCase() + monthName.slice(1)}</h3>
             <p className="text-ministral-100 text-[10px] sm:text-[11px]">Vamos celebrar a vida da equipe! 🎉</p>
          </div>
       </div>
       
       <div className="p-2.5 sm:p-3 bg-ministral-50/50 dark:bg-zinc-800/50">
           <div className="flex flex-wrap gap-2">
               {birthdays.map(member => {
                   const day = member.birthDate!.split('-')[2];
                   return (
                       <div key={member.id} className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-ministral-100 dark:border-ministral-900/30 rounded-full pr-3 pl-1 py-0.5 shadow-sm">
                           {member.avatar_url ? (
                               <img src={member.avatar_url} alt={member.name} className="w-6 h-6 rounded-full object-cover border border-ministral-200 dark:border-ministral-800" />
                           ) : (
                               <div className="w-6 h-6 rounded-full bg-ministral-100 dark:bg-ministral-900 text-ministral-600 dark:text-white flex items-center justify-center font-bold text-[10px] border border-ministral-200 dark:border-ministral-800">
                                   {member.name.charAt(0)}
                               </div>
                           )}
                           <div className="flex flex-col">
                               <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200">{member.name.split(' ')[0]}</span>
                               <span className="text-[9px] text-ministral-500 dark:text-white font-medium flex items-center gap-0.5">
                                   <CalendarHeart size={9} /> Dia {day}
                               </span>
                           </div>
                       </div>
                   )
               })}
           </div>
       </div>
    </div>
  );
};