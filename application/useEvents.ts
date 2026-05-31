import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchEventRules } from '../infra/supabase/fetchEventRules';
import { generateEvents } from '../domain/events/generateEvents';
import { CalendarEvent } from '../domain/events/types';

interface UseEventsProps {
  ministryId: string;
  organizationId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export function useEvents({ ministryId, organizationId, startDate, endDate }: UseEventsProps) {
  // Query Key Stability - Unificado com 'rules' do useMinistryQueries para compartilhar o cache
  const queryKey = useMemo(() => ['rules', ministryId, organizationId], [ministryId, organizationId]);

  // 1. Busca Regras com estratégia de cache agressiva (evita refetches desnecessários)
  const { data: rules, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => fetchEventRules(ministryId, organizationId),
    enabled: !!ministryId && !!organizationId,
    staleTime: 10 * 60 * 1000, // 10 minutos (Cache agressivo para reduzir frequencia de atualizacao de regras estaticas)
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // 2. Projeção em Memória (Memoizado)
  // Recalcula SEMPRE que rules muda (nova referência do RQ) ou datas mudam
  const events: CalendarEvent[] = useMemo(() => {
    // Guard de segurança
    if (!rules || !Array.isArray(rules)) return [];
    
    // Geração determinística pura
    return generateEvents(rules, startDate, endDate);
  }, [rules, startDate, endDate]);

  return {
    events,
    rules,
    isLoading: (!!ministryId && !!organizationId) ? isLoading : false,
    error
  };
}