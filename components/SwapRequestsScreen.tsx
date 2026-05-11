
import React, { useState } from 'react';
import { RefreshCcw, User, Calendar, ArrowRight, CheckCircle2, Clock, Info, FilterX, XCircle, Trash2 } from 'lucide-react';
import { SwapRequest, User as UserType, ScheduleMap } from '../types';
import { useToast } from './Toast';

interface Props {
  schedule: ScheduleMap;
  currentUser: UserType;
  requests: SwapRequest[];
  visibleEvents: { id: string; iso: string; title: string; dateDisplay: string }[];
  currentMonth: string; // YYYY-MM
  onCreateRequest: (role: string, iso: string, title: string) => Promise<void>;
  onAcceptRequest: (reqId: string) => void;
  onCancelRequest?: (reqId: string) => void;
}

export const SwapRequestsScreen: React.FC<Props> = ({ 
    schedule, currentUser, requests, visibleEvents, currentMonth, onCreateRequest, onAcceptRequest, onCancelRequest 
}) => {
  const [activeTab, setActiveTab] = useState<'mine' | 'wall'>('wall');
  const { confirmAction } = useToast();

  const getPendingRequest = (iso: string, role: string) => {
      return requests.find(r => 
          r.eventIso.split('|')[0] === iso && 
          r.role === role && 
          r.requesterName === currentUser.name && 
          r.status === 'pending'
      );
  };

  const mySchedules = visibleEvents
    .filter(evt => evt.iso.startsWith(currentMonth)) // so eventos do mes atual
    .filter(evt => new Date(evt.iso) > new Date()) // remover eventos passados
    .map(evt => {
      const myRolesInEvent: string[] = [];
      Object.keys(schedule).forEach(key => {
          if (evt.id && key.startsWith(`${evt.id}|`) && schedule[key] === currentUser.name) {
              const role = key.split('|').slice(2).join('|') || '';
              const pendingReq = getPendingRequest(evt.iso, role);
              if (!pendingReq) {
                  myRolesInEvent.push(role);
              }
          }
      });
      return { event: evt, roles: myRolesInEvent };
  }).filter(item => item.roles.length > 0);

  const visibleRequests = requests.filter(req => {
    if (req.status !== 'pending') return false;
    
    // Remover eventos passados do mural
    const evtIso = req.eventIso.split('|')[0];
    if (new Date(evtIso) <= new Date()) return false;

    // Sempre mostrar os proprios pedidos do usuario
    if (req.requesterName === currentUser.name) return true;
    // Admin ve tudo
    const isAdmin = currentUser.access_role === 'admin';
    if (isAdmin) return true;
    // Membro com funcoes definidas: filtrar por funcao compativel
    const userFunctions = currentUser.ministry_functions || [];
    if (userFunctions.length > 0) {
      return userFunctions.includes(req.role);
    }
    // Membro sem funcoes cadastradas: ver todos os pedidos
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
            <div>
                <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                    <RefreshCcw className="text-secondary dark:text-white"/> Trocas de Escala
                </h2>
                <p className="text-zinc-500 text-sm mt-1">
                    Solicite substituição ou assuma escalas disponíveis.
                </p>
            </div>
        </div>

        <div className="flex p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl w-full max-w-sm mx-auto">
            <button 
                onClick={() => setActiveTab('mine')}
                className={`flex-1 py-2 text-xs md:text-sm font-bold rounded-lg transition-all ${activeTab === 'mine' ? 'bg-white dark:bg-zinc-700 shadow text-zinc-900 dark:text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
                Minhas Escalas
            </button>
            <button 
                onClick={() => setActiveTab('wall')}
                className={`flex-1 py-2 text-xs md:text-sm font-bold rounded-lg transition-all ${activeTab === 'wall' ? 'bg-white dark:bg-zinc-700 shadow text-zinc-900 dark:text-white' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
                Mural de Trocas
                {visibleRequests.length > 0 && <span className="ml-2 bg-secondary text-white text-[10px] px-1.5 rounded-full">{visibleRequests.length}</span>}
            </button>
        </div>

        {activeTab === 'mine' && (
            <div className="space-y-4">
                <div className="bg-secondary/10 dark:bg-secondary/5 p-4 rounded-xl border border-secondary/20 dark:border-secondary/30 flex items-start gap-3">
                    <Info className="text-secondary dark:text-white shrink-0 mt-0.5" size={18} />
                    <p className="text-sm text-secondary dark:text-white">
                        Clique em "Solicitar Troca" para disponibilizar sua vaga no mural. Se mudar de ideia, pode cancelar o pedido enquanto ninguém assumiu a vaga.
                    </p>
                </div>

                {mySchedules.length === 0 ? (
                    <div className="text-center py-12 text-zinc-400">
                        <Calendar className="mx-auto mb-3 opacity-20" size={48}/>
                        <p>Você não está escalado em nenhum evento neste mês.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {mySchedules.map((item, idx) => (
                            <div key={idx} className="bg-white dark:bg-zinc-800 p-5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm animate-slide-up">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-bold text-zinc-800 dark:text-white">{item.event.title}</h3>
                                        <p className="text-sm text-zinc-500">{item.event.dateDisplay} • {item.event.iso.split('T')[1]?.substring(0, 5)}</p>
                                    </div>
                                    <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-lg text-zinc-500">
                                        <Clock size={20}/>
                                    </div>
                                </div>
                                
                                <div className="space-y-3">
                                    {item.roles.map(role => {
                                        return (
                                            <div key={role} className="flex flex-col gap-2 p-3 rounded-xl border transition-all bg-zinc-50 dark:bg-zinc-900/50 border-zinc-100 dark:border-zinc-700/50">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{role}</span>
                                                </div>
                                                
                                                <button 
                                                    onClick={async () => {
                                                        try {
                                                            await onCreateRequest(role, item.event.iso, item.event.title);
                                                            setActiveTab('wall');
                                                        } catch (e) {
                                                            // Error is handled in App.tsx
                                                        }
                                                    }}
                                                    className="w-full text-xs font-bold text-white bg-secondary hover:bg-secondaryHover py-2 rounded-lg transition-colors shadow-sm shadow-secondary/20 active:scale-95"
                                                >
                                                    Solicitar Troca
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {activeTab === 'wall' && (
            <div className="space-y-4">
                 <div className="bg-secondary/10 dark:bg-secondary/5 p-4 rounded-xl border border-secondary/20 dark:border-secondary/30 flex items-start gap-3">
                    <CheckCircle2 className="text-secondary dark:text-white shrink-0 mt-0.5" size={18} />
                    <p className="text-sm text-secondary dark:text-white">
                        Aqui aparecem pedidos de troca <strong>compatíveis com suas funções</strong>. Se você estiver disponível, clique em "Assumir Escala" para realizar a troca automaticamente.
                    </p>
                </div>

                {visibleRequests.length === 0 ? (
                    <div className="text-center py-12 text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                        <FilterX className="mx-auto mb-3 opacity-20" size={48}/>
                        <p className="font-medium text-zinc-500">Nenhum pedido compatível.</p>
                        <p className="text-xs text-zinc-400 mt-1">Não há trocas pendentes para suas funções no momento.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {visibleRequests.map(req => {
                            const evtIso = req.eventIso.split('|')[0];
                            const dateDisplay = evtIso.split('T')[0].split('-').reverse().join('/');
                            const timeDisplay = evtIso.split('T')[1]?.substring(0, 5) || '';

                            return (
                                <div key={req.id} className="bg-white dark:bg-zinc-800 p-5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm relative overflow-hidden animate-slide-up">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-secondary"></div>
                                    
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-full bg-secondary/10 dark:bg-secondary/20 flex items-center justify-center text-secondary dark:text-white font-bold">
                                            <User size={18}/>
                                        </div>
                                        <div>
                                            <p className="text-xs text-zinc-500 uppercase font-bold">Solicitante</p>
                                            <p className="font-bold text-zinc-800 dark:text-white">{req.requesterName}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2 mb-6">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-zinc-500">Evento:</span>
                                            <span className="font-medium text-zinc-800 dark:text-zinc-200 text-right">{req.eventTitle}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-zinc-500">Data:</span>
                                            <span className="font-medium text-zinc-800 dark:text-zinc-200">{dateDisplay} às {timeDisplay}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-zinc-500">Função:</span>
                                            <span className="font-bold text-secondary dark:text-white bg-secondary/10 px-2 py-0.5 rounded">{req.role}</span>
                                        </div>
                                    </div>

                                    {req.requesterName === currentUser.name ? (
                                        <button 
                                            onClick={() => {
                                                confirmAction(
                                                    "Cancelar Pedido",
                                                    "Deseja remover este pedido do mural de trocas?",
                                                    () => onCancelRequest?.(req.id)
                                                );
                                            }}
                                            className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all bg-white dark:bg-zinc-800 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/30 active:scale-95"
                                        >
                                            <Trash2 size={18}/> Retirar do Mural
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => {
                                                confirmAction(
                                                    "Assumir Escala",
                                                    `Você deseja assumir a escala de ${req.requesterName} para o evento "${req.eventTitle}"?`,
                                                    () => onAcceptRequest(req.id)
                                                );
                                            }}
                                            className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all bg-secondary hover:bg-secondaryHover text-white shadow-lg shadow-secondary/20 active:scale-95"
                                        >
                                            Assumir Escala <ArrowRight size={18}/>
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        )}
    </div>
  );
};
