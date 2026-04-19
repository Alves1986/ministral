import { createClient, SupabaseClient } from '@supabase/supabase-js';

// --- INITIALIZATION ---

export let serviceOrgId: string | null = null;

let envUrl = "";
let envKey = "";

try {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    envUrl = import.meta.env.VITE_SUPABASE_URL || "";
    envKey = import.meta.env.VITE_SUPABASE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "";
  }
} catch (e) {
  console.warn("[SupabaseService] Falha ao ler import.meta.env. Usando fallback se disponível.");
}

// Fallback to global defines from vite.config.ts
if (!envUrl) {
    try {
        // @ts-ignore
        envUrl = __SUPABASE_URL__ || "";
        // @ts-ignore
        envKey = __SUPABASE_KEY__ || "";
    } catch (e) {}
}

if (!envUrl && typeof process !== 'undefined' && process.env) {
    envUrl = process.env.VITE_SUPABASE_URL || "";
    envKey = process.env.VITE_SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
}

const supabase = (envUrl && envKey) 
  ? createClient(envUrl, envKey, {
      auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
      }
  }) 
  : null;

if (!supabase) {
    console.error("[SupabaseService] CRITICAL: Client não inicializado. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_KEY.");
}

export const getSupabase = () => supabase;

/**
 * Wrapper para chamadas do Supabase que garante tratamento de erro padronizado.
 * Em uma implementação real, isso poderia disparar eventos para um sistema de Toasts global.
 */
export async function safeCall<T>(
    operation: () => Promise<{ data: T | null; error: any }>,
    errorMessage: string = "Erro na operação do banco de dados"
): Promise<T | null> {
    try {
        const { data, error } = await operation();
        if (error) {
            console.error(`[Supabase Error] ${errorMessage}:`, error);
            // Aqui poderíamos disparar um evento customizado: 
            // window.dispatchEvent(new CustomEvent('supabase-error', { detail: { message: errorMessage, error } }));
            return null;
        }
        return data;
    } catch (err) {
        console.error(`[Supabase Critical Error] ${errorMessage}:`, err);
        return null;
    }
}

export const setServiceOrgContext = (id: string) => { serviceOrgId = id; };

/**
 * Envia uma mensagem de broadcast para invalidar o cache em outros clientes.
 */
export async function broadcastInvalidation(orgId: string, ministryId?: string) {
    const sb = getSupabase();
    if (!sb) return;
    const channel = sb.channel('cache-invalidation');
    channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
            await channel.send({
                type: 'broadcast',
                event: 'invalidate',
                payload: { orgId, ministryId, timestamp: Date.now() }
            });
            sb.removeChannel(channel);
        }
    });
}

export const clearServiceOrgContext = () => { serviceOrgId = null; };
export const configureSupabaseManual = (url: string, key: string) => { console.warn("Manual config disabled."); };
export const validateConnection = async (url: string, key: string) => { return false; };
