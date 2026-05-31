import React, { useState, useEffect } from 'react';
import { CalendarClock, CheckCircle2, Clock, MapPin, AlertCircle, ShieldCheck, CalendarPlus, Sparkles } from 'lucide-react';
import { Role, AttendanceMap, User as UserType, TeamMemberProfile } from '../types';
import { getLocalDateISOString, generateGoogleCalendarUrl } from '../utils/dateUtils';
import { useMinistryData } from '../hooks/useMinistryData'; // Import hook to get data
import { ServiceSchedule } from './ServiceSchedule';

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
  const [showServiceSchedule, setShowServiceSchedule] = useState(false);
  
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

    const pad = (n: number) => n.toString().padStart(2, '0');

    if (diffInMinutes < -120) {
      setTimeStatus('early');
      const openTime = new Date(eventDate.getTime() - 120 * 60 * 1000);
      let msUntilOpen = openTime.getTime() - now.getTime();
      if (msUntilOpen < 0) msUntilOpen = 0;

      const totalSeconds = Math.floor(msUntilOpen / 1000);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;

      if (h > 0) {
          setCountdownString(`${pad(h)}:${pad(m)}:${pad(s)}`);
      } else {
          setCountdownString(`${pad(m)}:${pad(s)}`);
      }
    } else if (diffInMinutes > 60) {
      setTimeStatus('closed');
    } else {
      setTimeStatus('open');
      const closeTime = new Date(eventDate.getTime() + 60 * 60 * 1000);
      let msUntilClose = closeTime.getTime() - now.getTime();
      if (msUntilClose < 0) msUntilClose = 0;

      const totalSeconds = Math.floor(msUntilClose / 1000);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;

      if (h > 0) {
          setCountdownString(`${pad(h)}:${pad(m)}:${pad(s)}`);
      } else {
          setCountdownString(`${pad(m)}:${pad(s)}`);
      }
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
                  <button disabled className="flex items-center justify-center gap-3 w-full py-4 bg-black/40 text-white/40 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest cursor-not-allowed border border-white/5">
                      <Clock size={16} /> Abre em {countdownString}
                  </button>
              );
          case 'closed':
              return (
                  <button disabled className="flex items-center justify-center gap-3 w-full py-4 bg-rose-500/20 text-rose-300 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest cursor-not-allowed border border-rose-500/30">
                      <AlertCircle size={16} /> Check-in Encerrado
                  </button>
              );
          case 'open':
              return (
                  <button 
                      onClick={() => onConfirm(memberKey)}
                      className="w-full flex flex-col items-center justify-center gap-1 px-8 py-4 bg-gradient-to-r from-[#c9a84c] to-[#b2933d] hover:from-[#d8b95c] hover:to-[#c9a84c] text-[#0f1f3d] rounded-[1.5rem] shadow-2xl shadow-ministral-gold/20 active:scale-95 transition-all border border-[#c9a84c]/20"
                  >
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest">
                          <MapPin size={18} fill="currentColor" className="opacity-80" /> Confirmar Check-in
                      </div>
                      <span className="text-[10px] font-bold opacity-80">Fecha em {countdownString}</span>
                  </button>
              );
      }
  };

  const getBackgroundUrl = () => {
    const name = (ministryName || "").toLowerCase();
    
    // Seed generator based on event string so it changes per event but is consistent
    const seedString = (propEvent.id || "") + (propEvent.extendedProps?.isoDate || "");
    const seed = seedString.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) || 0;
    
    const pick = (arr: string[]) => arr[seed % arr.length];

    if (name.includes("mídia") || name.includes("midia") || name.includes("projeção") || name.includes("projecao") || name.includes("transmissão") || name.includes("transmissao") || name.includes("multimídia") || name.includes("multimidia")) {
      return pick([
        "https://images.unsplash.com/photo-1542204165-65bf26472b9b?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1516280440502-3162b7194639?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=600&auto=format&fit=crop"
      ]);
    }
    if (name.includes("som") || name.includes("áudio") || name.includes("audio")) {
      return pick([
        "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1614680376573-3e4e1202e5f1?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1520698188355-6b589417852c?q=80&w=600&auto=format&fit=crop"
      ]);
    }
    if (name.includes("louvor") || name.includes("música") || name.includes("musica") || name.includes("banda") || name.includes("canto") || name.includes("coral")) {
      return pick([
        "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1514320291840-2e0a9bf66f22?q=80&w=600&auto=format&fit=crop"
      ]);
    }
    if (name.includes("recep") || name.includes("boas") || name.includes("acolhimento") || name.includes("portaria")) {
      return pick([
        "https://images.unsplash.com/photo-1478147427282-58a87a120781?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1544928147774-4b5bd5fb93c2?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1519671482749-fd098e382307?q=80&w=600&auto=format&fit=crop"
      ]);
    }
    if (name.includes("comunica") || name.includes("marketing") || name.includes("foto")) {
      return pick([
        "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1432888117247-efb57bceb7f1?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1493612278159-46be9eeeb1be?q=80&w=600&auto=format&fit=crop"
      ]);
    }
    if (name.includes("infantil") || name.includes("kids") || name.includes("criança") || name.includes("crianca")) {
      return pick([
        "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1516627145497-196249252189?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1602329581711-cb631624c944?q=80&w=600&auto=format&fit=crop"
      ]);
    }
    if (name.includes("joven") || name.includes("juventude") || name.includes("adolescente") || name.includes("mocidade")) {
      return pick([
        "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1523301343968-6a6ebf63f773?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1517486808506-ce54de01e127?q=80&w=600&auto=format&fit=crop"
      ]);
    }
    if (name.includes("mulher") || name.includes("feminino") || name.includes("senhora")) {
      return pick([
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1522770141673-ff8d234cf780?q=80&w=600&auto=format&fit=crop"
      ]);
    }
    if (name.includes("homen") || name.includes("masculino") || name.includes("senhor") || name.includes("homem")) {
      return pick([
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1519085360753-af0118f7cbe8?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1480455450811-e4ab1aabccb1?q=80&w=600&auto=format&fit=crop"
      ]);
    }
    if (name.includes("dança") || name.includes("danca") || name.includes("teatro") || name.includes("artes") || name.includes("coreografia") || name.includes("teatro")) {
      return pick([
        "https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1516450360452-8171b302c349?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1547153760022-a6f69fc35467?q=80&w=600&auto=format&fit=crop"
      ]);
    }
    if (name.includes("intercess") || name.includes("oraç") || name.includes("orac")) {
      return pick([
        "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1504052434569-70a18bb720c6?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1518062312678-bcf6b176cfd9?q=80&w=600&auto=format&fit=crop"
      ]);
    }
    if (name.includes("ensino") || name.includes("ebd") || name.includes("escola") || name.includes("estudo") || name.includes("professor")) {
      return pick([
        "https://images.unsplash.com/photo-1491841550275-ad7854e35ca6?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1524178232363-1ca2b0568d41?q=80&w=600&auto=format&fit=crop"
      ]);
    }
    if (name.includes("diaconia") || name.includes("diácono") || name.includes("diacono") || name.includes("ceia") || name.includes("serviço") || name.includes("servico")) {
      return pick([
        "https://images.unsplash.com/photo-1529070538774-1843cb3265df?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1461360228725-b4618776654e?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1593113565985-1779ba3bb7a0?q=80&w=600&auto=format&fit=crop"
      ]);
    }
    if (name.includes("seguran") || name.includes("estacionamento")) {
      return pick([
        "https://images.unsplash.com/photo-1621252179027-94459d278660?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1555627579-3fb70fbabcb0?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1618331835717-801e976710b2?q=80&w=600&auto=format&fit=crop"
      ]);
    }
    if (name.includes("limpeza") || name.includes("zeladoria") || name.includes("manutenç") || name.includes("manutenc")) {
      return pick([
        "https://images.unsplash.com/photo-1585421514738-01798e348b17?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1527515637462-8f69b82fc6d0?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1563453392212-326f5e81f441?q=80&w=600&auto=format&fit=crop"
      ]);
    }
    return pick([
      "https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1557682250-33bf4e6dc6ae?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1557683305-6447c21acb00?q=80&w=600&auto=format&fit=crop"
    ]);
  };

  return (
    <div className="relative mb-12 rounded-[3rem] overflow-hidden bg-white dark:bg-ministral-dark shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] border border-slate-200 dark:border-slate-800 animate-slide-up ring-1 ring-black/5">
      
      <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Main Info - High Fidelity Sidebar */}
          <div 
              className="lg:col-span-4 p-8 lg:p-12 bg-cover bg-center relative overflow-hidden flex flex-col justify-between text-white"
              style={{ backgroundImage: `url(${getBackgroundUrl()})` }}
          >
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#121212]/90 to-transparent"></div>
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
          <div className="lg:col-span-8 p-8 lg:p-12 bg-white dark:bg-ministral-dark relative">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                  <div className="flex items-center gap-4">
                      <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">Equipe Escalada</h3>
                      <button 
                          onClick={() => setShowServiceSchedule(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#c9a84c]/10 text-[#c9a84c] border border-[#c9a84c]/20 hover:bg-[#c9a84c]/20 transition-colors text-[10px] font-black uppercase tracking-widest"
                      >
                          <Sparkles size={12} />
                          Cronograma
                      </button>
                  </div>
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

      {showServiceSchedule && eventData && (
        <ServiceSchedule 
          eventRuleId={eventData.ruleId || eventData.id}
          eventDate={eventData.date}
          currentUser={currentUser!}
          orgId={currentUser?.organizationId}
          ministryId={ministryId}
          onClose={() => setShowServiceSchedule(false)}
        />
      )}
    </div>
  );
};