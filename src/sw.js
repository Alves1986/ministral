
const CACHE_NAME = 'gestao-escala-pwa-__SW_CACHE_VERSION__';

// Arquivos estáticos fundamentais
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// Instalação
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('Falha no precache não crítico:', err);
      });
    })
  );
});

// Ativação e Limpeza de Caches Antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Interceptação de Rede
self.addEventListener('fetch', event => {
  if (!event.request.url.startsWith('http')) return;

  // 1. Navegação (HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/')
          .then(response => response || caches.match('/index.html'));
      })
    );
    return;
  }

  // 2. Assets Estáticos (Cache First / Stale-While-Revalidate)
  if (['script', 'style', 'image', 'font', 'manifest'].includes(event.request.destination)) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return networkResponse;
        }).catch(() => {}); // Falha silenciosa offline
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 3. Requisições Supabase (Banco de Dados/API): Network First com Cache Dinâmico
  // Salva no cache os retornos das consultas de escala e membros para visualização offline.
  if (event.request.method === 'GET' && (event.request.url.includes('/rest/v1/') || event.request.url.includes('.supabase.co'))) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // 4. Outras requisições: Network First padrão
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// --- PUSH NOTIFICATIONS (Background & Closed App) ---

self.addEventListener('push', function(event) {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'Nova Notificação', body: event.data.text() };
  }

  // Configuração Robusta para Android/iOS
  const options = {
    body: data.body,
    icon: data.icon || '/branding/icon-light.png',
    badge: '/branding/favicon-light.png', // Ícone pequeno na barra de status (Android)
    vibrate: [100, 50, 100], // Vibração padrão
    data: { 
      url: data.data?.url || '/',
      dateOfArrival: Date.now() 
    },
    actions: [
      { action: 'open', title: 'Ver Agora' }
    ],
    tag: 'ministral-notification', // Agrupa notificações para não spammar
    renotify: true // Vibra novamente mesmo se tiver a mesma tag
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const urlToOpen = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // 1. Tenta encontrar uma aba já aberta do app
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        // Verifica se a URL base corresponde (ignora query params para match básico)
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          // Se encontrou, foca nela e navega para a URL correta
          return client.focus().then(c => {
              if (c && 'navigate' in c) {
                  return c.navigate(urlToOpen);
              }
          });
        }
      }
      
      // 2. Se não encontrou, abre uma nova janela
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
