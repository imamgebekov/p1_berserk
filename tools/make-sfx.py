# Звуки игры (3d/sfx, 2026-10-25): из скачанных файлов CC0 — моно 44,1 кГц, MP3 64 кбит/с, громкость выровнена, у петель стык сглажен.
# Источники и лицензии — 3d/ART-CREDITS.md. Запуск: python3 -I tools/make-sfx.py <папка со скачанным> 3d/sfx
# В папке: birds/, crickets/, rain/, river/, fire/, crow/, wings/x/, anvil/, kimpact/x/Audio, krpg/x/Audio (архивы Kenney и крыльев распакованы в x/).
import subprocess, numpy as np, sys, os, glob
D = sys.argv[1]; OUT = sys.argv[2]; SR = 44100
def load(path, t0=0, t1=None):
    args = ['ffmpeg', '-v', 'error', '-i', path, '-ss', str(t0)] + (['-t', str(t1 - t0)] if t1 else []) + ['-ac', '1', '-ar', str(SR), '-f', 'f32le', '-']
    return np.frombuffer(subprocess.run(args, capture_output=True, check=True).stdout, dtype=np.float32).astype(np.float64)     # float64: с временным float32 громкость выходила неверной
def save(x, name, kbps=64):
    p = os.path.join(OUT, name + '.mp3')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-c:a', 'libmp3lame', '-b:a', f'{kbps}k', p], input=soft(x).astype(np.float32).tobytes(), check=True)
    print(f'{name}.mp3 {len(x)/SR:.1f} c {os.path.getsize(p)//1024} КБ')
def soft(x, k=.8): a = np.abs(x); return np.where(a > k, np.sign(x) * (k + (1 - k) * np.tanh((a - k) / (1 - k))), x)     # мягкий предел вместо среза: треск без хрипа
def rms_norm(x, db): r = np.sqrt(np.mean(np.square(x))) or 1; return x * (10 ** (db / 20) / r)     # np.square, не x ** 2: на Python 3.14 numpy возводил временный массив в квадрат на месте
def peak_norm(x, db=-1.5): p = np.max(np.abs(x)) or 1; return x * (10 ** (db / 20) / p)
def fades(x, a=.01, b=.05): n, m = int(a * SR), int(b * SR); x[:n] *= np.linspace(0, 1, n); x[-m:] *= np.linspace(1, 0, m); return x
def loop(x, xf):     # хвост длиной xf с плавно переходит в начало: петля без щелчка
    n = int(xf * SR); head, body, tail = x[:n], x[n:-n], x[-n:]
    w = np.linspace(0, 1, n); mix = tail * np.sqrt(1 - w) + head * np.sqrt(w)
    return np.concatenate([body, mix])
save(loop(rms_norm(load(f'{D}/birds/birds_wind_ambient.ogg'), -20), 2.0), 'loop_birds')
save(loop(rms_norm(load(f'{D}/crickets/crickets.mp3'), -22), 1.0), 'loop_crickets')
save(loop(rms_norm(load(f'{D}/rain/rain-thunder.ogg', 0, 20.0), -20), 1.5), 'loop_rain')
save(loop(rms_norm(load(f'{D}/river/VistulaShort.mp3', 60, 102), -20), 2.0), 'loop_river')
save(loop(rms_norm(load(f'{D}/fire/fire.wav'), -20), 1.5), 'loop_fire')
th = load(f'{D}/rain/rain-thunder.ogg', 20.2, 42.0)     # гром с дождём под ним
save(fades(peak_norm(th, -2), .05, 5.0), 'thunder')
save(fades(peak_norm(load(f'{D}/crow/crow_caw.wav'))), 'crow')
save(fades(peak_norm(load(f'{D}/wings/x/wings_flap_large.ogg'))), 'wings')
save(fades(peak_norm(load(f'{D}/anvil/forger.ogg'))), 'anvil')
K = f'{D}/kimpact/x/Audio'
for src, dst in [('grass', 'grass'), ('concrete', 'stone'), ('wood', 'wood'), ('snow', 'sand')]:
    for i in range(5): save(fades(peak_norm(load(f'{K}/footstep_{src}_00{i}.ogg'), -3), .002, .03), f'step_{dst}_{i}')
R = f'{D}/krpg/x/Audio'
for src, dst in [('handleCoins', 'coins_0'), ('handleCoins2', 'coins_1'), ('bookOpen', 'book_open'), ('bookClose', 'book_close'), ('bookFlip1', 'book_flip_0'), ('bookFlip2', 'book_flip_1'), ('bookFlip3', 'book_flip_2'),
                 ('cloth1', 'cloth_0'), ('cloth2', 'cloth_1'), ('cloth3', 'cloth_2'), ('beltHandle1', 'belt_0'), ('beltHandle2', 'belt_1'), ('creak1', 'creak_0'), ('creak2', 'creak_1'), ('creak3', 'creak_2'), ('metalLatch', 'latch'), ('dropLeather', 'leather')]:
    save(fades(peak_norm(load(f'{R}/{src}.ogg'), -3), .002, .03), dst)
