import React, { useState, useEffect } from 'react';
import { CalendarClock, CheckCircle2, Clock, MapPin, AlertCircle, ShieldCheck, CalendarPlus, Sparkles } from 'lucide-react';
import { Role, AttendanceMap, User as UserType, TeamMemberProfile } from '../types';
import { getLocalDateISOString, generateGoogleCalendarUrl } from '../utils/dateUtils';
import { useMinistryData } from '../hooks/useMinistryData'; // Import hook to get data

// UPDATE PROPS: Remove explicit event/schedule/etc if we use internal data or update usage
interface Props {
  event: any; // Now receives the structured nextEvent object { event: ..., members: ... }
  schedule: Record<string, string>; // Legacy support if needed, but prefere internal data
  attendance: AttendanceMap; // Legacy support
  roles: Role[];
  members: TeamMemberProfile[];
  onConfirm: (key: string) => void;
  ministryId: string | null;
  ministryName?: string | null;
  currentUser: UserType | null;
}

type TimeStatus = 'early' | 'open' | 'closed';

export const NextEventCard: React.FC<Props> = ({ event: propEvent, schedule, attendance, roles, members, onConfirm, ministryId, ministryName, currentUser }) => {
  const [timeStatus, setTimeStatus] = useState<TimeStatus>('early');
  const [countdownString, setCountdownString] = useState('');
  
  // Use data directly passed from the new hook structure in App.tsx
  // The prop `event` now comes as `nextEvent` from `useMinistryData` which has `{ event, members }` structure.
  // We need to handle both cases if the parent hasn't updated yet, but assuming App.tsx passes `nextEvent` as `event`.
  
  const eventData = propEvent?.event ? propEvent.event : propEvent; // Handle structure
  const eventMembers = propEvent?.members || [];

  const checkTimeWindow = () => {
    if (!eventData) return;
    const now = new Date();
    const eventDate = new Date(eventData.iso);
    const diffInMinutes = (now.getTime() - eventDate.getTime()) / (1000 * 60);

    // Dynamic window based on type
    const isSingle = eventData.type === 'single';
    // If single, valid until 23:59 of that day.
    // If weekly/recurring, valid for 2 hours after start.
    
    let isClosed = diffInMinutes > 60; // 1 hour after

    // Opens 30 minutes before
    if (diffInMinutes < -30) {
      setTimeStatus('early');
      const openTime = new Date(eventDate.getTime() - 30 * 60 * 1000);
      let msUntilOpen = openTime.getTime() - now.getTime();
      if (msUntilOpen < 0) msUntilOpen = 0;

      const totalSeconds = Math.floor(msUntilOpen / 1000);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;

      const pad = (n: number) => n.toString().padStart(2, '0');
      if (h > 0) {
          setCountdownString(`${pad(h)}:${pad(m)}:${pad(s)}`);
      } else {
          setCountdownString(`${pad(m)}:${pad(s)}`);
      }
    } else if (isClosed) {
      setTimeStatus('closed');
    } else {
      setTimeStatus('open');
    }
  };

  useEffect(() => {
    checkTimeWindow();
    const interval = setInterval(checkTimeWindow, 1000);
    return () => clearInterval(interval);
  }, [eventData]);

  if (!eventData) return null;

  const eventIsToday = getLocalDateISOString() === eventData.iso.split('T')[0];
  const eventTime = eventData.iso.split('T')[1].substring(0, 5);
  const dateDisplay = eventData.date.split('-').reverse().slice(0, 2).join('/');

  const renderActionButton = (memberKey: string, isConfirmed: boolean, role: string) => {
      const googleCalUrl = generateGoogleCalendarUrl(
          `Escala: ${eventData.title}`,
          eventData.iso,
          `Você está escalado como: ${role}.\nMinistério: ${ministryName || ministryId?.toUpperCase()}`
      );

      if (isConfirmed) {
          return (
              <div className="flex gap-3 w-full">
                  <div className="flex-1 flex items-center justify-center gap-3 text-white bg-ministral-500/20 px-6 py-4 rounded-[1.5rem] text-sm font-black uppercase tracking-widest border border-ministral-500/30 backdrop-blur-md shadow-lg shadow-ministral-500/10">
                      <ShieldCheck size={20} className="text-ministral-400" /> Presença Confirmada
                  </div>
                  <a 
                      href={googleCalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-4 bg-white/10 text-white rounded-[1.5rem] hover:bg-white/20 transition-all border border-white/10 flex items-center justify-center"
                      title="Google Agenda"
                  >
                      <CalendarPlus size={24} />
                  </a>
              </div>
          );
      }

      if (!eventIsToday) {
          return (
              <a 
                  href={googleCalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 w-full py-4 bg-white text-ministral-dark rounded-[1.5rem] text-xs font-black uppercase tracking-widest hover:bg-ministral-50 transition-all shadow-2xl active:scale-95"
              >
                  <CalendarPlus size={18} /> Salvar no Agenda
              </a>
          );
      }

      switch (timeStatus) {
          case 'early':
              return (
                  <button disabled className="flex items-center justify-center gap-3 w-full py-4 bg-black/40 text-white/40 rounded-[1.5rem] text-xs font-black uppercase tracking-widest cursor-not-allowed border border-white/5">
                      <Clock size={18} /> Libera em {countdownString}
                  </button>
              );
          case 'closed':
              return (
                  <button disabled className="flex items-center justify-center gap-3 w-full py-4 bg-rose-500/20 text-rose-200 rounded-[1.5rem] text-xs font-black uppercase tracking-widest cursor-not-allowed border border-rose-500/30">
                      <AlertCircle size={18} /> Período Encerrado
                  </button>
              );
          case 'open':
              return (
                  <button 
                      onClick={() => onConfirm(memberKey)}
                      className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-gradient-to-r from-ministral-500 to-ministral-600 hover:from-ministral-400 hover:to-ministral-500 text-white rounded-[1.5rem] text-sm font-black uppercase tracking-widest shadow-2xl shadow-ministral-500/30 active:scale-95 transition-all"
                  >
                      <MapPin size={20} /> Confirmar Presença Agora
                  </button>
              );
      }
  };

  return (
    <div className="relative mb-12 rounded-[3rem] overflow-hidden bg-white dark:bg-ministral-dark shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] border border-slate-200 dark:border-slate-800 animate-slide-up ring-1 ring-black/5">
      
      <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Main Info - High Fidelity Sidebar */}
          <div className="lg:col-span-4 p-8 lg:p-12 bg-ministral-dark relative overflow-hidden flex flex-col justify-between text-white">
              <div className="absolute inset-0 bg-gradient-to-br from-ministral-600/20 via-ministral-dark to-ministral-gold/10"></div>
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-150 contrast-150 mix-blend-overlay"></div>
              
              <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                      <div className="px-3 py-1 rounded-full bg-ministral-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-ministral-500/30 flex items-center gap-1.5">
                          <Sparkles size={12} fill="currentColor" /> Próximo
                      </div>
                      {eventIsToday && (
                          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-ministral-400">
                             <span className="w-1.5 h-1.5 rounded-full bg-ministral-400 animate-ping"></span> Hoje
                          </div>
                      )}
                  </div>
                  
                  <h2 className="text-4xl lg:text-5xl font-black text-white leading-[1.1] mb-6 tracking-tighter">
                      {eventData.title}
                  </h2>
                  
                  <div className="space-y-4">
                      <div className="flex items-center gap-3 text-ministral-400">
                          <CalendarClock size={20} />
                          <span className="text-lg font-bold tracking-tight">{dateDisplay}</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-300">
                          <Clock size={20} />
                          <span className="text-lg font-bold tracking-tight">{eventTime}</span>
                      </div>
                  </div>
              </div>
              
              <div className="mt-12 relative z-10">
                  {(() => {
                      const myRole = eventMembers.find((t: any) => currentUser && t.name === currentUser.name);
                      
                      if (myRole) {
                          // Note: myRole.key is constructed in fetchNextEventCardData as eventIso_role
                          return renderActionButton(myRole.key, myRole.confirmed, myRole.role);
                      }
                      return (
                          <div className="p-5 rounded-[1.5rem] bg-white/5 border border-white/10 backdrop-blur-md text-center">
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Status</p>
                              <p className="text-xs font-bold text-slate-300">Você não está escalado neste evento.</p>
                          </div>
                      );
                  })()}
              </div>
          </div>

          {/* Team Detail List */}
          <div className="lg:col-span-8 p-8 lg:p-12 bg-white dark:bg-ministral-dark">
              <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">Equipe Escalada</h3>
                  <span className="text-[10px] font-black text-ministral-600 dark:text-white bg-ministral-50 dark:bg-ministral-600/20 px-3 py-1 rounded-full">{eventMembers.length} Integrantes</span>
              </div>

              {eventMembers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem]">
                      <CalendarClock size={48} className="text-slate-200 dark:text-slate-800 mb-4" />
                      <p className="text-slate-400 font-bold text-sm">Nenhum membro escalado ainda.</p>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {eventMembers.map((t: any, idx: number) => {
                          const isMe = currentUser && t.name === currentUser.name;
                          // Use avatarUrl directly from the fetched data if available
                          const avatar = t.avatarUrl; 
                          
                          return (
                              <div key={idx} className={`group flex items-center p-4 rounded-[2rem] border transition-all duration-500 ${
                                  isMe 
                                  ? 'bg-ministral-50/50 dark:bg-ministral-500/5 border-ministral-200 dark:border-ministral-800/50 ring-2 ring-ministral-500/10' 
                                  : 'bg-slate-50/50 dark:bg-slate-800/40 border-transparent hover:bg-white dark:hover:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-xl'
                              }`}>
                                  <div className="relative shrink-0">
                                      <div className={`w-14 h-14 rounded-2xl overflow-hidden border-2 transition-all duration-500 ${t.confirmed ? 'border-ministral-500 shadow-lg shadow-ministral-500/20' : 'border-slate-200 dark:border-slate-700'}`}>
                                          {avatar ? (
                                              <img src={avatar} className="w-full h-full object-cover" />
                                          ) : (
                                              <div className={`w-full h-full flex items-center justify-center font-black text-xl ${t.confirmed ? 'bg-ministral-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                                                  {t.name.charAt(0)}
                                              </div>
                                          )}
                                      </div>
                                      {t.confirmed && (
                                          <div className="absolute -top-2 -right-2 bg-ministral-500 text-white rounded-full p-1 border-4 border-white dark:border-ministral-dark shadow-lg scale-110">
                                              <CheckCircle2 size={12} />
                                          </div>
                                      )}
                                  </div>
                                  
                                  <div className="ml-5 flex-1 min-w-0">
                                      <p className="text-[10px] font-black text-ministral-600 dark:text-white uppercase tracking-widest mb-0.5">{t.role}</p>
                                      <p className={`text-base font-black truncate tracking-tight ${t.confirmed ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                                          {t.name}
                                      </p>
                                      {isMe && <span className="inline-block mt-1 text-[9px] font-black bg-ministral-500 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter">Você</span>}
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