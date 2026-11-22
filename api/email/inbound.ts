// api/email/inbound.ts
// Webhook Vercel Serverless para receber eventos de e-mail inbound do Resend (email.received)

import {
  parseInboundEmailPayload,
  verifyResendWebhookSignature,
  resend,
} from '../../services/email/resend.js';

function cleanEnv(value: string | undefined, fallback: string): string {
  const trimmed = (value || '').trim().replace(/^["']|["']$/g, '');
  return trimmed || fallback;
}

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

    // Forward inbound email to configured address
    const forwardTo = cleanEnv(process.env.INBOUND_FORWARD_EMAIL, '');
    console.log('[api/email/inbound] INBOUND_FORWARD_EMAIL raw:', process.env.INBOUND_FORWARD_EMAIL);
    console.log('[api/email/inbound] INBOUND_FORWARD_EMAIL clean:', forwardTo || '(vazio)');
    console.log('[api/email/inbound] RESEND_API_KEY present:', !!process.env.RESEND_API_KEY);
    if (forwardTo) {
      const forwardHtml = `
        <p><strong>De:</strong> ${email.from}</p>
        <p><strong>Para:</strong> ${email.to.join(', ')}</p>
        <p><strong>Assunto:</strong> ${email.subject}</p>
        <p><strong>Recebido em:</strong> ${email.receivedAt}</p>
        <hr/>
        ${email.html || `<pre>${email.text || '(sem corpo)'}</pre>`}
      `;
      try {
        console.log('[api/email/inbound] Tentando encaminhar via resend...');
        const forwardResult = await resend.emails.send({
          from: 'Ministral Inbound <inbound@ministral.app>',
          to: forwardTo,
          subject: `[INBOUND] ${email.subject}`,
          html: forwardHtml,
          replyTo: email.from,
        });
        console.log('[api/email/inbound] Resultado forward:', JSON.stringify(forwardResult));
        if (forwardResult.error) {
          console.error('[api/email/inbound] Falha ao encaminhar:', forwardResult.error);
        } else {
          console.log('[api/email/inbound] Encaminhado para', forwardTo, 'id:', forwardResult.data?.id);
        }
      } catch (err) {
        console.error('[api/email/inbound] Exceção ao encaminhar:', err);
      }
    } else {
      console.warn('[api/email/inbound] Forward pulado: INBOUND_FORWARD_EMAIL não configurado');
    }

    const debugInfo = {
      forwardToRaw: process.env.INBOUND_FORWARD_EMAIL,
      forwardToClean: forwardTo || '(vazio)',
      resendApiKeyPresent: !!process.env.RESEND_API_KEY,
      resendType: typeof resend,
      resendEmailsType: typeof resend?.emails,
      resendSendType: typeof resend?.emails?.send,
    };
    console.log('[api/email/inbound] Debug info:', JSON.stringify(debugInfo));

    return res.status(200).json({
      received: true,
      eventType: email.eventType,
      emailId: email.emailId,
      from: email.from,
      to: email.to,
      subject: email.subject,
      debug: debugInfo,
      version: 'inbound-v4-debug-20241122',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno ao processar webhook.';
    console.error('[api/email/inbound] Erro:', message);
    return res.status(400).json({ error: message });
  }
}
