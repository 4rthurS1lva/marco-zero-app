// src/serviceWorker.js
const CACHE_NAME = 'marco-zero-cache-v1'; // Nome do cache, mude para invalidar caches antigos
const urlsToCache = [
  '/',
  '/index.html',
  // O Create React App adiciona automaticamente os ativos compilados aqui durante o build.
  // Não é necessário listar todos manualmente para o funcionamento básico.
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache aberto para service worker.');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Falha ao cachear urls durante a instalação:', error);
      })
  );
});

// Ativação do Service Worker (limpa caches antigos)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName.startsWith('marco-zero-cache-') && cacheName !== CACHE_NAME) {
            console.log('Deletando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
          return null;
        })
      );
    })
  );
  self.clients.claim(); // Assume o controle imediatamente das páginas abertas
});

// Interceptação de requisições (Fetch)
self.addEventListener('fetch', (event) => {
  if (
    !event.request.url.startsWith('http') || // Ignora requisições não HTTP/HTTPS
    event.request.url.includes('google-analytics') || // Exemplo: ignorar analytics
    event.request.method !== 'GET' // Apenas cachear requisições GET
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) { // Retorna o recurso do cache se ele existir
          return response;
        }

        // Caso contrário, busca da rede
        return fetch(event.request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone(); // Clona a resposta para o cache

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(error => {
            console.error('Falha ao buscar recurso da rede e/ou cachear:', error);
            // Opcional: retornar uma página offline aqui, se desejar
            // Ex: return caches.match('/offline.html');
          });
      })
  );
});
