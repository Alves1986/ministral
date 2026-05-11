
import React, { useEffect, useState } from 'react';
import { Trophy, Crown, Info, X, RefreshCw, Star, Check, Award, History, ArrowDown, ArrowUp, Calendar, Heart, Eye, Coins, CalendarCheck, XCircle, UserCheck, Zap, Gift } from 'lucide-react';
import { RankingEntry, User as UserType, RankingHistoryItem } from '../types';
import { fetchRankingData } from '../services/supabaseService';

interface Props {
  ministryId: string;
  currentUser: UserType;
}

// --- Helpers ---
const GloryIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <img
    src="/branding/glorycoin.png"
    alt="GloryCoin"
    width={size}
    height={size}
    className={`object-contain drop-shadow-sm ${className}`}
  />
);

// --- History Modal Component ---
const HistoryModal = ({ isOpen, onClose, history, memberName, totalPoints }: { isOpen: boolean; onClose: () => void; history: RankingHistoryItem[]; memberName: string; totalPoints: number }) => {
    if (!isOpen) return null;

    const getIcon = (type: string) => {
        switch(type) {
            case 'assignment': return <Calendar size={16} className="text-secondary dark:text-white" />;
            case 'swap_assumed': return <RefreshCw size={16} className="text-emerald-500" />;
            case 'availability': return <CalendarCheck size={16} className="text-blue-500" />;
            case 'checkin_miss': return <XCircle size={16} className="text-red-500" />;
            case 'profile_complete': return <UserCheck size={16} className="text-accent" />;
            case 'month_complete': return <Trophy size={16} className="text-yellow-500" />;
            case 'streak_bonus': return <Zap size={16} className="text-yellow-500" />;
            case 'redeem': return <Gift size={16} className="text-red-500" />;
            case 'announcement_read': return <Eye size={16} className="text-secondary dark:text-white" />;
            case 'announcement_like': return <Heart size={16} className="text-pink-500" />;
            default: return <Star size={16} className="text-zinc-500" />;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[85vh]">
                <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 rounded-t-2xl">
                    <div>
                        <h3 className="font-bold text-zinc-900 dark:text-white text-lg flex items-center gap-2">
                            <History size={20} className="text-secondary dark:text-white"/> Histórico de Pontos
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            Extrato de {memberName.split(' ')[0]} • <span className="flex items-center gap-1">
                                <GloryIcon size={12}/>
                                {totalPoints} GC
                            </span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-0 overflow-y-auto custom-scrollbar flex-1">
                    {history.length === 0 ? (
                        <div className="p-10 text-center text-zinc-400">
                            <Star size={32} className="mx-auto mb-2 opacity-20"/>
                            <p className="text-sm">Nenhum registro de pontos ainda.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {history.map((item, idx) => (
                                <div key={idx} className="p-4 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${item.points > 0 ? 'bg-secondary/10 dark:bg-secondary/20 border-secondary/20 dark:border-secondary/30' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                                        {getIcon(item.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">{item.description}</p>
                                        <p className="text-[10px] text-zinc-500 uppercase font-medium">{new Date(item.date).toLocaleDateString('pt-BR')} • {new Date(item.date).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</p>
                                    </div>
                                    <div className={`font-black text-sm whitespace-nowrap ${item.points > 0 ? 'text-secondary dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
                                        {item.points > 0 ? '+' : ''}{item.points}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const RankingScreen: React.FC<Props> = ({ ministryId, currentUser }) => {
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<{ history: RankingHistoryItem[], name: string, points: number } | null>(null);

  const loadData = async () => {
      // FIX: Guard against missing organizationId
      if (!currentUser.organizationId) {
          console.warn("[Ranking] OrganizationID missing");
          setLoading(false);
          return;
      }

      setLoading(true);
      try {
          const orgId = currentUser.organizationId;
          const data = await fetchRankingData(ministryId, orgId);
          
          const sorted = data.sort((a, b) => {
              if (b.points !== a.points) {
                  return b.points - a.points;
              }
              return a.name.localeCompare(b.name);
          });
          
          setRanking(sorted);
      } catch (error) {
          console.error("[Ranking] Error loading data:", error);
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      if (currentUser.organizationId) {
          loadData();
      }
  }, [ministryId, currentUser.organizationId]);

  const getMedalColor = (index: number) => {
      if (index === 0) return 'text-accent'; // Ouro
      if (index === 1) return 'text-zinc-400';   // Prata
      if (index === 2) return 'text-amber-700';  // Bronze
      return 'text-zinc-500';
  };

  const handleOpenHistory = (entry: RankingEntry) => {
      setSelectedHistory({
          history: entry.history,
          name: entry.name,
          points: entry.points
      });
  };

  if (loading) {
    return (
        <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-10">
             {/* Header Skeleton */}
             <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-700 pb-4">
                 <div className="space-y-2">
                    <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse"></div>
                    <div className="h-4 w-64 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse"></div>
                 </div>
                 <div className="h-8 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse"></div>
             </div>
             
             <div className="grid grid-cols-3 gap-4 items-end mb-8 h-48 px-4">
                 <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-t-lg animate-pulse opacity-60"></div>
                 <div className="h-48 bg-zinc-200 dark:bg-zinc-800 rounded-t-lg animate-pulse"></div>
                 <div className="h-24 bg-zinc-200 dark:bg-zinc-800 rounded-t-lg animate-pulse opacity-60"></div>
             </div>

             <div className="h-24 w-full bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse mb-6"></div>

             <div className="space-y-3">
                 {[1,2,3,4,5].map(i => (
                     <div key={i} className="h-16 w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse border border-zinc-200 dark:border-zinc-700"></div>
                 ))}
             </div>
        </div>
    )
  }

  const myRank = ranking.findIndex(r => r.memberId === currentUser.id);
  const myData = ranking[myRank];
  const displayList = ranking;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-24">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-200 dark:border-zinc-700 pb-4 gap-4">
            <div>
                <h2 className="text-2xl font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                    <GloryIcon size={28} className="-mt-1"/> Destaques do Ano
                </h2>
                <p className="text-zinc-500 text-sm mt-1">
                    Acumule GloryCoins servindo com dedicação. Os melhores serão premiados!
                </p>
            </div>
            
            <div className="flex gap-2 self-end">
                <button 
                    onClick={() => setShowRules(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-secondary/10 dark:bg-secondary/5 text-secondary dark:text-white rounded-lg text-xs font-bold hover:bg-secondary/20 transition-colors"
                >
                    <Info size={16}/> Regras
                </button>
                <button 
                    onClick={loadData}
                    className="p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-white rounded-lg transition-colors"
                >
                    <RefreshCw size={18} className={loading ? "animate-spin" : ""}/>
                </button>
            </div>
        </div>

        {/* Podium (Top 3) */}
        {!loading && displayList.length > 0 && (
            <div className="grid grid-cols-3 gap-2 md:gap-4 items-end mb-8 relative px-2">
                {/* 2nd Place */}
                {displayList[1] && (
                    <div onClick={() => handleOpenHistory(displayList[1])} className="flex flex-col items-center animate-slide-up cursor-pointer group" style={{ animationDelay: '0.1s' }}>
                        <div className="relative mb-2 transition-transform group-hover:scale-105">
                            {displayList[1].avatar_url ? (
                                <img src={displayList[1].avatar_url} className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-zinc-300 object-cover shadow-lg" />
                            ) : (
                                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-zinc-300 bg-zinc-200 flex items-center justify-center text-zinc-500 font-bold text-xl shadow-lg">
                                    {displayList[1].name.charAt(0)}
                                </div>
                            )}
                            <div className="absolute -bottom-2 -right-2 bg-zinc-400 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs border-2 border-white dark:border-zinc-800">2</div>
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-zinc-800 dark:text-white text-xs md:text-sm line-clamp-1">{displayList[1].name}</p>
                            <span className="flex items-center justify-center gap-1">
                                <GloryIcon size={14}/>
                                <span className={`text-xs font-bold ${displayList[1].points < 0 ? 'text-red-500' : 'text-zinc-500'}`}>{displayList[1].points}</span>
                            </span>
                        </div>
                        <div className="h-16 md:h-24 w-full bg-gradient-to-t from-zinc-200 to-zinc-100 dark:from-zinc-800 dark:to-zinc-700 rounded-t-lg mt-2 opacity-80 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                )}

                {/* 1st Place */}
                {displayList[0] && (
                    <div onClick={() => handleOpenHistory(displayList[0])} className="flex flex-col items-center animate-slide-up z-10 w-full cursor-pointer group" style={{ animationDelay: '0s' }}>
                        <div className="relative mb-3 transition-transform group-hover:scale-105">
                            <Crown className="absolute -top-6 left-1/2 -translate-x-1/2 text-accent drop-shadow-md animate-bounce" size={28} fill="currentColor"/>
                            {displayList[0].avatar_url ? (
                                <img src={displayList[0].avatar_url} className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-accent object-cover shadow-xl" />
                            ) : (
                                <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-accent bg-accent/10 flex items-center justify-center text-accent font-bold text-2xl shadow-xl">
                                    {displayList[0].name.charAt(0)}
                                </div>
                            )}
                            <div className="absolute -bottom-3 -right-2 bg-accent text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-md border-2 border-white dark:border-zinc-800">1</div>
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-zinc-900 dark:text-white text-sm md:text-base line-clamp-1">{displayList[0].name}</p>
                            <span className="flex items-center justify-center gap-1">
                                <GloryIcon size={14}/>
                                <span className={`font-black text-sm md:text-lg ${displayList[0].points < 0 ? 'text-red-500' : 'text-accent'}`}>{displayList[0].points}</span>
                            </span>
                        </div>
                        <div className="h-24 md:h-32 w-full bg-gradient-to-t from-accent/20 to-accent/5 dark:from-accent/20 dark:to-accent/5 rounded-t-xl mt-2 border-x border-t border-accent/30 dark:border-accent/30 relative overflow-hidden group-hover:opacity-100 transition-opacity">
                            <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                        </div>
                    </div>
                )}

                {/* 3rd Place */}
                {displayList[2] && (
                    <div onClick={() => handleOpenHistory(displayList[2])} className="flex flex-col items-center animate-slide-up cursor-pointer group" style={{ animationDelay: '0.2s' }}>
                        <div className="relative mb-2 transition-transform group-hover:scale-105">
                            {displayList[2].avatar_url ? (
                                <img src={displayList[2].avatar_url} className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-amber-700/50 object-cover shadow-lg" />
                            ) : (
                                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-amber-700/50 bg-amber-100 flex items-center justify-center text-amber-800 font-bold text-xl shadow-lg">
                                    {displayList[2].name.charAt(0)}
                                </div>
                            )}
                            <div className="absolute -bottom-2 -right-2 bg-amber-700 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs border-2 border-white dark:border-zinc-800">3</div>
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-zinc-800 dark:text-white text-xs md:text-sm line-clamp-1">{displayList[2].name}</p>
                            <span className="flex items-center justify-center gap-1">
                                <GloryIcon size={14}/>
                                <span className={`text-xs font-bold ${displayList[2].points < 0 ? 'text-red-500' : 'text-zinc-500'}`}>{displayList[2].points}</span>
                            </span>
                        </div>
                        <div className="h-12 md:h-16 w-full bg-gradient-to-t from-orange-100 to-white dark:from-orange-900/30 dark:to-zinc-800 rounded-t-lg mt-2 opacity-80 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                )}
            </div>
        )}

        {/* My Score Card */}
        {myData && !loading && (
            <div 
                onClick={() => handleOpenHistory(myData)}
                className="bg-gradient-to-r from-accent to-ministral-600 rounded-xl p-4 text-white shadow-lg mb-6 flex items-center justify-between cursor-pointer hover:scale-[1.01] transition-transform active:scale-[0.99]"
            >
                <div className="flex items-center gap-4">
                    <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
                        <GloryIcon size={32}/>
                    </div>
                    <div>
                        <p className="text-white/80 text-xs font-bold uppercase flex items-center gap-1">
                            Seus GloryCoins <Coins size={10} className="opacity-70"/>
                        </p>
                        <h3 className={`text-2xl font-bold flex items-center gap-2 ${myData.points < 0 ? 'text-red-300' : ''}`}>
                            {myData.points}
                            <span className="text-base font-medium opacity-80">GloryCoins</span>
                        </h3>
                        <p className="text-xs text-white/60 mt-0.5">Posição atual: #{myRank + 1}</p>
                    </div>
                </div>
                <div className="text-right hidden sm:block">
                    <div className="text-xs opacity-80">Escalas Cumpridas</div>
                    <div className="font-bold text-lg">{myData.stats.confirmedEvents}</div>
                </div>
            </div>
        )}

        {/* Ranking List */}
        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50">
                <h3 className="font-bold text-zinc-700 dark:text-zinc-300 text-sm">Classificação Geral</h3>
            </div>
            
            {displayList.length === 0 ? (
                <div className="p-12 text-center text-zinc-400">
                    <History size={48} className="mx-auto mb-3 opacity-20"/>
                    <p>Nenhum membro encontrado neste ministério.</p>
                </div>
            ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
                    {displayList.map((user, idx) => (
                        <div 
                            key={user.memberId} 
                            onClick={() => handleOpenHistory(user)}
                            className={`flex items-center justify-between p-4 transition-colors cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/30 ${user.memberId === currentUser.id ? 'bg-secondary/10 dark:bg-secondary/5' : ''}`}
                        >
                            <div className="flex items-center gap-4">
                                <span className={`font-bold w-6 text-center text-sm ${idx < 3 ? getMedalColor(idx) : 'text-zinc-400'}`}>
                                    #{idx + 1}
                                </span>
                                
                                {user.avatar_url ? (
                                    <img src={user.avatar_url} className="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-700" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-zinc-500 font-bold text-xs">
                                        {user.name.charAt(0)}
                                    </div>
                                )}
                                <div>
                                    <p className={`font-bold text-sm ${user.memberId === currentUser.id ? 'text-secondary dark:text-white' : 'text-zinc-800 dark:text-zinc-200'}`}>
                                        {user.name} {user.memberId === currentUser.id && '(Você)'}
                                    </p>
                                    <div className="flex items-center gap-3 text-[10px] text-zinc-500 mt-0.5">
                                        <span className="flex items-center gap-1" title="Escalas Cumpridas"><Check size={10} className="text-secondary dark:text-white"/> {user.stats.confirmedEvents}</span>
                                        <span className="flex items-center gap-1" title="Trocas Assumidas"><RefreshCw size={10} className="text-secondary dark:text-white"/> {user.stats.swapsAssumed}</span>
                                        <span className="flex items-center gap-1" title="Avisos Lidos"><Eye size={10} className="text-secondary dark:text-white"/> {user.stats.announcementsRead}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                                <GloryIcon size={16}/>
                                <span className={`font-black ${user.points < 0 ? 'text-red-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                    {user.points}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* History Modal */}
        {selectedHistory && (
            <HistoryModal 
                isOpen={!!selectedHistory} 
                onClose={() => setSelectedHistory(null)}
                history={selectedHistory.history}
                memberName={selectedHistory.name}
                totalPoints={selectedHistory.points}
            />
        )}

        {/* Rules Modal */}
        {showRules && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div 
                    className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Modal Header */}
                    <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 sticky top-0 z-10">
                        <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                            <GloryIcon size={20}/> Como Pontuar em GloryCoins
                        </h3>
                        <button 
                            onClick={() => setShowRules(false)}
                            className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Modal Content - Scrollable */}
                    <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                        <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4 bg-accent/5 p-3 rounded-lg border border-accent/10">
                            Acumule GloryCoins (GC) engajando com a equipe e cumprindo suas escalas. Os bônus ajudam você a subir no ranking!
                        </p>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center p-3 rounded-lg border border-zinc-100 dark:border-zinc-700">
                                <div>
                                    <span className='text-sm font-bold'>Escala Confirmada (check-in)</span>
                                    <p className='text-xs text-zinc-500'>Confirme sua presença no dia do evento</p>
                                </div>
                                <span className='font-black text-accent'>+150 GC</span>
                            </div>
                            <div className="flex justify-between items-center p-3 rounded-lg border border-zinc-100 dark:border-zinc-700">
                                <div>
                                    <span className='text-sm font-bold'>Assumir Troca de Outro Membro</span>
                                    <p className='text-xs text-zinc-500'>Quando você aceita o lugar de outro membro</p>
                                </div>
                                <span className='font-black text-accent'>+80 GC</span>
                            </div>
                            <div className="flex justify-between items-center p-3 rounded-lg border border-zinc-100 dark:border-zinc-700">
                                <div>
                                    <span className='text-sm font-bold'>Disponibilidade Antecipada</span>
                                    <p className='text-xs text-zinc-500'>Marque sua disponibilidade com 7+ dias de antecedência</p>
                                </div>
                                <span className='font-black text-accent'>+20 GC</span>
                            </div>
                            <div className="flex justify-between items-center p-3 rounded-lg border border-zinc-100 dark:border-zinc-700">
                                <div>
                                    <span className='text-sm font-bold'>Bônus de Sequência (3 escalas seguidas)</span>
                                    <p className='text-xs text-zinc-500'>A cada 3 participações consecutivas sem falta</p>
                                </div>
                                <span className='font-black text-accent'>+50 GC</span>
                            </div>
                            <div className="flex justify-between items-center p-3 rounded-lg border border-zinc-100 dark:border-zinc-700">
                                <div>
                                    <span className='text-sm font-bold'>Bônus Mensal (todas escalas sem trocas)</span>
                                    <p className='text-xs text-zinc-500'>Cumpra todas as escalas do mês sem nenhuma troca</p>
                                </div>
                                <span className='font-black text-accent'>+100 GC</span>
                            </div>
                            <div className="flex justify-between items-center p-3 rounded-lg border border-zinc-100 dark:border-zinc-700">
                                <div>
                                    <span className='text-sm font-bold'>Curtir Aviso</span>
                                </div>
                                <span className='font-black text-accent'>+15 GC</span>
                            </div>
                            <div className="flex justify-between items-center p-3 rounded-lg border border-zinc-100 dark:border-zinc-700">
                                <div>
                                    <span className='text-sm font-bold'>Ler Aviso</span>
                                </div>
                                <span className='font-black text-accent'>+10 GC</span>
                            </div>
                            <div className="flex justify-between items-center p-3 rounded-lg border border-zinc-100 dark:border-zinc-700">
                                <div>
                                    <span className='text-sm font-bold'>Completar Perfil (foto+whatsapp+nasc.)</span>
                                    <p className='text-xs text-zinc-500'>Apenas uma vez por membro</p>
                                </div>
                                <span className='font-black text-accent'>+50 GC</span>
                            </div>
                            <div className="flex justify-between items-center p-3 rounded-lg border border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10">
                                <div>
                                    <span className='text-sm font-bold text-red-600 dark:text-red-400'>Solicitar Troca de Escala</span>
                                    <p className='text-xs text-zinc-500'>Penalidade aplicada ao pedir para sair de uma escala</p>
                                </div>
                                <span className='font-black text-red-600 dark:text-red-400'>-50 GC</span>
                            </div>
                            <div className="flex justify-between items-center p-3 rounded-lg border border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10">
                                <div>
                                    <span className='text-sm font-bold text-red-600 dark:text-red-400'>Esquecer de Marcar Check-in</span>
                                    <p className='text-xs text-zinc-500'>Penalidade aplicada após o evento sem confirmação</p>
                                </div>
                                <span className='font-black text-red-600 dark:text-red-400'>-30 GC</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
