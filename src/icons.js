// Пиксельные иконки предметов 12×12, рисуются на canvas кодом.
// Символы: . пусто, o контур, a основной цвет предмета, b акцент, h светлый блик, x тёмная пустота.
const BITMAPS = {
  sword: [
    '..........ha', '.........haa', '........haa.', '.......haa..', '......haa...', '.b...haa....',
    '..b.haa.....', '...bbb......', '...bb.......', '..oob.......', '.oo.........', 'oo..........'],
  great: [
    '.....ha.....', '....hhaa....', '....hhaa....', '....hhaa....', '....hhaa....', '....hhaa....',
    '....hhaa....', '..bbbbbbbb..', '.....oo.....', '.....oo.....', '.....oo.....', '....bbbb....'],
  axe: [
    '....aaaa....', '...aaaaah...', '..aaaaaaah..', '..aaaaaaoh..', '...aaaaao...', '....aaao....',
    '.....oo.....', '.....oo.....', '.....oo.....', '.....oo.....', '.....bb.....', '.....bb.....'],
  hood: [
    '....oooo....', '...oaaaao...', '..oaaaaaao..', '..oaaaaaao..', '.oaaaxxaaao.', '.oaaxxxxaao.',
    '.oaaxxxxaao.', '.oaaxxxxaao.', '.oaaaxxaaao.', '.oaaa..aaao.', '.ooo....ooo.', '............'],
  helm: [
    '....oooo....', '...ohhaao...', '..ohaaaaao..', '..oaaaaaao..', '..oaaaaaao..', '..obbbbbbo..',
    '..oxxbbxxo..', '..oxxbbxxo..', '..oaaaaaao..', '..oa....ao..', '..oo....oo..', '............'],
  body: [
    '..oo....oo..', '.oaao..oaao.', '.oaaooooaao.', '.oaaaaaaaao.', '.oaabbbbaao.', '..oaabbaao..',
    '..oaaaaaao..', '..oaabbaao..', '..oaaaaaao..', '..oaaaaaao..', '..oooooooo..', '............'],
  cloak: [
    '...oooooo...', '..obbbbbbo..', '..oaaaaaao..', '.oaaaaaaaao.', '.oaaahhaaao.', '.oaaaaaaaao.',
    '.oaaaaaaaao.', 'oaaaaaaaaaao', 'oaaaaaaaaaao', 'oaaaoaaoaaao', 'oaao.oo.oaao', 'oo........oo'],
  amulet: [
    '..o......o..', '..o......o..', '...o....o...', '...o....o...', '....o..o....', '....o..o....',
    '.....oo.....', '....obbo....', '...obhhbo...', '...obaabo...', '....obbo....', '.....oo.....'],
  ring: [
    '............', '.....oo.....', '....ohho....', '....obbo....', '...oooooo...', '..oaaaaaao..',
    '.oaao..oaao.', '.oao....oao.', '.oao....oao.', '.oaao..oaao.', '..oaaaaaao..', '...oooooo...']
};

const lighten = (hex, t) => {
  const n = parseInt(hex.slice(1), 16);
  const f = v => Math.round(v + (255 - v) * t);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

export const ICON_SIZE = 12;

// Рисует иконку в готовый canvas 12×12. dim — приглушённый силуэт (пустой слот).
export function drawIcon(canvas, icon, pal, dim = false) {
  const bm = BITMAPS[icon];
  if (!bm) return;
  canvas.width = canvas.height = ICON_SIZE;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, ICON_SIZE, ICON_SIZE);
  const col = { o: '#050303', a: pal[0], b: pal[1], h: lighten(pal[0], .55), x: '#0b0908' };
  for (let y = 0; y < ICON_SIZE; y++) {
    const row = bm[y];
    for (let x = 0; x < ICON_SIZE; x++) {
      const c = row[x];
      if (c === '.') continue;
      g.fillStyle = dim ? '#5a4a3d' : col[c];
      g.fillRect(x, y, 1, 1);
    }
  }
}

export const ICON_KEYS = Object.keys(BITMAPS);
export const SLOT_ICON = { weapon: 'sword', head: 'helm', body: 'body', cloak: 'cloak', amulet: 'amulet', ring: 'ring' };
