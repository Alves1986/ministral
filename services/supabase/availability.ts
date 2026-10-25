import { getSupabase } from './client';

export const fetchMemberAvailabilityV2 = async (ministryId: string, orgId: string) => {
    const sb = getSupabase();
    if (!sb) throw new Error("Supabase client not initialized");

    const { data, error } = await sb
        .from('member_availability')
        .select('user_id, available_date, note')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId);

    if (error) throw error;

    const map: Record<string, string[]> = {};
    const notes: Record<string, string> = {};

    data?.forEach((row: any) => {
        if (!map[row.user_id]) map[row.user_id] = [];

        const baseDate = row.available_date;

        // Marcador de mes inteiro bloqueado
        if (row.note === 'BLK') {
            map[row.user_id].push(`${baseDate.substring(0, 7)}-BLK`);
            return;
        }

        // Marcador de mes inteiro disponivel
        if (row.note === 'FREE') {
            map[row.user_id].push(`${baseDate.substring(0, 7)}-FREE`);
            return;
        }

        // Observacao geral do membro para o mes
        if (row.note && row.note.startsWith('NOTE:')) {
            const actualNote = row.note.substring(5);
            if (!/^\d{2}:\d{2}(:\d{2})?$/.test(actualNote.trim())) {
                const monthKey = row.available_date.substring(0, 7) + '-00';
                notes[`${row.user_id}_${monthKey}`] = actualNote;
            }
            return;
        }

        // Ausencia por periodo (M = manha, N = noite) ou dia inteiro
        if (row.note && ['M', 'N'].includes(row.note)) {
            map[row.user_id].push(`${baseDate}_${row.note}`);
        } else {
            map[row.user_id].push(baseDate);
        }
    });

    Object.keys(map).forEach(userId => {
        map[userId] = [...new Set(map[userId])];
    });

    return { availability: map, notes };
};

export const saveMemberAvailabilityV2 = async (orgId: string, ministryId: string, userId: string, dates: string[], notes: any, targetMonth: string) => {
    const sb = getSupabase();
    if (!sb) throw new Error("Supabase client not initialized");

    const [year, month] = targetMonth.split('-').map(Number);
    const next = new Date(year, month, 1);
    const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;



    const uniqueDates = [...new Set(dates.filter(d => d.startsWith(targetMonth)))];
    const rows: any[] = [];

    uniqueDates.forEach(dateString => {
        if (dateString.endsWith('-BLK')) {
            // Mes inteiro indisponivel
            rows.push({
                organization_id: orgId,
                ministry_id: ministryId,
                user_id: userId,
                available_date: `${targetMonth}-01`,
                note: 'BLK'
            });
        } else if (dateString.endsWith('-FREE')) {
            // Mes inteiro disponivel (sem ausencias marcadas)
            rows.push({
                organization_id: orgId,
                ministry_id: ministryId,
                user_id: userId,
                available_date: `${targetMonth}-01`,
                note: 'FREE'
            });
        } else {
            // Ausencia de dia ou periodo especifico
            const underscoreIdx = dateString.indexOf('_');
            if (underscoreIdx !== -1) {
                const dateOnly = dateString.substring(0, underscoreIdx);
                const period = dateString.substring(underscoreIdx + 1);
                rows.push({
                    organization_id: orgId,
                    ministry_id: ministryId,
                    user_id: userId,
                    available_date: dateOnly,
                    note: period
                });
            } else {
                rows.push({
                    organization_id: orgId,
                    ministry_id: ministryId,
                    user_id: userId,
                    available_date: dateString,
                    note: null
                });
            }
        }
    });

    // Salva observacao geral do mes
    const noteKey = `${targetMonth}-00`;
    const generalNote = notes[noteKey];
    if (generalNote && generalNote.trim()) {
        rows.push({
            organization_id: orgId,
            ministry_id: ministryId,
            user_id: userId,
            available_date: `${targetMonth}-01`,
            note: `NOTE:${generalNote.trim()}`
        });
    }

    // Reconciliação cirúrgica por diff para evitar wipe temporário da tela via Supabase Realtime
    const { data: existingRows, error: fetchErr } = await sb
        .from('member_availability')
        .select('id, available_date, note')
        .eq('organization_id', orgId)
        .eq('ministry_id', ministryId)
        .eq('user_id', userId)
        .gte('available_date', `${targetMonth}-01`)
        .lt('available_date', `${nextMonth}-01`);

    if (fetchErr) throw fetchErr;

    const sig = (r: { available_date: string; note?: string | null }) => `${r.available_date}|${r.note || ''}`;
    const existingMap = new Map((existingRows || []).map((r: any) => [sig(r), r.id]));
    const desiredSigs = new Set(rows.map(r => sig(r)));

    // 1. Remove apenas registros que foram desmarcados
    const idsToDelete = (existingRows || [])
        .filter((r: any) => !desiredSigs.has(sig(r)))
        .map((r: any) => r.id);

    if (idsToDelete.length > 0) {
        const { error: delError } = await sb
            .from('member_availability')
            .delete()
            .in('id', idsToDelete);
        if (delError) throw delError;
    }

    // 2. Insere apenas novos registros que não existiam previamente
    const rowsToInsert = rows.filter(r => !existingMap.has(sig(r)));
    if (rowsToInsert.length > 0) {
        const { error: insError } = await sb
            .from('member_availability')
            .insert(rowsToInsert);
        if (insError) throw insError;
    }
};

export const fetchMinistryAvailability = async (ministryId: string, orgId: string) => {
    return fetchMemberAvailabilityV2(ministryId, orgId);
};

export const saveMemberAvailability = async (ministryId: string, orgId: string, userId: string, dates: string[], notes: any, monthTarget?: string) => {
    return saveMemberAvailabilityV2(orgId, ministryId, userId, dates, notes, monthTarget || "");
};
