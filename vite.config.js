import { defineConfig } from 'vite';

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
    }
}));
