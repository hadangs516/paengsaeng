// 공용 유틸
import { Save } from './save.js';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
export const TAU = Math.PI * 2;

export const ease = {
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inCubic: t => t * t * t,
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1,
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
};

// 큰 숫자 보기 좋게: 1,234 / 12.3만 / 1.2억
export function fmt(n) {
  n = Math.floor(n);
  if (n < 100000) return n.toLocaleString('ko-KR');
  if (n < 100000000) return (n / 10000).toFixed(n < 1000000 ? 1 : 0).replace(/\.0$/, '') + '만';
  if (n < 1e12) return (n / 1e8).toFixed(n < 1e9 ? 2 : 1).replace(/\.?0+$/, '') + '억';
  return (n / 1e12).toFixed(2).replace(/\.?0+$/, '') + '조';
}

// 가중치 랜덤: [{w, ...}]
export function weighted(list, key = 'w') {
  const total = list.reduce((s, x) => s + x[key], 0);
  let r = Math.random() * total;
  for (const x of list) { r -= x[key]; if (r <= 0) return x; }
  return list[list.length - 1];
}

export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

// 간단한 DOM 생성: h('div.cls#id', {attrs}, children...)
export function h(tag, attrs, ...kids) {
  const m = tag.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
  const el = document.createElement(m[1] || 'div');
  (m[2].match(/[.#][\w-]+/g) || []).forEach(s => { if (s[0] === '.') el.classList.add(s.slice(1)); else el.id = s.slice(1); });
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) { if (k == null || k === false) continue; el.append(k instanceof Node ? k : document.createTextNode(String(k))); }
  return el;
}

export function vibrate(ms) { try { if (Save.settings.vib !== false && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
