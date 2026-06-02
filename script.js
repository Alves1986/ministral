const fs = require('fs');
const file = 'components/ScheduleRulesScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. imports
content = content.replace(
    /import \{ ShieldCheck, Plus, X, Trash2, Loader2, AlertTriangle, Users, Heart, UserMinus, RefreshCw \} from 'lucide-react';/,
    import { ShieldCheck, Plus, X, Trash2, Loader2, AlertTriangle, Users, Heart, UserMinus, RefreshCw, CalendarX } from 'lucide-react';
);

// 2. props interface
content = content.replace(
    /interface ScheduleRulesScreenProps \{[\s\S]*?\}/,
    interface ScheduleRulesScreenProps {
    ministryId: string;
    orgId: string;
    availableRoles: string[];
    members: TeamMemberProfile[];
    availableEvents?: { id: string; title: string }[];
}
);

// 3. conflict rule interface
content = content.replace(
    /rule_type: 'block_group' \| 'allow_exception' \| 'block_members' \| 'prefer_together';/,
    ule_type: 'block_group' | 'allow_exception' | 'block_members' | 'prefer_together' | 'event_role_exclude';
);

// 4. state variables
content = content.replace(
    /const \[rules, setRules\] = useState<ConflictRule\[\]>\(\[\]\);/,
    const [rules, setRules] = useState<ConflictRule[]>([]);
    const [selectedEventId, setSelectedEventId] = useState('');
    const [localEvents, setLocalEvents] = useState<{ id: string; title: string }[]>([]);
);

// 5. loadData (events)
content = content.replace(
    /setRules\(mappedRules as any\);/,
    setRules(mappedRules as any);
            
            const { data: eventsData } = await sb.from('event_rules')
                .select('id, title')
                .eq('ministry_id', ministryId)
                .eq('organization_id', orgId)
                .eq('active', true);
            setLocalEvents((availableEvents && availableEvents.length > 0) ? availableEvents : (eventsData || []));
);

// 6. mappedRules support
content = content.replace(
    /if \(r\.label\?\.startsWith\('\[MEMBER_BLOCK\]'\)\) \{/,
    if (r.label?.startsWith('[EVENT_ROLE_EXCLUDE]')) {
                    return { ...r, rule_type: 'event_role_exclude' };
                }
                if (r.label?.startsWith('[MEMBER_BLOCK]')) {
);

// 7. Extract eventExcludeRules
content = content.replace(
    /const blockGroups = rules\.filter\(r => r\.rule_type === 'block_group'\);/,
    const eventExcludeRules = rules.filter(r => r.rule_type === 'event_role_exclude' || r.label?.startsWith('[EVENT_ROLE_EXCLUDE]'));
    const blockGroups = rules.filter(r => r.rule_type === 'block_group');
);

// 8. The new component methods
const newMethods = 
    const handleCreateEventRoleExclude = async (roleToExclude: string) => {
        if (!selectedEventId) {
            addToast('Selecione um evento primeiro', 'warning');
            return;
        }
        if (!roleToExclude) return;

        const sb = getSupabase();
        if (!sb) return;

        const existingRule = rules.find(r => r.label?.includes(\event_rule_id=\\));
        
        try {
            if (existingRule) {
                if (existingRule.functions.includes(roleToExclude)) {
                    addToast('Fun��o j� exclu�da neste evento', 'warning');
                    return;
                }
                const updatedFunctions = [...existingRule.functions, roleToExclude];
                setRules(prev => prev.map(r => r.id === existingRule.id ? { ...r, functions: updatedFunctions } : r));
                await sb.from('schedule_conflict_rules')
                    .update({ functions: updatedFunctions })
                    .eq('id', existingRule.id)
                    .eq('organization_id', orgId);
            } else {
                const eventTitle = localEvents.find(e => e.id === selectedEventId)?.title || 'Evento';
                const newRule = {
                    ministry_id: ministryId,
                    organization_id: orgId,
                    rule_type: 'block_group',
                    functions: [roleToExclude],
                    label: \[EVENT_ROLE_EXCLUDE] event_rule_id=\ title=\\
                };
                const tempId = \	emp-\\;
                setRules(prev => [...prev, { ...newRule, id: tempId, rule_type: 'event_role_exclude' as any }]);
                await sb.from('schedule_conflict_rules').insert(newRule);
            }
            addToast('Regra salva com sucesso', 'success');
            loadData();
        } catch (error: any) {
            addToast(\Erro: \\, 'error');
            loadData();
        }
    };

    const handleRemoveEventRoleExclude = async (ruleId: string, currentFunctions: string[], roleToRemove: string) => {
        const sb = getSupabase();
        if (!sb) return;
        const updatedFunctions = currentFunctions.filter(f => f !== roleToRemove);
        try {
            setRules(prev => prev.map(r => r.id === ruleId ? { ...r, functions: updatedFunctions } : r));
            if (updatedFunctions.length === 0) {
                await sb.from('schedule_conflict_rules').delete().eq('id', ruleId).eq('organization_id', orgId);
            } else {
                await sb.from('schedule_conflict_rules').update({ functions: updatedFunctions }).eq('id', ruleId).eq('organization_id', orgId);
            }
            addToast('Fun��o removida', 'success');
            loadData();
        } catch (error: any) {
            addToast(\Erro: \\, 'error');
            loadData();
        }
    };

    if (loading) {;
content = content.replace(/if \(loading\) \{/, newMethods);


// 9. Component rendering - Section 1 insertion (putting between Sections 1 and 2 or BEFORE section 1? We'll put it BEFORE section 1 because it's about roles which makes sense at the top).

const newSection = \
            {/* SE��O: FUN��ES OPCIONAIS POR EVENTO */}
            <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                    <h3 className="text-lg font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                        <CalendarX size={20} className="text-amber-500" /> Fun��es Opcionais por Evento
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Defina quais fun��es a IA <strong>n�o deve preencher</strong> em eventos espec�ficos (ex: n�o h� c�mera no Culto de Ora��o).
                    </p>
                </div>

                <div className="p-6 space-y-6">
                    <div className="flex flex-col lg:flex-row items-end gap-3 bg-zinc-50 dark:bg-zinc-800/30 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <div className="flex-1 w-full">
                            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Evento / Tipo de Culto</label>
                            <select
                                value={selectedEventId}
                                onChange={(e) => setSelectedEventId(e.target.value)}
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-secondary outline-none"
                            >
                                <option value="">Selecione o evento...</option>
                                {localEvents.map(e => (
                                    <option key={e.id} value={e.id}>{e.title}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1 w-full">
                            <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">Fun��o a Excluir</label>
                            <select
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-secondary outline-none"
                                onChange={(e) => { if (e.target.value) { handleCreateEventRoleExclude(e.target.value); e.target.value = ''; } }}
                                defaultValue=""
                                disabled={!selectedEventId}
                            >
                                <option value="" disabled>{selectedEventId ? '+ Adicionar fun��o a excluir...' : 'Selecione um evento primeiro'}</option>
                                {availableRoles
                                    .filter(role => {
                                        const existingRule = rules.find(r => r.label?.includes(\event_rule_id=\\));
                                        return !existingRule?.functions.includes(role);
                                    })
                                    .map(role => (
                                        <option key={role} value={role}>{role}</option>
                                    ))
                                }
                            </select>
                        </div>
                    </div>

                    {eventExcludeRules.length === 0 ? (
                        <div className="text-center py-8 text-zinc-500 dark:text-zinc-400 flex flex-col items-center gap-3">
                            <CalendarX size={48} className="opacity-20" />
                            <p>Nenhuma exclus�o de fun��o por evento configurada.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {eventExcludeRules.map(rule => {
                                const eventIdMatch = rule.label?.match(/event_rule_id=([\\w-]+)/);
                                const titleMatch = rule.label?.match(/title=(.+)$/);
                                const eventTitle = titleMatch?.[1] || localEvents.find(e => e.id === eventIdMatch?.[1])?.title || 'Evento desconhecido';
                                return (
                                    <div key={rule.id} className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <CalendarX size={16} className="text-amber-600" />
                                                <span className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{eventTitle}</span>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteRule(rule.id)}
                                                className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 p-1.5 rounded-lg transition-colors"
                                                title="Excluir regra"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {rule.functions.map(func => (
                                                <div key={func} className="flex items-center gap-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-lg text-sm font-medium border border-amber-200 dark:border-amber-700/50">
                                                    {func}
                                                    <button
                                                        onClick={() => handleRemoveEventRoleExclude(rule.id, rule.functions, func)}
                                                        className="text-amber-400 hover:text-red-500 transition-colors ml-1"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* SE��O 1: REGRAS ENTRE MEMBROS (NOVO) */}
\;

content = content.replace(/\\{\\/\\* SE��O 1: REGRAS ENTRE MEMBROS \\(NOVO\\) \\*\\/\\}/, newSection);

fs.writeFileSync(file, content);
console.log('Update complete.');
