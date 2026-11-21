// api/email/send.ts
// Endpoint autenticado (Admin/SuperAdmin) para envio de e-mails transacionais via Resend

import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '../../services/email/resend.js';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Autenticação obrigatória via JWT Supabase (apenas Admin / SuperAdmin)
  try {
    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      '';
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      '';

    const authHeader = String(req.headers?.authorization || '');
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Não autorizado. Token de sessão ausente.' });
    }

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Configuração Supabase incompleta no servidor.' });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    const sb = createClient(supabaseUrl, supabaseKey);
    const {
      data: { user },
      error: authError,
    } = await sb.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }

    const { data: profile } = await sb
      .from('profiles')
      .select('is_admin, is_super_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.is_admin && !profile?.is_super_admin) {
      return res.status(403).json({ error: 'Permissão negada. Apenas administradores podem enviar e-mails.' });
    }
  } catch (authErr: unknown) {
    const msg = authErr instanceof Error ? authErr.message : 'Falha ao validar sessão.';
    return res.status(500).json({ error: msg });
  }

  try {
    const { to, subject, html, text, replyTo } = req.body || {};

    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Campos obrigatórios: to, subject, html.' });
    }

    const result = await sendEmail({ to, subject, html, text, replyTo });

    if (result.error) {
      return res.status(result.error.statusCode || 500).json({
        success: false,
        error: result.error.message,
        code: result.error.name,
      });
    }

    return res.status(200).json({
      success: true,
      id: result.data?.id,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Falha ao enviar e-mail.';
    console.error('[api/email/send] Erro:', message);
    return res.status(500).json({ success: false, error: message });
  }
}
