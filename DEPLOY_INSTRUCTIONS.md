# 🚀 Инструкции по деплою Kitt-Cues

## ❌ Проблема с GitHub Pages

**Почему сайт не работает:** https://sanchousmutant.github.io/Kitt-Cues/

GitHub Pages не может выполнять TypeScript код напрямую. В `index.html` была ссылка:
```html
<script type="module" src="/src/main.ts"></script>
```

Браузеры не понимают `.ts` файлы - нужны скомпилированные `.js` файлы.

## ✅ Решения

### **Вариант 1: Автоматический деплой через GitHub Actions** (Рекомендуется)

1. **Создать workflow** `.github/workflows/deploy.yml` (уже создан)
2. **Настроить GitHub Pages**:
   - Зайти в Settings → Pages
   - Source: "GitHub Actions"
   - Workflow будет собирать проект автоматически при каждом пуше

### **Вариант 2: Ручная сборка** (Быстрое решение)

1. **Собрать проект локально:**
   ```bash
   npm run build
   ```

2. **Скопировать dist в docs:**
   ```bash
   cp -r dist/* docs/
   ```

3. **Обновить index.html** для использования скомпилированных файлов:
   ```html
   <script type="module" src="./docs/index-[hash].js"></script>
   <link rel="stylesheet" href="./docs/index-[hash].css">
   ```

4. **Настроить GitHub Pages**:
   - Settings → Pages → Source: "Deploy from a branch"
   - Branch: main, Folder: /docs

### **Вариант 3: Использовать Vite + GitHub Pages**

1. **Обновить vite.config.js:**
   ```javascript
   export default defineConfig({
     base: '/Kitt-Cues/', // название репозитория
     build: {
       outDir: 'docs' // собирать в docs вместо dist
     }
   })
   ```

2. **Настроить деплой в package.json:**
   ```json
   {
     "scripts": {
       "deploy": "vite build && git add docs && git commit -m 'Deploy' && git push"
     }
   }
   ```

## 🔧 Текущий статус

- ✅ **TypeScript код** - рефакторинг завершен
- ✅ **Модульная архитектура** - все разделено по модулям  
- ✅ **Сборка Vite** - настроена и работает
- ⚠️ **GitHub Pages** - требует настройки автодеплоя
- 🔄 **CI/CD** - GitHub Actions workflow создан, нужно активировать

## 📝 Следующие шаги

1. **Коммитнуть изменения** с рефакторингом
2. **Настроить GitHub Actions** в настройках репозитория
3. **Активировать автодеплой** при пушах в main
4. **Проверить работу** сайта после автосборки

## 🎯 Результат

После настройки сайт будет:
- ✅ Автоматически собираться из TypeScript
- ✅ Деплоиться на GitHub Pages при каждом пуше
- ✅ Работать со всеми современными браузерами
- ✅ Поддерживать PWA функции

## 🔗 Полезные ссылки

- [GitHub Actions для Pages](https://github.com/actions/deploy-pages)
- [Vite Static Deploy](https://vitejs.dev/guide/static-deploy.html#github-pages)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)