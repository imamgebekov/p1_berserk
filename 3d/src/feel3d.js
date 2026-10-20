// Ощущение боя (этап 1 плана «круче»): отклик на убийство, элиту, босса, сильное ранение, серию убийств и новый уровень.
// Только вид и звук: читает события симуляции и выдаёт для цикла main.js замедление времени, наезд камеры, вспышку,
// красную кайму при низком здоровье, удары сердца и счётчик серии. Симуляция и боты тестов этого не видят.
// Время — настоящее (секунды экрана), не игровое. Числа — cfg.feel. Чистая логика (проверяется в Node).
import { rankLvs } from './data/abilities3d.js';
const clamp01 = v => Math.max(0, Math.min(1, v));

export function createFeel(cfg) {
  const F = cfg.feel, st = { slows: [], zoom: 0, zoomT: 0, flashA: 0, flashC: '#ffffff', streak: 0, streakT: 0, beatT: 0, shown: 0 };
  const slow = (scale, t, ease = false) => { if (scale < 1 && t > 0) st.slows.push({ scale, t, T: t, ease }); };
  const flash = (c, a) => { if (a > st.flashA) { st.flashA = a; st.flashC = c; } };
  const zoom = (z, hold) => { if (z > st.zoom) { st.zoom = z; st.zoomT = hold; } };
  return {
    // событие симуляции; maxhp — запас здоровья героя (для доли урона)
    event(v, maxhp = 100) {
      if (!F || !F.on) return null;
      if (v.k === 'die') {
        if (v.boss) { const [s, t, c, a, z] = F.boss; slow(s, t, true); flash(c, a); zoom(z, t * .6); st.streak = 0; return 'bossKill'; }
        if (v.elite) { const [s, t, c, a] = F.elite; slow(s, t, true); flash(c, a); return 'eliteKill'; }
        slow(F.kill[0], F.kill[1]);
        st.streak = st.streakT > 0 ? st.streak + 1 : 1; st.streakT = F.streak.gap;
        if (st.streak >= F.streak.from) { st.shown = st.streak; return 'streak'; }
        return null;
      }
      if (v.k === 'hurt' && v.dmg >= F.hurt[0] * maxhp) { slow(F.hurt[1], F.hurt[2]); flash(F.hurt[3], F.hurt[4]); return 'hurtBig'; }
      if (v.k === 'level') { flash(F.level[0], F.level[1]); zoom(F.level[2], .5); return null; }
      return null;
    },
    // шаг экрана: dt — настоящие секунды; hpFrac — доля здоровья героя; calm — «уменьшить движение» (без замедления и наезда)
    tick(dt, hpFrac = 1, calm = false) {
      let scale = 1;
      for (let i = st.slows.length - 1; i >= 0; i--) {
        const s = st.slows[i]; s.t -= dt; if (s.t <= 0) { st.slows.splice(i, 1); continue; }
        const k = s.ease ? s.scale + (1 - s.scale) * (1 - s.t / s.T) ** 2 : s.scale;     // плавный выход для элиты и босса
        scale = Math.min(scale, k);
      }
      if (st.zoomT > 0) st.zoomT -= dt; else st.zoom *= Math.exp(-dt * 4);
      st.flashA *= Math.exp(-dt / .12); if (st.flashA < .01) st.flashA = 0;
      if (st.streakT > 0) { st.streakT -= dt; if (st.streakT <= 0) { st.streak = 0; st.shown = 0; } }
      const L = F.low, vig = hpFrac > 0 && hpFrac < L.hp ? clamp01((L.hp - hpFrac) / L.hp) * L.vig + L.vig * .25 : 0;
      let beat = false;
      if (vig > 0) { st.beatT -= dt; if (st.beatT <= 0) { beat = true; st.beatT = L.beat[0] + (L.beat[1] - L.beat[0]) * clamp01((L.hp - hpFrac) / L.hp); } } else st.beatT = 0;
      return { scale: calm ? 1 : scale, zoom: calm ? 0 : st.zoom, flash: { c: st.flashC, a: st.flashA * (calm ? F.calm : 1) }, vig, beat, streak: st.shown };
    },
    state: () => st
  };
}

// что открылось на уровне lv: первые ранги умений героя, новый ранг, место в отряде (для карточки «Новый уровень»)
export function unlocksAt(lv, cfg, abilities) {
  const out = [];
  abilities.forEach((a, i) => { const ranks = rankLvs(cfg, i, a), k = ranks.indexOf(lv); if (k === 0) out.push({ kind: 'ability', name: a.name, icon: a.icon }); else if (k > 0) out.push({ kind: 'rank', name: a.name, rank: k + 1, icon: a.icon }); });
  const S = cfg.squad; if (lv > 1 && lv % S.perLevels === 0 && S.baseMax + lv / S.perLevels <= S.cap) out.push({ kind: 'squad', n: S.baseMax + lv / S.perLevels });
  return out;
}
