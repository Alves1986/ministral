import { getSupabase } from '../services/supabase/client';

// Safe Access VAPID Key from Environment Variables
let vapidKey = "";

try {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";
  }
} catch (e) {}

// Fallback manual check for process.env if Vite replacement didn't happen
if (!vapidKey && typeof process !== 'undefined' && process.env) {
    vapidKey = process.env.VITE_VAPID_PUBLIC_KEY || "";
}

export const VAPID_PUBLIC_KEY = vapidKey;

if (!VAPID_PUBLIC_KEY) {
  console.warn("⚠️ VITE_VAPID_PUBLIC_KEY is missing. Push notifications will not work.");
}

export function urlBase64ToUint8Array(base64String: string) {
  if (!base64String) throw new Error("VAPID Key is empty");
  
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  try {
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  } catch (e) {
    console.error("VAPID Key decoding failed. Invalid VAPID Key.", e);
    return new Uint8Array(0);
  }
}

export const subscribeUserToPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        console.warn("[Push] Push notifications not supported in this browser/device");
        return null;
    }

    if (!VAPID_PUBLIC_KEY) {
        console.error("[Push] VAPID Key is missing. Cannot subscribe.");
        return null;
    }

    try {
        // 1. Solicitar permissão explicitamente se ainda não foi decidida
        let permission = Notification.permission;
        if (permission === 'default') {
            permission = await Notification.requestPermission();
        }
        if (permission !== 'granted') {
            console.warn("[Push] Permission not granted:", permission);
            return null;
        }

        // 2. Garantir que o Service Worker está registrado e pronto
        let registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
            registration = await navigator.serviceWorker.register('/sw.js');
        }
        const activeReg = await navigator.serviceWorker.ready;

        const targetKeyBytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

        // 3. Obter ou renovar subscription
        let subscription = await activeReg.pushManager.getSubscription();

        if (subscription) {
            // Valida se a inscrição existente utiliza a mesma VAPID key
            const existingKey = (subscription as any).options?.applicationServerKey;
            if (existingKey) {
                const existingArr = new Uint8Array(existingKey);
                const isMatch = existingArr.length === targetKeyBytes.length &&
                    existingArr.every((v, i) => v === targetKeyBytes[i]);

                if (!isMatch) {
                    console.warn("[Push] Chave VAPID alterada. Renovando inscrição...");
                    await subscription.unsubscribe();
                    subscription = null;
                }
            }
        }

        if (!subscription) {
            subscription = await activeReg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: targetKeyBytes
            });
        }

        // 4. Enviar para o backend (Supabase)
        const sb = getSupabase();
        if (sb && subscription) {
            let authUser = null;
            try {
                const { data } = await sb.auth.getUser();
                authUser = data?.user;
            } catch (e) {
                console.warn("[Push] Falha ao obter auth.getUser, tentando session:", e);
            }

            if (!authUser) {
                const { data: sessionData } = await sb.auth.getSession();
                authUser = sessionData?.session?.user;
            }

            if (authUser) {
                const subJson = subscription.toJSON();
                if (subJson.endpoint && subJson.keys?.p256dh && subJson.keys?.auth) {
                    const { error } = await sb.from('push_subscriptions').upsert({
                        user_id: authUser.id,
                        endpoint: subJson.endpoint,
                        p256dh: subJson.keys.p256dh,
                        auth: subJson.keys.auth,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'endpoint' });

                    if (error) {
                        console.error("[Push] Falha ao salvar inscrição no Supabase:", error);
                    } else {
                        console.log("[Push] Inscrição salva com sucesso no Supabase para o usuário:", authUser.id);
                    }
                }
                return subscription;
            } else {
                console.warn("[Push] Usuário não autenticado no momento da inscrição. Inscrição local pronta.");
                return subscription;
            }
        }
    } catch (e) {
        console.error("[Push] Erro ao registrar inscrição push:", e);
        return null;
    }
    return null;
};