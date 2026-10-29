import { AppNotification } from '../types';

/**
 * Utilitários para filtragem e isolamento determinístico de repertório por evento/culto.
 */

export interface TargetEventInfo {
  ruleId?: string | null;
  id?: string | null;
  title?: string | null;
  time?: string | null;
  date?: string | null;
}

export interface RepertoireItemLike {
  event_rule_id?: string | null;
  eventRuleId?: string | null;
  observation?: string | null;
  date?: string | null;
  [key: string]: any;
}

const normalizeText = (text?: string | null): string => {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

/**
 * Determina se um item de repertório pertence com exatidão a um culto/evento específico.
 * Garante que cultos diferentes no mesmo dia (ex: Domingo Manhã e Domingo Noite)
 * não compartilhem ou misturem seus louvores indevidamente.
 */
export const isRepertoireItemForEvent = (
  item: RepertoireItemLike,
  target: TargetEventInfo
): boolean => {
  if (!item || !target) return false;

  // 1. Verificação de Data
  const itemDate = item.date ? item.date.slice(0, 10) : null;
  const targetDate = target.date ? target.date.slice(0, 10) : null;

  if (itemDate && targetDate && itemDate !== targetDate) {
    return false;
  }

  // Extrair ruleId alvo (se vier no formato composto "ruleId|date", extrair ruleId)
  let targetRuleId = target.ruleId || null;
  if (!targetRuleId && target.id && typeof target.id === 'string' && target.id.includes('|')) {
    targetRuleId = target.id.split('|')[0];
  } else if (!targetRuleId && target.id) {
    targetRuleId = target.id;
  }

  const itemRuleId = item.event_rule_id || item.eventRuleId || null;

  // 2. Se ambos tiverem ruleId definido:
  if (itemRuleId && targetRuleId) {
    return itemRuleId === targetRuleId;
  }

  // 3. Se o item tiver um ruleId específico mas o target tiver outro ruleId conhecido:
  // (caso já coberto pelo if acima se ambos tiverem). Mas se o item tem ruleId e target não tem:
  if (itemRuleId && !targetRuleId) {
    // Se o item tem regra amarrada, mas não sabemos a regra do evento, não associamos por segurança
    return false;
  }

  // 4. Se o item não tem ruleId, verificamos o conteúdo do campo observation (Culto: [Nome] (HH:mm))
  const targetTitleNorm = normalizeText(target.title);
  const targetTime = target.time ? target.time.slice(0, 5) : '';
  const obs = item.observation || '';
  const obsNorm = normalizeText(obs);

  if (obsNorm) {
    // Tenta casar o padrão "Culto: [Nome] (HH:mm)"
    const obsMatch = obs.match(/culto:\s*([^(]+?)(?:\s*\(([^)]+)\))?$/i);
    if (obsMatch) {
      const obsTitleNorm = normalizeText(obsMatch[1]);
      const obsTime = obsMatch[2] ? obsMatch[2].trim().slice(0, 5) : '';

      // Se ambos tiverem horários e forem diferentes (ex: 09:30 vs 19:00), NÃO pertence!
      if (targetTime && obsTime && targetTime !== obsTime) {
        return false;
      }

      // Se ambos tiverem títulos e forem divergentes (ex: 'manha' vs 'noite'), NÃO pertence!
      if (targetTitleNorm && obsTitleNorm) {
        const isTargetMorning = targetTitleNorm.includes('manha');
        const isTargetNight = targetTitleNorm.includes('noite');
        const isObsMorning = obsTitleNorm.includes('manha');
        const isObsNight = obsTitleNorm.includes('noite');

        if ((isTargetMorning && isObsNight) || (isTargetNight && isObsMorning)) {
          return false;
        }

        if (targetTitleNorm.includes(obsTitleNorm) || obsTitleNorm.includes(targetTitleNorm)) {
          return true;
        }
      }

      // Se os horários baterem exatamente
      if (targetTime && obsTime && targetTime === obsTime) {
        return true;
      }
    } else {
      // Verificação defensiva de palavras-chave na observação
      const isObsMorning = obsNorm.includes('manha') || obsNorm.includes('09:') || obsNorm.includes('10:');
      const isObsNight = obsNorm.includes('noite') || obsNorm.includes('18:') || obsNorm.includes('19:') || obsNorm.includes('20:');
      const isTargetMorning = targetTitleNorm.includes('manha') || targetTime.startsWith('09:') || targetTime.startsWith('10:');
      const isTargetNight = targetTitleNorm.includes('noite') || targetTime.startsWith('18:') || targetTime.startsWith('19:') || targetTime.startsWith('20:');

      if ((isObsMorning && isTargetNight) || (isObsNight && isTargetMorning)) {
        return false;
      }
    }
  }

  // 5. Se o target tiver ruleId mas o item não tem ruleId e não tem observation discriminando:
  // Se o target tem um ruleId explícito e o item é avulso sem vinculação,
  // não associamos a um culto específico de regras para evitar que músicas avulsas
  // vazem para cultos de agenda semanal sem seleção intencional.
  if (targetRuleId && !itemRuleId && !obsNorm) {
    return false;
  }

  return true;
};

// ── Controle de Cooldown e Idempotência de Notificações de Playlist ──────────
const playlistNotificationCooldownMap = new Map<string, number>();

export function canDispatchPlaylistNotification(key: string, cooldownMs = 15000): boolean {
  if (!key) return false;
  const now = Date.now();
  const lastDispatch = playlistNotificationCooldownMap.get(key);
  if (lastDispatch && now - lastDispatch < cooldownMs) {
    return false;
  }
  playlistNotificationCooldownMap.set(key, now);
  return true;
}

export function resetPlaylistNotificationCooldown(): void {
  playlistNotificationCooldownMap.clear();
}

/**
 * Extrai uma chave canônica de agrupamento de notificação de playlist.
 */
export function extractPlaylistNotificationKey(n: AppNotification): string | null {
  const isPlaylist = (n.actionLink === 'repertoire') ||
    (n.title && (n.title.includes('Playlist') || n.title.includes('Repertório'))) ||
    (n.message && (n.message.includes('playlist') || n.message.includes('repertório')));

  if (!isPlaylist) return null;

  const text = `${n.title || ''} ${n.message || ''}`.toLowerCase();

  // Extrai data DD/MM/AAAA ou AAAA-MM-DD
  const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})|(\d{4}-\d{2}-\d{2})/);
  const dateStr = dateMatch ? dateMatch[0] : '';

  // Extrai identificador do culto (ex: "dom - noite", "dom - manha", "quarta", etc.)
  let cultoKey = 'geral';
  if (text.includes('manha') || text.includes('manhã')) {
    cultoKey = 'manha';
  } else if (text.includes('noite')) {
    cultoKey = 'noite';
  } else if (text.includes('quarta')) {
    cultoKey = 'quarta';
  } else if (text.includes('sabado') || text.includes('sábado')) {
    cultoKey = 'sabado';
  } else {
    const matchCulto = text.match(/para\s+o\s+([^(.,]+)/i);
    if (matchCulto && matchCulto[1]) {
      cultoKey = matchCulto[1].trim();
    }
  }

  if (dateStr) {
    return `playlist_${dateStr}_${cultoKey}`;
  }
  return null;
}

/**
 * Deduplica notificações de playlist repetidas de um mesmo culto para o usuário,
 * garantindo que ele veja apenas uma notificação limpa em vez de múltiplas cópias
 * geradas para Louvor, Dança e Projeção.
 */
export function deduplicatePlaylistNotifications(notifications: AppNotification[]): AppNotification[] {
  if (!Array.isArray(notifications)) return [];

  const seenPlaylistKeys = new Set<string>();
  const result: AppNotification[] = [];

  for (const n of notifications) {
    const key = extractPlaylistNotificationKey(n);
    if (!key) {
      result.push(n);
      continue;
    }

    if (!seenPlaylistKeys.has(key)) {
      seenPlaylistKeys.add(key);
      result.push(n);
    }
  }

  return result;
}

// ── Normalização e Ranking de Músicas do Repertório ─────────────────────────

export interface SongOccurrence {
  id: string;
  date: string;
  cultoTitle: string;
  cultoTime?: string;
  link?: string;
  key?: string;
  content?: string;
}

export interface SongRankingItem {
  normalizedTitle: string;
  displayTitle: string;
  count: number;
  lastDate: string;
  lastCultoTitle: string;
  lastCultoTime?: string;
  links: string[];
  content?: string;
  key?: string;
  occurrences: SongOccurrence[];
}

export function normalizeSongTitle(title?: string | null): string {
  if (!title) return '';
  return title
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function calculateSongsRanking(items: RepertoireItemLike[]): SongRankingItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];

  const map = new Map<string, {
    normalizedTitle: string;
    displayTitle: string;
    count: number;
    lastDate: string;
    lastCultoTitle: string;
    lastCultoTime?: string;
    links: string[];
    content?: string;
    key?: string;
    occurrences: SongOccurrence[];
  }>();

  for (const item of items) {
    if (!item.title) continue;
    const norm = normalizeSongTitle(item.title);
    if (!norm) continue;

    const itemDate = item.date ? item.date.slice(0, 10) : '0000-00-00';
    let cultoTitle = item.eventRuleTitle || '';
    let cultoTime = item.eventRuleTime || '';

    if (!cultoTitle && item.observation) {
      const obsMatch = item.observation.match(/^Culto:\s*([^(]+?)(?:\s*\(([^)]+)\))?$/i);
      if (obsMatch) {
        cultoTitle = obsMatch[1].trim();
        if (obsMatch[2]) cultoTime = obsMatch[2].trim();
      }
    }

    if (!cultoTitle) {
      cultoTitle = 'Culto Geral';
    }

    const occurrence: SongOccurrence = {
      id: item.id || `${norm}_${itemDate}`,
      date: itemDate,
      cultoTitle,
      cultoTime: cultoTime || undefined,
      link: item.link || undefined,
      key: item.key || undefined,
      content: item.content || undefined
    };

    if (!map.has(norm)) {
      map.set(norm, {
        normalizedTitle: norm,
        displayTitle: item.title.trim(),
        count: 1,
        lastDate: itemDate,
        lastCultoTitle: cultoTitle,
        lastCultoTime: cultoTime || undefined,
        links: item.link ? [item.link] : [],
        content: item.content || undefined,
        key: item.key || undefined,
        occurrences: [occurrence]
      });
    } else {
      const existing = map.get(norm)!;
      existing.count += 1;
      existing.occurrences.push(occurrence);

      if (item.link && !existing.links.includes(item.link)) {
        existing.links.push(item.link);
      }

      // Se a data deste item for mais recente que lastDate, atualiza displayTitle, lastDate, cultoTitle e links/cifras
      if (itemDate >= existing.lastDate) {
        existing.lastDate = itemDate;
        existing.lastCultoTitle = cultoTitle;
        existing.lastCultoTime = cultoTime || undefined;
        existing.displayTitle = item.title.trim();
        if (item.key) existing.key = item.key;
        if (item.content) existing.content = item.content;
      }
    }
  }

  // Ordena ranking:
  // 1. Contagem descrescente (músicas mais escolhidas primeiro)
  // 2. Data mais recente decrescente
  // 3. Título alfabético
  return Array.from(map.values()).sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    const dateComp = b.lastDate.localeCompare(a.lastDate);
    if (dateComp !== 0) {
      return dateComp;
    }
    return a.displayTitle.localeCompare(b.displayTitle);
  });
}

export interface PartitionedPlaylists<T = any> {
  nextPlaylist: T | null;
  upcomingPlaylists: T[];
  pastPlaylists: T[];
}

export function partitionPlaylists<T extends { isNext?: boolean; isPast?: boolean; groupKey?: string; date?: string; cultoTime?: string | null }>(
  groups: T[]
): PartitionedPlaylists<T> {
  if (!Array.isArray(groups) || groups.length === 0) {
    return { nextPlaylist: null, upcomingPlaylists: [], pastPlaylists: [] };
  }

  // Encontra a playlist que é o próximo culto
  let nextPlaylist = groups.find(g => g.isNext) || groups.find(g => !g.isPast) || null;

  const upcomingPlaylists: T[] = [];
  const pastPlaylists: T[] = [];

  for (const g of groups) {
    if (g.isPast) {
      pastPlaylists.push(g);
    } else if (!nextPlaylist || g.groupKey !== nextPlaylist.groupKey) {
      upcomingPlaylists.push(g);
    }
  }

  return {
    nextPlaylist,
    upcomingPlaylists,
    pastPlaylists
  };
}

export function filterSongRanking(ranking: SongRankingItem[], query?: string | null): SongRankingItem[] {
  if (!query || !query.trim()) return ranking;
  const qNorm = normalizeSongTitle(query);
  return ranking.filter(item => 
    item.normalizedTitle.includes(qNorm) || 
    item.displayTitle.toLowerCase().includes(query.trim().toLowerCase())
  );
}

// ============================================================================
// SELEÇÃO INTELIGENTE DE CULTOS DA AGENDA NO REPERTÓRIO
// ============================================================================

export interface CalendarCultoItem {
  key: string;
  id: string;
  ruleId?: string | null;
  title: string;
  date: string;
  time: string;
  iso: string;
  weekday: number;
  weekdayShort: string;
  weekdayFull: string;
  dateDisplay: string;
  isPast: boolean;
  isNext?: boolean;
  songsCount?: number;
}

export interface CultoMonthGroup {
  monthKey: string;
  cultos: CalendarCultoItem[];
}

export interface OrganizedCultosSelection {
  nextCulto: CalendarCultoItem | null;
  quickPickCultos: CalendarCultoItem[];
  upcomingCultos: CalendarCultoItem[];
  upcomingByMonth: CultoMonthGroup[];
  pastCultos: CalendarCultoItem[];
}

export interface RuleTemplateItem {
  title: string;
  time: string;
  ruleId: string;
}

/**
 * Deduplica regras de culto da organização priorizando as regras do ministério atual.
 * Garante também que o horário esteja em formato HH:mm e que o tipo ('weekly' | 'single') esteja preenchido.
 */
export function deduplicateEventRules<T extends Record<string, any>>(
  rules: T[],
  preferredMinistryId?: string | null
): T[] {
  if (!Array.isArray(rules) || rules.length === 0) return [];

  // Ordena priorizando as regras do ministério atual
  const sorted = [...rules].sort((a, b) => {
    const aPref = preferredMinistryId && a.ministry_id === preferredMinistryId ? 0 : 1;
    const bPref = preferredMinistryId && b.ministry_id === preferredMinistryId ? 0 : 1;
    if (aPref !== bPref) return aPref - bPref;
    const aTime = String(a.time || '19:30').slice(0, 5);
    const bTime = String(b.time || '19:30').slice(0, 5);
    return aTime.localeCompare(bTime);
  });

  const seen = new Set<string>();
  const result: T[] = [];

  for (const r of sorted) {
    if (!r || !r.title) continue;
    if (r.active === false) continue;

    const timeNorm = String(r.time || '19:30').slice(0, 5);
    const titleNorm = normalizeSongTitle(r.title);
    const inferredType = r.type || (r.weekday !== undefined && r.weekday !== null ? 'weekly' : 'single');
    const sig = `${inferredType}|${r.weekday ?? ''}|${r.date || ''}|${timeNorm}|${titleNorm}`;

    if (!seen.has(sig)) {
      seen.add(sig);
      result.push({
        ...r,
        time: timeNorm,
        type: inferredType,
        active: true,
      });
    }
  }

  return result;
}

/**
 * Extrai modelos únicos de cultos já existentes na igreja para preenchimento rápido.
 */
export function extractRuleTemplates(rules: Record<string, any>[]): RuleTemplateItem[] {
  if (!Array.isArray(rules) || rules.length === 0) return [];
  const seen = new Set<string>();
  const templates: RuleTemplateItem[] = [];

  for (const r of rules) {
    if (!r || !r.title) continue;
    const title = String(r.title).trim();
    const time = String(r.time || '19:30').slice(0, 5);
    const sig = `${normalizeSongTitle(title)}|${time}`;
    if (!seen.has(sig)) {
      seen.add(sig);
      templates.push({
        title,
        time,
        ruleId: String(r.id || ''),
      });
    }
  }

  return templates;
}

/**
 * Conta quantas músicas já existem cadastradas no repertório para um culto específico.
 */
function countSongsForCulto(culto: CalendarCultoItem, repertoireItems: RepertoireItemLike[]): number {
  if (!Array.isArray(repertoireItems) || repertoireItems.length === 0) return 0;

  const cultoTitleNorm = normalizeSongTitle(culto.title);
  const cultoTimeNorm = (culto.time || '').slice(0, 5);
  let count = 0;

  for (const item of repertoireItems) {
    if (!item || !item.date) continue;
    const itemDate = item.date.split('T')[0];
    if (itemDate !== culto.date) continue;

    // 1. Match direto por ruleId
    if (item.eventRuleId && culto.ruleId && item.eventRuleId === culto.ruleId) {
      count += 1;
      continue;
    }

    // 2. Match por título e horário extraídos do item ou da observation
    let itemTitle = item.eventRuleTitle || '';
    let itemTime = item.eventRuleTime || '';
    if (!itemTitle && item.observation) {
      const obsMatch = item.observation.match(/^Culto:\s*([^(]+?)(?:\s*\(([^)]+)\))?$/i);
      if (obsMatch) {
        itemTitle = obsMatch[1].trim();
        if (obsMatch[2]) itemTime = obsMatch[2].trim();
      }
    }
    itemTime = itemTime.slice(0, 5);
    const itemTitleNorm = normalizeSongTitle(itemTitle);

    if (itemTitleNorm && itemTitleNorm === cultoTitleNorm) {
      if (!itemTime || !cultoTimeNorm || itemTime === cultoTimeNorm) {
        count += 1;
      }
    }
  }

  return count;
}

/**
 * Organiza todos os cultos do calendário para facilitar a escolha pelo ministro:
 * - Não esconde cultos do mês seguinte quando estamos no fim do mês
 * - Contabiliza quantas músicas cada culto já possui (songsCount)
 * - Gera lista de acesso rápido (quickPickCultos) para seleção em 1 clique
 * - Agrupa futuros por mês e ordena realizados do mais recente para o mais antigo
 */
export function organizeCultosForSelection(
  allCultos: CalendarCultoItem[],
  repertoireItems: RepertoireItemLike[] = [],
  quickPickLimit = 4
): OrganizedCultosSelection {
  if (!Array.isArray(allCultos) || allCultos.length === 0) {
    return {
      nextCulto: null,
      quickPickCultos: [],
      upcomingCultos: [],
      upcomingByMonth: [],
      pastCultos: [],
    };
  }

  const enriched: CalendarCultoItem[] = allCultos
    .map(c => ({
      ...c,
      songsCount: countSongsForCulto(c, repertoireItems),
    }))
    .sort((a, b) => a.iso.localeCompare(b.iso));

  const upcomingCultos = enriched.filter(c => !c.isPast);
  const nextCulto = upcomingCultos.find(c => c.isNext) || upcomingCultos[0] || null;
  const quickPickCultos = upcomingCultos.slice(0, quickPickLimit);

  const monthMap = new Map<string, CalendarCultoItem[]>();
  for (const c of upcomingCultos) {
    const monthKey = c.date.slice(0, 7);
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, []);
    }
    monthMap.get(monthKey)!.push(c);
  }

  const upcomingByMonth: CultoMonthGroup[] = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([monthKey, cultos]) => ({ monthKey, cultos }));

  const pastCultos = enriched
    .filter(c => c.isPast)
    .sort((a, b) => b.iso.localeCompare(a.iso));

  return {
    nextCulto,
    quickPickCultos,
    upcomingCultos,
    upcomingByMonth,
    pastCultos,
  };
}



