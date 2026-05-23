import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSupabase } from '../services/supabase/client';
import { User } from '../types';
import { 
  Music, Sparkles, ExternalLink, Tv, ShieldAlert, X
} from 'lucide-react';

interface Props {
  eventRuleId: string | null | undefined;
  eventDate: string | null | undefined;
  currentUser: User | null;
  orgId: string | null | undefined;
  ministryId: string | null | undefined;
  onClose: () => void;
}

export const ServiceSchedule: React.FC<Props> = ({ eventRuleId, eventDate, currentUser, orgId, ministryId, onClose }) => {
  // 1. Buscar funções do membro no ministério atual
  const { data: memberFunctions = [], isLoading: loadingFunctions } = useQuery({
    queryKey: ['member_ministry_functions', currentUser?.id, ministryId],
    queryFn: async () => {
      const sb = getSupabase();
      if (!sb || !currentUser?.id || !ministryId) return [];
      const { data } = await sb
        .from('ministry_members')
        .select('functions')
        .eq('profile_id', currentUser.id)
        .eq('ministry_id', ministryId)
        .maybeSingle();
      return data?.functions || [];
    },
    enabled: !!currentUser?.id && !!ministryId
  });

  // 2. Buscar músicas do repertório
  const { data: songs = [], isLoading: loadingSongs } = useQuery({
    queryKey: ['repertoire_event_songs', eventRuleId, eventDate, ministryId],
    queryFn: async () => {
      const sb = getSupabase();
      if (!sb || !orgId || !ministryId) return [];

      let query = sb
        .from('repertoire_items')
        .select('*')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId);

      if (eventRuleId) {
        query = query.eq('event_rule_id', eventRuleId);
      } else if (eventDate) {
        query = query.eq('event_date', eventDate);
      } else {
        return [];
      }

      const { data } = await query;
      return data || [];
    },
    enabled: !!orgId && !!ministryId && (!!eventRuleId || !!eventDate)
  });

  // Verifica se o membro tem função de projeção ou mídia
  const hasProjectionAccess = memberFunctions.some((f: string) => {
    const low = f.toLowerCase();
    return low.includes('projeção') || low.includes('projecao') || low.includes('mídia') || low.includes('midia') || low.includes('som') || low.includes('áudio') || low.includes('audio') || low.includes('louvor');
  });

  if (!eventDate) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl w-full max-w-4xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh] animate-slide-up">
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-[#c9a84c]/10 text-[#c9a84c] rounded-full border border-[#c9a84c]/20">
                Conteúdo do Culto
              </span>
            </div>
            <h3 className="text-xl md:text-2xl font-black text-[#0f1f3d] dark:text-white tracking-tight">
              Repertório & Diretrizes
            </h3>
          </div>
          <button onClick={onClose} className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition-colors">
            <X size={24} className="text-zinc-500 dark:text-zinc-400" />
          </button>
        </div>

        <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar bg-white dark:bg-zinc-900">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Left Side: Repertório */}
            <div className="space-y-6">
              <h4 className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Music size={16} /> Repertório Musical
              </h4>
              
              <div className="bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800/80 rounded-3xl p-6">
                 {loadingSongs ? (
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] animate-ping"></span> Carregando repertório...
                    </div>
                  ) : hasProjectionAccess ? (
                    songs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-3 p-6 text-center text-amber-500 dark:text-amber-400 text-sm font-bold bg-amber-500/5 rounded-2xl border border-amber-500/10">
                        <ShieldAlert size={24} />
                        <span>Nenhum louvor definido para este culto.</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-[#c9a84c] tracking-widest mb-2">
                          <Tv size={14} /> {songs.length} Música{songs.length > 1 ? 's' : ''} Selecionada{songs.length > 1 ? 's' : ''}
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {songs.map((song: any) => (
                            <div key={song.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm hover:border-[#c9a84c]/50 transition-colors">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-[#c9a84c]/10 flex items-center justify-center shrink-0">
                                  <Music size={14} className="text-[#c9a84c]" />
                                </div>
                                <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">{song.title}</span>
                              </div>
                              {song.link && (
                                <a 
                                  href={song.link} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="w-8 h-8 flex items-center justify-center bg-zinc-100 dark:bg-zinc-700 text-zinc-500 hover:text-[#c9a84c] hover:bg-[#c9a84c]/10 rounded-full transition-colors shrink-0"
                                >
                                  <ExternalLink size={14} />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center text-zinc-500 dark:text-zinc-400 text-sm font-bold bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl">
                      <ShieldAlert size={32} className="opacity-50" />
                      <div>
                        <p>Acesso Restrito</p>
                        <p className="text-xs font-medium mt-1">Repertório é exclusivo para equipes de Mídia, Projeção, Som e Louvor.</p>
                      </div>
                    </div>
                  )}
              </div>
            </div>

            {/* Right Side: Diretrizes Práticas */}
            <div className="space-y-6">
              <h4 className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Sparkles size={16} /> Diretrizes Práticas
              </h4>
              
              <div className="bg-[#0f1f3d]/5 dark:bg-[#c9a84c]/5 border border-[#0f1f3d]/10 dark:border-[#c9a84c]/10 rounded-3xl p-6 space-y-6">
                <ul className="space-y-5">
                  <li className="flex items-start gap-4">
                    <span className="mt-1 h-2 w-2 rounded-full bg-[#c9a84c] shrink-0"></span>
                    <div>
                      <h6 className="text-xs font-extrabold text-[#0f1f3d] dark:text-white uppercase tracking-wider mb-1">Postura Espiritual</h6>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">Esteja em oração antes do início do culto para ministrar com graça e integridade.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <span className="mt-1 h-2 w-2 rounded-full bg-[#c9a84c] shrink-0"></span>
                    <div>
                      <h6 className="text-xs font-extrabold text-[#0f1f3d] dark:text-white uppercase tracking-wider mb-1">Pontualidade Britânica</h6>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">Chegue com pelo menos 30 minutos de antecedência. O atraso compromete todo o roteiro.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <span className="mt-1 h-2 w-2 rounded-full bg-[#c9a84c] shrink-0"></span>
                    <div>
                      <h6 className="text-xs font-extrabold text-[#0f1f3d] dark:text-white uppercase tracking-wider mb-1">Check-list de Equipamentos</h6>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">Verifique cabos, baterias, notebooks e conexões antes da abertura dos portões.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <span className="mt-1 h-2 w-2 rounded-full bg-[#c9a84c] shrink-0"></span>
                    <div>
                      <h6 className="text-xs font-extrabold text-[#0f1f3d] dark:text-white uppercase tracking-wider mb-1">Acolhimento Amoroso</h6>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">Sorria e receba a igreja com alegria. O serviço começa com um abraço e bom testemunho.</p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
