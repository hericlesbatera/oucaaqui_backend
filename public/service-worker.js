// Service Worker para PWA - Funcionamento Offline Completo
const CACHE_NAME = 'musicasua-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/images/default-album.png',
  '/images/default-avatar.png'
];

// Assets do React build que serão cacheados dinamicamente
const DYNAMIC_CACHE = 'musicasua-dynamic-v2';

// Instalar service worker e cachear assets estáticos
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalando v2...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Cacheando assets estáticos');
      return cache.addAll(STATIC_ASSETS).catch((error) => {
        console.warn('[Service Worker] Alguns assets não puderam ser cacheados:', error);
      });
    })
  );
  // Ativar imediatamente sem esperar
  self.skipWaiting();
});

// Ativar service worker e limpar caches antigos
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Ativando v2...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            // Remover caches antigos (v1, etc)
            return cacheName.startsWith('musicasua-') && 
                   cacheName !== CACHE_NAME && 
                   cacheName !== DYNAMIC_CACHE;
          })
          .map((cacheName) => {
            console.log('[Service Worker] Deletando cache antigo:', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
  );
  // Tomar controle imediato de todas as páginas
  self.clients.claim();
});

// Estratégia de cache inteligente
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requests não-GET
  if (request.method !== 'GET') return;

  // Ignorar extensões do Chrome e URLs externas de desenvolvimento
  if (url.protocol === 'chrome-extension:') return;
  if (url.hostname === 'localhost' && url.port !== '3000') return;

  // Para navegação (HTML), usar Network First com fallback para cache
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline: retornar do cache ou index.html
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return caches.match('/index.html');
          });
        })
    );
    return;
  }

  // Para APIs, usar Network First
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return new Response(
              JSON.stringify({ error: 'Offline', message: 'Você está offline' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // Para assets estáticos (JS, CSS, imagens), usar Cache First
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico)$/) ||
    url.pathname.startsWith('/static/')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Atualizar cache em background
          fetch(request).then((response) => {
            if (response.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, response);
              });
            }
          }).catch(() => {});
          return cachedResponse;
        }

        return fetch(request).then((response) => {
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        }).catch(() => {
          // Fallback para imagens padrão
          if (request.url.includes('album') || request.url.includes('cover')) {
            return caches.match('/images/default-album.png');
          }
          if (request.url.includes('avatar') || request.url.includes('profile')) {
            return caches.match('/images/default-avatar.png');
          }
          return new Response('', { status: 404 });
        });
      })
    );
    return;
  }

  // Para outros requests (Supabase storage, etc), usar Network First
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cachear imagens do Supabase storage
        if (response.status === 200 && url.hostname.includes('supabase')) {
          const responseToCache = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return new Response('', { status: 503 });
        });
      })
  );
});

// Background Sync para downloads pendentes (futuro)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-downloads') {
    console.log('[Service Worker] Sincronizando downloads...');
  }
});

// Notificações push (futuro)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/logo192.png',
      badge: '/logo192.png'
    });
  }
});

// Mensagem do cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
