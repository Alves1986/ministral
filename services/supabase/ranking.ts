import { getSupabase } from './client';
import { RankingEntry, RankingHistoryItem } from '../../types';

export const fetchRankingData = async (ministryId: string, orgId?: string): Promise<RankingEntry[]> => {
    const sb = getSupabase();
    if (!sb || !orgId) throw new Error("Missing dependencies");

    const GC = {
        assignment: 150,
        swap_assumed: 80,
        swap_requested: -50,
        availability: 20,
        checkin_miss: -30,
        profile_complete: 50,
        month_complete: 100,
        streak_bonus: 50,
        announcement_like: 15,
        announcement_read: 10,
    } as const;

    const { data: membershipsData, error: memError } = await sb.from('ministry_members')
        .select(`
            profile_id,
            profiles!inner (
                id,
                name,
                avatar_url,
                organization_id
            )
        `)
        .eq('ministry_id', ministryId)
        .eq('profiles.organization_id', orgId);

    if (memError) {
        console.error("[Ranking] Error fetching memberships:", memError);
        throw memError;
    }

    if (!membershipsData || membershipsData.length === 0) return [];
    
    const members = membershipsData.map((m: any) => Array.isArray(m.profiles) ? m.profiles[0] : m.profiles).filter(Boolean);
    const userIds = members.map((m: any) => m.id);
    const todayStr = new Date().toISOString().slice(0, 10);
    const now = new Date();

    const { data: ministryAnnouncements } = await sb.from('announcements')
        .select('id')
        .eq('ministry_id', ministryId)
        .eq('organization_id', orgId);
    
    const announcementIds = (ministryAnnouncements || []).map((a: any) => a.id);

    const [
        assignmentsRes, 
        swapsRes, 
        interactionsRes,
        swapsAssumedRes,
        availabilityRes,
        checkinMissesRes,
        ministryMembershipsRes,
        profilesRes
    ] = await Promise.all([
        sb.from('schedule_assignments').select('member_id, event_date, role, confirmed').eq('organization_id', orgId).eq('ministry_id', ministryId).eq('confirmed', true).lte('event_date', todayStr),
        sb.from('swap_requests').select('requester_id, created_at, status').eq('organization_id', orgId).eq('ministry_id', ministryId),
        announcementIds.length > 0 
            ? sb.from('announcement_interactions').select('user_id, interaction_type, created_at').eq('organization_id', orgId).in('user_id', userIds).in('announcement_id', announcementIds)
            : Promise.resolve({ data: [], error: null }),
        sb.from('swap_requests').select('taken_by_id, created_at').eq('organization_id', orgId).eq('ministry_id', ministryId).eq('status', 'completed').not('taken_by_id', 'is', null),
        sb.from('member_availability').select('user_id, available_date, created_at').eq('organization_id', orgId).eq('ministry_id', ministryId),
        sb.from('schedule_assignments').select('member_id, event_date, confirmed, event_rules(time)').eq('organization_id', orgId).eq('ministry_id', ministryId).eq('confirmed', false),
        sb.from('ministry_members').select('profile_id, created_at').eq('ministry_id', ministryId).eq('organization_id', orgId),
        sb.from('profiles').select('id, avatar_url, whatsapp, birth_date').in('id', userIds).eq('organization_id', orgId)
    ]) as any;

    const assignments = assignmentsRes.data || [];
    const swaps = swapsRes.data || [];
    const interactions = interactionsRes.data || [];
    const swapsAssumed = swapsAssumedRes.data || [];
    const availabilities = availabilityRes.data || [];
    const checkinMissesData = checkinMissesRes.data || [];
    const ministryMemberships = ministryMembershipsRes.data || [];
    const profiles = profilesRes.data || [];

    return (members || []).map((m: any) => {
        let points = 0;
        const history: RankingHistoryItem[] = [];

        // 1. ESCALAS CONFIRMADAS
        const memberAssignments = assignments.filter((a: any) => a.member_id === m.id);
        points += memberAssignments.length * GC.assignment;
        memberAssignments.forEach((a: any) => {
            history.push({ 
                id: `assign-${a.member_id}-${a.event_date}`, 
                date: a.event_date, 
                description: `Escala Confirmada: ${a.role}`, 
                points: GC.assignment, 
                type: 'assignment' 
            });
        });

        // 2. BONUS DE SEQUENCIA
        const sortedAssignments = [...memberAssignments].sort((a, b) => a.event_date.localeCompare(b.event_date));
        let streakCount = 0;
        for (let i = 2; i < sortedAssignments.length; i += 3) {
            points += GC.streak_bonus;
            streakCount++;
            history.push({
                id: `streak-${m.id}-${sortedAssignments[i].event_date}`,
                date: sortedAssignments[i].event_date,
                description: 'Bonus de Sequencia: 3 escalas seguidas',
                points: GC.streak_bonus,
                type: 'streak_bonus'
            });
        }

        // 3. SWAPS ASSUMIDOS
        const assumed = swapsAssumed.filter((s: any) => s.taken_by_id === m.id);
        points += assumed.length * GC.swap_assumed;
        assumed.forEach((s: any) => {
            history.push({
                id: `swap-assumed-${m.id}-${s.created_at}`,
                date: s.created_at,
                description: 'Assumiu Troca de Outro Membro',
                points: GC.swap_assumed,
                type: 'swap_assumed'
            });
        });

        // 3.1 PENALIDADE POR SOLICITAR TROCA
        const memberSwapsRequested = swaps.filter((s: any) => s.requester_id === m.id);
        points += memberSwapsRequested.length * GC.swap_requested;
        memberSwapsRequested.forEach((s: any) => {
            history.push({
                id: `swap-requested-${m.id}-${s.created_at}`,
                date: s.created_at,
                description: 'Solicitou Troca de Escala',
                points: GC.swap_requested,
                type: 'manual_adjust' // Usando manual_adjust ou podemos adicionar 'swap_penalty' se existisse, mas usaremos manual_adjust ou assignment dependendo do tipo permitido no history
            });
        });

        // 4. DISPONIBILIDADE ANTECIPADA (Apenas 1x por membro)
        const memberAvails = availabilities.filter((a: any) => a.user_id === m.id);
        const firstEarlyAvail = memberAvails.find((a: any) => {
            const createdAt = new Date(a.created_at);
            const availDate = new Date(a.available_date);
            const diffDays = (availDate.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
            return diffDays >= 7;
        });

        if (firstEarlyAvail) {
            points += GC.availability;
            history.push({
                id: `avail-${m.id}-${firstEarlyAvail.available_date}`,
                date: firstEarlyAvail.created_at,
                description: 'Disponibilidade Marcada com Antecedencia (Bonus Unico)',
                points: GC.availability,
                type: 'availability'
            });
        }

        // 5. CHECK-IN ESQUECIDO
        const misses = checkinMissesData.filter((a: any) => {
            if (a.member_id !== m.id || a.confirmed) return false;
            const timeStr = a.event_rules?.time || '23:59:59';
            const eventDateTime = new Date(`${a.event_date}T${timeStr}`);
            
            // Add 120 minutes to allow the user checking in late (as NextEventCard permits)
            const checkinClosedTime = new Date(eventDateTime.getTime() + 120 * 60000);
            return checkinClosedTime < now;
        });
        points += misses.length * GC.checkin_miss;
        misses.forEach((a: any) => {
            history.push({
                id: `miss-${m.id}-${a.event_date}`,
                date: a.event_date,
                description: 'Check-in nao marcado',
                points: GC.checkin_miss,
                type: 'checkin_miss'
            });
        });

        // 6. PERFIL COMPLETO
        const prof = profiles.find((p: any) => p.id === m.id);
        if (prof?.avatar_url && prof?.whatsapp && prof?.birth_date) {
            points += GC.profile_complete;
            history.push({
                id: `profile-${m.id}`,
                date: m.created_at || todayStr,
                description: 'Perfil Completo',
                points: GC.profile_complete,
                type: 'profile_complete'
            });
        }

        // 7. BONUS MENSAL
        const membership = ministryMemberships.find((mm: any) => mm.profile_id === m.id);
        if (membership?.created_at) {
            const joinDate = new Date(membership.created_at);
            const yearsInMinistry = Math.floor((now.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 365));
            if (yearsInMinistry >= 1) {
                const memberSwapsRequested = swaps.filter((s: any) => s.requester_id === m.id);
                const hasNoSwaps = memberSwapsRequested.length === 0;
                const hasNoMisses = misses.length === 0;

                if (hasNoSwaps && hasNoMisses && memberAssignments.length > 0) {
                    points += GC.month_complete;
                    history.push({
                        id: `month-bonus-${m.id}-${todayStr.slice(0, 7)}`,
                        date: todayStr,
                        description: 'Bonus: Todas as escalas do mes sem trocas',
                        points: GC.month_complete,
                        type: 'month_complete'
                    });
                }
            }
        }

        // 8. CURTIDAS E LEITURAS
        const memberReads = interactions.filter((i: any) => i.user_id === m.id && i.interaction_type === 'read');
        points += memberReads.length * GC.announcement_read;
        memberReads.forEach((i: any) => history.push({ 
            id: `read-${m.id}-${i.created_at}`, 
            date: i.created_at, 
            description: `Leu um Aviso`, 
            points: GC.announcement_read, 
            type: 'announcement_read' 
        }));

        const memberLikes = interactions.filter((i: any) => i.user_id === m.id && i.interaction_type === 'like');
        points += memberLikes.length * GC.announcement_like;
        memberLikes.forEach((i: any) => history.push({ 
            id: `like-${m.id}-${i.created_at}`, 
            date: i.created_at, 
            description: `Curtiu um Aviso`, 
            points: GC.announcement_like, 
            type: 'announcement_like' 
        }));

        if (points < 0) points = 0;
        history.sort((a, b) => b.date.localeCompare(a.date));

        return {
            memberId: m.id,
            name: m.name,
            avatar_url: m.avatar_url,
            points,
            gloryCoinBalance: points,
            gloryCoinEarned: points,
            stats: {
                confirmedEvents: memberAssignments.length,
                swapsAssumed: assumed.length,
                checkinMisses: misses.length,
                streakBonuses: streakCount,
                announcementsRead: memberReads.length,
                announcementsLiked: memberLikes.length,
            },
            history
        };
    });
};
