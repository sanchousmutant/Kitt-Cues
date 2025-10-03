import { defineConfig } from 'vite';

export default defineConfig(() => ({
    define: {
        __APP_VERSION__: JSON.stringify(process.env.npm_package_version || 'dev')
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true
    }
}));
