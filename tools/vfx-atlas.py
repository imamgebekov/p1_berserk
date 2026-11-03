# Атлас спрайтов эффектов 3d/models/vfx_atlas.webp из Kenney Particle Pack (CC0, 2026-11-03).
# Запуск: python3 tools/vfx-atlas.py <папка PNG из kenney_particlePack.zip>. Порядок ячеек = номера спрайтов в 3d/src/fx3d.js и abfx3d.js (ячейка 0 — мягкая точка).
import math, sys
from PIL import Image
NAMES = ['circle_05', 'flare_01', 'flame_03', 'flame_05', 'fire_01', 'magic_02', 'magic_04', 'smoke_04', 'smoke_07', 'spark_01', 'spark_05', 'star_04', 'star_07', 'slash_02', 'trace_03', 'twirl_02', 'light_02', 'symbol_01', 'muzzle_03', 'scorch_02', 'dirt_02', 'spark_07', 'magic_01', 'flame_01']
src = sys.argv[1]; S = 96; N = 5; M = int(S * .86); at = Image.new('RGB', (S * N, S * N), (0, 0, 0))
for i, n in enumerate(NAMES, 1):
    im = Image.open(f'{src}/{n}.png').convert('RGBA'); bg = Image.new('RGBA', im.size, (0, 0, 0, 255)); bg.alpha_composite(im); g = bg.convert('RGB').resize((M, M), Image.LANCZOS); px = g.load()
    for y in range(M):
        for x in range(M):
            k = min(1, min(x, y, M - 1 - x, M - 1 - y) / (M * .12)); r, gg, b = px[x, y]; px[x, y] = (int(r * k), int(gg * k), int(b * k))     # мягкий край: чёрная кайма без швов
    t = Image.new('RGB', (S, S)); t.paste(g, ((S - M) // 2, (S - M) // 2)); at.paste(t, ((i % N) * S, (i // N) * S))
d = Image.new('RGB', (S, S)); px = d.load()
for y in range(S):
    for x in range(S): v = int(255 * max(0, 1 - math.hypot(x - S / 2 + .5, y - S / 2 + .5) / (S / 2)) ** 1.6); px[x, y] = (v, v, v)
at.paste(d, (0, 0)); at.save('3d/models/vfx_atlas.webp', quality=92)
