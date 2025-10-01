const CACHE_NAME = 'kitt-cues-v1.4.0';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icons/icon-72x72.png',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './browserconfig.xml',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Comfortaa:wght@400;700&display=swap'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Кэширование файлов');
        return cache.addAll(urlsToCache.map(url => new Request(url, {credentials: 'same-origin'})));
      })
      .then(() => {
        console.log('Service Worker: Все файлы кэшированы');
        return self.skipWaiting(); // Принудительно активируем новый SW
      })
      .catch((error) => {
        console.error('Service Worker: Ошибка кэширования:', error);
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Удаление старого кэша:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Активирован');
      return self.clients.claim(); // Берем управление всеми клиентами
    })
  );
});

// Перехват запросов с стратегией Cache First для статических ресурсов
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Игнорируем запросы к другим доменам (кроме fonts и CDN)
  if (url.origin !== location.origin && 
      !url.hostname.includes('fonts.googleapis.com') && 
      !url.hostname.includes('fonts.gstatic.com') &&
      !url.hostname.includes('cdn.tailwindcss.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Если есть кэшированная версия, возвращаем её
        if (cachedResponse) {
          console.log('Service Worker: Served from cache:', event.request.url);
          return cachedResponse;
        }

        // Иначе загружаем из сети и кэшируем
        return fetch(event.request)
          .then((response) => {
            // Проверяем валидность ответа
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Клонируем ответ для кэширования
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
                console.log('Service Worker: Cached new resource:', event.request.url);
              });

            return response;
          })
          .catch((error) => {
            console.error('Service Worker: Fetch failed:', error);
            
            // Возвращаем офлайн страницу для HTML запросов
            if (event.request.destination === 'document') {
              return caches.match('./index.html');
            }
            
            throw error;
          });
      })
  );
});

// Обработка сообщений от клиента
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Уведомления о обновлениях (для будущего использования)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Background sync');
  }
});

console.log('Service Worker: Loaded version', CACHE_NAME);
