import { defineConfig } from 'vite';
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
        
        // Настройки для PWA
        manifest: true,
        
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
        
        // Настройки для тестирования PWA
        headers: {
            'Service-Worker-Allowed': '/'
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
    
    // Плагин для копирования иконок
    plugins: [
        {
            name: 'copy-icons',
            writeBundle() {
                const iconsDir = join(process.cwd(), 'dist', 'icons');
                if (!existsSync(iconsDir)) {
                    mkdirSync(iconsDir, { recursive: true });
                }
                
                // Копируем существующие иконки
                const icons = ['icon-72x72.png', 'icon-192x192.png', 'icon-512x512.png', 'icon-192x192.svg'];
                icons.forEach(icon => {
                    const src = join(process.cwd(), 'icons', icon);
                    const dest = join(iconsDir, icon);
                    if (existsSync(src)) {
                        copyFileSync(src, dest);
                    } else if (icon === 'icon-192x192.png' || icon === 'icon-512x512.png') {
                        // Если отсутствует, копируем icon-72x72.png с новым именем
                        const fallback = join(process.cwd(), 'icons', 'icon-72x72.png');
                        if (existsSync(fallback)) {
                            copyFileSync(fallback, dest);
                        }
                    }
                });
                
                // Создаем .nojekyll файл для отключения обработки Jekyll на GitHub Pages
                // Это предотвращает проблемы с MIME типами для JS файлов
                const nojekyllPath = join(process.cwd(), 'dist', '.nojekyll');
                writeFileSync(nojekyllPath, '', 'utf8');
                console.log('✅ Created .nojekyll file to disable Jekyll processing');
            }
        }
    ]
}));
