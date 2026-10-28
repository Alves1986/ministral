import { describe, it, expect } from 'vitest';
import {
  ASAAS_PLANS,
  mapAsaasEventToBillingStatus,
  verifyAsaasWebhookToken,
  generateAsaasEventLogKey,
  resolvePaymentGateway,
  getAsaasBaseUrl
} from '../utils/asaasUtils';

describe('Integração Asaas - Regras de Cobrança e Normalização de Pagamentos', () => {
  describe('Preços e Metadados dos Planos', () => {
    it('deve possuir valores corretos para Pro e Enterprise', () => {
      expect(ASAAS_PLANS.pro.value).toBe(49.90);
      expect(ASAAS_PLANS.pro.cycle).toBe('MONTHLY');
      expect(ASAAS_PLANS.pro.name).toBe('Pro');

      expect(ASAAS_PLANS.enterprise.value).toBe(99.90);
      expect(ASAAS_PLANS.enterprise.cycle).toBe('MONTHLY');
      expect(ASAAS_PLANS.enterprise.name).toBe('Enterprise');
    });

    it('deve resolver a URL base correta para Sandbox e Produção', () => {
      expect(getAsaasBaseUrl('sandbox')).toBe('https://sandbox.asaas.com/api/v3');
      expect(getAsaasBaseUrl('production')).toBe('https://api.asaas.com/v3');
      expect(getAsaasBaseUrl()).toBe('https://sandbox.asaas.com/api/v3');
    });
  });

  describe('Mapeamento de Eventos do Webhook Asaas', () => {
    it('deve ativar a organização quando o pagamento for confirmado (PAYMENT_CONFIRMED)', () => {
      const payload = {
        event: 'PAYMENT_CONFIRMED',
        payment: {
          id: 'pay_123',
          value: 49.90,
          customer: 'cus_123',
          subscription: 'sub_456',
          externalReference: 'org-uuid-1',
          status: 'CONFIRMED'
        }
      };

      const result = mapAsaasEventToBillingStatus(payload);
      expect(result.billingStatus).toBe('active');
      expect(result.accessLocked).toBe(false);
      expect(result.planType).toBe('pro');
      expect(result.shouldUpdateOrg).toBe(true);
      expect(result.targetOrgId).toBe('org-uuid-1');
    });

    it('deve reconhecer o plano Enterprise para pagamentos de R$ 99,90 ou superiores', () => {
      const payload = {
        event: 'PAYMENT_RECEIVED',
        payment: {
          id: 'pay_789',
          value: 99.90,
          customer: 'cus_ent',
          subscription: 'sub_ent',
          externalReference: 'org-uuid-enterprise',
          status: 'RECEIVED'
        }
      };

      const result = mapAsaasEventToBillingStatus(payload);
      expect(result.billingStatus).toBe('active');
      expect(result.accessLocked).toBe(false);
      expect(result.planType).toBe('enterprise');
    });

    it('deve marcar past_due e bloquear acesso quando o pagamento estiver vencido (PAYMENT_OVERDUE)', () => {
      const payload = {
        event: 'PAYMENT_OVERDUE',
        payment: {
          id: 'pay_overdue',
          value: 49.90,
          customer: 'cus_123',
          subscription: 'sub_456',
          externalReference: 'org-uuid-1',
          status: 'OVERDUE'
        }
      };

      const result = mapAsaasEventToBillingStatus(payload);
      expect(result.billingStatus).toBe('past_due');
      expect(result.accessLocked).toBe(true);
      expect(result.shouldUpdateOrg).toBe(true);
    });

    it('deve cancelar o plano e bloquear acesso quando a assinatura for deletada (SUBSCRIPTION_DELETED)', () => {
      const payload = {
        event: 'SUBSCRIPTION_DELETED',
        subscription: {
          id: 'sub_deleted',
          customer: 'cus_123',
          externalReference: 'org-uuid-1',
          status: 'INACTIVE'
        }
      };

      const result = mapAsaasEventToBillingStatus(payload);
      expect(result.billingStatus).toBe('canceled');
      expect(result.accessLocked).toBe(true);
      expect(result.planType).toBe('trial');
      expect(result.shouldUpdateOrg).toBe(true);
    });

    it('deve cancelar quando houver estorno de cobrança (PAYMENT_REFUNDED)', () => {
      const payload = {
        event: 'PAYMENT_REFUNDED',
        payment: {
          id: 'pay_refund',
          value: 49.90,
          externalReference: 'org-uuid-1'
        }
      };

      const result = mapAsaasEventToBillingStatus(payload);
      expect(result.billingStatus).toBe('canceled');
      expect(result.accessLocked).toBe(true);
    });
  });

  describe('Validação de Token e Idempotência', () => {
    it('deve validar token do header do webhook em tempo seguro', () => {
      const secret = 'whsec_test_secret_12345';
      expect(verifyAsaasWebhookToken(secret, secret)).toBe(true);
      expect(verifyAsaasWebhookToken('invalid_token', secret)).toBe(false);
      expect(verifyAsaasWebhookToken(undefined, secret)).toBe(false);
      expect(verifyAsaasWebhookToken(secret, undefined)).toBe(false);
    });

    it('deve gerar chave de idempotência consistente para eventos de pagamento e assinatura', () => {
      const keyPayment = generateAsaasEventLogKey({
        event: 'PAYMENT_CONFIRMED',
        payment: { id: 'pay_abc123' }
      });
      expect(keyPayment).toBe('PAYMENT_CONFIRMED_pay_abc123');

      const keyWithExplicitId = generateAsaasEventLogKey({
        id: 'evt_999888',
        event: 'SUBSCRIPTION_UPDATED',
        subscription: { id: 'sub_111' }
      });
      expect(keyWithExplicitId).toBe('evt_999888');
    });
  });

  describe('Resolução do Gateway Ativo (Coexistência Stripe / Asaas)', () => {
    it('deve manter Stripe como padrão quando nenhuma preferência ou assinatura Asaas estiver ativa', () => {
      const org = { id: 'org-1', stripe_customer_id: 'cus_stripe_1' };
      expect(resolvePaymentGateway(org)).toBe('stripe');
    });

    it('deve respeitar a seleção de teste explícita do usuário quando configurada', () => {
      const org = { id: 'org-1' };
      expect(resolvePaymentGateway(org, 'asaas')).toBe('asaas');
      expect(resolvePaymentGateway(org, 'stripe')).toBe('stripe');
    });

    it('deve resolver Asaas quando a organização possuir assinatura ativa no Asaas', () => {
      const org = {
        id: 'org-1',
        payment_gateway: 'asaas' as const,
        asaas_subscription_id: 'sub_asaas_1'
      };
      expect(resolvePaymentGateway(org)).toBe('asaas');
    });
  });
});

