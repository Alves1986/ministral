
import React, { useState, useEffect } from 'react';
import { X, Check, Loader2, Plus, Building2, Mail } from 'lucide-react';
import { DEFAULT_ROLES } from '../types';
import { fetchMinistrySettings } from '../services/supabaseService';
import { useAppStore } from '../store/appStore';
import { useSession } from '../context/SessionContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (ministryId: string, roles: string[]) => Promise<void>;
  alreadyJoined: string[]; // IDs dos ministérios que o usuário JÁ participa
  isPro?: boolean;
}

export const JoinMinistryModal: React.FC<Props> = ({ isOpen, onClose, onJoin, alreadyJoined, isPro }) => {
  const [selectedMinistry, setSelectedMinistry] = useState<string | null>(null);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const { availableMinistries } = useAppStore();
  const { user: sessionUser } = useSession();
  
  // Usar o user da sessão para garantir dados atualizados de admin/organization
  const activeUser = sessionUser;
  const isSuperAdmin = activeUser?.isSuperAdmin;
  const orgId = activeUser?.organizationId;

  // Filtra ministérios disponíveis (exclui os que o usuário já tem)
  const availableToJoin = availableMinistries.filter(m => !alreadyJoined.includes(m.id));
  const isTrialLimit = !isPro && alreadyJoined.length >= 1;

  // Carrega as funções quando um ministério é selecionado
  useEffect(() => {
    async function fetchRoles() {
      if (!selectedMinistry) {
        setAvailableRoles([]);
        setSelectedRoles([]);
        return;
      }

      if (!orgId) return;

      setLoadingRoles(true);
      
      // Encontrar o código do ministério para fallback de roles
      const min = availableMinistries.find(m => m.id === selectedMinistry);
      const minLabel = min?.label?.toLowerCase() || '';
      const minCode = min?.code?.toLowerCase() || 'default';
      
      let defaults = DEFAULT_ROLES[minCode] || [];
      
      // Fallback baseado no nome se o código não bater
      if (defaults.length === 0) {
          if (minLabel.includes('midia')) defaults = DEFAULT_ROLES['midia'];
          else if (minLabel.includes('louvor')) defaults = DEFAULT_ROLES['louvor'];
          else if (minLabel.includes('infantil')) defaults = DEFAULT_ROLES['infantil'];
          else if (minLabel.includes('musica')) defaults = DEFAULT_ROLES['louvor'];
          else if (minLabel.includes('kids')) defaults = DEFAULT_ROLES['infantil'];
          else defaults = DEFAULT_ROLES['default'];
      }
      
      try {
        const settings = await fetchMinistrySettings(selectedMinistry, orgId);
        const dynamicRoles = settings?.roles;
        if (dynamicRoles && dynamicRoles.length > 0) {
            setAvailableRoles(dynamicRoles.filter((r: string) => !r.startsWith('__vocal_count:') && !r.startsWith('__dance_count:')));
        } else {
            setAvailableRoles(defaults);
        }
      } catch (e) {
        setAvailableRoles(defaults);
      } finally {
        setLoadingRoles(false);
      }
    }

    fetchRoles();
  }, [selectedMinistry, orgId, availableMinistries]);

  const toggleRole = (role: string) => {
    if (selectedRoles.includes(role)) {
      setSelectedRoles(selectedRoles.filter(r => r !== role));
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  const handleJoin = async () => {
    if (!selectedMinistry) return;
    setSubmitting(true);
    try {
        await onJoin(selectedMinistry, selectedRoles);
        
        // Se for super admin entra direto, senão avisa que enviou solicitação
        if (!isSuperAdmin) {
            alert("Solicitação enviada com sucesso! Aguarde a aprovação dos administradores deste ministério.");
        }
        
        onClose();
    } catch (error) {
        console.error("Erro ao entrar no ministério:", error);
        alert("Ocorreu um erro ao processar sua solicitação.");
    } finally {
        setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg border border-zinc-200 dark:border-zinc-700 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                {isSuperAdmin ? 'Entrar em Novo Ministério' : 'Solicitar Entrada em Ministério'}
            </h2>
            <p className="text-sm text-zinc-500">
                {isSuperAdmin ? 'Expanda sua participação na equipe.' : 'Sua solicitação será enviada para aprovação.'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          
          {/* 1. Seleção de Ministério */}
          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Escolha o Ministério</label>
            {isTrialLimit ? (
                <div className="p-4 bg-ministral-gold/10 dark:bg-ministral-gold/20 border border-ministral-gold/30 rounded-xl text-center text-ministral-gold dark:text-ministral-gold text-sm">
                    O plano Trial permite apenas 1 ministério. Faça o upgrade para o Plano Pro para participar de múltiplos ministérios.
                </div>
            ) : availableToJoin.length === 0 ? (
                <div className="p-4 bg-zinc-100 dark:bg-zinc-900 rounded-xl text-center text-zinc-500 text-sm">
                    {availableMinistries.length === 0 
                        ? 'Nenhum ministério carregado.' 
                        : 'Você já participa de todos os ministérios disponíveis!'}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-2">
                    {availableToJoin.map(m => (
                        <button
                            key={m.id}
                            onClick={() => setSelectedMinistry(m.id)}
                            className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                                selectedMinistry === m.id
                                ? 'bg-ministral-50 dark:bg-ministral-900/20 border-ministral-500 text-ministral-700 dark:text-ministral-300 ring-1 ring-ministral-500'
                                : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-ministral-300 dark:hover:border-zinc-600'
                            }`}
                        >
                            <span className="flex items-center gap-2">
                                <Building2 size={18} className={selectedMinistry === m.id ? 'text-ministral-500' : 'text-zinc-400'}/>
                                {m.label}
                            </span>
                            {selectedMinistry === m.id && <Check size={18} className="text-ministral-500"/>}
                        </button>
                    ))}
                </div>
            )}
          </div>

          {/* 2. Seleção de Funções (Condicional) */}
          {selectedMinistry && (
              <div className="animate-fade-in">
                  <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-zinc-500 uppercase">Suas Funções (Neste Ministério)</label>
                      {loadingRoles && <Loader2 size={14} className="animate-spin text-ministral-500"/>}
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                      {availableRoles.length > 0 ? availableRoles.map(role => {
                          const isSelected = selectedRoles.includes(role);
                          return (
                              <button
                                  key={role}
                                  onClick={() => toggleRole(role)}
                                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 ${
                                      isSelected 
                                      ? 'bg-ministral-500 text-white border-ministral-500 shadow-md' 
                                      : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                                  }`}
                              >
                                  {role}
                                  {isSelected && <Check size={12} />}
                              </button>
                          );
                      }) : (
                          <p className="text-sm text-zinc-400 italic">Nenhuma função específica.</p>
                      )}
                  </div>
              </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 rounded-b-2xl flex justify-end gap-3">
            <button 
                onClick={onClose}
                className="px-4 py-2 text-sm font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition-colors"
            >
                Cancelar
            </button>
            <button 
                onClick={handleJoin}
                disabled={!selectedMinistry || submitting || isTrialLimit}
                className="px-6 py-2 bg-ministral-500 hover:bg-ministral-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-ministral-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all active:scale-95"
            >
                {submitting ? <Loader2 size={16} className="animate-spin"/> : (isSuperAdmin ? <Plus size={16} /> : <Mail size={16} />)}
                {isSuperAdmin ? 'Confirmar Entrada' : 'Solicitar Entrada'}
            </button>
        </div>
      </div>
    </div>
  );
};
