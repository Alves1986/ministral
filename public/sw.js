// Ministral Service Worker — Web Push Notifications
// Este arquivo DEVE ficar em /public/sw.js para ser servido na raiz do domínio

const CACHE_NAME = 'ministral-v1';

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
    icon: data.icon,
    badge: data.badge,
    data: data.data,
    vibrate: [200, 100, 200],
    requireInteraction: false,
    actions: [
      { action: 'open', title: 'Abrir', icon: '/branding/favicon-light.png' },
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

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se já tem uma aba aberta, foca nela e navega
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(targetUrl);
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
