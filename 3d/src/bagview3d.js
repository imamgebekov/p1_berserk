// Герой в сумке (2026-10-20, просьба владельца): вместо нарисованного силуэта — 3D-модель героя в надетом: облик по броне
// (look3d.js), оружие и вторая рука, цвет плаща. Свой маленький рендер на холсте сумки; крутится медленно и рисует, только
// пока холст на экране. Без WebGL (тесты, старые устройства) — тихо ничего не делает, остаётся силуэт.
import * as THREE from 'three';
import { makeHero } from './models.js';
import { heroOf } from './data/heroes3d.js';
import { BY_ID } from './data/items.js';
import { dressedLook, lookKey } from './look3d.js';

export function createHeroView(doc) {
  let r = null, scene, cam, hero, raf = 0, key = '', W = null, last = 0;
  const canvas = doc.createElement('canvas'); canvas.className = 'herov'; canvas.width = 240; canvas.height = 320;
  try {
    r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: false });
    r.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1)); r.setSize(240, 320, false);
    scene = new THREE.Scene(); cam = new THREE.PerspectiveCamera(30, 240 / 320, .1, 30); cam.position.set(0, 1.2, 5.2); cam.lookAt(0, .9, 0);
    scene.add(new THREE.HemisphereLight('#ffe8c8', '#3a2a20', 1.6));
    const sun = new THREE.DirectionalLight('#ffd2a0', 1.6); sun.position.set(2, 4, 3); scene.add(sun);
    const rim = new THREE.DirectionalLight('#9ab8ff', .8); rim.position.set(-3, 2, -2); scene.add(rim);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(.75, 40), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: .35 })); disc.rotation.x = -Math.PI / 2; scene.add(disc);
    hero = makeHero(); scene.add(hero.group);
  } catch (e) { r = null; }
  function dress() {
    const inv = W.inv, cp = W.ach && W.ach.cape, wp = inv.eq.weapon && BY_ID[inv.eq.weapon], of = inv.eq.offhand && BY_ID[inv.eq.offhand];
    const k = lookKey(W.hero, inv, cp) + '|' + (inv.eq.weapon || '') + '|' + (inv.eq.offhand || ''); if (k === key) return; key = k;
    hero.setLook(dressedLook(heroOf(W.hero).look, inv, cp));
    hero.setWeapon(wp ? wp.kind : 'fists', wp ? wp.mat : 'steel'); hero.setOff(of ? of.id : '', of && of.kind, of && of.mat, of && of.form);
  }
  function frame(t) {
    raf = 0; if (!r || !W || !canvas.isConnected || canvas.offsetParent === null) return;     // сумка закрыта — не рисуем
    if (globalThis.navigator && navigator.webdriver) { const k0 = key; dress(); if (k0 !== key) r.render(scene, cam); raf = requestAnimationFrame(frame); return; }     // автотесты (программный рендер): кадр только при смене одежды
    if (t - last < 66) { raf = requestAnimationFrame(frame); return; }     // 15 кадров в секунду хватает для медленного поворота
    const dt = Math.min(.2, (t - (last || t)) / 1000); last = t;
    dress(); hero.group.rotation.y += dt * .5; hero.root.position.y = Math.sin(t / 900) * .01;
    r.render(scene, cam); raf = requestAnimationFrame(frame);
  }
  // показать героя мира w в холсте; вызывать при каждой перерисовке сумки
  const show = w => { W = w; if (!r) return null; key = ''; if (!raf) raf = requestAnimationFrame(frame); return canvas; };
  return { show, ok: () => !!r };
}
