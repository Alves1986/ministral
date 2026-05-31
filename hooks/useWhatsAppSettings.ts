/**
 * useWhatsAppSettings — Hook TanStack Query para configurações de WhatsApp.
 *
 * Substitui chamadas diretas a fetchWhatsAppSettings() com:
 * - Cache de 10 minutos (dados que mudam raramente)
 * - Deduplicação automática de requests simultâneos
 * - Refetch automático em background
 * - Mutation tipada para salvar configurações com invalidação de cache
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWhatsAppSettings, upsertWhatsAppSettings } from '../services/supabase/misc';
import { WhatsAppSettings } from '../types';

const STALE_SLOW  = 10 * 60 * 1000; // 10 minutos
const GC_TIME     = 15 * 60 * 1000; // 15 minutos

/** Chave de cache para as configurações de WhatsApp de uma organização. */
export const whatsappSettingsKey = (orgId: string) => ['whatsapp-settings', orgId] as const;

/**
 * Hook para ler e atualizar configurações de WhatsApp da organização.
 *
 * @example
 * const { data: settings, isLoading, saveSettings } = useWhatsAppSettings(orgId);
 * await saveSettings({ enabled: true, send_days_before: 2 });
 */
export function useWhatsAppSettings(orgId: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery<WhatsAppSettings | null>({
    queryKey: whatsappSettingsKey(orgId ?? ''),
    queryFn: () => fetchWhatsAppSettings(orgId!),
    enabled: Boolean(orgId),
    staleTime: STALE_SLOW,
    gcTime: GC_TIME,
  });

  const mutation = useMutation({
    mutationFn: (settings: Partial<WhatsAppSettings>) =>
      upsertWhatsAppSettings(orgId!, settings),
    onSuccess: () => {
      // Invalida o cache após salvar para refetch imediato
      queryClient.invalidateQueries({ queryKey: whatsappSettingsKey(orgId ?? '') });
    },
  });

  return {
    settings: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    /** Salva configurações parciais e invalida o cache automaticamente. */
    saveSettings: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}
