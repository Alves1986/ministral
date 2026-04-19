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

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const subscribeUserToPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn("Push notifications not supported");
        return null;
    }

    if (!VAPID_PUBLIC_KEY) {
        console.error("VAPID Key is missing. Cannot subscribe.");
        return null;
    }

    try {
        // 1. Solicitar permissão explicitamente
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.warn("Permission not granted for Notification");
            return null;
        }

        // 2. Garantir que o SW está registrado e pronto
        let registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
            registration = await navigator.serviceWorker.register('/sw.js');
        }
        await navigator.serviceWorker.ready;

        // 3. Obter ou criar subscription
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
        }

        // 4. Enviar para o backend (Supabase)
        const sb = getSupabase();
        if (sb) {
            const { data: { user } } = await sb.auth.getUser();
            if (user) {
                const subJson = subscription.toJSON();
                
                const { error } = await sb.from('push_subscriptions').upsert({
                    user_id: user.id,
                    endpoint: subJson.endpoint,
                    p256dh: subJson.keys?.p256dh,
                    auth: subJson.keys?.auth,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'endpoint' });

                if (error) {
                    console.error("Failed to save subscription to DB:", error);
                    return null;
                }
                
                return subscription;
            }
        }
    } catch (e) {
        console.error("Failed to subscribe to push:", e);
        return null;
    }
    return null;
};