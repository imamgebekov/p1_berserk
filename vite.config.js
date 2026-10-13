import { defineConfig } from 'vite';

// Нулевые зависимости в рантайме. Vite нужен как dev-сервер (--host: открыть с iPhone по Wi-Fi)
// и для сборки в один файл.
export default defineConfig({
  base: './',
  server: { host: true, port: 5174, strictPort: false },
  build: { target: 'es2020', sourcemap: false, assetsInlineLimit: 0 }
});
