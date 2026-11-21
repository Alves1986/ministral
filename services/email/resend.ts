import crypto from 'node:crypto';

const RESEND_API_URL = 'https://api.resend.com/emails';

export interface EmailConfig {
  apiKey: string;
  appDomain: string;
  appOrigin: string;
  emailFrom: string;
  formattedFrom: string;
  replyTo: string;
  inboundWebhookUrl: string;
}

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  headers?: Record<string, string>;
}

export interface ResendError {
  message: string;
  statusCode?: number;
  name?: string;
}

export interface ResendSendResponse {
  data: { id: string } | null;
  error: ResendError | null;
}

export interface NormalizedInboundEmail {
  eventType: string;
  emailId: string | null;
  from: string;
  to: string[];
  subject: string;
  html: string | null;
  text: string | null;
  receivedAt: string;
}

function cleanEnv(value: string | undefined, fallback: string): string {
  const trimmed = (value || '').trim().replace(/^["']|["']$/g, '');
  return trimmed || fallback;
}

export function getEmailConfig(): EmailConfig {
  const appDomain = cleanEnv(process.env.APP_DOMAIN, 'ministral.app');
  const appOrigin = cleanEnv(process.env.APP_ORIGIN, `https://${appDomain}`);
  const emailFrom = cleanEnv(process.env.EMAIL_FROM, `noreply@${appDomain}`);
  const formattedFrom = emailFrom.includes('<') ? emailFrom : `Ministral <${emailFrom}>`;
  const replyTo = cleanEnv(process.env.EMAIL_REPLY_TO, `suporte@${appDomain}`);
  const inboundWebhookUrl = cleanEnv(
    process.env.INBOUND_EMAIL_WEBHOOK,
    `${appOrigin.replace(/\/+$/, '')}/api/email/inbound`
  );
  const apiKey = cleanEnv(process.env.RESEND_API_KEY, '');

  return {
    apiKey,
    appDomain,
    appOrigin,
    emailFrom,
    formattedFrom,
    replyTo,
    inboundWebhookUrl,
  };
}

function normalizeRecipients(value: string | string[] | undefined): string[] | undefined {
  if (!value) return undefined;
  const list = Array.isArray(value) ? value : [value];
  const cleaned = list.map((item) => item.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : undefined;
}

class ResendClient {
  public readonly emails = {
    send: async (params: SendEmailInput): Promise<ResendSendResponse> => {
      const config = getEmailConfig();

      if (!config.apiKey) {
        return {
          data: null,
          error: {
            name: 'missing_api_key',
            message: 'RESEND_API_KEY não configurada no ambiente.',
            statusCode: 500,
          },
        };
      }

      const toList = normalizeRecipients(params.to);
      if (!toList || toList.length === 0) {
        return {
          data: null,
          error: {
            name: 'validation_error',
            message: 'Campo "to" é obrigatório para enviar e-mail.',
            statusCode: 400,
          },
        };
      }

      const payload: Record<string, unknown> = {
        from: params.from || config.formattedFrom,
        to: toList,
        subject: params.subject,
        html: params.html,
      };

      if (params.text !== undefined) payload.text = params.text;
      if (params.replyTo) payload.reply_to = params.replyTo;

      const ccList = normalizeRecipients(params.cc);
      if (ccList) payload.cc = ccList;

      const bccList = normalizeRecipients(params.bcc);
      if (bccList) payload.bcc = bccList;

      if (params.headers && Object.keys(params.headers).length > 0) {
        payload.headers = params.headers;
      }

      try {
        const response = await fetch(RESEND_API_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const responseJson = (await response.json().catch(() => ({}))) as Record<string, unknown>;

        if (!response.ok) {
          return {
            data: null,
            error: {
              name: typeof responseJson.name === 'string' ? responseJson.name : 'resend_api_error',
              message:
                typeof responseJson.message === 'string'
                  ? responseJson.message
                  : response.statusText || 'Falha ao enviar e-mail pelo Resend.',
              statusCode: response.status,
            },
          };
        }

        return {
          data: { id: String(responseJson.id || '') },
          error: null,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erro de rede ao conectar ao Resend.';
        return {
          data: null,
          error: {
            name: 'network_error',
            message,
            statusCode: 500,
          },
        };
      }
    },
  };
}

export const resend = new ResendClient();

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
  from,
  cc,
  bcc,
  headers,
}: SendEmailInput): Promise<ResendSendResponse> {
  const config = getEmailConfig();
  return resend.emails.send({
    from: from || config.formattedFrom,
    to,
    subject,
    html,
    text,
    replyTo: replyTo ?? config.replyTo,
    cc,
    bcc,
    headers,
  });
}

export function parseInboundEmailPayload(payload: unknown): NormalizedInboundEmail {
  const raw = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const eventType = typeof raw.type === 'string' ? raw.type : 'email.received';
  const data =
    raw.data && typeof raw.data === 'object' ? (raw.data as Record<string, unknown>) : raw;

  const rawTo = data.to;
  let toList: string[] = [];
  if (Array.isArray(rawTo)) {
    toList = rawTo.map((item) => String(item).trim()).filter(Boolean);
  } else if (typeof rawTo === 'string' && rawTo.trim()) {
    toList = [rawTo.trim()];
  }

  return {
    eventType,
    emailId: typeof data.email_id === 'string' ? data.email_id : typeof data.id === 'string' ? data.id : null,
    from: typeof data.from === 'string' ? data.from : '',
    to: toList,
    subject: typeof data.subject === 'string' ? data.subject : '(sem assunto)',
    html: typeof data.html === 'string' ? data.html : null,
    text: typeof data.text === 'string' ? data.text : null,
    receivedAt:
      typeof raw.created_at === 'string'
        ? raw.created_at
        : typeof data.created_at === 'string'
          ? data.created_at
          : new Date().toISOString(),
  };
}

export function verifyResendWebhookSignature({
  rawBody,
  svixId,
  svixTimestamp,
  svixSignature,
  secret,
  toleranceSeconds = 300,
}: {
  rawBody: string;
  svixId: string | undefined;
  svixTimestamp: string | undefined;
  svixSignature: string | undefined;
  secret: string;
  toleranceSeconds?: number;
}): boolean {
  if (!svixId || !svixTimestamp || !svixSignature || !secret) {
    return false;
  }

  const tsNum = Number(svixTimestamp);
  if (!Number.isFinite(tsNum)) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - tsNum) > toleranceSeconds) {
    return false;
  }

  const cleanSecret = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  const secretKey = Buffer.from(cleanSecret, 'base64');
  const signedPayload = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expectedSig = crypto.createHmac('sha256', secretKey).update(signedPayload).digest('base64');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');

  const candidates = svixSignature
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const [version, signature] = candidate.split(',');
    if (version !== 'v1' || !signature) continue;
    const candidateBuf = Buffer.from(signature, 'utf8');
    if (
      candidateBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(candidateBuf, expectedBuf)
    ) {
      return true;
    }
  }

  return false;
}
