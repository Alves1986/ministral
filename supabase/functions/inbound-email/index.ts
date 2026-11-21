import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { safeCompare } from '../_shared/safeCompare.ts';

declare const Deno: any;

const ALLOWED_ORIGIN = Deno.env.get('APP_ORIGIN') || 'https://ministral.app';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
};

function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function verifySvixSignature(
  rawBody: string,
  svixId: string | null,
  svixTimestamp: string | null,
  svixSignature: string | null,
  secret: string
): Promise<boolean> {
  if (!svixId || !svixTimestamp || !svixSignature || !secret) return false;

  const tsNum = Number(svixTimestamp);
  if (!Number.isFinite(tsNum)) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - tsNum) > 300) return false;

  const cleanSecret = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  const keyBytes = decodeBase64(cleanSecret);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signedContent = new TextEncoder().encode(`${svixId}.${svixTimestamp}.${rawBody}`);
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, signedContent);
  const expectedSig = encodeBase64(new Uint8Array(signatureBuffer));

  const candidates = svixSignature
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const [version, sig] = candidate.split(',');
    if (version !== 'v1' || !sig) continue;
    if (safeCompare(sig, expectedSig)) {
      return true;
    }
  }

  return false;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    const rawBody = await req.text();
    const webhookSecret = (Deno.env.get('RESEND_WEBHOOK_SECRET') || '').trim();

    if (webhookSecret) {
      const valid = await verifySvixSignature(
        rawBody,
        req.headers.get('svix-id'),
        req.headers.get('svix-timestamp'),
        req.headers.get('svix-signature'),
        webhookSecret
      );

      if (!valid) {
        console.warn('[inbound-email] Assinatura Svix/Resend inválida.');
        return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        });
      }
    }

    const payload = rawBody ? JSON.parse(rawBody) : {};
    const eventType = payload?.type || 'email.received';
    const data = payload?.data || payload;

    const toList = Array.isArray(data?.to)
      ? data.to
      : data?.to
        ? [String(data.to)]
        : [];

    console.log('[inbound-email] Inbound email received:', {
      eventType,
      emailId: data?.email_id || data?.id || null,
      from: data?.from || '',
      to: toList,
      subject: data?.subject || '(sem assunto)',
      receivedAt: payload?.created_at || new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        received: true,
        eventType,
        emailId: data?.email_id || data?.id || null,
        from: data?.from || '',
        to: toList,
        subject: data?.subject || '(sem assunto)',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('[inbound-email] Error processing payload:', error?.message || error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro ao processar payload inbound.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
