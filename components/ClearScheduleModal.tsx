import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Trash2, 
  X, 
  AlertTriangle, 
  Check, 
  Mic, 
  Crown, 
  Music, 
  Filter, 
  Layers, 
  Loader2,
  CheckSquare,
  Square
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  monthLabel: string;
  roles: string[];
  roleCounts?: Record<string, number>;
  totalAssignments?: number;
  onConfirm: (rolesToClear?: string[]) => Promise<void>;
}

export const ClearScheduleModal: React.FC<Props> = ({
  isOpen,
  onClose,
  monthLabel,
  roles,
  roleCounts = {},
  totalAssignments = 0,
  onConfirm,
}) => {
  const [mode, setMode] = useState<'partial' | 'all'>('partial');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Normalizador para busca e comparação
  const norm = (s: string) => 
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  // Deduplica e ordena funções
  const uniqueRoles = useMemo(() => {
    return Array.from(new Set(roles)).filter(Boolean);
  }, [roles]);

  // Identificação de grupos de funções
  const vocalRoles = useMemo(() => {
    return uniqueRoles.filter(r => {
      const n = norm(r);
      return n.includes('vocal') || n.includes('coral') || n.includes('voz');
    });
  }, [uniqueRoles]);

  const ministerRoles = useMemo(() => {
    return uniqueRoles.filter(r => {
      const n = norm(r);
      return n.includes('ministr') || n.includes('dirigent') || n.includes('lider');
    });
  }, [uniqueRoles]);

  const musicianRoles = useMemo(() => {
    return uniqueRoles.filter(r => {
      const n = norm(r);
      return (
        n.includes('bater') ||
        n.includes('baix') ||
        n.includes('guit') ||
        n.includes('viol') ||
        n.includes('tecl') ||
        n.includes('pian') ||
        n.includes('sax') ||
        n.includes('percuss') ||
        n.includes('som')
      );
    });
  }, [uniqueRoles]);

  const danceRoles = useMemo(() => {
    return uniqueRoles.filter(r => {
      const n = norm(r);
      return n.includes('danc') || n.includes('danç') || n.includes('bailar');
    });
  }, [uniqueRoles]);

  // Inicializa a seleção quando o modal abre (padrão: se houver vocais, pré-seleciona vocais ou vazio)
  useEffect(() => {
    if (isOpen) {
      setMode('partial');
      setIsSubmitting(false);
      // Por padrão na abertura, se houver vocal pré-seleciona os vocais como exemplo prático
      if (vocalRoles.length > 0) {
        setSelectedRoles(vocalRoles);
      } else if (uniqueRoles.length > 0) {
        setSelectedRoles([uniqueRoles[0]]);
      } else {
        setSelectedRoles([]);
      }
    }
  }, [isOpen, uniqueRoles, vocalRoles]);

  // Contagem de agendamentos das funções selecionadas
  const selectedAssignmentsCount = useMemo(() => {
    if (mode === 'all') return totalAssignments;
    return selectedRoles.reduce((acc, role) => acc + (roleCounts[role] || 0), 0);
  }, [mode, selectedRoles, roleCounts, totalAssignments]);

  // Acessibilidade e foco
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setTimeout(() => modalRef.current?.focus(), 50);
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const toggleRole = (role: string) => {
    setSelectedRoles(prev => 
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleSelectAll = () => {
    setSelectedRoles(uniqueRoles);
  };

  const handleClearSelection = () => {
    setSelectedRoles([]);
  };

  const handleSelectVocalOnly = () => {
    setSelectedRoles(vocalRoles);
  };

  const handleSelectMinistersOnly = () => {
    setSelectedRoles(ministerRoles);
  };

  const handleSelectMusiciansOnly = () => {
    setSelectedRoles(musicianRoles);
  };

  const handleSelectDanceOnly = () => {
    setSelectedRoles(danceRoles);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (mode === 'partial' && selectedRoles.length === 0) {
      return;
    }

    try {
      setIsSubmitting(true);
      if (mode === 'all') {
        // Limpa tudo
        await onConfirm();
      } else {
        // Limpa funções selecionadas
        await onConfirm(selectedRoles);
      }
      onClose();
    } catch (err) {
      console.error('Falha ao limpar escala:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="clear-schedule-modal-title"
        tabIndex={-1}
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden transform transition-all flex flex-col max-h-[92vh] outline-none"
      >
        {/* Cabeçalho */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 border border-red-200 dark:border-red-900/50">
              <Trash2 size={20} />
            </div>
            <div>
              <h2 id="clear-schedule-modal-title" className="text-lg font-bold text-zinc-900 dark:text-white leading-tight">
                Limpar Escala
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">
                Mês de {monthLabel}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Fechar"
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo com rolagem */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 custom-scrollbar">
          
          {/* Seletor de Modo (Parcial vs Geral) */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Como você deseja limpar?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              
              {/* Opção Parcial */}
              <button
                type="button"
                onClick={() => setMode('partial')}
                className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                  mode === 'partial'
                    ? 'border-ministral-500 bg-ministral-50/50 dark:bg-ministral-950/20 ring-2 ring-ministral-500/20'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-800/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Filter size={16} className={mode === 'partial' ? 'text-ministral-600 dark:text-ministral-400' : 'text-zinc-400'} />
                    <span className="font-bold text-sm text-zinc-900 dark:text-white">Limpeza Parcial</span>
                  </div>
                  <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    mode === 'partial'
                      ? 'border-ministral-500 bg-ministral-500 text-white'
                      : 'border-zinc-300 dark:border-zinc-600'
                  }`}>
                    {mode === 'partial' && <Check size={10} strokeWidth={3} />}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Limpa apenas funções selecionadas (ex: só vocal, só ministros).
                </p>
              </button>

              {/* Opção Geral (Toda a escala) */}
              <button
                type="button"
                onClick={() => setMode('all')}
                className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                  mode === 'all'
                    ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20 ring-2 ring-red-500/20'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-800/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Layers size={16} className={mode === 'all' ? 'text-red-600 dark:text-red-400' : 'text-zinc-400'} />
                    <span className="font-bold text-sm text-zinc-900 dark:text-white">Toda a Escala</span>
                  </div>
                  <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    mode === 'all'
                      ? 'border-red-500 bg-red-500 text-white'
                      : 'border-zinc-300 dark:border-zinc-600'
                  }`}>
                    {mode === 'all' && <Check size={10} strokeWidth={3} />}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Remove todas as pessoas escaladas no mês inteiro.
                </p>
              </button>
            </div>
          </div>

          {/* Configuração do modo Parcial */}
          {mode === 'partial' && (
            <div className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Atalhos Rápidos
                </label>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  <strong className="text-zinc-800 dark:text-zinc-200">{selectedRoles.length}</strong> de {uniqueRoles.length} funções marcadas
                </span>
              </div>

              {/* Chips de Atalhos */}
              <div className="flex flex-wrap gap-1.5">
                {vocalRoles.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectVocalOnly}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 transition-colors"
                  >
                    <Mic size={13} />
                    <span>Somente Vocal ({vocalRoles.length})</span>
                  </button>
                )}

                {ministerRoles.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectMinistersOnly}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 transition-colors"
                  >
                    <Crown size={13} />
                    <span>Somente Ministros ({ministerRoles.length})</span>
                  </button>
                )}

                {musicianRoles.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectMusiciansOnly}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 transition-colors"
                  >
                    <Music size={13} />
                    <span>Somente Músicos ({musicianRoles.length})</span>
                  </button>
                )}

                {danceRoles.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectDanceOnly}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-pink-50 hover:bg-pink-100 dark:bg-pink-950/40 dark:hover:bg-pink-900/40 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800/60 transition-colors"
                  >
                    <span>💃 Somente Dança ({danceRoles.length})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                >
                  Marcar Todos
                </button>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                >
                  Desmarcar
                </button>
              </div>

              {/* Lista de Seleção de Funções com Checkboxes */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-2 bg-zinc-50/50 dark:bg-zinc-950/40 max-h-56 overflow-y-auto custom-scrollbar space-y-1">
                {uniqueRoles.length === 0 ? (
                  <p className="text-xs text-zinc-400 text-center py-4">
                    Nenhuma função encontrada neste ministério.
                  </p>
                ) : (
                  uniqueRoles.map((role) => {
                    const isSelected = selectedRoles.includes(role);
                    const count = roleCounts[role] || 0;

                    return (
                      <div
                        key={role}
                        onClick={() => toggleRole(role)}
                        role="checkbox"
                        aria-checked={isSelected}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault();
                            toggleRole(role);
                          }
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs select-none ${
                          isSelected
                            ? 'bg-ministral-50 dark:bg-ministral-950/30 text-zinc-900 dark:text-white font-semibold'
                            : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <span className={`${isSelected ? 'text-ministral-600 dark:text-ministral-400' : 'text-zinc-400'}`}>
                            {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                          </span>
                          <span className="truncate">{role}</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 font-medium ${
                          count > 0 
                            ? isSelected
                              ? 'bg-ministral-100 dark:bg-ministral-900/60 text-ministral-700 dark:text-ministral-300 font-bold'
                              : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                            : 'text-zinc-400 dark:text-zinc-500'
                        }`}>
                          {count > 0 ? `${count} ${count === 1 ? 'escalado' : 'escalados'}` : 'Vazio'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Aviso de impacto */}
          <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${
            mode === 'all'
              ? 'bg-red-50/70 dark:bg-red-950/30 border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-300'
              : selectedRoles.length === 0
                ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300'
                : 'bg-zinc-100/70 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
          }`}>
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5 leading-relaxed">
              {mode === 'all' ? (
                <>
                  <p className="font-bold">Atenção: Limpeza Completa</p>
                  <p>
                    Todos os <strong>{totalAssignments} agendamento(s)</strong> do mês de <strong>{monthLabel}</strong> serão removidos. Essa ação não pode ser desfeita.
                  </p>
                </>
              ) : selectedRoles.length === 0 ? (
                <>
                  <p className="font-bold">Nenhuma função selecionada</p>
                  <p>Marque ao menos uma função acima ou use um atalho rápido para prosseguir.</p>
                </>
              ) : (
                <>
                  <p className="font-bold">Resumo da Limpeza Parcial</p>
                  <p>
                    Serão removidos <strong>{selectedAssignmentsCount} agendamento(s)</strong> nas <strong>{selectedRoles.length} função(ões)</strong> selecionadas. As demais funções permanecerão inalteradas.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Rodapé com botões de ação */}
        <div className="p-4 sm:p-5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2.5 bg-zinc-50 dark:bg-zinc-900/60">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || (mode === 'partial' && selectedRoles.length === 0)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
              mode === 'all'
                ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20 active:scale-95'
                : 'bg-ministral-500 hover:bg-ministral-600 shadow-ministral-500/20 active:scale-95'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Limpando...</span>
              </>
            ) : mode === 'all' ? (
              <>
                <Trash2 size={16} />
                <span>Limpar Toda a Escala</span>
              </>
            ) : (
              <>
                <Trash2 size={16} />
                <span>Limpar Funções Selecionadas ({selectedRoles.length})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
