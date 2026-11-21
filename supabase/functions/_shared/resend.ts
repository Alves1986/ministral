// supabase/functions/_shared/resend.ts
// Wrapper compartilhado para envio de e-mails via API REST do Resend nas Edge Functions (Deno)

declare const Deno: any;

const RESEND_API_URL = 'https://api.resend.com/emails';

export interface DenoSendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  from?: string;
}

export interface DenoResendResult {
  data: { id: string } | null;
  error: { message: string; statusCode?: number; name?: string } | null;
}

export function getDenoEmailConfig() {
  const appDomain = (Deno.env.get('APP_DOMAIN') || 'ministral.app').trim();
  const appOrigin = (Deno.env.get('APP_ORIGIN') || `https://${appDomain}`).trim();
  const emailFrom = (Deno.env.get('EMAIL_FROM') || `noreply@${appDomain}`).trim();
  const formattedFrom = emailFrom.includes('<') ? emailFrom : `Ministral <${emailFrom}>`;
  const replyTo = (Deno.env.get('EMAIL_REPLY_TO') || `suporte@${appDomain}`).trim();
  const apiKey = (Deno.env.get('RESEND_API_KEY') || '').trim();

  return { appDomain, appOrigin, emailFrom, formattedFrom, replyTo, apiKey };
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
  from,
}: DenoSendEmailParams): Promise<DenoResendResult> {
  const cfg = getDenoEmailConfig();

  if (!cfg.apiKey) {
    return {
      data: null,
      error: {
        name: 'missing_api_key',
        message: 'RESEND_API_KEY não configurada nas secrets do Supabase.',
        statusCode: 500,
      },
    };
  }

  const toList = (Array.isArray(to) ? to : [to]).map((item) => item.trim()).filter(Boolean);
  if (toList.length === 0) {
    return {
      data: null,
      error: {
        name: 'validation_error',
        message: 'Destinatário (to) inválido.',
        statusCode: 400,
      },
    };
  }

  const body: Record<string, unknown> = {
    from: from || cfg.formattedFrom,
    to: toList,
    subject,
    html,
    reply_to: replyTo ?? cfg.replyTo,
  };
  if (text !== undefined) body.text = text;

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      data: null,
      error: {
        name: json?.name || 'resend_api_error',
        message: json?.message || response.statusText || 'Erro ao enviar e-mail.',
        statusCode: response.status,
      },
    };
  }

  return { data: { id: String(json?.id || '') }, error: null };
}

export const resend = {
  emails: {
    send: sendEmail,
  },
};
