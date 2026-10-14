import { defineConfig } from 'vite';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// После сборки пишет dist/sw.js: версия = хэш файлов, список = вся сборка (офлайн-кэш)
function swPlugin() {
  let outDir;
  const walk = (dir, base = '') => readdirSync(dir).flatMap(n => {
    const p = join(dir, n), rel = base ? base + '/' + n : n;
    return statSync(p).isDirectory() ? walk(p, rel) : [rel];
  });
  return {
    name: 'berserk-sw', apply: 'build',
    configResolved(c) { outDir = resolve(c.root, c.build.outDir); },
    closeBundle() {
      // служебные файлы хостинга (_headers, _redirects) и точечные не кэшируем: их нет в ответах сервера, addAll упал бы
      const files = walk(outDir).filter(f => f !== 'sw.js' && !f.split('/').pop().startsWith('_') && !f.split('/').pop().startsWith('.')).sort();
      const h = createHash('md5');
      for (const f of files) h.update(f).update(readFileSync(join(outDir, f)));
      const tpl = readFileSync(join(here, 'tools', 'sw.template.js'), 'utf8');
      writeFileSync(join(outDir, 'sw.js'), tpl.replace('__VERSION__', h.digest('hex').slice(0, 10)).replace('__ASSETS__', JSON.stringify(['./', ...files.map(f => './' + f)])));
    }
  };
}

// Нулевые зависимости в рантайме. Vite нужен как dev-сервер (--host: открыть с iPhone по Wi-Fi),
// для сборки в один файл и для офлайн-кэша (service worker).
export default defineConfig({
  base: './',
  plugins: [swPlugin()],
  server: { host: true, port: 5174, strictPort: false },
  build: { target: 'es2020', sourcemap: false, assetsInlineLimit: 0 }
});
