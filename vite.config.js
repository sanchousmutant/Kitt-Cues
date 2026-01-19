import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { copyFileSync, mkdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

export default defineConfig(({ mode }) => ({
    // Базовый путь для GitHub Pages
    base: '/Kitt-Cues/',

    define: {
        __APP_VERSION__: JSON.stringify(process.env.npm_package_version || 'dev'),
        __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
        __GIT_COMMIT__: JSON.stringify(process.env.GITHUB_SHA || 'local'),
    },

    build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: mode === 'development',
        minify: mode === 'production' ? 'esbuild' : false,
        // Предотвращаем проблемы с порядком инициализации модулей
        commonjsOptions: {
            include: [/node_modules/],
            transformMixedEsModules: true
        },

        rollupOptions: {
            input: {
                main: 'index.html'
            },
            output: {
                manualChunks: {
                    // Разделяем код на чанки для лучшей производительности
                    physics: ['./src/modules/physics.ts'],
                    sound: ['./src/modules/sound.ts'],
                    ui: ['./src/modules/ui.ts'],
                    cats: ['./src/modules/cats.ts'],
                    utils: ['./src/utils/device.ts', './src/utils/helpers.ts']
                },
                // Настройки именования файлов
                chunkFileNames: 'assets/[name]-[hash].js',
                entryFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash].[ext]'
            }
        },

        // Настройки для GitHub Pages
        assetsDir: 'assets',

        // Оптимизация размера бандла
        chunkSizeWarningLimit: 1000,

        // Копируем иконки после сборки
        copyPublicDir: true,

        // Оптимизация для мобильных устройств
        target: ['es2020', 'chrome80', 'safari13'],

        // CSS настройки
        cssCodeSplit: true,
        cssMinify: mode === 'production'
    },

    resolve: {
        alias: {
            '@': new URL('./src', import.meta.url).pathname,
            '@modules': new URL('./src/modules', import.meta.url).pathname,
            '@utils': new URL('./src/utils', import.meta.url).pathname
        }
    },

    // Настройки dev сервера
    server: {
        port: 3000,
        open: true,
        cors: true,
        host: '0.0.0.0', // Позволяет доступ с мобильных устройств в локальной сети
        
        // Для тестирования PWA важно разрешить service worker
        headers: {
            'Service-Worker-Allowed': '/',
        }
    },

    // Настройки превью
    preview: {
        port: 4173,
        host: '0.0.0.0'
    },

    // Оптимизация зависимостей
    optimizeDeps: {
        include: [],
        exclude: []
    },

    // Настройки для TypeScript
    esbuild: {
        target: 'es2020',
        keepNames: true,

        // Оптимизация для production
        ...(mode === 'production' && {
            drop: ['console', 'debugger'],
            minifyIdentifiers: true,
            minifySyntax: true,
            minifyWhitespace: true
        })
    },

    // Настройки CSS
    css: {
        devSourcemap: mode === 'development',

        // PostCSS настройки для Tailwind
        postcss: {
            plugins: []
        }
    },

    // Настройки для тестирования
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test/setup.ts']
    },

    // Плагины
    plugins: [
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['/Kitt-Cues/icons/*.png', '/Kitt-Cues/icons/*.svg'],
            manifest: {
                name: 'Kitt-Cues - Бильярд с котами',
                short_name: 'Kitt-Cues',
                description: 'Весёлая игра в бильярд с интерактивными котами',
                theme_color: '#1f2937',
                background_color: '#3a2d27',
                display: 'standalone',
                display_override: ['standalone'],
                orientation: 'any',
                scope: '/Kitt-Cues/',
                start_url: '/Kitt-Cues/',
                icons: [
                    {
                        src: 'icons/icon-72x72.png',
                        sizes: '72x72',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: 'icons/icon-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any maskable'
                    },
                    {
                        src: 'icons/icon-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                    }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
                cleanupOutdatedCaches: true,
                maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // Увеличиваем лимит до 10MB (10 * 1024 * 1024 Bytes)
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-cache',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'gstatic-fonts-cache',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    }
                ]
            }
        }),
        {
            name: 'copy-files-for-dist',
            writeBundle() {
                const distDir = join(process.cwd(), 'dist');

                // --- Копирование иконок ---
                const iconsDir = join(distDir, 'icons');
                if (!existsSync(iconsDir)) {
                    mkdirSync(iconsDir, { recursive: true });
                }
                const iconsToCopy = ['icon-72x72.png', 'icon-192x192.png', 'icon-512x512.png', 'icon-192x192.svg'];
                iconsToCopy.forEach(icon => {
                    const src = join(process.cwd(), 'icons', icon);
                    if (existsSync(src)) {
                        copyFileSync(src, join(iconsDir, icon));
                    }
                });
                
                // --- Создание .nojekyll ---
                const nojekyllPath = join(distDir, '.nojekyll');
                writeFileSync(nojekyllPath, '', 'utf8');
                console.log('✅ Created .nojekyll file');

                // --- Копирование browserconfig.xml ---
                const browserConfigSrc = join(process.cwd(), 'browserconfig.xml');
                if (existsSync(browserConfigSrc)) {
                    copyFileSync(browserConfigSrc, join(distDir, 'browserconfig.xml'));
                    console.log('✅ Copied browserconfig.xml');
                }
            }
        }
    ]
}));
