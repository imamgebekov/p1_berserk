// Внешний вид предметов на герое. Цвета берутся из pal предмета (data/items.js), здесь — форма и эффект.
//
// weapon: kind — blade (прямой), curved (дугой), cleaver (тесак, расширяется к концу), slab (плита), great (двуручный),
//         serrated (зубчатый), axe (топор);  len — длина от рукояти, px (влияет на дальность удара);
//         w — ширина клинка;  guard — cross | wide | none;  fx — sparks | ember | curse | brand
// head:   kind — hood | helm | mask | crown;  horns, skull
// body:   kind — rags | leather | mail | plate | hide | shroud;  glow — светящееся клеймо
// cloak:  len — длина плаща, w — ширина, kind — rag | trav | ash | raven | tatter | flow
// amulet / ring: glow — мерцание
export const DEFAULT_WEAPON = { kind: 'blade', len: 29, w: 2, guard: 'cross' };
export const DEFAULT_STEEL = ['#cfc9bb', '#7d776b'];

export const LOOKS = {
  w_rust_cleaver: { kind: 'cleaver', len: 26, w: 4, guard: 'none' },
  w_forged_sabre: { kind: 'curved', len: 30, w: 2, guard: 'cross' },
  w_iron_slab: { kind: 'slab', len: 30, w: 4, guard: 'none' },
  w_bone_edge: { kind: 'serrated', len: 29, w: 2, guard: 'none', fx: 'sparks' },
  w_ember_edge: { kind: 'blade', len: 32, w: 2, guard: 'cross', fx: 'ember' },
  w_widow_blade: { kind: 'great', len: 36, w: 3, guard: 'wide', fx: 'curse' },
  w_eclipse_sting: { kind: 'axe', len: 34, w: 2, guard: 'none', fx: 'curse' },
  w_brand_giant: { kind: 'great', len: 42, w: 4, guard: 'wide', fx: 'brand' },

  h_leather_hood: { kind: 'hood' },
  h_iron_helm: { kind: 'helm' },
  h_bone_oracle: { kind: 'helm', skull: true },
  h_horned_helm: { kind: 'helm', horns: true },
  h_hanged_mask: { kind: 'mask' },
  h_brand_crown: { kind: 'crown', glow: true },

  b_torn_shirt: { kind: 'rags' },
  b_leather_vest: { kind: 'leather' },
  b_chainmail: { kind: 'mail' },
  b_brute_hide: { kind: 'hide' },
  b_widow_shroud: { kind: 'shroud' },
  b_brand_plate: { kind: 'plate', glow: true },

  c_sackcloth: { kind: 'rag', len: 8, w: 3 },
  c_wanderer: { kind: 'trav', len: 10, w: 4 },
  c_ash_cloak: { kind: 'ash', len: 11, w: 4, fx: 'ash' },
  c_raven: { kind: 'raven', len: 11, w: 4 },
  c_hanged_cape: { kind: 'tatter', len: 13, w: 4 },
  c_crimson: { kind: 'flow', len: 13, w: 5, glow: true },

  a_beast_fang: {}, a_charred: {}, a_bone_charm: {}, a_eclipse_eye: { glow: true }, a_black_tear: { glow: true }, a_brand_seal: { glow: true },
  r_copper: {}, r_bone_ring: {}, r_ash_ring: { glow: true }, r_silver: {}, r_widow_ring: { glow: true }, r_brand_ring: { glow: true }
};

// Длина клинка надетого оружия (или стартового меча) — влияет на дальность удара
export const weaponLen = eq => (eq.weapon ? LOOKS[eq.weapon.id].len : DEFAULT_WEAPON.len);
