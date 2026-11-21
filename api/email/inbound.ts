// api/email/inbound.ts
// Webhook Vercel Serverless para receber eventos de e-mail inbound do Resend (email.received)

import {
  parseInboundEmailPayload,
  verifyResendWebhookSignature,
} from '../../services/email/resend.js';

function getHeader(headers: Record<string, string | string[] | undefined> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const rawBody =
      typeof req.rawBody === 'string'
        ? req.rawBody
        : typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body ?? {});

    const webhookSecret = (process.env.RESEND_WEBHOOK_SECRET || '').trim();
    if (webhookSecret) {
      const valid = verifyResendWebhookSignature({
        rawBody,
        svixId: getHeader(req.headers, 'svix-id'),
        svixTimestamp: getHeader(req.headers, 'svix-timestamp'),
        svixSignature: getHeader(req.headers, 'svix-signature'),
        secret: webhookSecret,
      });

      if (!valid) {
        console.warn('[api/email/inbound] Assinatura Svix/Resend inválida.');
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }

    const parsedBody =
      typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
    const email = parseInboundEmailPayload(parsedBody);

    console.log('[api/email/inbound] E-mail recebido:', {
      eventType: email.eventType,
      emailId: email.emailId,
      from: email.from,
      to: email.to,
      subject: email.subject,
      receivedAt: email.receivedAt,
    });

    return res.status(200).json({
      received: true,
      eventType: email.eventType,
      emailId: email.emailId,
      from: email.from,
      to: email.to,
      subject: email.subject,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno ao processar webhook.';
    console.error('[api/email/inbound] Erro:', message);
    return res.status(400).json({ error: message });
  }
}
