import { getSupabase } from './client';
import { sendNotificationSQL } from './notifications';
import { canDispatchPlaylistNotification } from '../../utils/repertoireUtils';

export const replicateRepertoireToProjectionAndDance = async (
    item: any,
    sourceMinistryId: string,
    orgId: string,
    eventRuleId: string | null = null,
    notify: boolean = false
) => {
    const sb = getSupabase();
    if (!sb || !orgId) return;

    try {
        // 1. Localizar ministérios de Comunicação / Projeção / Mídia e Dança / Coreografia na mesma organização
        const { data: orgMinistries } = await sb
            .from('organization_ministries')
            .select('id, label, code')
            .eq('organization_id', orgId);

        const isProjectionMinistry = (m: any) => {
            if (!m || m.id === sourceMinistryId) return false;
            const text = `${m.label || ''} ${m.code || ''}`.toLowerCase();
            return (
                text.includes('comunic') ||
                text.includes('projec') ||
                text.includes('projeç') ||
                text.includes('mídia') ||
                text.includes('midia') ||
                text.includes('transmiss') ||
                text.includes('multimidia') ||
                text.includes('multimídia') ||
                text.includes('som')
            );
        };

        const isDanceMinistry = (m: any) => {
            if (!m || m.id === sourceMinistryId) return false;
            const text = `${m.label || ''} ${m.code || ''}`.toLowerCase();
            return (
                text.includes('dança') ||
                text.includes('danca') ||
                text.includes('coreograf') ||
                text.includes('teatro') ||
                text.includes('artes') ||
                text.includes('dance')
            );
        };

        const projectionMinistries = (orgMinistries || []).filter(isProjectionMinistry);
        const danceMinistries = (orgMinistries || []).filter(isDanceMinistry);

        const dateFormatted = item.date ? item.date.split('-').reverse().join('/') : '';
        const itemTitle = item.title ? item.title.substring(0, 250) : 'Sem Título';
        const itemLink = item.link ? item.link.substring(0, 500) : '';

        // Sincronizar para Projeção / Comunicação
        for (const targetMin of projectionMinistries) {
            let query = sb
                .from('repertoire_items')
                .select('id')
                .eq('organization_id', orgId)
                .eq('ministry_id', targetMin.id)
                .eq('date', item.date)
                .eq('title', itemTitle);
            
            if (eventRuleId) {
                query = query.eq('event_rule_id', eventRuleId);
            }

            const { data: existing } = await query.maybeSingle();

            if (!existing) {
                await sb.from('repertoire_items').insert({
                    organization_id: orgId,
                    ministry_id: targetMin.id,
                    title: itemTitle,
                    link: itemLink,
                    date: item.date,
                    added_by: `${item.addedBy || 'Ministro de Louvor'} (Louvor)`,
                    content: item.content,
                    observation: item.observation || 'Sincronizado automaticamente da equipe de Louvor para Projeção',
                    event_rule_id: eventRuleId
                });

                if (notify) {
                    sendNotificationSQL(targetMin.id, orgId, {
                        title: '🎵 Playlist para Projeção Sincronizada!',
                        message: `O louvor postou "${item.title}" para o culto de ${dateFormatted}. Disponível no repertório para preparar a projeção!`,
                        type: 'info',
                        actionLink: 'repertoire'
                    }).catch(() => {});
                }
            }
        }

        // Sincronizar para Dança / Coreografia
        for (const targetDance of danceMinistries) {
            let query = sb
                .from('repertoire_items')
                .select('id')
                .eq('organization_id', orgId)
                .eq('ministry_id', targetDance.id)
                .eq('date', item.date)
                .eq('title', itemTitle);
            
            if (eventRuleId) {
                query = query.eq('event_rule_id', eventRuleId);
            }

            const { data: existing } = await query.maybeSingle();

            if (!existing) {
                await sb.from('repertoire_items').insert({
                    organization_id: orgId,
                    ministry_id: targetDance.id,
                    title: itemTitle,
                    link: itemLink,
                    date: item.date,
                    added_by: `${item.addedBy || 'Ministro de Louvor'} (Louvor)`,
                    content: item.content,
                    observation: item.observation || 'Sincronizado automaticamente da equipe de Louvor para Dança',
                    event_rule_id: eventRuleId
                });

                if (notify) {
                    sendNotificationSQL(targetDance.id, orgId, {
                        title: '💃 Repertório do Louvor para Dança!',
                        message: `O louvor postou "${item.title}" para o culto de ${dateFormatted}. Playlist e cifras disponíveis no repertório para ensaio de coreografia!`,
                        type: 'info',
                        actionLink: 'repertoire'
                    }).catch(() => {});
                }
            }
        }

        if (notify) {
            // 2. Notificar membros com funções específicas na organização via tabela canônica ministry_members
            const { data: members } = await sb
                .from('ministry_members')
                .select('profile_id, functions, profiles!inner(id, name)')
                .eq('organization_id', orgId);

            const memberMap = new Map<string, { id: string; name: string; funcs: string[] }>();
            (members || []).forEach((m: any) => {
                const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
                const pid = m.profile_id || profile?.id;
                if (!pid) return;
                const funcs = (m.functions || []).map((f: string) => f.toLowerCase());
                if (!memberMap.has(pid)) {
                    memberMap.set(pid, {
                        id: pid,
                        name: profile?.name || '',
                        funcs: [...funcs]
                    });
                } else {
                    const existing = memberMap.get(pid)!;
                    existing.funcs = Array.from(new Set([...existing.funcs, ...funcs]));
                }
            });
            const memberProfiles = Array.from(memberMap.values());

            // Notificar voluntários de Projeção
            const projectionProfiles = memberProfiles.filter((p) => {
                return p.funcs.some((f: string) => 
                    f.includes('projec') || 
                    f.includes('projeç') || 
                    f.includes('mídia') || 
                    f.includes('midia') || 
                    f.includes('comunic') ||
                    f.includes('slide') ||
                    f.includes('letra')
                );
            });

            for (const p of projectionProfiles) {
                sendNotificationSQL(sourceMinistryId, orgId, {
                    title: '🎵 Playlist para Projeção Disponível!',
                    message: `Olá ${p.name || ''}, o louvor postou a música "${item.title}" para o culto de ${dateFormatted}. Acesse o repertório para preparar a projeção!`,
                    type: 'info',
                    actionLink: 'repertoire',
                    targetUserId: p.id
                }).catch(() => {});
            }

            // Notificar voluntárias de Dança
            const danceProfiles = memberProfiles.filter((p) => {
                return p.funcs.some((f: string) => 
                    f.includes('dança') || 
                    f.includes('danca') || 
                    f.includes('coreograf') || 
                    f.includes('teatro') || 
                    f.includes('artes') || 
                    f.includes('dance')
                );
            });

            for (const p of danceProfiles) {
                sendNotificationSQL(sourceMinistryId, orgId, {
                    title: '💃 Playlist de Louvor para Dança!',
                    message: `Olá ${p.name || ''}, o louvor adicionou a música "${item.title}" para o culto de ${dateFormatted}. Acesse o repertório para saber os louvores e ensaiar a coreografia!`,
                    type: 'info',
                    actionLink: 'repertoire',
                    targetUserId: p.id
                }).catch(() => {});
            }
        }
    } catch (err) {
        console.warn("[replicateRepertoireToProjectionAndDance] Falha ao sincronizar com Projeção e Dança:", err);
    }
};

/**
 * Notifica de forma unificada e consolidada que a playlist de um determinado culto foi postada.
 * Dispara apenas UMA notificação para o ministério, Projeção, Dança e Super Admins,
 * evitando spam por música.
 */
export const notifyRepertoirePlaylistPublished = async (
    ministryId: string,
    orgId: string,
    details: {
        cultoTitle?: string;
        cultoTime?: string;
        date: string;
        songsCount: number;
        addedBy?: string;
        eventRuleId?: string | null;
    }
) => {
    const sb = getSupabase();
    if (!sb || !orgId) return;

    // Cooldown e idempotência: evita disparos múltiplos para a mesma playlist/culto em cliques seguidos
    const cooldownKey = `${orgId}_${ministryId}_${details.date}_${details.eventRuleId || details.cultoTitle || 'geral'}`;
    if (!canDispatchPlaylistNotification(cooldownKey, 15000)) {
        console.log('[notifyRepertoirePlaylistPublished] Disparo ignorado por cooldown/idempotência:', cooldownKey);
        return;
    }

    try {
        const dateFormatted = details.date ? details.date.split('-').reverse().join('/') : '';
        const cultoName = details.cultoTitle
            ? `${details.cultoTitle}${details.cultoTime ? ` (${details.cultoTime.slice(0, 5)})` : ''}`
            : '';
        const cultoDesc = cultoName ? `${cultoName} (${dateFormatted})` : `culto de ${dateFormatted}`;
        const songsText = `${details.songsCount} ${details.songsCount === 1 ? 'música' : 'músicas'}`;

        // 1. Notificação única para o ministério de Louvor
        await sendNotificationSQL(ministryId, orgId, {
            title: '🎵 Playlist do Culto Postada!',
            message: `A playlist para o ${cultoDesc} foi publicada no repertório com ${songsText}.`,
            type: 'info',
            actionLink: 'repertoire'
        }).catch(() => {});

        // 2. Localizar ministérios de Projeção e Dança da organização
        const { data: orgMinistries } = await sb
            .from('organization_ministries')
            .select('id, label, code')
            .eq('organization_id', orgId);

        const isProjectionMinistry = (m: any) => {
            if (!m || m.id === ministryId) return false;
            const text = `${m.label || ''} ${m.code || ''}`.toLowerCase();
            return (
                text.includes('comunic') ||
                text.includes('projec') ||
                text.includes('projeç') ||
                text.includes('mídia') ||
                text.includes('midia') ||
                text.includes('transmiss') ||
                text.includes('multimidia') ||
                text.includes('multimídia') ||
                text.includes('som')
            );
        };

        const isDanceMinistry = (m: any) => {
            if (!m || m.id === ministryId) return false;
            const text = `${m.label || ''} ${m.code || ''}`.toLowerCase();
            return (
                text.includes('dança') ||
                text.includes('danca') ||
                text.includes('coreograf') ||
                text.includes('teatro') ||
                text.includes('artes') ||
                text.includes('dance')
            );
        };

        const projectionMinistries = (orgMinistries || []).filter(isProjectionMinistry);
        const danceMinistries = (orgMinistries || []).filter(isDanceMinistry);

        // Notificar ministérios de Projeção (apenas para o ministério, sem duplicar por membro)
        for (const targetMin of projectionMinistries) {
            sendNotificationSQL(targetMin.id, orgId, {
                title: '🎵 Playlist para Projeção Disponível!',
                message: `O louvor postou a playlist para o ${cultoDesc} com ${songsText}. Disponível no repertório para preparar a projeção!`,
                type: 'info',
                actionLink: 'repertoire'
            }).catch(() => {});
        }

        // Notificar ministérios de Dança (apenas para o ministério, sem duplicar por membro)
        for (const targetDance of danceMinistries) {
            sendNotificationSQL(targetDance.id, orgId, {
                title: '💃 Repertório de Louvor para Dança!',
                message: `O louvor postou a playlist para o ${cultoDesc} com ${songsText}. Playlist disponível no repertório para ensaio de coreografia!`,
                type: 'info',
                actionLink: 'repertoire'
            }).catch(() => {});
        }

        // 3. Fallback: Notificar voluntários específicos APENAS SE a organização NÃO possuir
        // ministério dedicado de Projeção ou Dança (evitando spam duplicado para quem já está nesses ministérios)
        const needsIndividualProjection = projectionMinistries.length === 0;
        const needsIndividualDance = danceMinistries.length === 0;

        if (needsIndividualProjection || needsIndividualDance) {
            const { data: members } = await sb
                .from('ministry_members')
                .select('profile_id, functions, profiles!inner(id, name)')
                .eq('organization_id', orgId);

            const memberMap = new Map<string, { id: string; name: string; funcs: string[] }>();
            (members || []).forEach((m: any) => {
                const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
                const pid = m.profile_id || profile?.id;
                if (!pid) return;
                const funcs = (m.functions || []).map((f: string) => f.toLowerCase());
                if (!memberMap.has(pid)) {
                    memberMap.set(pid, {
                        id: pid,
                        name: profile?.name || '',
                        funcs: [...funcs]
                    });
                } else {
                    const existing = memberMap.get(pid)!;
                    existing.funcs = Array.from(new Set([...existing.funcs, ...funcs]));
                }
            });
            const memberProfiles = Array.from(memberMap.values());

            if (needsIndividualProjection) {
                const projectionProfiles = memberProfiles.filter((p) => {
                    return p.funcs.some((f: string) => 
                        f.includes('projec') || 
                        f.includes('projeç') || 
                        f.includes('mídia') || 
                        f.includes('midia') || 
                        f.includes('comunic') ||
                        f.includes('slide') ||
                        f.includes('letra')
                    );
                });

                for (const p of projectionProfiles) {
                    sendNotificationSQL(ministryId, orgId, {
                        title: '🎵 Playlist para Projeção Disponível!',
                        message: `Olá ${p.name || ''}, a playlist para o ${cultoDesc} foi publicada com ${songsText}. Acesse o repertório para preparar a projeção!`,
                        type: 'info',
                        actionLink: 'repertoire',
                        targetUserId: p.id
                    }).catch(() => {});
                }
            }

            if (needsIndividualDance) {
                const danceProfiles = memberProfiles.filter((p) => {
                    return p.funcs.some((f: string) => 
                        f.includes('dança') || 
                        f.includes('danca') || 
                        f.includes('coreograf') || 
                        f.includes('teatro') || 
                        f.includes('artes') || 
                        f.includes('dance')
                    );
                });

                for (const p of danceProfiles) {
                    sendNotificationSQL(ministryId, orgId, {
                        title: '💃 Repertório de Louvor para Dança!',
                        message: `Olá ${p.name || ''}, a playlist para o ${cultoDesc} foi publicada com ${songsText}. Acesse o repertório para o ensaio!`,
                        type: 'info',
                        actionLink: 'repertoire',
                        targetUserId: p.id
                    }).catch(() => {});
                }
            }
        }
    } catch (err) {
        console.warn("[notifyRepertoirePlaylistPublished] Erro ao enviar notificações consolidadas de repertório:", err);
    }
};

export const replicateRepertoireToProjection = replicateRepertoireToProjectionAndDance;

export const fetchRepertoire = async (ministryId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return [];

    // 1. Buscar os itens do ministério atual
    const { data: ownItems } = await sb.from('repertoire_items')
        .select('*, event_rules(id, title, time)')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .order('date', { ascending: false });

    let allRawItems = [...(ownItems || [])];

    // 2. Se o ministério atual for Dança ou Projeção, buscar também os louvores do Ministério de Louvor para visualização unificada
    try {
        const { data: orgMinistries } = await sb
            .from('organization_ministries')
            .select('id, label, code')
            .eq('organization_id', orgId);

        const currentMin = (orgMinistries || []).find((m: any) => m.id === ministryId || m.code === ministryId);
        const minText = `${currentMin?.label || ''} ${currentMin?.code || ''} ${ministryId || ''}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        const isDanceOrProjection = 
            minText.includes('danca') || minText.includes('coreograf') ||
            minText.includes('artes') || minText.includes('teatro') || minText.includes('dance') ||
            minText.includes('projec') || minText.includes('midia') || minText.includes('comunic');

        if (isDanceOrProjection) {
            // Localizar ministério(s) de Louvor
            const worshipMinistries = (orgMinistries || []).filter((m: any) => {
                if (m.id === ministryId || m.code === ministryId) return false;
                const txt = `${m.label || ''} ${m.code || ''}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return txt.includes('louvor') || txt.includes('musica') || txt.includes('banda') || txt.includes('worship');
            });

            const worshipIds = worshipMinistries.map((m: any) => m.id);
            if (!worshipIds.includes('louvor')) {
                worshipIds.push('louvor');
            }

            if (worshipIds.length > 0) {
                const { data: worshipItems } = await sb
                    .from('repertoire_items')
                    .select('*, event_rules(id, title, time)')
                    .eq('organization_id', orgId)
                    .in('ministry_id', worshipIds)
                    .order('date', { ascending: false });

                if (worshipItems && worshipItems.length > 0) {
                    const existingKeys = new Set(
                        allRawItems.map((i: any) => `${(i.date || i.event_date || '').trim()}_${(i.event_rule_id || i.observation || '')}_${(i.title || '').trim().toLowerCase()}`)
                    );

                    for (const wItem of worshipItems) {
                        const key = `${(wItem.date || wItem.event_date || '').trim()}_${(wItem.event_rule_id || wItem.observation || '')}_${(wItem.title || '').trim().toLowerCase()}`;
                        if (!existingKeys.has(key)) {
                            existingKeys.add(key);
                            allRawItems.push({
                                ...wItem,
                                isFromWorship: true,
                                observation: wItem.observation || 'Sincronizado da equipe de Louvor'
                            });
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.warn("[fetchRepertoire] Falha ao verificar/unificar itens do Louvor:", e);
    }

    // Ordenar por data decrescente
    allRawItems.sort((a, b) => {
        const dateA = a.date || a.event_date || '';
        const dateB = b.date || b.event_date || '';
        return dateB.localeCompare(dateA);
    });
        
    return allRawItems.map((r: any) => {
        const rule = Array.isArray(r.event_rules) ? r.event_rules[0] : r.event_rules;
        
        let cultoTitle = rule?.title || null;
        let cultoTime = rule?.time ? rule.time.slice(0, 5) : null;
        
        if (!cultoTitle && typeof r.observation === 'string' && r.observation.startsWith('Culto: ')) {
            const raw = r.observation.replace('Culto: ', '').trim();
            const timeMatch = raw.match(/\((\d{2}:\d{2})\)$/);
            if (timeMatch) {
                cultoTime = timeMatch[1];
                cultoTitle = raw.replace(/\s*\(\d{2}:\d{2}\)$/, '').trim();
            } else {
                cultoTitle = raw;
            }
        }

        return {
            id: r.id,
            title: r.title,
            link: r.link,
            date: r.date || r.event_date,
            observation: r.observation,
            addedBy: r.added_by,
            createdAt: r.created_at,
            content: r.content,
            key: r.key,
            organizationId: r.organization_id,
            isFromWorship: !!r.isFromWorship || (typeof r.observation === 'string' && r.observation.toLowerCase().includes('louvor')),
            eventRuleId: r.event_rule_id || null,
            eventRuleTitle: cultoTitle,
            eventRuleTime: cultoTime
        };
    });
};

export const addToRepertoire = async (
    ministryId: string, 
    orgId: string, 
    item: any,
    skipNotification: boolean = false
) => {
    const sb = getSupabase();
    if (!sb) return false;

    // Se eventRuleId foi fornecido diretamente, utilize-o
    let eventRuleId = item.eventRuleId || item.event_rule_id || null;
    
    // Se não tiver eventRuleId explícito, tenta resolver de forma segura e contextual
    if (!eventRuleId && item.observation && orgId) {
        try {
            const obsMatch = item.observation.match(/^Culto:\s*([^(]+?)(?:\s*\(([^)]+)\))?$/i);
            const cultoTitle = obsMatch ? obsMatch[1].trim() : null;
            const cultoTime = obsMatch && obsMatch[2] ? obsMatch[2].trim() : null;

            if (cultoTitle) {
                let ruleQuery = sb
                    .from('event_rules')
                    .select('id')
                    .eq('organization_id', orgId)
                    .ilike('title', cultoTitle);
                
                if (cultoTime) {
                    ruleQuery = ruleQuery.ilike('time', `${cultoTime}%`);
                }

                const { data: matchedRule } = await ruleQuery.limit(1).maybeSingle();
                if (matchedRule?.id) {
                    eventRuleId = matchedRule.id;
                }
            }
        } catch (e) {
            console.warn("[addToRepertoire] Não foi possível resolver eventRuleId por título:", e);
        }
    }

    const { error } = await sb.from('repertoire_items').insert({
        organization_id: orgId,
        ministry_id: ministryId,
        title: item.title ? item.title.substring(0, 250) : 'Sem Título',
        link: item.link ? item.link.substring(0, 500) : '',
        date: item.date,
        added_by: item.addedBy ? item.addedBy.substring(0, 100) : 'Admin',
        content: item.content,
        observation: item.observation || null,
        event_rule_id: eventRuleId
    });

    if (error) {
        console.error("Erro ao inserir no repertoire_items:", error);
        throw error;
    }

    if (!error) {
        // Replicar dados no banco para Projeção / Comunicação e Dança (sem spam de notificações por música)
        replicateRepertoireToProjectionAndDance(item, ministryId, orgId, eventRuleId, false).catch(() => {});

        // Apenas notifica se for inserção avulsa direta (fora de lote/playlist)
        if (!skipNotification) {
            void notifyRepertoirePlaylistPublished(ministryId, orgId, {
                cultoTitle: item.eventRuleTitle || item.cultoTitle,
                cultoTime: item.eventRuleTime || item.cultoTime,
                date: item.date,
                songsCount: 1,
                addedBy: item.addedBy,
                eventRuleId
            });
        }
    }

    return !error;
};

export const deleteFromRepertoire = async (id: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) return;

    try {
        const { data: item } = await sb
            .from('repertoire_items')
            .select('title, date, observation, event_rule_id')
            .eq('id', id)
            .eq('organization_id', orgId)
            .maybeSingle();

        await sb.from('repertoire_items').delete().eq('id', id).eq('organization_id', orgId);

        // Se foi um item original (não sincronizado), limpar também réplicas automáticas
        if (item && (!item.observation || !item.observation.includes('Sincronizado automaticamente'))) {
            let delQuery = sb.from('repertoire_items')
                .delete()
                .eq('organization_id', orgId)
                .eq('date', item.date)
                .eq('title', item.title)
                .ilike('observation', '%Sincronizado automaticamente%');
            if (item.event_rule_id) {
                delQuery = delQuery.eq('event_rule_id', item.event_rule_id);
            }
            await delQuery;
        }
    } catch (e) {
        await sb.from('repertoire_items').delete().eq('id', id).eq('organization_id', orgId);
    }
};

export const updateRepertoireItem = async (id: string, orgId: string, updates: any) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('repertoire_items').update(updates).eq('id', id).eq('organization_id', orgId);
};
