import React, { useState, useEffect } from 'react';
import { getSupabase } from '../services/supabaseService';
import { ShieldCheck, Plus, X, Trash2, Loader2, AlertTriangle, Users, Heart, UserMinus, RefreshCw } from 'lucide-react';
import { useToast } from './Toast';
import { TeamMemberProfile } from '../types';

interface ScheduleRulesScreenProps {
    ministryId: string;
    orgId: string;
    availableRoles: string[];
    members: TeamMemberProfile[];
}

interface ConflictRule {
    id: string;
    rule_type: 'block_group' | 'allow_exception' | 'block_members' | 'prefer_together';
    functions: string[];
    label: string | null;
}

export const ScheduleRulesScreen: React.FC<ScheduleRulesScreenProps> = ({ ministryId, orgId, availableRoles, members }) => {
    const [rules, setRules] = useState<ConflictRule[]>([]);
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();

    // Form states for new exception
    const [newExceptionRoleA, setNewExceptionRoleA] = useState('');
    const [newExceptionRoleB, setNewExceptionRoleB] = useState('');

    // Form states for member rules
    const [newMemberRuleType, setNewMemberRuleType] = useState<'block_members' | 'prefer_together'>('block_members');
    const [selectedMemberA, setSelectedMemberA] = useState('');
    const [selectedMemberB, setSelectedMemberB] = useState('');

    const loadData = async () => {
        const sb = getSupabase();
        if (!sb || !ministryId || !orgId) return;
        
        setLoading(true);
        try {
            const { data, error } = await sb.from('schedule_conflict_rules')
                .select('*')
                .eq('ministry_id', ministryId)
                .eq('organization_id', orgId);
                
            if (error) throw error;
            
            // Map rules back from database format
            const mappedRules = (data || []).map((r: any) => {
                const functions = Array.isArray(r.functions) ? r.functions : [];
                if (r.label?.startsWith('[MEMBER_BLOCK]')) {
                    return {
                        ...r,
                        rule_type: 'block_members',
                        functions: functions.map((f: string) => f.replace('member:', ''))
                    };
                }
                if (r.label?.startsWith('[MEMBER_PREFER]')) {
                    return {
                        ...r,
                        rule_type: 'prefer_together',
                        functions: functions.map((f: string) => f.replace('member:', ''))
                    };
                }
                return {
                    ...r,
                    functions: functions
                };
            });

            setRules(mappedRules as any);
        } catch (error) {
            console.error('Error loading data:', error);
            addToast('Erro ao carregar regras', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [ministryId, orgId]);

    const handleCreateBlockGroup = async () => {
        const sb = getSupabase();
        if (!sb) return;
        
        try {
            const newRule = {
                ministry_id: ministryId,
                organization_id: orgId,
                rule_type: 'block_group',
                functions: [],
                label: 'Novo Grupo de Bloqueio'
            };

            // Optimistic update
            const tempId = `temp-${Date.now()}`;
            setRules(prev => [...prev, { ...newRule, id: tempId } as ConflictRule]);

            const { error } = await sb
                .from('schedule_conflict_rules')
                .insert(newRule);
                
            if (error) throw error;
            addToast('Grupo criado com sucesso', 'success');
            loadData();
        } catch (error) {
            console.error('Error creating block group:', error);
            addToast('Erro ao criar grupo', 'error');
            loadData(); // Revert
        }
    };

    const handleDeleteRule = async (id: string) => {
        const sb = getSupabase();
        if (!sb) return;
        
        try {
            // Optimistic update
            setRules(prev => prev.filter(r => r.id !== id));

            const { error } = await sb
                .from('schedule_conflict_rules')
                .delete()
                .eq('id', id)
                .eq('organization_id', orgId);
                
            if (error) throw error;
            addToast('Regra excluída com sucesso', 'success');
            loadData();
        } catch (error) {
            console.error('Error deleting rule:', error);
            addToast('Erro ao excluir regra', 'error');
            loadData(); // Revert
        }
    };

    const handleAddFunctionToGroup = async (ruleId: string, currentFunctions: string[], newRole: string) => {
        if (!newRole) return;
        if (currentFunctions.includes(newRole)) {
            addToast('Função já está no grupo', 'warning');
            return;
        }

        const sb = getSupabase();
        if (!sb) return;
        
        try {
            const updatedFunctions = [...currentFunctions, newRole];
            
            // Optimistic update
            setRules(prev => prev.map(r => r.id === ruleId ? { ...r, functions: updatedFunctions } : r));

            const { error } = await sb
                .from('schedule_conflict_rules')
                .update({ functions: updatedFunctions })
                .eq('id', ruleId)
                .eq('organization_id', orgId);
                
            if (error) throw error;
            addToast('Função adicionada', 'success');
            loadData();
        } catch (error) {
            console.error('Error adding function:', error);
            addToast('Erro ao adicionar função', 'error');
            loadData(); // Revert
        }
    };

    const handleRemoveFunctionFromGroup = async (ruleId: string, currentFunctions: string[], roleToRemove: string) => {
        const sb = getSupabase();
        if (!sb) return;
        
        try {
            const updatedFunctions = currentFunctions.filter(f => f !== roleToRemove);
            
            // Optimistic update
            setRules(prev => prev.map(r => r.id === ruleId ? { ...r, functions: updatedFunctions } : r));

            const { error } = await sb
                .from('schedule_conflict_rules')
                .update({ functions: updatedFunctions })
                .eq('id', ruleId)
                .eq('organization_id', orgId);
                
            if (error) throw error;
            addToast('Função removida', 'success');
            loadData();
        } catch (error) {
            console.error('Error removing function:', error);
            addToast('Erro ao remover função', 'error');
            loadData(); // Revert
        }
    };

    const handleCreateException = async () => {
        if (!newExceptionRoleA || !newExceptionRoleB) {
            addToast('Selecione duas funções para a exceção', 'warning');
            return;
        }
        if (newExceptionRoleA === newExceptionRoleB) {
            addToast('As funções devem ser diferentes', 'warning');
            return;
        }

        const sb = getSupabase();
        if (!sb) return;
        
        try {
            const { error } = await sb
                .from('schedule_conflict_rules')
                .insert({
                    ministry_id: ministryId,
                    organization_id: orgId,
                    rule_type: 'allow_exception',
                    functions: [newExceptionRoleA, newExceptionRoleB],
                    label: `Exceção: ${newExceptionRoleA} + ${newExceptionRoleB}`
                });
                
            if (error) throw error;
            addToast('Exceção criada com sucesso', 'success');
            setNewExceptionRoleA('');
            setNewExceptionRoleB('');
            loadData();
        } catch (error) {
            console.error('Error creating exception:', error);
            addToast('Erro ao criar exceção', 'error');
        }
    };

    const handleCreateMemberRule = async () => {
        if (!selectedMemberA || !selectedMemberB) {
            addToast('Selecione dois membros', 'warning');
            return;
        }
        if (selectedMemberA === selectedMemberB) {
            addToast('Os membros devem ser diferentes', 'warning');
            return;
        }

        const sb = getSupabase();
        if (!sb) return;

        const memberA = members.find(m => m.id === selectedMemberA);
        const memberB = members.find(m => m.id === selectedMemberB);

        try {
            const isBlock = newMemberRuleType === 'block_members';
            const prefix = isBlock ? '[MEMBER_BLOCK]' : '[MEMBER_PREFER]';
            const label = `${prefix} ${memberA?.name} + ${memberB?.name}`;

            const { error } = await sb
                .from('schedule_conflict_rules')
                .insert({
                    ministry_id: ministryId,
                    organization_id: orgId,
                    rule_type: isBlock ? 'block_group' : 'allow_exception',
                    functions: [`member:${selectedMemberA}`, `member:${selectedMemberB}`],
                    label: label
                });

            if (error) throw error;
            addToast('Regra criada com sucesso', 'success');
            setSelectedMemberA('');
            setSelectedMemberB('');
            loadData();
        } catch (error: any) {
            console.error('Error creating member rule:', error);
            addToast(`Erro ao criar regra: ${error.message || 'Erro desconhecido'}`, 'error');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="animate-spin text-secondary" size={32} />
            </div>
        );
    }

    if (!members || members.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
                <Users className="text-zinc-300 dark:text-zinc-700" size={64} />
                <div className="max-w-xs">
                    <h3 className="text-lg font-bold text-zinc-800 dark:text-white">Nenhum membro carregado</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        Não foi possível carregar a lista de membros. Verifique sua conexão ou se há membros cadastrados neste ministério.
                    </p>
                </div>
                <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-xl font-bold text-sm">
                    <RefreshCw size={16} /> Tentar Novamente
                </button>
            </div>
        );
    }

    const blockGroups = rules.filter(r => r.rule_type === 'block_group');
    const allowExceptions = rules.filter(r => r.rule_type === 'allow_exception');
    const memberRules = rules.filter(r => r.rule_type === 'block_members' || r.rule_type === 'prefer_together');

    const getMemberName = (id: string) => members.find(m => m.id === id)?.name || 'Membro desconhecido';

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
                <div>
                    <h2 className="text-3xl font-bold text-zinc-800 dark:text-white flex items-center gap-3">
                        <ShieldCheck className="text-secondary" size={32} /> Regras de Escala
                    </h2>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-2">
                        Configure bloqueios entre funções, exceções e preferências entre membros.
                    </p>
                </div>
            </div>

            {/* SEÇÃO 1: REGRAS ENTRE MEMBROS (NOVO) */}
            <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                    <h3 className="text-lg font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                        Regras entre Membros (Casais / Bloqueios)
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Defina membros que devem ser escalados juntos (preferência) ou que não podem estar na mesma escala.
                    </p>
                </div>

                <div className="p-6 space-y-6">
                    <div className="flex flex-col lg:flex-row items-end gap-3 bg-zinc-50 dark:bg-zinc-800/30 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <div className="w-full lg:w-48">
                            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Tipo de Regra</label>
                            <select
                                value={newMemberRuleType}
                                onChange={(e) => setNewMemberRuleType(e.target.value as any)}
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-secondary outline-none"
                            >
                                <option value="block_members">Bloquear Juntos</option>
                                <option value="prefer_together">Escalar Juntos (Casal)</option>
                            </select>
                        </div>
                        <div className="flex-1 w-full">
                            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Membro A</label>
                            <select
                                value={selectedMemberA}
                                onChange={(e) => setSelectedMemberA(e.target.value)}
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-secondary outline-none"
                            >
                                <option value="">Selecione...</option>
                                {members.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="pb-3 text-zinc-400 font-bold hidden lg:block">+</div>
                        <div className="flex-1 w-full">
                            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Membro B</label>
                            <select
                                value={selectedMemberB}
                                onChange={(e) => setSelectedMemberB(e.target.value)}
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-secondary outline-none"
                            >
                                <option value="">Selecione...</option>
                                {members.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={handleCreateMemberRule}
                            className="w-full lg:w-auto px-6 py-2.5 bg-secondary hover:bg-secondaryHover text-white rounded-xl font-bold text-sm transition-colors shadow-sm whitespace-nowrap"
                        >
                            Salvar Regra
                        </button>
                    </div>

                    {memberRules.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                            {memberRules.map(rule => (
                                <div key={rule.id} className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${rule.rule_type === 'prefer_together' ? 'bg-pink-50 dark:bg-pink-900/20 text-pink-600' : 'bg-red-50 dark:bg-red-900/20 text-red-600'}`}>
                                            {rule.rule_type === 'prefer_together' ? <Heart size={18} /> : <UserMinus size={18} />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{getMemberName(rule.functions[0])}</span>
                                                <span className="text-zinc-400 text-xs font-bold">&</span>
                                                <span className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{getMemberName(rule.functions[1])}</span>
                                            </div>
                                            <p className="text-[10px] uppercase font-black tracking-widest mt-1 opacity-60">
                                                {rule.rule_type === 'prefer_together' ? 'Preferência (Juntos)' : 'Bloqueio (Separados)'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteRule(rule.id)}
                                        className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 p-2 rounded-lg transition-colors ml-2 shrink-0"
                                        title="Remover regra"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-zinc-500 dark:text-zinc-400 flex flex-col items-center gap-3">
                            <Users size={48} className="opacity-20" />
                            <p>Nenhuma regra entre membros configurada.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* SEÇÃO 2: GRUPOS BLOQUEADOS */}
            <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/30">
                    <div>
                        <h3 className="text-lg font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                            Grupos de Bloqueio
                        </h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                            Membros não poderão ser escalados em mais de uma função do mesmo grupo.
                        </p>
                    </div>
                    <button
                        onClick={handleCreateBlockGroup}
                        className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondaryHover text-white rounded-xl font-bold text-sm transition-colors shadow-sm"
                    >
                        <Plus size={16} /> Novo Grupo
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {blockGroups.length === 0 ? (
                        <div className="text-center py-8 text-zinc-500 dark:text-zinc-400 flex flex-col items-center gap-3">
                            <ShieldCheck size={48} className="opacity-20" />
                            <p>Nenhum grupo de bloqueio configurado.</p>
                        </div>
                    ) : (
                        blockGroups.map(group => (
                            <div key={group.id} className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 bg-zinc-50/30 dark:bg-zinc-800/10">
                                <div className="flex justify-between items-start mb-4">
                                    <h4 className="font-bold text-zinc-700 dark:text-zinc-300">
                                        {group.label || 'Grupo de Bloqueio'}
                                    </h4>
                                    <button
                                        onClick={() => handleDeleteRule(group.id)}
                                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 p-1.5 rounded-lg transition-colors"
                                        title="Excluir grupo"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <div className="flex flex-wrap gap-2 mb-4">
                                    {group.functions && group.functions.length > 0 ? (
                                        group.functions.map(func => (
                                            <div key={func} className="flex items-center gap-1.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 rounded-lg text-sm font-medium">
                                                {func}
                                                <button
                                                    onClick={() => handleRemoveFunctionFromGroup(group.id, group.functions, func)}
                                                    className="text-zinc-400 hover:text-red-500 transition-colors ml-1"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))
                                    ) : (
                                        <span className="text-sm text-zinc-400 italic">Nenhuma função neste grupo.</span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                                    <select
                                        className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-secondary outline-none"
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                handleAddFunctionToGroup(group.id, group.functions || [], e.target.value);
                                                e.target.value = ''; // reset select
                                            }
                                        }}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>+ Adicionar função ao grupo...</option>
                                        {availableRoles
                                            .filter(role => !(group.functions || []).includes(role))
                                            .map(role => (
                                                <option key={role} value={role}>{role}</option>
                                            ))
                                        }
                                    </select>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>

            {/* SEÇÃO 2: EXCEÇÕES PERMITIDAS */}
            <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                    <h3 className="text-lg font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                        Exceções Permitidas
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Combinações específicas de funções que são permitidas, mesmo se estiverem no mesmo grupo de bloqueio.
                    </p>
                </div>

                <div className="p-6 space-y-6">
                    <div className="flex flex-col sm:flex-row items-end gap-3 bg-zinc-50 dark:bg-zinc-800/30 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <div className="flex-1 w-full">
                            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Função A</label>
                            <select
                                value={newExceptionRoleA}
                                onChange={(e) => setNewExceptionRoleA(e.target.value)}
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-secondary outline-none"
                            >
                                <option value="">Selecione...</option>
                                {availableRoles.map(role => (
                                    <option key={role} value={role}>{role}</option>
                                ))}
                            </select>
                        </div>
                        <div className="pb-3 text-zinc-400 font-bold hidden sm:block">+</div>
                        <div className="flex-1 w-full">
                            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Função B</label>
                            <select
                                value={newExceptionRoleB}
                                onChange={(e) => setNewExceptionRoleB(e.target.value)}
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-secondary outline-none"
                            >
                                <option value="">Selecione...</option>
                                {availableRoles.map(role => (
                                    <option key={role} value={role}>{role}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={handleCreateException}
                            className="w-full sm:w-auto px-6 py-2.5 bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white rounded-xl font-bold text-sm transition-colors shadow-sm whitespace-nowrap"
                        >
                            Salvar Exceção
                        </button>
                    </div>

                    {allowExceptions.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
                            {allowExceptions.map(exc => (
                                <div key={exc.id} className="flex items-center justify-between bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-sm">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="bg-secondary/10 dark:bg-secondary/5 text-secondary px-2.5 py-1 rounded-md text-xs font-bold border border-secondary/20">
                                            {exc.functions[0]}
                                        </span>
                                        <span className="text-zinc-400 text-xs font-bold">+</span>
                                        <span className="bg-secondary/10 dark:bg-secondary/5 text-secondary px-2.5 py-1 rounded-md text-xs font-bold border border-secondary/20">
                                            {exc.functions[1]}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteRule(exc.id)}
                                        className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 p-1.5 rounded-lg transition-colors ml-2 shrink-0"
                                        title="Remover exceção"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};
