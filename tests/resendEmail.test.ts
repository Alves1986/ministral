import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  getEmailConfig,
  sendEmail,
  resend,
  parseInboundEmailPayload,
  verifyResendWebhookSignature,
} from '../services/email/resend';

describe('Resend Email Service & ministral.app config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    delete process.env.RESEND_API_KEY;
    delete process.env.APP_DOMAIN;
    delete process.env.APP_ORIGIN;
    delete process.env.EMAIL_FROM;
    delete process.env.EMAIL_REPLY_TO;
    delete process.env.INBOUND_EMAIL_WEBHOOK;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('usa defaults corretos para o domínio ministral.app quando variáveis não estão definidas', () => {
    const cfg = getEmailConfig();
    expect(cfg.appDomain).toBe('ministral.app');
    expect(cfg.appOrigin).toBe('https://ministral.app');
    expect(cfg.emailFrom).toBe('noreply@ministral.app');
    expect(cfg.formattedFrom).toBe('Ministral <noreply@ministral.app>');
    expect(cfg.replyTo).toBe('suporte@ministral.app');
    expect(cfg.inboundWebhookUrl).toBe('https://ministral.app/api/email/inbound');
  });

  it('respeita variáveis de ambiente customizadas em getEmailConfig', () => {
    process.env.APP_DOMAIN = 'ministral.app';
    process.env.EMAIL_FROM = 'avisos@ministral.app';
    process.env.EMAIL_REPLY_TO = 'contato@ministral.app';

    const cfg = getEmailConfig();
    expect(cfg.formattedFrom).toBe('Ministral <avisos@ministral.app>');
    expect(cfg.replyTo).toBe('contato@ministral.app');
  });

  it('retorna erro descritivo se RESEND_API_KEY não estiver configurada', async () => {
    const result = await sendEmail({
      to: 'teste@exemplo.com',
      subject: 'Teste',
      html: '<p>OK</p>',
    });

    expect(result.data).toBeNull();
    expect(result.error?.message).toMatch(/RESEND_API_KEY/i);
  });

  it('envia email corretamente via API do Resend com from e reply_to padrão de ministral.app', async () => {
    process.env.RESEND_API_KEY = 're_test_123456';

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'email_abc123' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await sendEmail({
      to: 'usuario@igreja.org',
      subject: 'Bem-vindo ao Ministral',
      html: '<p>Olá!</p>',
      text: 'Olá!',
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ id: 'email_abc123' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['Authorization']).toBe('Bearer re_test_123456');

    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      from: 'Ministral <noreply@ministral.app>',
      to: ['usuario@igreja.org'],
      subject: 'Bem-vindo ao Ministral',
      html: '<p>Olá!</p>',
      text: 'Olá!',
      reply_to: 'suporte@ministral.app',
    });
  });

  it('expõe singleton resend.emails.send compatível com o SDK do Resend', async () => {
    process.env.RESEND_API_KEY = 're_test_singleton';

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'email_singleton' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await resend.emails.send({
      from: 'Ministral <noreply@ministral.app>',
      to: ['a@b.com', 'c@d.com'],
      subject: 'Teste Singleton',
      html: '<p>OK</p>',
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe('email_singleton');
  });

  it('propaga erro HTTP retornado pela API do Resend sem lançar exceção não tratada', async () => {
    process.env.RESEND_API_KEY = 're_invalid';

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ name: 'validation_error', message: 'Invalid API key' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await sendEmail({
      to: 'usuario@igreja.org',
      subject: 'Teste',
      html: '<p>OK</p>',
    });

    expect(result.data).toBeNull();
    expect(result.error).toEqual({
      name: 'validation_error',
      message: 'Invalid API key',
      statusCode: 401,
    });
  });

  it('normaliza payload de webhook inbound do Resend (evento email.received e payload direto)', () => {
    const webhookEvent = parseInboundEmailPayload({
      type: 'email.received',
      created_at: '2026-11-21T20:00:00.000Z',
      data: {
        email_id: 'inb_001',
        from: 'Pastor João <joao@igreja.org>',
        to: ['suporte@ministral.app'],
        subject: 'Dúvida sobre escalas',
        html: '<p>Preciso de ajuda</p>',
        text: 'Preciso de ajuda',
      },
    });

    expect(webhookEvent).toEqual({
      eventType: 'email.received',
      emailId: 'inb_001',
      from: 'Pastor João <joao@igreja.org>',
      to: ['suporte@ministral.app'],
      subject: 'Dúvida sobre escalas',
      html: '<p>Preciso de ajuda</p>',
      text: 'Preciso de ajuda',
      receivedAt: '2026-11-21T20:00:00.000Z',
    });

    const directPayload = parseInboundEmailPayload({
      from: 'teste@gmail.com',
      to: 'qualquer@ministral.app',
      subject: 'Ping',
      text: 'Pong',
    });

    expect(directPayload.from).toBe('teste@gmail.com');
    expect(directPayload.to).toEqual(['qualquer@ministral.app']);
    expect(directPayload.subject).toBe('Ping');
  });

  it('valida assinatura HMAC-SHA256 (Svix/Resend) de webhook inbound', () => {
    const rawSecretBytes = Buffer.from('super-secret-webhook-key-ministral');
    const secret = `whsec_${rawSecretBytes.toString('base64')}`;
    const svixId = 'msg_2abc123';
    const svixTimestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify({ type: 'email.received', data: { from: 'a@b.com' } });

    const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
    const expectedSig = crypto
      .createHmac('sha256', rawSecretBytes)
      .update(signedContent)
      .digest('base64');

    expect(
      verifyResendWebhookSignature({
        rawBody,
        svixId,
        svixTimestamp,
        svixSignature: `v1,${expectedSig}`,
        secret,
      })
    ).toBe(true);

    expect(
      verifyResendWebhookSignature({
        rawBody,
        svixId,
        svixTimestamp,
        svixSignature: 'v1,assinatura_invalida',
        secret,
      })
    ).toBe(false);
  });

  it('garante ausência de referências ao domínio antigo (seu-dominio.com) nas Edge Functions', () => {
    const validateInviteSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/functions/validate-invite/index.ts'),
      'utf-8'
    );
    const acceptInviteSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/functions/accept-invite/index.ts'),
      'utf-8'
    );
    const pushNotifSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/functions/push-notification/index.ts'),
      'utf-8'
    );

    expect(validateInviteSrc).not.toContain('seu-dominio.com');
    expect(validateInviteSrc).toContain('https://ministral.app');
    expect(acceptInviteSrc).toContain('https://ministral.app');
    expect(pushNotifSrc).not.toContain('ministral.com.br');
    expect(pushNotifSrc).toContain('suporte@ministral.app');
  });
});
