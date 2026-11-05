# Проверка: комментарий // посреди кода (после // на той же строке идёт код, правка по куску строки выключила его).
# Без аргументов проверяет весь JS в 3d/src; с аргументами — только указанные файлы. Код возврата 1, если что-то нашлось.
import re, sys, glob
CODE = re.compile(r";\s*(const|let|var|if|for|return|await|[A-Za-z_$][\w$.]*\s*(=|\())|\)\s*\{\s*\w|\}\s*(else|\))|=>\s*\{")
files = sys.argv[1:] or sorted(glob.glob('3d/src/**/*.js', recursive=True))
bad = 0
for f in files:
    for n, l in enumerate(open(f, encoding='utf8'), 1):
        q = None; i = 0
        while i < len(l):
            c = l[i]
            if q:
                if c == '\\': i += 1
                elif c == q: q = None
            elif c in '\'"`': q = c
            elif l.startswith('//', i) and (i == 0 or l[i-1] != ':'):
                if CODE.search(l[i+2:]) and l[:i].strip(): print(f'{f}:{n}: {l.strip()[:150]}'); bad += 1
                break
            i += 1
print('комментарии посреди кода: ' + ('не найдены' if not bad else f'НАЙДЕНО {bad}'))
sys.exit(1 if bad else 0)
