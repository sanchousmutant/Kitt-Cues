const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

export function createPWAHandler(ctx) {
    const { state, window: win, document: doc } = ctx;

    function ensureInstallButton() {
        if (!state.installButton) {
            const button = doc.createElement('button');
            button.innerHTML = '📱 Установить приложение';
            button.className = 'bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow text-sm sm:text-base md:text-lg fixed top-4 right-4 z-50 transition-all duration-300';
            button.id = 'pwa-install-button';
            button.style.display = 'none';
            button.addEventListener('click', installApp);
            doc.body.appendChild(button);
            state.installButton = button;
        }
        return state.installButton;
    }

    function showInstallButton() {
        const button = ensureInstallButton();
        button.style.display = 'block';
        state.isInstallable = true;
        setTimeout(() => {
            button.style.transform = 'scale(1.05)';
            setTimeout(() => {
                button.style.transform = 'scale(1)';
            }, 200);
        }, 100);
    }

    function hideInstallButton() {
        if (state.installButton) {
            state.installButton.style.display = 'none';
        }
        state.isInstallable = false;
    }

    function installApp() {
        if (state.deferredPrompt) {
            state.deferredPrompt.prompt();
            state.deferredPrompt.userChoice
                .then(choiceResult => {
                    if (choiceResult.outcome === 'accepted') {
                        tryVibrateSuccess();
                    }
                    state.deferredPrompt = null;
                    hideInstallButton();
                })
                .catch(error => {
                    console.log('Ошибка при установке PWA:', error);
                });
        } else {
            showManualInstallInstructions();
        }
    }

    function tryVibrateSuccess() {
        const nav = win.navigator;
        const fn = nav?.vibrate || nav?.webkitVibrate || nav?.mozVibrate || nav?.msVibrate;
        if (typeof fn === 'function') {
            try {
                fn.call(nav, [100, 50, 100, 50, 100]);
            } catch (error) {
                console.log('Vibration not supported:', error);
            }
        }
    }

    function showManualInstallInstructions() {
        const modal = doc.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-lg p-6 max-w-md w-full">
                <h3 class="text-lg font-bold mb-4">📱 Установка приложения</h3>
                <div class="text-sm text-gray-700 mb-4">
                    ${renderInstallInstructions()}
                </div>
                <button class="bg-blue-600 text-white px-4 py-2 rounded w-full">Понятно</button>
            </div>
        `;
        modal.querySelector('button')?.addEventListener('click', () => modal.remove());
        doc.body.appendChild(modal);
        setTimeout(() => modal.remove(), 10000);
    }

    function renderInstallInstructions() {
        const nav = win.navigator;
        const isIOS = /iPad|iPhone|iPod/.test(nav?.userAgent || '');
        const isSafari = /Safari/.test(nav?.userAgent || '') && !/Chrome/.test(nav?.userAgent || '');

        if (isIOS && isSafari) {
            return `
                <p class="mb-2">На iOS Safari:</p>
                <ol class="list-decimal list-inside space-y-1">
                    <li>Нажмите кнопку "Поделиться" в Safari</li>
                    <li>Выберите "На экран Домой"</li>
                    <li>Нажмите "Добавить"</li>
                </ol>
            `;
        }

        return `
            <p class="mb-2">В Chrome:</p>
            <ol class="list-decimal list-inside space-y-1">
                <li>Нажмите на меню (три точки)</li>
                <li>Выберите "Добавить на главный экран"</li>
                <li>Нажмите "Добавить"</li>
            </ol>
        `;
    }

    function showUpdateNotification() {
        const notification = doc.createElement('div');
        notification.className = 'fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
        notification.innerHTML = `
            <div class="flex items-center space-x-3">
                <span>🆕 Доступна новая версия</span>
                <button class="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium">Обновить</button>
                <button class="text-white hover:text-gray-200">✕</button>
            </div>
        `;
        const [updateBtn, closeBtn] = notification.querySelectorAll('button');
        updateBtn?.addEventListener('click', () => win.location.reload());
        closeBtn?.addEventListener('click', () => notification.remove());
        doc.body.appendChild(notification);
        setTimeout(() => notification.remove(), 10000);
    }

    function registerServiceWorker() {
        if (!('serviceWorker' in win.navigator)) {
            console.log('⚠️ Service Worker не поддерживается в этом браузере');
            return;
        }

        win.addEventListener('load', () => {
            const swUrl = `/service-worker.js?v=${encodeURIComponent(APP_VERSION)}`;
            win.navigator.serviceWorker
                .register(swUrl)
                .then(registration => {
                    console.log('✅ Service Worker зарегистрирован успешно:', registration.scope);
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker?.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && win.navigator.serviceWorker.controller) {
                                showUpdateNotification();
                            }
                        });
                    });
                })
                .catch(error => {
                    console.log('❌ Service Worker регистрация не удалась:', error);
                });
        });
    }

    function checkInstallability() {
        const isStandalone = win.matchMedia && win.matchMedia('(display-mode: standalone)').matches;
        if (isStandalone) {
            console.log('PWA уже установлено и запущено');
            return;
        }

        const nav = win.navigator;
        const isIOS = /iPad|iPhone|iPod/.test(nav?.userAgent || '');
        const isSafari = /Safari/.test(nav?.userAgent || '') && !/Chrome/.test(nav?.userAgent || '');

        if (isIOS && isSafari) {
            setTimeout(showInstallButton, 3000);
        }

        setTimeout(() => {
            if (!state.isInstallable && !win.matchMedia('(display-mode: standalone)').matches) {
                showInstallButton();
            }
        }, 5000);
    }

    function handleBeforeInstallPrompt(event) {
        event.preventDefault();
        state.deferredPrompt = event;
        showInstallButton();
    }

    function handleAppInstalled() {
        hideInstallButton();
        state.deferredPrompt = null;
        const notification = doc.createElement('div');
        notification.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-all duration-300';
        notification.innerHTML = '✅ Приложение установлено!';
        doc.body.appendChild(notification);
        tryVibrateSuccess();
        setTimeout(() => {
            notification.style.transform = 'translate(-50%, -100%)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    function monitorDisplayMode() {
        win.addEventListener('DOMContentLoaded', () => {
            const isStandalone = win.matchMedia && win.matchMedia('(display-mode: standalone)').matches;
            if (isStandalone) {
                doc.body.classList.add('pwa-mode');
            } else {
                checkInstallability();
            }
        });
    }

    function setupListeners() {
        win.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        win.addEventListener('appinstalled', handleAppInstalled);
        monitorDisplayMode();
    }

    return {
        registerServiceWorker,
        setupListeners,
        showInstallButton,
        hideInstallButton
    };
}
