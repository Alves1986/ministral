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

