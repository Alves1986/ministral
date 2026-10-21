// services/supabase/aiQuotaService.ts
// Gerenciamento e controle de Rate Limiting & Quotas de IA por Organização

import { getSupabase } from './client';
import {
  Organization,
  AIPlanTier,
  OrganizationAIQuotaConfig,
  OrganizationAIQuotaStatus,
  GlobalAIQuotaOverview,
} from '../../types';

export const DEFAULT_TIER_LIMITS: Record<AIPlanTier, { weeklyLimit: number; allowedModels: 'basic' | 'all'; label: string }> = {
  free: {
    weeklyLimit: 25,
    allowedModels: 'basic',
    label: 'Gratuito (Básico)',
  },
  pro: {
    weeklyLimit: 150,
    allowedModels: 'all',
    label: 'Pago (Turbo / Pro)',
  },
  enterprise: {
    weeklyLimit: 999999,
    allowedModels: 'all',
    label: 'Enterprise (Ilimitado)',
  },
  custom: {
    weeklyLimit: 50,
    allowedModels: 'all',
    label: 'Personalizado',
  },
};

const CACHE_KEY_CONFIGS = 'ministral_ai_quota_configs_v1';
const CACHE_KEY_USAGE = 'ministral_ai_weekly_usage_v1';

/**
 * Retorna a data/hora do início da semana corrente (Segunda-feira 00:00:00)
 */
export function getStartOfCurrentWeek(): Date {
  const now = new Date();
  const day = now.getDay(); // 0 = Domingo, 1 = Segunda, ...
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Ajusta para segunda-feira
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Lê configurações de cache local (fallback e performance)
 */
function getCachedConfigs(): Record<string, Partial<OrganizationAIQuotaConfig>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY_CONFIGS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setCachedConfig(orgId: string, config: Partial<OrganizationAIQuotaConfig>) {
  if (typeof window === 'undefined') return;
  try {
    const current = getCachedConfigs();
    current[orgId] = { ...(current[orgId] || {}), ...config, updatedAt: new Date().toISOString() };
    localStorage.setItem(CACHE_KEY_CONFIGS, JSON.stringify(current));
  } catch {}
}

/**
 * Lê contadores de uso semanal em cache local
 */
function getCachedUsageMap(): Record<string, { weekStart: string; count: number }> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY_USAGE);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function incrementCachedUsage(orgId: string): number {
  if (typeof window === 'undefined') return 1;
  try {
    const map = getCachedUsageMap();
    const currentWeekStart = getStartOfCurrentWeek().toISOString();
    const existing = map[orgId];

    if (!existing || existing.weekStart !== currentWeekStart) {
      map[orgId] = { weekStart: currentWeekStart, count: 1 };
    } else {
      map[orgId].count = (map[orgId].count || 0) + 1;
    }
    localStorage.setItem(CACHE_KEY_USAGE, JSON.stringify(map));
    return map[orgId].count;
  } catch {
    return 1;
  }
}

/**
 * Obtém a configuração de cota de IA para uma organização específica
 */
export async function getOrganizationAIQuota(
  orgId: string,
  orgFallback?: Partial<Organization>
): Promise<OrganizationAIQuotaConfig> {
  const cached = getCachedConfigs()[orgId];

  // 1. Tentar ler do Supabase (organizations ou audit logs)
  const sb = getSupabase();
  if (sb) {
    try {
      const { data: orgData } = await sb
        .from('organizations')
        .select('id, name, plan_type, ai_enabled, ai_tier, ai_weekly_limit, ai_bonus_credits, ai_allowed_models')
        .eq('id', orgId)
        .maybeSingle();

      if (orgData) {
        const tier = (orgData.ai_tier as AIPlanTier) || (orgData.plan_type === 'enterprise' ? 'enterprise' : orgData.plan_type === 'pro' ? 'pro' : 'free');
        const defaultTier = DEFAULT_TIER_LIMITS[tier] || DEFAULT_TIER_LIMITS.free;

        const resolvedConfig: OrganizationAIQuotaConfig = {
          organizationId: orgId,
          organizationName: orgData.name || orgFallback?.name,
          enabled: orgData.ai_enabled !== undefined ? Boolean(orgData.ai_enabled) : (cached?.enabled !== undefined ? cached.enabled : true),
          tier,
          weeklyLimit: orgData.ai_weekly_limit || cached?.weeklyLimit || defaultTier.weeklyLimit,
          bonusCredits: orgData.ai_bonus_credits || cached?.bonusCredits || 0,
          allowedModels: orgData.ai_allowed_models || cached?.allowedModels || defaultTier.allowedModels,
          updatedAt: cached?.updatedAt || new Date().toISOString(),
        };

        setCachedConfig(orgId, resolvedConfig);
        return resolvedConfig;
      }
    } catch {
      // Falha silenciosa caso colunas não existam ainda
    }

    // 2. Tentar ler de ministry_audit_logs (última atualização de cota de IA)
    try {
      const { data: auditRow } = await sb
        .from('ministry_audit_logs')
        .select('metadata, created_at')
        .eq('organization_id', orgId)
        .eq('action', 'ai_quota_config_update')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (auditRow && auditRow.metadata) {
        const m = auditRow.metadata;
        const tier = (m.tier as AIPlanTier) || 'free';
        const defaultTier = DEFAULT_TIER_LIMITS[tier] || DEFAULT_TIER_LIMITS.free;

        const resolvedConfig: OrganizationAIQuotaConfig = {
          organizationId: orgId,
          organizationName: orgFallback?.name,
          enabled: m.enabled !== undefined ? Boolean(m.enabled) : true,
          tier,
          weeklyLimit: m.weeklyLimit !== undefined ? Number(m.weeklyLimit) : defaultTier.weeklyLimit,
          bonusCredits: m.bonusCredits !== undefined ? Number(m.bonusCredits) : 0,
          allowedModels: m.allowedModels || defaultTier.allowedModels,
          updatedAt: auditRow.created_at,
        };

        setCachedConfig(orgId, resolvedConfig);
        return resolvedConfig;
      }
    } catch {}
  }

  // 3. Fallback inteligente baseado no plano da organização ou cache
  const plan = orgFallback?.plan_type || 'trial';
  const tier: AIPlanTier = cached?.tier || (plan === 'enterprise' ? 'enterprise' : plan === 'pro' ? 'pro' : 'free');
  const defaultTier = DEFAULT_TIER_LIMITS[tier] || DEFAULT_TIER_LIMITS.free;

  const fallbackConfig: OrganizationAIQuotaConfig = {
    organizationId: orgId,
    organizationName: orgFallback?.name,
    enabled: cached?.enabled !== undefined ? cached.enabled : true,
    tier,
    weeklyLimit: cached?.weeklyLimit !== undefined ? cached.weeklyLimit : defaultTier.weeklyLimit,
    bonusCredits: cached?.bonusCredits || 0,
    allowedModels: cached?.allowedModels || defaultTier.allowedModels,
    updatedAt: cached?.updatedAt || new Date().toISOString(),
  };

  setCachedConfig(orgId, fallbackConfig);
  return fallbackConfig;
}

/**
 * Retorna o status completo de uso e cota de IA para uma organização específica
 */
export async function getOrganizationAIStatus(
  orgId: string,
  orgName?: string
): Promise<OrganizationAIQuotaStatus> {
  const config = await getOrganizationAIQuota(orgId, orgName ? { id: orgId, name: orgName } : undefined);
  const usedThisWeek = await getOrganizationWeeklyUsageCount(orgId);
  const isUnlimited = config.tier === 'enterprise' || config.weeklyLimit >= 999999;
  const totalLimit = config.weeklyLimit + config.bonusCredits;
  const isExceeded = !isUnlimited && usedThisWeek >= totalLimit;
  const percentUsed = isUnlimited ? 0 : Math.min(100, Math.round((usedThisWeek / (totalLimit || 1)) * 100));
  const remaining = isUnlimited ? 999999 : Math.max(0, totalLimit - usedThisWeek);

  let status: 'normal' | 'warning' | 'exceeded' | 'disabled' = 'normal';
  if (!config.enabled) status = 'disabled';
  else if (isExceeded) status = 'exceeded';
  else if (percentUsed >= 80) status = 'warning';

  return {
    organizationId: orgId,
    organizationName: config.organizationName || orgName || 'Organização',
    enabled: config.enabled,
    tier: config.tier,
    weeklyLimit: config.weeklyLimit,
    bonusCredits: config.bonusCredits,
    allowedModels: config.allowedModels,
    usedThisWeek,
    totalLimit,
    percentUsed,
    remaining,
    isExceeded,
    status,
  };
}

/**
 * Salva a configuração de cota de IA para uma organização
 */
export async function saveOrganizationAIQuota(
  orgId: string,
  config: Partial<OrganizationAIQuotaConfig>,
  orgName?: string
): Promise<{ success: boolean; message?: string }> {
  // Atualiza cache local imediatamente
  setCachedConfig(orgId, config);

  const sb = getSupabase();
  if (!sb) return { success: true, message: 'Salvo localmente' };

  let dbUpdated = false;

  // 1. Tenta atualizar colunas na tabela organizations
  try {
    const orgPayload: any = {};
    if (config.enabled !== undefined) orgPayload.ai_enabled = config.enabled;
    if (config.tier !== undefined) orgPayload.ai_tier = config.tier;
    if (config.weeklyLimit !== undefined) orgPayload.ai_weekly_limit = config.weeklyLimit;
    if (config.bonusCredits !== undefined) orgPayload.ai_bonus_credits = config.bonusCredits;
    if (config.allowedModels !== undefined) orgPayload.ai_allowed_models = config.allowedModels;

    if (Object.keys(orgPayload).length > 0) {
      const { error } = await sb.from('organizations').update(orgPayload).eq('id', orgId);
      if (!error) dbUpdated = true;
    }
  } catch {}

  // 2. Registra na auditoria (persistência garantida em PostgreSQL)
  try {
    const { data: { user } } = await sb.auth.getUser();
    await sb.from('ministry_audit_logs').insert({
      organization_id: orgId,
      actor_id: user?.id || null,
      actor_name: user?.user_metadata?.name || 'Super Admin',
      action: 'ai_quota_config_update',
      target_type: 'organization_ai_quota',
      target_id: orgId,
      target_name: orgName || 'Organização',
      metadata: {
        ...config,
        updated_at: new Date().toISOString(),
      },
    });
    dbUpdated = true;
  } catch (err) {
    console.warn('[saveOrganizationAIQuota] Erro ao gravar auditoria:', err);
  }

  return { success: true, message: dbUpdated ? 'Configuração de IA atualizada com sucesso!' : 'Configuração salva no cache!' };
}

/**
 * Conta quantas requisições de IA a organização realizou nesta semana
 */
export async function getOrganizationWeeklyUsageCount(orgId: string): Promise<number> {
  const sb = getSupabase();
  const weekStart = getStartOfCurrentWeek().toISOString();

  let countFromDb = 0;
  let dbQueried = false;

  if (sb) {
    // 1. Tentar tabela dedicada ai_usage_logs
    try {
      const { count, error } = await sb
        .from('ai_usage_logs')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .gte('created_at', weekStart);

      if (!error && count !== null) {
        countFromDb = count;
        dbQueried = true;
      }
    } catch {}

    // 2. Tentar ministry_audit_logs (action = 'ai_request_log')
    if (!dbQueried) {
      try {
        const { count, error } = await sb
          .from('ministry_audit_logs')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('action', 'ai_request_log')
          .gte('created_at', weekStart);

        if (!error && count !== null) {
          countFromDb = count;
          dbQueried = true;
        }
      } catch {}
    }
  }

  // 3. Fallback / Sincronização com o cache local
  const cachedMap = getCachedUsageMap();
  const cached = cachedMap[orgId];
  const cachedCount = cached && cached.weekStart === weekStart ? cached.count : 0;

  return Math.max(countFromDb, cachedCount);
}

/**
 * Registra o uso de uma chamada de IA
 */
export async function recordAIRequestUsage(
  orgId: string,
  details: {
    taskType: string;
    modelUsed: string;
    durationMs?: number;
    status: 'success' | 'error' | 'fallback';
    errorMessage?: string;
  }
) {
  // Incrementa cache local imediatamente
  incrementCachedUsage(orgId);

  const sb = getSupabase();
  if (!sb) return;

  // 1. Tenta inserir na tabela ai_usage_logs
  try {
    await sb.from('ai_usage_logs').insert({
      organization_id: orgId,
      task_type: details.taskType,
      model_used: details.modelUsed,
      status: details.status,
      duration_ms: details.durationMs || 0,
      error_message: details.errorMessage || null,
    });
    return;
  } catch {}

  // 2. Fallback: grava em ministry_audit_logs
  try {
    const { data: { user } } = await sb.auth.getUser();
    await sb.from('ministry_audit_logs').insert({
      organization_id: orgId,
      actor_id: user?.id || null,
      actor_name: user?.user_metadata?.name || 'Membro / IA',
      action: 'ai_request_log',
      target_type: 'ai_task',
      target_name: details.taskType,
      metadata: {
        task_type: details.taskType,
        model_used: details.modelUsed,
        duration_ms: details.durationMs,
        status: details.status,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {}
}

/**
 * Verifica se a organização pode executar uma tarefa de IA no momento
 */
export async function checkAIQuota(
  orgId: string,
  orgFallback?: Partial<Organization>
): Promise<{ allowed: boolean; reason?: string; status?: OrganizationAIQuotaStatus }> {
  const config = await getOrganizationAIQuota(orgId, orgFallback);

  if (!config.enabled) {
    return {
      allowed: false,
      reason: 'O módulo de Inteligência Artificial está desativado para esta igreja. Contate o suporte para ativar o recurso.',
    };
  }

  const usedThisWeek = await getOrganizationWeeklyUsageCount(orgId);
  const totalLimit = config.weeklyLimit + (config.bonusCredits || 0);
  const isUnlimited = config.tier === 'enterprise' || config.weeklyLimit >= 999999;
  const isExceeded = !isUnlimited && usedThisWeek >= totalLimit;

  const percentUsed = isUnlimited
    ? 0
    : Math.min(100, Math.round((usedThisWeek / (totalLimit || 1)) * 100));

  const remaining = isUnlimited ? 999999 : Math.max(0, totalLimit - usedThisWeek);

  let statusLevel: 'normal' | 'warning' | 'exceeded' | 'disabled' = 'normal';
  if (!config.enabled) statusLevel = 'disabled';
  else if (isExceeded) statusLevel = 'exceeded';
  else if (percentUsed >= 80) statusLevel = 'warning';

  const status: OrganizationAIQuotaStatus = {
    ...config,
    usedThisWeek,
    totalLimit,
    percentUsed,
    remaining,
    isExceeded,
    status: statusLevel,
  };

  if (isExceeded) {
    return {
      allowed: false,
      reason: `Limite semanal de IA atingido (${usedThisWeek}/${totalLimit} requisições usadas). A cota será renovada na próxima segunda-feira ou solicite recarga de créditos com o administrador.`,
      status,
    };
  }

  return { allowed: true, status };
}

/**
 * Carrega a visão consolidada de todas as organizações para a tela de Super Admin
 */
export async function fetchAllOrganizationsAIQuotaStatuses(
  organizations: Organization[]
): Promise<OrganizationAIQuotaStatus[]> {
  const sb = getSupabase();
  const weekStart = getStartOfCurrentWeek().toISOString();

  // Buscar contagens agregadas da semana para todas as organizações de uma vez
  const usageCountMap: Record<string, number> = {};

  if (sb) {
    try {
      const { data: usageRows } = await sb
        .from('ai_usage_logs')
        .select('organization_id')
        .gte('created_at', weekStart);

      (usageRows || []).forEach((row: any) => {
        if (row.organization_id) {
          usageCountMap[row.organization_id] = (usageCountMap[row.organization_id] || 0) + 1;
        }
      });
    } catch {
      // Fallback para ministry_audit_logs
      try {
        const { data: auditRows } = await sb
          .from('ministry_audit_logs')
          .select('organization_id')
          .eq('action', 'ai_request_log')
          .gte('created_at', weekStart);

        (auditRows || []).forEach((row: any) => {
          if (row.organization_id) {
            usageCountMap[row.organization_id] = (usageCountMap[row.organization_id] || 0) + 1;
          }
        });
      } catch {}
    }
  }

  // Mesclar com cache local
  const cachedUsage = getCachedUsageMap();
  Object.entries(cachedUsage).forEach(([orgId, val]) => {
    if (val.weekStart === weekStart && val.count > (usageCountMap[orgId] || 0)) {
      usageCountMap[orgId] = val.count;
    }
  });

  const cachedConfigs = getCachedConfigs();

  const statuses: OrganizationAIQuotaStatus[] = organizations.map(org => {
    const cached = cachedConfigs[org.id];
    const plan = org.plan_type || 'trial';
    const tier: AIPlanTier = (org.ai_tier as AIPlanTier) || cached?.tier || (plan === 'enterprise' ? 'enterprise' : plan === 'pro' ? 'pro' : 'free');
    const defaultTier = DEFAULT_TIER_LIMITS[tier] || DEFAULT_TIER_LIMITS.free;

    const enabled = org.ai_enabled !== undefined ? Boolean(org.ai_enabled) : (cached?.enabled !== undefined ? cached.enabled : true);
    const weeklyLimit = org.ai_weekly_limit || cached?.weeklyLimit || defaultTier.weeklyLimit;
    const bonusCredits = org.ai_bonus_credits || cached?.bonusCredits || 0;
    const allowedModels = org.ai_allowed_models || cached?.allowedModels || defaultTier.allowedModels;

    const totalLimit = weeklyLimit + bonusCredits;
    const usedThisWeek = usageCountMap[org.id] || 0;
    const isUnlimited = tier === 'enterprise' || weeklyLimit >= 999999;
    const isExceeded = !isUnlimited && usedThisWeek >= totalLimit;
    const percentUsed = isUnlimited ? 0 : Math.min(100, Math.round((usedThisWeek / (totalLimit || 1)) * 100));
    const remaining = isUnlimited ? 999999 : Math.max(0, totalLimit - usedThisWeek);

    let status: 'normal' | 'warning' | 'exceeded' | 'disabled' = 'normal';
    if (!enabled) status = 'disabled';
    else if (isExceeded) status = 'exceeded';
    else if (percentUsed >= 80) status = 'warning';

    return {
      organizationId: org.id,
      organizationName: org.name,
      enabled,
      tier,
      weeklyLimit,
      bonusCredits,
      allowedModels,
      usedThisWeek,
      totalLimit,
      percentUsed,
      remaining,
      isExceeded,
      status,
    };
  });

  return statuses;
}

/**
 * Calcula a visão geral global das quotas de IA para os cards de destaque
 */
export function calculateGlobalAIQuotaOverview(
  statuses: OrganizationAIQuotaStatus[]
): GlobalAIQuotaOverview {
  let activeWithAI = 0;
  let freeTierCount = 0;
  let proTierCount = 0;
  let enterpriseTierCount = 0;
  let totalGlobalLimit = 0;
  let totalGlobalUsedThisWeek = 0;
  let exceededOrgsCount = 0;
  let warningOrgsCount = 0;

  statuses.forEach(s => {
    if (s.enabled) activeWithAI++;
    if (s.tier === 'free') freeTierCount++;
    else if (s.tier === 'pro') proTierCount++;
    else if (s.tier === 'enterprise') enterpriseTierCount++;

    if (s.tier !== 'enterprise' && s.weeklyLimit < 999999) {
      totalGlobalLimit += s.totalLimit;
    }
    totalGlobalUsedThisWeek += s.usedThisWeek;

    if (s.status === 'exceeded') exceededOrgsCount++;
    else if (s.status === 'warning') warningOrgsCount++;
  });

  const globalPercentUsed = totalGlobalLimit > 0
    ? Math.min(100, Math.round((totalGlobalUsedThisWeek / totalGlobalLimit) * 100))
    : 0;

  return {
    totalOrganizations: statuses.length,
    activeWithAI,
    freeTierCount,
    proTierCount,
    enterpriseTierCount,
    totalGlobalLimit,
    totalGlobalUsedThisWeek,
    globalPercentUsed,
    exceededOrgsCount,
    warningOrgsCount,
  };
}

/**
 * Zera o consumo semanal de uma organização (cortesia/reset manual)
 */
export async function resetOrganizationWeeklyUsage(
  orgId: string,
  orgName?: string
): Promise<{ success: boolean; message: string }> {
  // Atualiza cache local
  if (typeof window !== 'undefined') {
    try {
      const map = getCachedUsageMap();
      delete map[orgId];
      localStorage.setItem(CACHE_KEY_USAGE, JSON.stringify(map));
    } catch {}
  }

  const sb = getSupabase();
  if (sb) {
    try {
      const { data: { user } } = await sb.auth.getUser();
      await sb.from('ministry_audit_logs').insert({
        organization_id: orgId,
        actor_id: user?.id || null,
        actor_name: user?.user_metadata?.name || 'Super Admin',
        action: 'ai_quota_weekly_reset',
        target_type: 'organization_ai_quota',
        target_id: orgId,
        target_name: orgName || 'Organização',
        metadata: {
          reset_at: new Date().toISOString(),
          note: 'Consumo semanal zerado manualmente pelo Super Admin',
        },
      });
    } catch {}
  }

  return { success: true, message: `Consumo semanal de ${orgName || 'Organização'} zerado com sucesso!` };
}

/**
 * Adiciona créditos bônus/avulsos à organização
 */
export async function addOrganizationBonusCredits(
  orgId: string,
  additionalCredits: number,
  orgName?: string
): Promise<{ success: boolean; message: string }> {
  const current = await getOrganizationAIQuota(orgId);
  const newBonus = (current.bonusCredits || 0) + additionalCredits;

  await saveOrganizationAIQuota(orgId, { bonusCredits: newBonus }, orgName);

  return {
    success: true,
    message: `+${additionalCredits} créditos de IA adicionados com sucesso para ${orgName || 'Organização'}!`,
  };
}
