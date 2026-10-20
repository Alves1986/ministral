// Ministral Service Worker — Web Push Notifications
// Este arquivo DEVE ficar em /public/sw.js para ser servido na raiz do domínio

const CACHE_NAME = 'ministral-v1';
// Injetado pelo Workbox injectManifest
const swManifest = self.__WB_MANIFEST;
self.__SW_MANIFEST = swManifest;

// =============================================
// EVENTO: push (recebe notificação do servidor)
// =============================================
self.addEventListener('push', (event) => {
  console.log('[SW] Push recebido:', event);

  let data = {
    title: 'Ministral',
    body: 'Você tem uma nova notificação.',
    icon: '/branding/icon-light.png',
    badge: '/branding/favicon-light.png',
    data: { url: '/' }
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = {
        title: parsed.title || data.title,
        body: parsed.body || data.body,
        icon: parsed.icon || data.icon,
        badge: parsed.badge || data.badge,
        data: parsed.data || data.data
      };
    }
  } catch (e) {
    console.warn('[SW] Erro ao parsear payload push:', e);
  }

  const options = {
    body: data.body,
    icon: data.icon || '/branding/icon-light.png',
    badge: data.badge || '/branding/favicon-light.png',
    data: data.data,
    tag: (data.data && data.data.id) ? `ministral-${data.data.id}` : `ministral-${Date.now()}`,
    renotify: true,
    vibrate: [200, 100, 200],
    requireInteraction: false,
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'close', title: 'Fechar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// =============================================
// EVENTO: notificationclick (usuário clicou)
// =============================================
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notificação clicada:', event.action);

  event.notification.close();

  if (event.action === 'close') return;

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/';

  let targetTab = null;
  try {
    const parsedUrl = new URL(targetUrl, self.location.origin);
    targetTab = parsedUrl.searchParams.get('tab');
  } catch (e) {}

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se já tem uma aba aberta, foca nela e navega
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          if ('postMessage' in client) {
            client.postMessage({ type: 'NAVIGATE', url: targetUrl, tab: targetTab });
          }
          return;
        }
      }
      // Caso contrário, abre nova aba
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// =============================================
// EVENTO: install / activate (ciclo de vida)
// =============================================
self.addEventListener('install', (event) => {
  console.log('[SW] Instalado.');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Ativado.');
  event.waitUntil(clients.claim());
});
