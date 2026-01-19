/**
 * Модуль для регистрации Service Worker и управления PWA
 */
export function registerSW() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            const swUrl = './service-worker.js';

            navigator.serviceWorker.register(swUrl, { scope: './' })
                .then(registration => {
                    console.log('✅ Service Worker зарегистрирован с областью:', registration.scope);

                    registration.onupdatefound = () => {
                        const installingWorker = registration.installing;
                        if (installingWorker == null) {
                            return;
                        }

                        installingWorker.onstatechange = () => {
                            if (installingWorker.state === 'installed') {
                                if (navigator.serviceWorker.controller) {
                                    // New content is available; please refresh.
                                    console.log('🔄 Доступен новый контент; пожалуйста, обновите страницу.');
                                    // Можно добавить уведомление пользователю здесь
                                } else {
                                    // Content is cached for offline use.
                                    console.log('⚡ Контент кэширован для автономного использования.');
                                }
                            }
                        };
                    };
                })
                .catch(error => {
                    console.error('❌ Ошибка регистрации Service Worker:', error);
                });
        });
    }
}
