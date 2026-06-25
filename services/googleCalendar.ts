/**
 * googleCalendar.ts
 * Integração com Google Agenda via Supabase OAuth.
 * Firebase foi removido — o token vem do provider_token da sessão Supabase.
 */
import { getSupabase } from './supabase/client';

const GCAL_TOKEN_KEY = 'gcal_provider_token';
const GCAL_USER_KEY = 'gcal_user_info';
const GCAL_RETURN_PARAM = 'calendar_connected';

interface CalendarUserInfo {
  name: string;
  email: string;
  avatar?: string;
}

/**
 * Inicia o fluxo OAuth do Google com escopo do Calendar.
 * Redireciona para o Google e volta para /?tab=profile&calendar_connected=true
 */
export const connectGoogleCalendar = async (): Promise<void> => {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase não inicializado.');

  const redirectTo = `${window.location.origin}?tab=profile&${GCAL_RETURN_PARAM}=true`;

  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'https://www.googleapis.com/auth/calendar.events',
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
      redirectTo,
    },
  });

  if (error) throw new Error(`Erro ao iniciar conexão: ${error.message}`);
};

/**
 * Captura e persiste o provider_token logo após o callback OAuth.
 * Deve ser chamado quando a URL contém `?calendar_connected=true`.
 * Retorna true se o token foi capturado com sucesso.
 */
export const captureCalendarTokenFromSession = async (): Promise<boolean> => {
  const sb = getSupabase();
  if (!sb) return false;

  try {
    const { data: { session } } = await sb.auth.getSession();
    const token = session?.provider_token;
    if (!token) {
      console.warn('[GoogleCalendar] provider_token ausente na sessão após callback.');
      return false;
    }

    // Persiste o token e as informações do usuário Google
    localStorage.setItem(GCAL_TOKEN_KEY, token);

    const user = session?.user;
    const userInfo: CalendarUserInfo = {
      name: user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Conta Google',
      email: user?.email || '',
      avatar: user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '',
    };
    localStorage.setItem(GCAL_USER_KEY, JSON.stringify(userInfo));

    return true;
  } catch (e) {
    console.error('[GoogleCalendar] Erro ao capturar token:', e);
    return false;
  }
};

/**
 * Retorna o access token do Google Calendar armazenado.
 */
export const getCalendarToken = (): string | null => {
  return localStorage.getItem(GCAL_TOKEN_KEY);
};

/**
 * Retorna as informações do usuário Google conectado.
 */
export const getCalendarUserInfo = (): CalendarUserInfo | null => {
  const raw = localStorage.getItem(GCAL_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CalendarUserInfo;
  } catch {
    return null;
  }
};

/**
 * Retorna true se há um token de Calendar armazenado.
 */
export const isCalendarConnected = (): boolean => {
  return !!localStorage.getItem(GCAL_TOKEN_KEY);
};

/**
 * Desconecta o Google Agenda (remove token do localStorage).
 * Não afeta a sessão principal do Supabase.
 */
export const disconnectGoogleCalendar = (): void => {
  localStorage.removeItem(GCAL_TOKEN_KEY);
  localStorage.removeItem(GCAL_USER_KEY);
};

/**
 * Sincroniza um evento com o Google Calendar usando o access token.
 */
export const syncEventToGoogleCalendar = async (
  accessToken: string,
  eventDetails: { title: string; isoDate: string; description?: string }
): Promise<unknown> => {
  const { title, isoDate, description } = eventDetails;

  const startDate = new Date(isoDate);
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // duração: 2h

  const event = {
    summary: title,
    description: description || '',
    start: {
      dateTime: startDate.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  };

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const msg = (errorData as any)?.error?.message || res.statusText;

    // Token expirado (401): limpa o cache local
    if (res.status === 401) {
      disconnectGoogleCalendar();
      throw new Error('Sessão do Google expirada. Reconecte o Google Agenda.');
    }
    throw new Error(`Falha ao sincronizar com Google Agenda: ${msg}`);
  }

  return res.json();
};

/**
 * Sincroniza automaticamente se já houver um token válido.
 * Usado para auto-sync ao confirmar presença.
 */
export const autoSyncIfConnected = async (
  eventDetails: { title: string; isoDate: string; description?: string }
): Promise<void> => {
  const token = getCalendarToken();
  if (!token) return;
  try {
    await syncEventToGoogleCalendar(token, eventDetails);
    console.log('[GoogleCalendar] Auto-sync realizado com sucesso.');
  } catch (e) {
    console.error('[GoogleCalendar] Falha no auto-sync:', e);
  }
};
