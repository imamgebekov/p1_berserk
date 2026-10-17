// Качество картинки (шаг 14 аудита): пресеты «Авто / Низкое / Среднее / Высокое» и подстройка разрешения для «Авто».
// Чистые функции (проверяются в Node).

export const QUALITY_IDS = ['auto', 'low', 'mid', 'high'];
export const QUALITY_NAMES = { auto: 'Авто', low: 'Низкое', mid: 'Среднее', high: 'Высокое' };

// настройки пресета: разрешение, густота травы, столбы света, тени (тени — только на компьютере)
export function qualityOf(cfg, id, desk) {
  const Q = cfg.view.quality, base = Q[id === 'auto' ? 'mid' : id] || Q.mid;
  return { ...base, shadows: !!(base.shadows && desk), auto: id === 'auto' };
}

// «Авто»: копит длительности кадров; раз в A.every с — шаг разрешения по p95 (выше down — вниз, ниже up — вверх);
// первые A.warm с после старта и рывки дольше A.stall мс не считаются
export function makeAutoRes(A) {
  let t = 0, acc = 0; const ms = [];
  return {
    // dt — секунд с прошлого кадра, scale — текущее разрешение; вернёт новое разрешение (или то же)
    frame(dt, scale) {
      t += dt; if (t < A.warm) return scale;
      const f = dt * 1000; if (f < A.stall) ms.push(f);
      if ((acc += dt) < A.every) return scale;
      acc = 0; if (ms.length < 20) { ms.length = 0; return scale; }
      const s = [...ms].sort((a, b) => a - b), p95 = s[Math.floor(s.length * .95)]; ms.length = 0;
      if (p95 > A.down) return Math.max(A.lo, +(scale - A.step).toFixed(2));
      if (p95 < A.up) return Math.min(A.hi, +(scale + A.step).toFixed(2));
      return scale;
    }
  };
}
