import React, { useState, useEffect } from 'react';
import { AvailabilityMap, AvailabilityNotesMap, User, TeamMemberProfile } from '../types';
import { getMonthName, adjustMonth } from '../utils/dateUtils';
import { ChevronLeft, ChevronRight, Save, CheckCircle2, Moon, Sun, Lock, FileText, Ban, RefreshCw, Check, ShieldAlert } from 'lucide-react';
import { useToast } from './Toast';

interface Props {
  availability: AvailabilityMap; // Now keyed by User ID
  availabilityNotes: AvailabilityNotesMap; // Keyed by UserID_Month
  setAvailability: React.Dispatch<React.SetStateAction<AvailabilityMap>>;
  members: TeamMemberProfile[]; 
  currentMonth: string;
  onMonthChange: (newMonth: string) => void;
  currentUser: User | null;
  onSaveAvailability: (ministryId: string, userId: string, dates: string[], notes: Record<string, string>, targetMonth: string) => Promise<void>; 
  availabilityWindow?: { start?: string, end?: string };
  ministryId: string;
}

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved';

export const AvailabilityScreen: React.FC<Props> = ({
  availability,
  availabilityNotes,
  members,
  currentMonth,
  onMonthChange,
  currentUser,
  onSaveAvailability,
  availabilityWindow,
  ministryId
}) => {
  const { addToast } = useToast();
  
  // States
  const [selectedMemberId, setSelectedMemberId] = useState<string>(""); 
  const [tempDates, setTempDates] = useState<string[]>([]); 
  const [generalNote, setGeneralNote] = useState("");
  
  // --- MÁQUINA DE ESTADOS DO SALVAMENTO (State Machine) ---
  const [saveState, setSaveState] = useState<SaveState>('idle');

  // Bloqueio visual: Impede alterações enquanto salva ou mostra sucesso
  const isSaveLocked = saveState === 'saving' || saveState === 'saved';
  
  const isAdmin = currentUser?.access_role === 'admin';
  const isBlockedMonth = tempDates.includes(`${currentMonth}-BLK`);

  // Calendar Props
  const [year, month] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const blanks = Array.from({ length: firstDayOfWeek });
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Check Window Status
  const isWindowOpenForMembers = React.useMemo(() => {
      if (!availabilityWindow?.start && !availabilityWindow?.end) return true;
      if (availabilityWindow.start?.includes('1970')) return false;

      const now = new Date();
      let start = new Date(0);
      let end = new Date(8640000000000000); 

      if (availabilityWindow.start) start = new Date(availabilityWindow.start);
      if (availabilityWindow.end) end = new Date(availabilityWindow.end);
      
      return now >= start && now <= end;
  }, [availabilityWindow]);

  const canEdit = isAdmin || isWindowOpenForMembers;

  // Init Member Selection
  useEffect(() => {
    if (currentUser && !selectedMemberId && members.length > 0) {
      // Find current user's profile in members list
      const me = members.find(m => m.id === currentUser.id);
      if (me) {
        setSelectedMemberId(me.id);
      } else if (isAdmin) {
        // Only admins can default to another member if they are not in the list
        setSelectedMemberId(members[0].id);
      }
    }
  }, [currentUser, members, isAdmin]);

  // Load Data on Mount or Change (Sync with Backend Truth)
  useEffect(() => {
    if (!selectedMemberId) return;

    // Se o usuário estiver ativamente editando (dirty), salvando (saving)
    // ou se mal acabou de salvar (saved), NÃO sobrescrevemos a tela temporária
    // com os dados atrasados. Damos tempo pro servidor responder via background (Realtime) 
    // com os dados mais recentes antes de repaginar a página pra Idle.
    if (saveState !== 'idle') return;

    // Availability map is keyed by User ID now
    const storedDates = availability[selectedMemberId] || [];
    const monthDates = storedDates.filter(d => d.startsWith(currentMonth));
    setTempDates(monthDates);
    
    // Note key format: ID_YYYY-MM-00
    const noteKey = `${selectedMemberId}_${currentMonth}-00`;
    setGeneralNote(availabilityNotes?.[noteKey] || "");
  }, [selectedMemberId, currentMonth, availability, availabilityNotes, members, saveState]);

  // Auto-dismiss do estado 'saved'
  useEffect(() => {
    if (saveState !== 'saved') return;
    
    // Agora que forçamos a invalidação no App.tsx diretamente, podemos voltar a Idade para que ele sincronize rápido
    const timeout = setTimeout(() => {
      setSaveState('idle');
    }, 1000);
    
    return () => clearTimeout(timeout);
  }, [saveState]);

  const handleToggleBlockMonth = () => {
      if (!canEdit) return;
      if (isSaveLocked) return; // Bloqueio visual

      setSaveState('dirty');

      if (isBlockedMonth) {
          setTempDates([]); 
      } else {
          setTempDates([`${currentMonth}-BLK`]);
      }
  };

  const handleToggleDate = (day: number) => {
      if (!canEdit) {
          addToast("O período de envio está fechado.", "warning");
          return;
      }
      
      if (isSaveLocked) return; // Bloqueio visual

      setSaveState('dirty');
      
      const dateBase = `${currentMonth}-${String(day).padStart(2, '0')}`;
      const dateObj = new Date(year, month - 1, day);
      const isSunday = dateObj.getDay() === 0;

      const full = dateBase;
      const morning = `${dateBase}_M`;
      const night = `${dateBase}_N`;

      let newDates = isBlockedMonth ? [] : [...tempDates];
      
      const hadFull = newDates.includes(full);
      const hadMorning = newDates.includes(morning);
      const hadNight = newDates.includes(night);
      
      newDates = newDates.filter(d => !d.startsWith(dateBase));

      if (isSunday) {
          if (!hadFull && !hadMorning && !hadNight) newDates.push(full);
          else if (hadFull) newDates.push(morning);
          else if (hadMorning) newDates.push(night);
      } else {
          if (!hadFull) newDates.push(full);
      }
      
      setTempDates(newDates);
  };

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (isSaveLocked) return;
      setGeneralNote(e.target.value);
      setSaveState('dirty');
  };

  const handleSave = async () => {
      if (!selectedMemberId) return;
      // Previne duplo clique ou salvamento durante sucesso
      if (isSaveLocked) return; 

      setSaveState('saving');

      try {
          // --- 1. MERGE DE DATAS ---
          const existingDates = availability[selectedMemberId] || [];
          const otherMonthDates = existingDates.filter(
              date => !date.startsWith(currentMonth)
          );
          const consolidatedDates = [...otherMonthDates, ...tempDates];

          // --- 2. MERGE DE NOTAS ---
          const consolidatedNotes: Record<string, string> = {};
          const prefix = `${selectedMemberId}_`;
          const currentNoteKey = `${currentMonth}-00`;

          Object.entries(availabilityNotes).forEach(([key, value]) => {
              if (key.startsWith(prefix)) {
                  const originalKey = key.substring(prefix.length);
                  if (originalKey !== currentNoteKey) {
                      consolidatedNotes[originalKey] = value as string;
                  }
              }
          });

          if (generalNote.trim()) {
              consolidatedNotes[currentNoteKey] = generalNote.trim();
          }

          // 4. Envia payload consolidado (USANDO ID)
          await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(() => reject(new Error("O tempo de resposta do servidor foi excedido. Tente novamente.")), 30000);
              
              onSaveAvailability(
                  ministryId, 
                  selectedMemberId, 
                  consolidatedDates, 
                  consolidatedNotes, 
                  currentMonth
              ).then(() => {
                  clearTimeout(timer);
                  resolve();
              }).catch((e) => {
                  clearTimeout(timer);
                  reject(e);
              });
          });
          
          // ESTADO TERMINAL DE SUCESSO
          setSaveState('saved');
          
      } catch (error: unknown) {
          console.error(error);
          setSaveState('dirty'); // Permite tentar novamente
          const msg = error instanceof Error ? error.message : "Erro desconhecido";
          addToast(`Erro: ${msg}`, "error");
      }
  };

  const getDayStatus = (day: number) => {
      if (isBlockedMonth) return 'blocked';
      const dateBase = `${currentMonth}-${String(day).padStart(2, '0')}`;
      if (tempDates.includes(dateBase)) return 'full';
      if (tempDates.includes(`${dateBase}_M`)) return 'morning';
      if (tempDates.includes(`${dateBase}_N`)) return 'night';
      return 'none';
  };

  const handleMonthNav = (dir: number) => {
      if (saveState === 'dirty') {
          if (!window.confirm("Há alterações não salvas. Descartar?")) return;
      }
      setSaveState('idle');
      onMonthChange(adjustMonth(currentMonth, dir));
  };

  return (
    <div className="space-y-4 animate-fade-in max-w-4xl mx-auto pb-32">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
            <div>
                <h2 className="text-xl md:text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="text-secondary dark:text-white"/> Minha Disponibilidade
                </h2>
                <p className="text-zinc-500 text-xs md:text-sm mt-1">
                    Toque nos dias para marcar (Dom: Dia/Manhã/Noite).
                </p>
            </div>
            
            <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end bg-zinc-50 dark:bg-zinc-900/50 p-1.5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                {isAdmin && (
                    <select 
                        value={selectedMemberId} 
                        onChange={(e) => {
                            if(saveState === 'dirty' && !confirm("Descartar alterações?")) return;
                            setSaveState('idle');
                            setSelectedMemberId(e.target.value);
                        }}
                        className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg py-1.5 px-3 text-xs md:text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-secondary outline-none max-w-[140px]"
                    >
                        {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                )}
                
                <div className="flex items-center gap-2">
                    <button onClick={() => handleMonthNav(-1)} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-300"><ChevronLeft size={16}/></button>
                    <span className="text-xs md:text-sm font-bold min-w-[70px] text-center capitalize text-zinc-900 dark:text-zinc-100">{getMonthName(currentMonth)}</span>
                    <button onClick={() => handleMonthNav(1)} className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-300"><ChevronRight size={16}/></button>
                </div>
            </div>
        </div>

        {/* --- STATUS WARNINGS --- */}
        {!isWindowOpenForMembers && isAdmin && (
            <div className="bg-secondary/10 dark:bg-secondary/5 border border-secondary/20 dark:border-secondary/30 p-3 rounded-xl flex items-center gap-3 text-secondary dark:text-white animate-slide-up">
                <ShieldAlert size={20} className="shrink-0" />
                <div>
                    <p className="font-bold text-xs md:text-sm">Modo Admin Ativo</p>
                    <p className="text-[10px] md:text-xs opacity-80">A janela está <strong>fechada</strong> para membros, mas você tem permissão para editar.</p>
                </div>
            </div>
        )}

        {!isWindowOpenForMembers && !isAdmin && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 p-3 rounded-xl flex items-center gap-3 text-red-800 dark:text-red-200 animate-slide-up">
                <Lock size={20} className="shrink-0" />
                <div>
                    <p className="font-bold text-xs md:text-sm">Edição Encerrada</p>
                    <p className="text-[10px] md:text-xs opacity-80">O prazo para envio de disponibilidade já terminou. Contate a liderança.</p>
                </div>
            </div>
        )}

        {/* Calendar Area */}
        <div className={`transition-opacity duration-300 ${!canEdit ? 'opacity-60 pointer-events-none grayscale-[0.5]' : ''}`}>
            
            {/* Block Month Toggle */}
            <button 
                onClick={handleToggleBlockMonth}
                className={`w-full mb-4 py-3 px-4 rounded-xl border flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                    isBlockedMonth 
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-600 dark:text-red-400'
                    : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                }`}
            >
                <Ban size={16} />
                <span className="text-xs md:text-sm font-bold">
                    {isBlockedMonth ? 'MÊS BLOQUEADO (Toque para liberar)' : 'Marcar mês inteiro como indisponível'}
                </span>
            </button>

            <div className={`bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-3 md:p-6 relative overflow-hidden transition-all duration-300 ${isBlockedMonth ? 'ring-2 ring-red-500/20 opacity-50' : ''}`}>
                
                {isBlockedMonth && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                        <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm p-4 rounded-2xl border border-red-200 dark:border-red-900 shadow-xl">
                            <p className="text-red-500 font-bold text-sm flex items-center gap-2"><Ban size={16}/> Indisponível este mês</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-7 gap-1 mb-2">
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                        <div key={`${d}-${i}`} className="text-center text-[10px] md:text-xs font-bold text-zinc-400 py-1">{d}</div>
                    ))}
                </div>
                
                <div className="grid grid-cols-7 gap-1 md:gap-3">
                    {blanks.map((_, i) => <div key={`blank-${i}`} />)}
                    {days.map(day => {
                        const status = getDayStatus(day);
                        let btnClass = "bg-zinc-50 dark:bg-zinc-900/50 text-zinc-400 border-zinc-200 dark:border-zinc-700";
                        let content = <span className="text-xs md:text-sm font-bold">{day}</span>;

                        if (status === 'full') {
                            btnClass = "bg-secondary text-white border-secondaryHover shadow-sm";
                            content = (
                                <>
                                    <CheckCircle2 size={12} className="mb-0.5 md:mb-1" />
                                    <span className="text-xs md:text-sm font-bold leading-none">{day}</span>
                                </>
                            );
                        } else if (status === 'morning') {
                            btnClass = "bg-ministral-gold text-white border-ministral-gold shadow-sm";
                            content = (
                                <>
                                    <Sun size={12} className="mb-0.5 md:mb-1" />
                                    <span className="text-xs md:text-sm font-bold leading-none">{day}</span>
                                </>
                            );
                        } else if (status === 'night') {
                            btnClass = "bg-ministral-600 text-white border-ministral-600 shadow-sm";
                            content = (
                                <>
                                    <Moon size={12} className="mb-0.5 md:mb-1" />
                                    <span className="text-xs md:text-sm font-bold leading-none">{day}</span>
                                </>
                            );
                        }

                        return (
                            <button
                                key={day}
                                onClick={() => handleToggleDate(day)}
                                className={`aspect-square rounded-lg md:rounded-xl border flex flex-col items-center justify-center transition-all active:scale-90 ${btnClass}`}
                            >
                                {content}
                            </button>
                        );
                    })}
                </div>

                <div className="flex flex-wrap gap-2 md:gap-4 mt-6 justify-center bg-zinc-50 dark:bg-zinc-900/50 p-2 md:p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-zinc-600 dark:text-zinc-400">
                        <div className="w-2.5 h-2.5 rounded-full bg-secondary shadow-sm"></div> Livre
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-zinc-600 dark:text-zinc-400">
                        <div className="w-2.5 h-2.5 rounded-full bg-ministral-gold shadow-sm"></div> Manhã
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-zinc-600 dark:text-zinc-400">
                        <div className="w-2.5 h-2.5 rounded-full bg-ministral-600 shadow-sm"></div> Noite
                    </div>
                </div>
            </div>

            {/* Notes */}
            <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 mt-4">
                <div className="flex items-center gap-2 mb-2">
                    <FileText size={16} className="text-zinc-400" />
                    <h3 className="text-xs md:text-sm font-bold text-zinc-700 dark:text-zinc-300">Observações (Opcional)</h3>
                </div>
                <textarea 
                    value={generalNote}
                    onChange={handleNoteChange}
                    placeholder="Ex: Chego atrasado no dia 15..."
                    className="w-full h-16 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 text-xs md:text-sm focus:ring-2 focus:ring-secondary outline-none resize-none placeholder:text-zinc-400 text-zinc-800 dark:text-zinc-200"
                    disabled={!canEdit}
                />
            </div>
        </div>

        {/* Floating Action Bar */}
        <div className={`fixed bottom-24 lg:bottom-6 left-0 right-0 z-[100] flex justify-center pointer-events-none transition-all duration-500 ease-out transform ${saveState !== 'idle' ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <div className={`
                backdrop-blur-xl rounded-2xl shadow-2xl p-2 pl-5 pr-2 w-[90%] max-w-sm flex items-center justify-between pointer-events-auto border ring-1 ring-black/5 transition-colors duration-300
                ${saveState === 'saved'
                    ? 'bg-secondary border-secondary/50 text-white' 
                    : 'bg-zinc-900/90 dark:bg-white/95 text-white dark:text-zinc-900 border-zinc-700/50 dark:border-zinc-200/50'
                }
            `}>
                <div className="flex items-center gap-3">
                    {saveState === 'saved' ? (
                        <CheckCircle2 size={20} className="text-white animate-bounce" />
                    ) : (
                        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse shadow-[0_0_8px_2px_rgba(250,204,21,0.5)]"></div>
                    )}
                    <span className="text-xs font-bold uppercase tracking-wider">
                        {saveState === 'saved' ? 'Salvo com sucesso!' : saveState === 'saving' ? 'Salvando...' : 'Alterações pendentes'}
                    </span>
                </div>
                
                {saveState !== 'saved' && (
                    <button 
                        onClick={handleSave}
                        disabled={saveState === 'saving'}
                        className="bg-secondary hover:bg-secondaryHover text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-secondary/30 active:scale-95 transition-all flex items-center gap-2 text-sm disabled:opacity-70 disabled:cursor-not-allowed group"
                    >
                        {saveState === 'saving' ? <RefreshCw className="animate-spin" size={16}/> : <Save size={16} className="group-hover:scale-110 transition-transform"/>}
                        Salvar
                    </button>
                )}
                
                {saveState === 'saved' && (
                    <div className="px-4 py-2">
                        <Check size={20} className="text-white/80" />
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};