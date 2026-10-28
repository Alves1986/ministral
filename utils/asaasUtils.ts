import { Organization } from '../types';

/**
 * Utilitários e configurações da integração com o gateway de pagamentos Asaas.
 * Gerencia precificação, normalização de eventos de webhook, cálculo de base URL
 * e regras de coexistência com o Stripe.
 */

export const ASAAS_PLANS = {
  pro: {
    name: 'Pro',
    value: 49.90,
    cycle: 'MONTHLY' as const,
    description: 'Plano Pro - Ministral'
  },
  enterprise: {
    name: 'Enterprise',
    value: 99.90,
    cycle: 'MONTHLY' as const,
    description: 'Plano Enterprise - Ministral'
  }
};

/**
 * Retorna o endpoint base da API v3 do Asaas conforme o ambiente.
 * Conforme documentação oficial do Asaas (https://docs.asaas.com/docs/criando-um-cliente):
 * - Sandbox: https://api-sandbox.asaas.com/v3
 * - Produção: https://api.asaas.com/v3
 */
export function getAsaasBaseUrl(env?: string): string {
  const isProd = (env || '').toLowerCase() === 'production';
  return isProd ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';
}

/**
 * Comparação em tempo constante (anti timing-attack) do token do webhook Asaas.
 */
export function verifyAsaasWebhookToken(receivedToken?: string, expectedSecret?: string): boolean {
  if (!receivedToken || !expectedSecret) return false;
  if (typeof receivedToken !== 'string' || typeof expectedSecret !== 'string') return false;

  const encoder = new TextEncoder();
  const bufA = encoder.encode(receivedToken);
  const bufB = encoder.encode(expectedSecret);

  if (bufA.length !== bufB.length) return false;

  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

/**
 * Gera uma chave unificada para log de eventos e idempotência de webhooks.
 */
export function generateAsaasEventLogKey(payload: any): string {
  if (payload?.id && typeof payload.id === 'string') {
    return payload.id;
  }
  const event = payload?.event || 'UNKNOWN';
  const targetId = payload?.payment?.id || payload?.subscription?.id || 'GLOBAL';
  return `${event}_${targetId}`;
}

export interface AsaasBillingStatusMapping {
  billingStatus?: 'active' | 'past_due' | 'canceled' | 'trial';
  accessLocked?: boolean;
  planType?: 'pro' | 'enterprise' | 'trial';
  shouldUpdateOrg: boolean;
  targetOrgId?: string;
}

/**
 * Mapeia os eventos do Asaas para o status de liberação e faturamento da organização.
 */
export function mapAsaasEventToBillingStatus(payload: any): AsaasBillingStatusMapping {
  const event = payload?.event;
  const payment = payload?.payment;
  const subscription = payload?.subscription;

  const targetOrgId = payment?.externalReference || subscription?.externalReference;

  let billingStatus: 'active' | 'past_due' | 'canceled' | 'trial' | undefined;
  let accessLocked: boolean | undefined;
  let planType: 'pro' | 'enterprise' | 'trial' | undefined;
  let shouldUpdateOrg = false;

  if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
    billingStatus = 'active';
    accessLocked = false;
    shouldUpdateOrg = true;

    const val = Number(payment?.value || 0);
    planType = val >= 80 ? 'enterprise' : 'pro';
  } else if (event === 'PAYMENT_OVERDUE') {
    billingStatus = 'past_due';
    accessLocked = true;
    shouldUpdateOrg = true;
  } else if (event === 'PAYMENT_REFUNDED' || event === 'PAYMENT_DELETED') {
    billingStatus = 'canceled';
    accessLocked = true;
    shouldUpdateOrg = true;
  } else if (event === 'SUBSCRIPTION_DELETED') {
    billingStatus = 'canceled';
    accessLocked = true;
    planType = 'trial';
    shouldUpdateOrg = true;
  }

  return {
    billingStatus,
    accessLocked,
    planType,
    shouldUpdateOrg,
    targetOrgId
  };
}

/**
 * Resolve se o gateway ativo deve ser Stripe ou Asaas, permitindo
 * coexistência limpa e testes em paralelo.
 */
export function resolvePaymentGateway(
  org?: Partial<Organization> | null,
  userPreference?: 'stripe' | 'asaas'
): 'stripe' | 'asaas' {
  if (userPreference) {
    return userPreference;
  }
  if (org?.payment_gateway === 'asaas' || org?.asaas_subscription_id) {
    return 'asaas';
  }
  return 'stripe';
}

