// 화면 전환, 팝업, 토스트, 숫자 카운트업, 코인 날리기
import { h, $, sleep, clamp } from './util.js';
import { Audio } from './audio.js';
import { path, hasIcon, IMG } from './assets.js';
import { TOPS, RARITY, TYPES } from '../data/tops.js';

export const app = () => $('#app');

// ───────── 아이콘 (생성 이미지가 없으면 SVG로 대체) ─────────
const SVG = {
  home: `<svg viewBox="0 0 64 64"><path d="M14 28 L32 13 L50 28 V54 a3 3 0 0 1 -3 3 H17 a3 3 0 0 1 -3 -3z" fill="#ffcf3a" stroke="#141a3a" stroke-width="3.5" stroke-linejoin="round"/><path d="M8 30 L32 9 L56 30" fill="none" stroke="#141a3a" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 30 L32 9 L56 30" fill="none" stroke="#ff5468" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><rect x="26" y="38" width="12" height="19" rx="3" fill="#7a3ae6" stroke="#141a3a" stroke-width="3"/><circle cx="21" cy="36" r="3.5" fill="#fff"/></svg>`,
  upgrade: `<svg viewBox="0 0 64 64"><g transform="rotate(-38 32 32)"><rect x="28" y="20" width="8" height="38" rx="3" fill="#b9762a" stroke="#141a3a" stroke-width="3"/><rect x="14" y="8" width="36" height="16" rx="4" fill="#c9d3ea" stroke="#141a3a" stroke-width="3.5"/><rect x="14" y="8" width="10" height="16" rx="3" fill="#8a93b8" stroke="#141a3a" stroke-width="3"/></g><path d="M46 38 l4 8 9 1 -6.5 6 1.6 9 -8.1-4.3 -8.1 4.3 1.6-9 -6.5-6 9-1z" fill="#ffd23f" stroke="#6b4300" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
  coin: `<svg viewBox="0 0 64 64"><defs><radialGradient id="gc" cx=".35" cy=".3"><stop offset="0" stop-color="#fff7b0"/><stop offset=".45" stop-color="#ffd23f"/><stop offset="1" stop-color="#d98a00"/></radialGradient></defs><circle cx="32" cy="34" r="27" fill="#8a5200"/><circle cx="32" cy="30" r="27" fill="url(#gc)" stroke="#5a3500" stroke-width="3"/><circle cx="32" cy="30" r="19" fill="none" stroke="#b86e00" stroke-width="3" opacity=".7"/><path d="M32 17 l5 9 -5 15 -5 -15z" fill="#b86e00" opacity=".85"/></svg>`,
  gem: `<svg viewBox="0 0 64 64"><path d="M14 22 L24 10 H40 L50 22 L32 56 Z" fill="#c13cff" stroke="#3b0a5c" stroke-width="3" stroke-linejoin="round"/><path d="M14 22 H50 L32 56Z" fill="#9a1fe0"/><path d="M24 10 L28 22 H14Z M40 10 L36 22 H50Z" fill="#e58bff"/><path d="M28 22 L32 10 L36 22Z" fill="#f6c6ff"/><path d="M28 22 L32 56 L22 22Z" fill="#b032f0" opacity=".8"/></svg>`,
  xp: `<svg viewBox="0 0 64 64"><path d="M32 6 l7.6 15.4 17 2.5 -12.3 12 2.9 16.9L32 44.8 16.8 52.8l2.9-16.9-12.3-12 17-2.5z" fill="#ffd23f" stroke="#6b4300" stroke-width="3" stroke-linejoin="round"/></svg>`,
  settings: `<svg viewBox="0 0 64 64"><path d="M27 6h10l2 7 6 3 7-3 7 7-3 7 3 6 7 2v10l-7 2-3 6 3 7-7 7-7-3-6 3-2 7H27l-2-7-6-3-7 3-7-7 3-7-3-6-7-2V27l7-2 3-6-3-7 7-7 7 3 6-3z" transform="scale(.82) translate(7 7)" fill="#c9d3ea" stroke="#1d2547" stroke-width="3.5" stroke-linejoin="round"/><circle cx="32" cy="32" r="9" fill="#1d2547"/></svg>`,
  mission: `<svg viewBox="0 0 64 64"><rect x="12" y="10" width="40" height="48" rx="7" fill="#f4e1b8" stroke="#3a2a10" stroke-width="3"/><rect x="22" y="6" width="20" height="10" rx="4" fill="#b98a4a" stroke="#3a2a10" stroke-width="3"/><path d="M20 36 l8 8 16-18" fill="none" stroke="#2bb34f" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  calendar: `<svg viewBox="0 0 64 64"><rect x="8" y="12" width="48" height="44" rx="8" fill="#fff" stroke="#2a1a1a" stroke-width="3"/><path d="M8 20a8 8 0 0 1 8-8h32a8 8 0 0 1 8 8v6H8z" fill="#ff4f63" stroke="#2a1a1a" stroke-width="3"/><path d="M32 30l3.5 7 7.5 1-5.5 5.2 1.4 7.6L32 47.2l-6.9 3.6 1.4-7.6L21 38l7.5-1z" fill="#ffc531" stroke="#6b4300" stroke-width="2"/></svg>`,
  roulette: `<svg viewBox="0 0 64 64"><circle cx="32" cy="34" r="25" fill="#fff" stroke="#1d2547" stroke-width="3"/><path d="M32 34 L32 9 A25 25 0 0 1 53.6 21.5Z" fill="#ff4f63"/><path d="M32 34 L53.6 21.5 A25 25 0 0 1 53.6 46.5Z" fill="#ffc531"/><path d="M32 34 L53.6 46.5 A25 25 0 0 1 32 59Z" fill="#3fa2ff"/><path d="M32 34 L32 59 A25 25 0 0 1 10.4 46.5Z" fill="#42d66b"/><path d="M32 34 L10.4 46.5 A25 25 0 0 1 10.4 21.5Z" fill="#b45cff"/><path d="M32 34 L10.4 21.5 A25 25 0 0 1 32 9Z" fill="#ff9f43"/><circle cx="32" cy="34" r="25" fill="none" stroke="#1d2547" stroke-width="3"/><circle cx="32" cy="34" r="5" fill="#1d2547"/><path d="M26 4h12l-6 10z" fill="#ffd23f" stroke="#1d2547" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
  training: `<svg viewBox="0 0 64 64"><rect x="6" y="26" width="8" height="14" rx="3" fill="#5a6390" stroke="#141a3a" stroke-width="2.5"/><rect x="50" y="26" width="8" height="14" rx="3" fill="#5a6390" stroke="#141a3a" stroke-width="2.5"/><rect x="12" y="20" width="9" height="26" rx="3" fill="#ff5468" stroke="#141a3a" stroke-width="2.5"/><rect x="43" y="20" width="9" height="26" rx="3" fill="#ff5468" stroke="#141a3a" stroke-width="2.5"/><rect x="20" y="30" width="24" height="6" rx="3" fill="#c9d3ea" stroke="#141a3a" stroke-width="2.5"/></svg>`,
  friend: `<svg viewBox="0 0 64 64"><circle cx="22" cy="22" r="10" fill="#3fa2ff" stroke="#10183a" stroke-width="3"/><path d="M6 54c0-12 7-18 16-18s16 6 16 18z" fill="#3fa2ff" stroke="#10183a" stroke-width="3"/><circle cx="43" cy="22" r="10" fill="#ff9f43" stroke="#10183a" stroke-width="3"/><path d="M27 54c0-12 7-18 16-18s16 6 16 18z" fill="#ff9f43" stroke="#10183a" stroke-width="3"/></svg>`,
  tower: `<svg viewBox="0 0 64 64"><path d="M18 58V22h28v36z" fill="#8a93b8" stroke="#141a3a" stroke-width="3"/><path d="M14 22V12h6v5h6v-5h12v5h6v-5h6v10z" fill="#a8b1d4" stroke="#141a3a" stroke-width="3" stroke-linejoin="round"/><rect x="27" y="40" width="10" height="18" rx="5" fill="#2a3060" stroke="#141a3a" stroke-width="2.5"/><path d="M32 12V2l10 4-10 4" fill="#ff4f63" stroke="#141a3a" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
  boss: `<svg viewBox="0 0 64 64"><path d="M10 10c4 10 8 14 14 16M54 10c-4 10-8 14-14 16" fill="none" stroke="#e8e0d0" stroke-width="6" stroke-linecap="round"/><path d="M14 30c0-10 8-16 18-16s18 6 18 16v8c0 10-8 18-18 18S14 48 14 38z" fill="#c8203a" stroke="#2a0610" stroke-width="3"/><path d="M20 34l9 3-1 5-8-3zM44 34l-9 3 1 5 8-3z" fill="#ffd23f"/></svg>`,
  chest: `<svg viewBox="0 0 64 64"><path d="M8 28h48v26a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4z" fill="#b9762a" stroke="#3a2008" stroke-width="3"/><path d="M8 28c0-10 8-16 24-16s24 6 24 16z" fill="#d48a32" stroke="#3a2008" stroke-width="3"/><rect x="6" y="26" width="52" height="7" fill="#ffc531" stroke="#3a2008" stroke-width="3"/><rect x="27" y="30" width="10" height="12" rx="2" fill="#ffd23f" stroke="#3a2008" stroke-width="3"/></svg>`,
  lock: `<svg viewBox="0 0 64 64"><path d="M20 28v-8a12 12 0 0 1 24 0v8" fill="none" stroke="#d5dbee" stroke-width="7"/><rect x="12" y="28" width="40" height="30" rx="7" fill="#ffc531" stroke="#3a2a00" stroke-width="3"/><circle cx="32" cy="42" r="5" fill="#3a2a00"/></svg>`,
  ring: `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="20" fill="none" stroke="#ff5468" stroke-width="10"/><path d="M32 4l6 10h-12zM60 32l-10 6v-12zM32 60l-6-10h12zM4 32l10-6v12z" fill="#e6ebf5" stroke="#1d2547" stroke-width="2.5" stroke-linejoin="round"/><circle cx="32" cy="32" r="20" fill="none" stroke="#1d2547" stroke-width="2.5"/></svg>`,
  disc: `<svg viewBox="0 0 64 64"><ellipse cx="32" cy="36" rx="26" ry="16" fill="#1f62d6" stroke="#0b1a40" stroke-width="3"/><ellipse cx="32" cy="30" rx="26" ry="16" fill="#9fb4d8" stroke="#0b1a40" stroke-width="3"/><ellipse cx="32" cy="30" rx="8" ry="5" fill="#0b1a40"/><circle cx="18" cy="29" r="3" fill="#0b1a40"/><circle cx="46" cy="29" r="3" fill="#0b1a40"/></svg>`,
  axis: `<svg viewBox="0 0 64 64"><rect x="20" y="8" width="24" height="12" rx="4" fill="#42d66b" stroke="#0b2a14" stroke-width="3"/><path d="M24 20h16l-4 22h-8z" fill="#c9d3ea" stroke="#1d2547" stroke-width="3" stroke-linejoin="round"/><path d="M28 42h8l-4 16z" fill="#8a93b8" stroke="#1d2547" stroke-width="3" stroke-linejoin="round"/></svg>`,
};
const ICON_ALIAS = { xp: 'xp_star', settings: 'icon_settings', mission: 'icon_mission', calendar: 'icon_calendar', roulette: 'icon_roulette', training: 'icon_training', friend: 'icon_friend', boss: 'icon_boss', ring: 'part_ring', disc: 'part_disc', axis: 'part_axis', tower: 'tab_challenge' };

export function icon(name, cls = 'ic') {
  const file = ICON_ALIAS[name] || name;
  if (hasIcon(file)) return h('img.' + cls, { src: path.icon(file), alt: '', draggable: 'false' });
  const s = SVG[name] || SVG[file] || SVG.coin;
  const span = h('span.' + cls, { html: s, style: { display: 'inline-block', lineHeight: 0 } });
  span.firstChild.setAttribute('width', '100%'); span.firstChild.setAttribute('height', '100%');
  return span;
}

export function topImg(id, cls = 'top') { return h('img.' + cls, { src: path.top(id), alt: TOPS[id]?.name || '', draggable: 'false' }); }
export function charImg(id, cls = '') { return h('img' + (cls ? '.' + cls : ''), { src: path.char(id), alt: '', draggable: 'false' }); }

export function typeChip(type) { return h('span.type-chip.' + type, TYPES[type].short); }
export function rarChip(r) { return h('span.rar-chip', { style: { background: RARITY[r].color } }, RARITY[r].name); }
export function starsEl(n, max = 5) {
  const s = h('span.stars');
  for (let i = 0; i < max; i++) s.append(h('span' + (i < n ? '' : '.off'), '★'));
  return s;
}

// 강조 표기: **글자** → <b>
export function rich(text) {
  const esc = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return esc.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

// ───────── 화면 전환 ─────────
let current = null;
export const Screens = {};
export function registerScreen(name, factory) { Screens[name] = factory; }

export async function go(name, params = {}, dir = 'right') {
  const factory = Screens[name];
  if (!factory) return;
  const root = app();
  const el = factory(params);
  el.dataset.screen = name;
  if (current) {
    const old = current.el;
    old.classList.add(dir === 'fade' ? 'leave-fade' : dir === 'left' ? 'leave-right' : 'leave-left');
    if (current.cleanup) try { current.cleanup(); } catch (e) {}
    setTimeout(() => old.remove(), 300);
  }
  el.classList.add(dir === 'fade' ? 'enter-fade' : dir === 'left' ? 'enter-left' : 'enter-right');
  root.insertBefore(el, $('#modal-root'));
  current = { name, el, cleanup: el._cleanup };
  if (el._onShow) el._onShow();
  updateVersionPos();
  return el;
}
export function currentScreen() { return current?.name; }

export function updateVersionPos() {
  const v = $('.version');
  if (!v) return;
  v.classList.toggle('up', !!(current && current.el.querySelector('.tabbar')));
}

// ───────── 팝업 ─────────
export function modal({ title, color = '', body, buttons = [], closable = false, onClose, cls = '' }) {
  const root = $('#modal-root');
  const wrap = h('div.modal-wrap');
  const foot = h('div.modal-foot');
  const close = (v) => {
    if (wrap._closed) return; wrap._closed = true;
    wrap.classList.add('closing');
    setTimeout(() => wrap.remove(), 180);
    onClose && onClose(v);
  };
  for (const b of buttons) {
    const btn = h('button.btn' + (b.cls ? '.' + b.cls.split(' ').join('.') : ''), { onclick: async () => {
      Audio.sfx('click');
      if (b.onClick) { const r = await b.onClick(btn, close); if (r === false) return; }
      close(b.value);
    } }, b.label);
    foot.append(btn);
  }
  const m = h('div.modal' + (cls ? '.' + cls : ''),
    title ? h('div.modal-head' + (color ? '.' + color : ''), title) : null,
    h('div.panel', { style: { display: 'flex', flexDirection: 'column', minHeight: 0 } },
      h('div.modal-body', body), buttons.length ? foot : null));
  wrap.append(m);
  if (closable) wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) { Audio.sfx('back'); close(null); } });
  root.append(wrap);
  return { close, el: m, wrap };
}

export function confirmBox(text, okLabel = '확인', cancel = '돌아가기', color = '') {
  return new Promise(res => {
    modal({ title: '확인', color, body: h('div', { style: { font: '700 17px/1.55 var(--f-body)', textAlign: 'center', padding: '6px 4px 4px', wordBreak: 'keep-all' }, html: rich(text) }),
      buttons: [{ label: cancel, cls: 'ghost', value: false }, { label: okLabel, cls: color === 'red' ? 'red' : 'green', value: true }], onClose: (v) => res(!!v) });
  });
}

export function toast(text, kind = '') {
  const root = $('#toast-root');
  const t = h('div.toast' + (kind ? '.' + kind : ''), { html: rich(text) });
  root.append(t);
  while (root.children.length > 3) root.firstChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 1900);
}

// 회색 버튼을 눌렀을 때: 흔들고 이유 표시
export function deny(el, reason) {
  Audio.sfx('deny');
  if (el) { el.classList.remove('shake-x'); void el.offsetWidth; el.classList.add('shake-x'); }
  if (reason) toast(reason, 'warn');
}

// ───────── 숫자 카운트업 (1.5초 이내) ─────────
export function countTo(el, from, to, dur = 900) {
  if (el._countRaf) cancelAnimationFrame(el._countRaf);
  const t0 = performance.now();
  dur = Math.min(1500, dur);
  const step = (now) => {
    const k = clamp((now - t0) / dur, 0, 1);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(from + (to - from) * e).toLocaleString('ko-KR');
    if (k < 1) el._countRaf = requestAnimationFrame(step);
    else { el.textContent = Math.round(to).toLocaleString('ko-KR'); el._countRaf = null; }
  };
  el._countRaf = requestAnimationFrame(step);
}

// ───────── 코인/보석이 날아가서 들어가는 연출 ─────────
export async function flyTo(kind, fromEl, toEl, count = 8) {
  const root = app();
  const rr = root.getBoundingClientRect();
  const a = fromEl ? fromEl.getBoundingClientRect() : { left: rr.width / 2 + rr.left - 15, top: rr.height / 2 + rr.top, width: 30, height: 30 };
  const b = toEl ? toEl.getBoundingClientRect() : { left: rr.left + 20, top: rr.top + 20, width: 20, height: 20 };
  const sx = a.left - rr.left + a.width / 2 - 15, sy = a.top - rr.top + a.height / 2 - 15;
  const ex = b.left - rr.left + b.width / 2 - 15, ey = b.top - rr.top + b.height / 2 - 15;
  const n = clamp(count, 3, 14);
  const jobs = [];
  for (let i = 0; i < n; i++) {
    const f = h('div.flyer', icon(kind === 'gems' ? 'gem' : 'coin'));
    root.append(f);
    const ang = Math.random() * Math.PI * 2, rad = 30 + Math.random() * 50;
    const mx = sx + Math.cos(ang) * rad, my = sy + Math.sin(ang) * rad;
    const delay = i * 45;
    jobs.push(new Promise(res => {
      f.animate([
        { transform: `translate(${sx}px,${sy}px) scale(.4)`, opacity: 0 },
        { transform: `translate(${mx}px,${my}px) scale(1.15)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${ex}px,${ey}px) scale(.7)`, opacity: 1 },
      ], { duration: 720, delay, easing: 'cubic-bezier(.5,0,.7,1)', fill: 'both' }).onfinish = () => {
        f.remove();
        Audio.sfx(kind === 'gems' ? 'gem' : 'coin', { pitch: i % 5 });
        if (toEl) { toEl.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 160 }); }
        res();
      };
    }));
  }
  await Promise.all(jobs);
}

// 큰 글자 연출 (화면 가운데 팡!)
export function bigText(text, color = '#ffd23f', sub = '') {
  const el = h('div', { style: { position: 'absolute', inset: '0', zIndex: 70, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' } },
    h('div.display.stroke', { style: { fontSize: '52px', color, textAlign: 'center', lineHeight: '1.05', textShadow: '0 6px 0 #070b1c' } }, text),
    sub ? h('div.display.stroke-s', { style: { fontSize: '20px', marginTop: '8px' } }, sub) : null);
  app().append(el);
  el.animate([{ transform: 'scale(.3) rotate(-8deg)', opacity: 0 }, { transform: 'scale(1.15) rotate(2deg)', opacity: 1, offset: .35 }, { transform: 'scale(1)', opacity: 1, offset: .7 }, { transform: 'scale(1.05)', opacity: 0 }], { duration: 1400, easing: 'ease-out', fill: 'both' }).onfinish = () => el.remove();
}

// 버튼 공용: 누르면 클릭음
export function btn(label, cls, onClick, attrs = {}) {
  const b = h('button.btn' + (cls ? '.' + cls.split(' ').join('.') : ''), { ...attrs, onclick: (e) => { Audio.sfx('click'); onClick && onClick(e, b); } }, label);
  return b;
}
export function backBtn(onClick) {
  return h('button.btn-back', { onclick: () => { Audio.sfx('back'); onClick(); } }, '돌아가기');
}

export { sleep };
