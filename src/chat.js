// Чат — только данные в состоянии; HUD рисует их сам.
import { CFG } from './config.js';
import { W, P } from './state.js';
import { ri, pick } from './util.js';

export const NPC_NAMES = ['Сокол47', 'Тень_Лазарь', 'Мясник', 'Ворон', 'Пепельная', 'kraken_77'];
export const NPC_COLORS = ['#9aa5ad', '#c9a56a', '#8fb4d6', '#b88a9a', '#a3b58f', '#c4a0d0'];
export const IDLE_LINES = [
  'кто идёт на Предвестника?', 'продам клейменый обломок, недорого', 'рогачи сегодня злые', 'у костра безопасно, не бойтесь',
  'затмение скоро, чувствуете?', 'наконец-то взял уровень', 'новичок с большим мечом, держись левее',
  'фармлю пепел, мимо не проходите', 'кто-нибудь видел, откуда они лезут?', 'gg', 'опять ничего не выпало',
  'не стойте у края, они прыгают', 'держитесь вместе', 'я тут просто посижу у огня'
];

// kind: 'sys' — системная строка, 'npc' — реплика «игрока», 'me' — реплика героя
export function chat(name, text, kind, col) {
  W.chatLog.push({ id: ++W.chatSeq, name, text, kind: kind || '', col: col || '#d8cfbd', born: W.T });
  while (W.chatLog.length > CFG.chat.maxLines) W.chatLog.shift();
}

export function npcSay(text) {
  if (!W.npcs.length) return;
  const n = W.npcs[ri(0, W.npcs.length - 1)];
  chat(n.name, text, 'npc', n.col);
}

export const idleLine = () => pick(IDLE_LINES);
export const playerLevel = () => P.lv;
