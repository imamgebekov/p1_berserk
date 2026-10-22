// Снимки моделей для разбора стиля (2026-10-22): ряды героев, спутников, врагов, боссов, оружия → PNG и models.json в папке OUT.
// Запуск: OUT=<папка> node tools/shots-models.mjs
import { createServer } from 'vite';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), OUT = process.env.OUT || join(root, 'shots-models'); mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const dev = await createServer({ root, server: { port: 5196, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' }); await dev.listen();
const base = `http://127.0.0.1:${dev.config.server.port}/3d/index.html`;
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage(); page.setDefaultTimeout(120000);
  page.on('pageerror', e => console.log('pageerror:', e.message)); page.on('console', m => { if ((m.type() === 'warning' || m.type() === 'error') && !/GL Driver/.test(m.text())) console.log('console:', m.text()); });
  await page.goto(base + '?shot&models=1'); await page.waitForFunction(() => window.__b3d && window.__b3d.W);
  await page.locator('#heroCards button').first().click(); await page.waitForFunction(() => document.getElementById('heroPick').hidden);
  for (let k = 0; k < 30 && !(await page.evaluate(() => document.getElementById('dialog').hidden)); k++) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }
  await page.waitForTimeout(3000);
  if (process.env.GAME) await page.screenshot({ path: join(OUT, 'game.png') });
  const rows = await page.evaluate(async only => { try {
    const S = await import('/tools/stand-models.js'); await S.ready();
    const { W, cfg, renderer: R } = window.__b3d; W.player.inv = 999;
    const A = cfg.actors, out = {}, keys = Object.keys(A.kits);
    const add = (name, items, o) => { if (!only || only.split(',').includes(name)) out[name] = S.shoot(R, W, items, o); };
    const heroIds = Object.keys(A.heroes).concat(A.heroes.hunter ? [] : ['hunter']);
    const hk = A.kits.kk_hunter ? 'kk_hunter' : 'q_warrior';
    add('heroes', heroIds.map(id => ({ m: S.heroModel(id, id === 'hunter' && !A.heroes.hunter ? hk : undefined), label: id + ' · ' + (A.heroes[id] || hk) })));
    if (only === 'ref') {     // образцы стиля для генератора картинок: спереди, сбоку, сзади
      const R0 = { w: 640, h: 640, elev: .06, bg: '#e8e8e6', ground: '#dcdcd8' };
      for (const [nm, mk] of [['knight', () => S.heroModel('thorn')], ['mage', () => S.heroModel('irga')], ['barbarian', () => S.heroModel('brand')], ['yeti', () => S.keyModel('q_yeti')], ['demon', () => S.keyModel('q_demonfly')], ['skeleton', () => S.keyModel('kk_skel_warrior')]])
        [['front', 0], ['side', Math.PI / 2], ['back', Math.PI]].forEach(([v, r]) => { out['ref_' + nm + '_' + v] = S.shoot(R, W, [{ m: mk(), label: '', rot: r }], R0); });
      return out;
    }
    if (only.startsWith('foes:')) { out.list = S.shoot(R, W, only.slice(5).split(',').map(t => ({ m: S.foeModel(t), label: cfg.enemies[t].name + ' · ' + A.foes[t] }))); return out; }     // ряд по списку видов: foes:вид1,вид2
    if (only.startsWith('pack:')) {     // просмотр набора: pack:<папка в _packs>:<файл1,файл2…>
      const [, dir, list] = only.split(':'), names = list.split(','), info = {};
      for (let i = 0; i < names.length; i += 9) { const part = []; for (const n of names.slice(i, i + 9)) { const m = await S.rawModel(`/_packs/${dir}/${n}.glb`, 2); info[n] = { clips: m.clips, tris: m.tris }; part.push({ m, label: n }); } out['pack_' + (i / 9 + 1)] = S.shoot(R, W, part, { w: 1800 }); }
      out.info = info; return out;
    }
    if (only.includes('pilot')) add('pilot', ['mossbeast', 'drownqueen', 'smelter'].flatMap(t => [{ m: S.foeModel(t, true), label: cfg.enemies[t].name + ' · было' }, { m: S.foeModel(t), label: cfg.enemies[t].name + ' · стало' }]), { w: 1800, h: 600 });
    const draft = { warlock: ['kk_mage', '#8a6ab0'], priest: ['kk_knight', '#fff2d0'], hunter: ['kk_rogue_hooded', '#9a8a8a'] };     // набросок пути А: все герои на KayKit, перекраска грубым оттенком
    add('heroes_a', heroIds.map(id => { const d = draft[id], m = d ? S.keyModel(d[0], d[1]) : S.heroModel(id); if (d) { const [w, off] = S.HERO_W[id]; m.setWeapon(w, 'steel'); if (off) m.setOff(off[0], off[0], off[1] || 'steel'); } return { m, label: id + ' · ' + (d ? d[0] + ' + оттенок' : A.heroes[id]) }; }));
    add('heroes_cubes', heroIds.map(id => ({ m: S.heroModel(id, null), label: id + ' · кубики' })));
    add('soldiers', ['guard', 'soldier', 'veteran', 'kad_xbow', 'royal_guard', 'irma', 'timka', 'kord', 'alaric'].map(t => ({ m: S.soldierModel(t), label: cfg.squad.types[t].name })));
    add('kweapons', [{ m: S.heroModel('thorn'), label: 'thorn для размера' }, ...S.weapons().filter(k => k !== 'fists').map(k => ({ m: (() => { const w = S.kkWeaponModel(k); w.group.scale.multiplyScalar(.75); return w; })(), label: k, rot: 0 }))], { w: 2000, h: 520, elev: .15 });
    add('squad', [...['guard', 'soldier', 'veteran'].map(t => ({ m: S.soldierModel(t), label: t })),
      ...['merchant', 'smith', 'captain', 'villager', 'villagerF', 'traveler'].map(t => ({ m: S.npcModel(t), label: t + ' · ' + ((A.npcs || {})[t] || 'кубики') }))]);
    const common = ['imp', 'hound', 'lunger', 'war_ghost', 'witch', 'archer', 'shield', 'shade', 'troll', 'brute', 'ghoul', 'golem', 'drowned'];
    add('foes', common.map(t => ({ m: S.foeModel(t), label: t + ' · ' + A.foes[t] })));
    add('foes_big', ['demon_guard', 'tidewyrm', 'namelessking', 'castellan', 'barghest', 'oldoak'].map(t => ({ m: S.foeModel(t), label: t + ' · ' + A.foes[t] })));
    const kbs = Object.keys(A.foes).filter(k => A.foes[k].startsWith('kb_') && cfg.enemies[k]);
    for (let i = 0; i < kbs.length; i += 10) add('bosses_kb_' + (i / 10 + 1), kbs.slice(i, i + 10).map(t => ({ m: S.foeModel(t), label: t + ' · ' + A.foes[t] })));
    const bosses = Object.keys(cfg.enemies).filter(k => cfg.enemies[k] && cfg.enemies[k].boss && (!A.foes[k] || A.foes[k].startsWith('kb_')));
    if (/bosses_cubes/.test(only)) for (let i = 0; i < bosses.length; i += 10) add('bosses_cubes_' + (i / 10 + 1), bosses.slice(i, i + 10).map(t => ({ m: S.foeModel(t, true), label: t })));
    add('kits_raw', keys.filter(k => !/^q_(chicken|pigeon|cow|fox|stag|horse)$/.test(k)).map(k => ({ m: S.keyModel(k), label: k })), { h: 560, w: 2400 });
    const wk = S.weapons().filter(k => k !== 'fists');
    add('weapons', [{ m: S.heroModel('thorn'), label: 'thorn для размера' }, ...wk.map(k => { const w = S.weaponModel(k); return { m: w, label: k, rot: 0 }; })], { w: 2000, h: 520, elev: .15 });
    add('weapon_mats', ['rust', 'iron', 'steel', 'tempered', 'black', 'bone', 'gold', 'blood'].map(mt => ({ m: S.weaponModel('sword', mt), label: mt, rot: 0 })), { elev: .15 });
    add('hands', ['thorn', 'vale', 'jay', 'irga', 'warlock', 'priest', 'brand'].map(id => ({ m: S.heroModel(id), label: id, rot: 1.2 })), { elev: .1 });
    const tris = {}; for (const k of keys) tris[k] = S.triOf(S.keyModel(k)); tris.hero_cubes = S.triOf(S.heroModel('thorn', null)); out.tris = tris;
    return out;
  } catch (e) { return { err: String(e.stack) }; } }, process.env.ONLY || '');
  if (rows.err) throw new Error(rows.err);
  const meta = {};
  for (const [k, v] of Object.entries(rows)) { if (k === 'tris' || k === 'info') { meta[k] = v; continue; } writeFileSync(join(OUT, k + '.png'), Buffer.from(v.url.split(',')[1], 'base64')); meta[k] = { labels: v.labels, tris: v.tris }; }
  writeFileSync(join(OUT, 'models.json'), JSON.stringify(meta, null, 1));
  console.log('снимки:', Object.keys(meta).join(', '), '→', OUT);
} finally { await browser.close(); await dev.close(); }
