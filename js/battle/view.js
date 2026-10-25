// 배틀 렌더러: 캔버스에 경기장, 팽이, 이펙트를 그린다
import { R } from './engine.js';
import { IMG, spinBlur, darkTop, hasStadium } from '../core/assets.js';
import { TOPS, TYPES, SKILLS } from '../data/tops.js';
import { rand, clamp, TAU } from '../core/util.js';

const STADIUM_THEME = {
  st_playground: { floor: ['#f7e3b5', '#e8c27e', '#c9984f'], rim: ['#ff5a4f', '#ffc531'], ring: 'rgba(160,100,40,.35)', glow: '#ffb84a' },
  st_school: { floor: ['#3f7a5a', '#2c5c44', '#1d3f2f'], rim: ['#b98a4a', '#7a5428'], ring: 'rgba(255,255,255,.28)', glow: '#9df5c0' },
  st_beach: { floor: ['#fbe9c4', '#efd39a', '#d9b46e'], rim: ['#25c4d9', '#0f7f9e'], ring: 'rgba(170,120,60,.35)', glow: '#5ff0ff' },
  st_city: { floor: ['#1c1f3a', '#121428', '#0a0b18'], rim: ['#b0b8d6', '#4a5070'], ring: 'rgba(80,240,255,.35)', glow: '#ff4fe0' },
  st_volcano: { floor: ['#3a2a2a', '#2a1c1c', '#160d0d'], rim: ['#ff6a1a', '#7a1a08'], ring: 'rgba(255,120,40,.35)', glow: '#ff7a1a' },
  st_snow: { floor: ['#e6f6ff', '#bfe4fa', '#8ac4e8'], rim: ['#ffffff', '#9ccbe8'], ring: 'rgba(80,150,200,.35)', glow: '#bff3ff' },
  st_sky: { floor: ['#fffdf5', '#f1ead6', '#d9cca6'], rim: ['#ffd84a', '#c99a1a'], ring: 'rgba(200,160,60,.4)', glow: '#fff1a8' },
  st_chaos: { floor: ['#3a1f4f', '#261338', '#140a20'], rim: ['#2a0f2a', '#0a050c'], ring: 'rgba(255,40,90,.4)', glow: '#ff2a5a' },
  st_tower: { floor: ['#5d6f93', '#43526f', '#2b3550'], rim: ['#ffd23f', '#2a2a2a'], ring: 'rgba(255,255,255,.22)', glow: '#9fd0ff' },
};

// 생성 그림 경기장의 바닥 반지름 비율 (그림 반지름 대비)
const STADIUM_FLOOR = { st_playground: 0.76, st_school: 0.81, st_sky: 0.74, st_beach: 0.8, st_city: 0.8, st_volcano: 0.8, st_snow: 0.8, st_chaos: 0.8, st_tower: 0.8 };

export class BattleView {
  constructor(canvas, opts) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.opts = opts; // { stadium, bg }
    this.parts = [];   // 파티클
    this.texts = [];   // 떠오르는 글자
    this.rings = [];   // 충격파
    this.bolts = [];   // 번개
    this.trails = new Map();
    this.shake = 0; this.flash = 0; this.flashColor = '#fff';
    this.zoom = 1; this.zoomTarget = 1; this.focus = { x: 0, y: 0 };
    this.time = 0;
    this.quality = 1;
    this.resize();
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1) * this.quality;
    const r = this.cv.getBoundingClientRect();
    this.w = Math.max(10, r.width); this.h = Math.max(10, r.height);
    this.cv.width = Math.round(this.w * dpr); this.cv.height = Math.round(this.h * dpr);
    this.dpr = dpr;
    this.layout();
    this.bgCache = null; this.stCache = null;
  }

  // 경기장 위치/크기: 세로 화면은 위쪽, 가로 화면은 가운데
  layout() {
    const w = this.w, h = this.h;
    const top = this.opts.padTop || 0, bottom = this.opts.padBottom || 0;
    const availH = h - top - bottom;
    const size = Math.min(w * 1.0, availH * 0.98);
    this.cx = w / 2; this.cy = top + availH / 2;
    // 바닥 지름을 화면에 맞추고, 그림마다 다른 테두리 두께만큼 그림을 키운다
    const floorDiam = size * 0.86;
    const ratio = hasStadium(this.opts.stadium) ? (STADIUM_FLOOR[this.opts.stadium] || 0.8) : 0.88;
    this.arenaPx = floorDiam / ratio;  // 테두리 포함 지름
    this.scale = (floorDiam / 2) / R;  // 바닥 반지름 = R
  }

  toScreen(x, y) {
    const z = this.zoom;
    return [this.cx + (x - this.focus.x * (z - 1) / z) * this.scale * z, this.cy + (y - this.focus.y * (z - 1) / z) * this.scale * z];
  }
  toWorld(sx, sy) {
    const z = this.zoom;
    return [(sx - this.cx) / (this.scale * z) + this.focus.x * (z - 1) / z, (sy - this.cy) / (this.scale * z) + this.focus.y * (z - 1) / z];
  }

  // ───── 이벤트 → 이펙트 ─────
  handle(ev) {
    switch (ev.type) {
      case 'clash': {
        const n = Math.round(8 + ev.power * 22) * this.quality;
        const col = ev.crit ? '#fff4a0' : '#ffe9b0';
        for (let i = 0; i < n; i++) {
          const a = Math.atan2(ev.ny, ev.nx) + Math.PI / 2 * (Math.random() < .5 ? 1 : -1) + rand(-0.9, 0.9);
          const sp = rand(200, 700) * (0.6 + ev.power);
          this.parts.push({ k: 'spark', x: ev.x, y: ev.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(.18, .42), t: 0, col, w: rand(1.5, 3.2) });
        }
        this.rings.push({ x: ev.x, y: ev.y, r: 6, max: 40 + ev.power * 70, t: 0, life: .28, col: ev.crit ? '#ffe14a' : '#ffffff', w: 5 });
        this.shake = Math.min(1, this.shake + 0.18 + ev.power * 0.32 + (ev.crit ? 0.25 : 0));
        if (ev.crit) { this.flash = 0.35; this.flashColor = '#fff6d0'; }
        break;
      }
      case 'wall': {
        for (let i = 0; i < 8 * this.quality; i++) { const a = rand(TAU); this.parts.push({ k: 'dust', x: ev.x, y: ev.y, vx: Math.cos(a) * rand(30, 120), vy: Math.sin(a) * rand(30, 120), life: rand(.3, .6), t: 0, r: rand(5, 11), col: 'rgba(255,255,255,.5)' }); }
        this.shake = Math.min(1, this.shake + ev.power * 0.2);
        break;
      }
      case 'dmg': {
        if (ev.dmg < 1) break;
        const big = ev.crit;
        this.texts.push({ x: ev.top.x + rand(-14, 14), y: ev.top.y - ev.top.r - 6, vy: -90, t: 0, life: big ? 1.0 : .75, text: '-' + Math.round(ev.dmg).toLocaleString('ko-KR'), size: big ? 30 : 21, col: big ? '#ffd23f' : (ev.top.side === 'p' ? '#ff8b8b' : '#ffffff'), crit: big });
        if (ev.combo >= 3 && ev.src && ev.src.side === 'p') this.texts.push({ x: ev.src.x, y: ev.src.y + ev.src.r + 18, vy: -20, t: 0, life: .8, text: ev.combo + ' 콤보!', size: 20, col: '#7ff0ff' });
        break;
      }
      case 'dash': {
        const t = ev.top;
        for (let i = 0; i < 10 * this.quality; i++) this.parts.push({ k: 'dust', x: t.x + rand(-10, 10), y: t.y + rand(-10, 10), vx: -t.vx * rand(.05, .2), vy: -t.vy * rand(.05, .2), life: rand(.25, .5), t: 0, r: rand(6, 12), col: hexA(TYPES[t.type].color, .45) });
        break;
      }
      case 'skill': {
        const t = ev.top, sk = SKILLS[t.skill] || SKILLS.rush;
        this.rings.push({ x: t.x, y: t.y, r: t.r, max: 160, t: 0, life: .55, col: sk.fx, w: 10 });
        for (let i = 0; i < 40 * this.quality; i++) { const a = rand(TAU); const sp = rand(150, 520); this.parts.push({ k: 'spark', x: t.x, y: t.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(.3, .7), t: 0, col: sk.fx, w: rand(2, 4) }); }
        this.flash = 0.45; this.flashColor = sk.fx;
        this.shake = Math.min(1, this.shake + 0.4);
        if (t.skill === 'tidalGuard' || t.skill === 'rockFortress') this.rings.push({ x: t.x, y: t.y, r: t.r * 2.6, max: t.r * 1.5, t: 0, life: .4, col: sk.fx, w: 6, shrink: true });
        break;
      }
      case 'shockwave': {
        for (let k = 0; k < 3; k++) this.rings.push({ x: ev.x, y: ev.y, r: 20, max: 280 + k * 60, t: -k * 0.08, life: .6, col: SKILLS[ev.top.skill]?.fx || '#fff', w: 14 - k * 3 });
        this.shake = 1; this.flash = 0.5; this.flashColor = SKILLS[ev.top.skill]?.fx || '#fff';
        break;
      }
      case 'bolt': {
        this.bolts.push({ x1: ev.x, y1: ev.y - 420, x2: ev.x, y2: ev.y, t: 0, life: .22, seed: Math.random() });
        this.flash = 0.25; this.flashColor = '#fff7a0';
        this.shake = Math.min(1, this.shake + .3);
        for (let i = 0; i < 14 * this.quality; i++) { const a = rand(TAU); this.parts.push({ k: 'spark', x: ev.x, y: ev.y, vx: Math.cos(a) * rand(150, 450), vy: Math.sin(a) * rand(150, 450), life: rand(.2, .4), t: 0, col: '#fff36a', w: 2.5 }); }
        break;
      }
      case 'petal': {
        for (let i = 0; i < 6; i++) this.parts.push({ k: 'petal', x: ev.from.x, y: ev.from.y, tx: ev.x + rand(-20, 20), ty: ev.y + rand(-20, 20), t: 0, life: .35, rot: rand(TAU), col: i % 2 ? '#ff9fd0' : '#ffd1e8' });
        break;
      }
      case 'teleport': {
        this.rings.push({ x: ev.top.x, y: ev.top.y, r: 60, max: 4, t: 0, life: .3, col: '#b45cff', w: 8, shrink: true });
        break;
      }
      case 'empowerHit': {
        this.rings.push({ x: ev.x, y: ev.y, r: 10, max: 150, t: 0, life: .4, col: SKILLS[ev.top.skill]?.fx || '#fff', w: 12 });
        this.shake = 1;
        break;
      }
      case 'poison': {
        for (let i = 0; i < 12; i++) this.parts.push({ k: 'dust', x: ev.top.x, y: ev.top.y, vx: rand(-60, 60), vy: rand(-120, -20), life: rand(.5, .9), t: 0, r: rand(5, 9), col: 'rgba(120,255,80,.55)' });
        break;
      }
      case 'finish': {
        if (!ev.top) break;
        const t = ev.top;
        if (ev.how === 'burst') {
          // 팽이가 조각나서 흩어진다
          for (let k = 0; k < 4; k++) {
            const a = k / 4 * TAU + rand(-.3, .3);
            this.parts.push({ k: 'shard', id: t.id, x: t.x, y: t.y, vx: Math.cos(a) * rand(260, 420), vy: Math.sin(a) * rand(260, 420), life: 1.6, t: 0, a0: a, rot: rand(TAU), vr: rand(-12, 12), size: t.r * 2 * (t.scale ? 1 : 1) });
          }
          for (let i = 0; i < 60 * this.quality; i++) { const a = rand(TAU); const sp = rand(200, 800); this.parts.push({ k: 'spark', x: t.x, y: t.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(.3, .9), t: 0, col: i % 3 ? '#ffd86a' : '#ffffff', w: rand(2, 4) }); }
          this.rings.push({ x: t.x, y: t.y, r: 10, max: 260, t: 0, life: .7, col: '#ffffff', w: 16 });
          t.burstHidden = true;
        }
        this.shake = 1; this.flash = 0.6; this.flashColor = '#ffffff';
        this.zoomTarget = 1.35; this.focus = { x: t.x * .8, y: t.y * .8 };
        setTimeout(() => { this.zoomTarget = 1; }, 1100);
        break;
      }
      case 'wind': {
        this.windFx = { a: ev.dir, t: 1.4 };
        break;
      }
    }
  }

  update(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 2.4);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt * 6);
    if (this.windFx) this.windFx.t -= dt;
    for (const p of this.parts) {
      p.t += dt;
      if (p.k === 'petal') continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const d = p.k === 'spark' ? 3.5 : p.k === 'shard' ? 1.4 : 2;
      p.vx *= Math.max(0, 1 - d * dt); p.vy *= Math.max(0, 1 - d * dt);
      if (p.k === 'shard') p.rot += p.vr * dt;
    }
    this.parts = this.parts.filter(p => p.t < p.life);
    if (this.parts.length > 420) this.parts.splice(0, this.parts.length - 420);
    for (const t of this.texts) { t.t += dt; t.y += t.vy * dt; t.vy *= 0.92; }
    this.texts = this.texts.filter(t => t.t < t.life);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter(r => r.t < r.life);
    for (const b of this.bolts) b.t += dt;
    this.bolts = this.bolts.filter(b => b.t < b.life);
  }

  // ───── 그리기 ─────
  draw(battle, extra = {}) {
    const g = this.g, dpr = this.dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 배경
    if (!this.bgCache) this.bgCache = this.renderBg();
    g.drawImage(this.bgCache, 0, 0, this.w, this.h);
    // 흔들림
    const sh = this.shake * this.shake * 14;
    g.save();
    if (sh > 0.1) g.translate(rand(-sh, sh), rand(-sh, sh));
    // 경기장
    const z = this.zoom;
    const [scx, scy] = this.toScreen(0, 0);
    const spx = this.arenaPx * z;
    if (!this.stCache) this.stCache = this.renderStadium();
    g.drawImage(this.stCache, scx - spx / 2, scy - spx / 2, spx, spx);
    // 월드 좌표계
    g.save();
    g.translate(scx, scy);
    g.scale(this.scale * z, this.scale * z);
    this.drawPockets(g, battle);
    this.drawRailGlow(g, battle);
    // 바람
    if (this.windFx && this.windFx.t > 0) this.drawWind(g);
    // 그림자
    for (const t of battle.tops) this.drawShadow(g, t);
    // 잔상
    for (const t of battle.tops) this.drawTrail(g, t);
    // 팽이
    const order = [...battle.tops].sort((a, b) => (a.alive ? 1 : 0) - (b.alive ? 1 : 0));
    for (const t of order) this.drawTop(g, t, battle);
    // 발사 준비 표시
    if (extra.launch) this.drawLaunch(g, extra.launch);
    // 이펙트
    this.drawFx(g);
    g.restore();
    g.restore();
    // 화면 번쩍
    if (this.flash > 0) {
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = hexA(this.flashColor, this.flash * 0.55);
      g.fillRect(0, 0, this.w, this.h);
      g.globalCompositeOperation = 'source-over';
    }
    // 슬로모 비네트
    if (battle.slowmo < 0.9) {
      const gr = g.createRadialGradient(this.w / 2, this.h / 2, this.w * .25, this.w / 2, this.h / 2, Math.max(this.w, this.h) * .75);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,10,.55)');
      g.fillStyle = gr; g.fillRect(0, 0, this.w, this.h);
    }
  }

  renderBg() {
    const c = document.createElement('canvas');
    c.width = Math.round(this.w * this.dpr); c.height = Math.round(this.h * this.dpr);
    const g = c.getContext('2d');
    g.scale(this.dpr, this.dpr);
    const im = IMG['bg:' + this.opts.bg] || IMG['bg:keyart'];
    if (im) {
      const s = Math.max(this.w / im.width, this.h / im.height);
      const iw = im.width * s, ih = im.height * s;
      g.filter = 'blur(3px) saturate(1.1)';
      g.drawImage(im, (this.w - iw) / 2, (this.h - ih) / 2, iw, ih);
      g.filter = 'none';
    } else {
      const gr = g.createLinearGradient(0, 0, 0, this.h);
      gr.addColorStop(0, '#1b2a6b'); gr.addColorStop(1, '#070b1d');
      g.fillStyle = gr; g.fillRect(0, 0, this.w, this.h);
    }
    g.fillStyle = 'rgba(6,9,26,.45)'; g.fillRect(0, 0, this.w, this.h);
    const gr = g.createRadialGradient(this.cx, this.cy, this.arenaPx * .3, this.cx, this.cy, Math.max(this.w, this.h) * .8);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,8,.7)');
    g.fillStyle = gr; g.fillRect(0, 0, this.w, this.h);
    // 경기장 조명
    const sp = g.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, this.arenaPx * .7);
    sp.addColorStop(0, 'rgba(255,255,255,.12)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sp; g.fillRect(0, 0, this.w, this.h);
    return c;
  }

  renderStadium() {
    const size = Math.round(this.arenaPx * this.dpr * 1.1);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const id = this.opts.stadium;
    const im = hasStadium(id) && IMG['st:' + id];
    const cx = size / 2, rr = size / 2;
    // 바닥 그림자
    g.fillStyle = 'rgba(0,0,0,.45)';
    g.beginPath(); g.ellipse(cx, cx + rr * 0.05, rr * 0.98, rr * 0.98, 0, 0, TAU); g.fill();
    if (im) {
      g.drawImage(im, 0, 0, size, size);
      return c;
    }
    const th = STADIUM_THEME[id] || STADIUM_THEME.st_playground;
    const floorR = rr * 0.88;
    // 테두리
    const rim = g.createLinearGradient(0, 0, 0, size);
    rim.addColorStop(0, th.rim[0]); rim.addColorStop(1, th.rim[1]);
    g.fillStyle = rim; g.beginPath(); g.arc(cx, cx, rr * 0.985, 0, TAU); g.fill();
    g.lineWidth = rr * 0.02; g.strokeStyle = 'rgba(0,0,0,.55)'; g.stroke();
    // 테두리 볼트/장식
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * TAU;
      g.fillStyle = i % 2 ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.3)';
      g.beginPath(); g.arc(cx + Math.cos(a) * rr * 0.925, cx + Math.sin(a) * rr * 0.925, rr * 0.018, 0, TAU); g.fill();
    }
    // 안쪽 턱
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(cx, cx, floorR * 1.035, 0, TAU); g.fill();
    // 바닥 (그릇 모양 음영)
    const fl = g.createRadialGradient(cx - floorR * 0.15, cx - floorR * 0.2, floorR * 0.05, cx, cx, floorR);
    fl.addColorStop(0, th.floor[0]); fl.addColorStop(0.65, th.floor[1]); fl.addColorStop(1, th.floor[2]);
    g.fillStyle = fl; g.beginPath(); g.arc(cx, cx, floorR, 0, TAU); g.fill();
    // 동심원 가이드
    g.strokeStyle = th.ring; g.lineWidth = rr * 0.006;
    for (const k of [0.22, 0.46, 0.7, 0.92]) { g.beginPath(); g.arc(cx, cx, floorR * k, 0, TAU); g.stroke(); }
    // 중앙 마크
    g.fillStyle = th.ring; g.beginPath(); g.arc(cx, cx, floorR * 0.06, 0, TAU); g.fill();
    // 안쪽 그림자 (깊이감)
    const ish = g.createRadialGradient(cx, cx, floorR * 0.75, cx, cx, floorR);
    ish.addColorStop(0, 'rgba(0,0,0,0)'); ish.addColorStop(1, 'rgba(0,0,0,.35)');
    g.fillStyle = ish; g.beginPath(); g.arc(cx, cx, floorR, 0, TAU); g.fill();
    // 하이라이트
    const hl = g.createLinearGradient(0, cx - floorR, 0, cx);
    hl.addColorStop(0, 'rgba(255,255,255,.18)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hl; g.beginPath(); g.ellipse(cx, cx - floorR * 0.35, floorR * 0.7, floorR * 0.45, 0, 0, TAU); g.fill();
    return c;
  }

  drawPockets(g, b) {
    const pw = 0.36;
    for (const p of b.pockets) {
      g.save();
      g.rotate(p);
      // 구멍
      g.fillStyle = 'rgba(5,3,12,.92)';
      g.beginPath();
      g.arc(0, 0, R + 34, -pw / 2, pw / 2);
      g.arc(0, 0, R - 6, pw / 2, -pw / 2, true);
      g.closePath(); g.fill();
      // 경고 테두리
      const pulse = 0.55 + 0.45 * Math.sin(this.time * 6);
      g.strokeStyle = `rgba(255,70,90,${0.5 + pulse * 0.4})`;
      g.lineWidth = 4;
      g.beginPath(); g.arc(0, 0, R - 6, -pw / 2, pw / 2); g.stroke();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = `rgba(255,60,80,${0.25 * pulse})`; g.lineWidth = 14;
      g.beginPath(); g.arc(0, 0, R - 8, -pw / 2, pw / 2); g.stroke();
      g.globalCompositeOperation = 'source-over';
      // OUT 글자
      g.translate(R + 14, 0); g.rotate(Math.PI / 2);
      g.fillStyle = 'rgba(255,120,130,.9)'; g.font = `400 15px "Black Han Sans"`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('OUT', 0, 0);
      g.restore();
    }
  }

  drawRailGlow(g, b) {
    const th = STADIUM_THEME[this.opts.stadium] || STADIUM_THEME.st_playground;
    for (const t of b.tops) {
      if (!t.alive || !t.onRail) continue;
      const a = Math.atan2(t.y, t.x);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = hexA(th.glow, 0.55);
      g.lineWidth = 8; g.lineCap = 'round';
      g.beginPath(); g.arc(0, 0, R - 4, a - 0.5 * t.dir, a, t.dir < 0); g.stroke();
      g.restore();
    }
  }

  drawWind(g) {
    const a = this.windFx.a, k = clamp(this.windFx.t / 1.4, 0, 1);
    g.save(); g.rotate(a);
    g.strokeStyle = `rgba(220,240,255,${0.35 * k})`; g.lineWidth = 3; g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const y = -R + i * (R * 2 / 8) + Math.sin(this.time * 3 + i) * 10;
      const x = ((this.time * 600 + i * 137) % (R * 2.4)) - R * 1.2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 70, y); g.stroke();
    }
    g.restore();
  }

  drawShadow(g, t) {
    if (t.finish === 'out' && t.outAnim > 0.3) return;
    if (t.burstHidden) return;
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.beginPath(); g.ellipse(t.x + 6, t.y + 9, t.r * 1.02, t.r * 0.92, 0, 0, TAU); g.fill();
  }

  drawTrail(g, t) {
    let tr = this.trails.get(t);
    if (!tr) { tr = []; this.trails.set(t, tr); }
    if (t.alive) { tr.push({ x: t.x, y: t.y }); if (tr.length > 10) tr.shift(); }
    else if (tr.length) tr.shift();
    const sp = Math.hypot(t.vx, t.vy);
    if (tr.length < 3 || sp < 260) return;
    const col = TYPES[t.type].color;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 1; i < tr.length; i++) {
      const k = i / tr.length;
      g.strokeStyle = hexA(col, 0.22 * k * clamp((sp - 260) / 300, 0, 1));
      g.lineWidth = t.r * 1.6 * k;
      g.beginPath(); g.moveTo(tr[i - 1].x, tr[i - 1].y); g.lineTo(tr[i].x, tr[i].y); g.stroke();
    }
    g.restore();
  }

  drawTop(g, t, b) {
    if (t.burstHidden) return;
    const ratio = clamp(t.hp / t.maxHp, 0, 1);
    const size = t.r * 2.25;
    const im = t.dark ? darkTop(t.id) : IMG['top:' + t.id];
    const blur = spinBlur(t.id);
    g.save();
    let x = t.x, y = t.y;
    if (t.alive && t.wob > 0) { x += Math.sin(this.time * 23 + t.i) * t.wob * 6; y += Math.cos(this.time * 19 + t.i) * t.wob * 6; }
    g.translate(x, y);
    // 링아웃: 구멍으로 빠지며 작아짐
    if (t.finish === 'out') { const k = 1 - t.outAnim; g.scale(k, k); g.globalAlpha = k; }
    // 쓰러짐: 기울어진 타원
    if (!t.alive && t.finish !== 'out') { g.scale(1, 1 - t.tilt * 0.38); g.rotate(t.tilt * 0.4); }
    // 오라 (타입 색 / 필살기 준비)
    if (t.alive) {
      const col = TYPES[t.type].color;
      const ready = t.gauge >= 100;
      const ar = size * (ready ? 0.95 + Math.sin(this.time * 8) * 0.06 : 0.78);
      const gr = g.createRadialGradient(0, 0, size * 0.3, 0, 0, ar);
      gr.addColorStop(0, hexA(col, 0)); gr.addColorStop(0.7, hexA(col, ready ? 0.55 : 0.25)); gr.addColorStop(1, hexA(col, 0));
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, ar, 0, TAU); g.fill();
      g.globalCompositeOperation = 'source-over';
      // 편 표시 (내 팽이 = 파랑 링, 적 = 빨강 링)
      g.strokeStyle = t.side === 'p' ? 'rgba(80,190,255,.85)' : t.ally ? 'rgba(120,255,160,.8)' : 'rgba(255,80,100,.75)';
      g.lineWidth = 3; g.setLineDash([10, 8]); g.lineDashOffset = -this.time * 40;
      g.beginPath(); g.arc(0, 0, size * 0.6, 0, TAU); g.stroke(); g.setLineDash([]);
    }
    // 본체
    if (im) {
      const spinVis = t.alive ? clamp(ratio * 1.25, 0, 1) : 0;
      g.rotate(t.ang);
      if (blur && spinVis > 0.05 && !t.dark) { g.globalAlpha *= 1; g.drawImage(blur, -size / 2, -size / 2, size, size); }
      const sharpA = t.alive ? 0.35 + (1 - spinVis) * 0.65 : 1;
      const ga = g.globalAlpha;
      g.globalAlpha = ga * (t.dark ? 1 : sharpA);
      g.drawImage(im, -size / 2, -size / 2, size, size);
      g.globalAlpha = ga;
      // 회전 하이라이트
      if (t.alive && spinVis > 0.2) {
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = `rgba(255,255,255,${0.35 * spinVis})`; g.lineWidth = size * 0.05;
        g.beginPath(); g.arc(0, 0, size * 0.34, 0, 1.1); g.stroke();
        g.beginPath(); g.arc(0, 0, size * 0.34, Math.PI, Math.PI + 1.1); g.stroke();
        g.globalCompositeOperation = 'source-over';
      }
      if (!t.alive && t.finish !== 'out') { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-size, -size, size * 2, size * 2); g.globalCompositeOperation = 'source-over'; }
    } else {
      g.fillStyle = TOPS[t.id]?.color || '#ccc'; g.beginPath(); g.arc(0, 0, t.r, 0, TAU); g.fill();
    }
    g.restore();
    // 상태 이펙트
    if (t.alive) this.drawStatus(g, t, size);
  }

  drawStatus(g, t, size) {
    const f = t.fx;
    g.save(); g.translate(t.x, t.y);
    if (f.shield > 0) {
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(0, 0, size * .4, 0, 0, size * .78);
      gr.addColorStop(0, 'rgba(80,220,255,0)'); gr.addColorStop(1, 'rgba(80,220,255,.55)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, size * .78, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(180,240,255,.8)'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, size * .78, 0, TAU); g.stroke();
    }
    if (f.fort > 0) { g.strokeStyle = 'rgba(230,170,90,.9)'; g.lineWidth = 7; g.beginPath(); g.arc(0, 0, size * .66, 0, TAU); g.stroke(); }
    if (f.slow > 0) { g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(160,230,255,.35)'; g.beginPath(); g.arc(0, 0, size * .62, 0, TAU); g.fill(); }
    if (f.stun > 0) { g.fillStyle = '#ffd23f'; g.font = '400 22px "Black Han Sans"'; g.textAlign = 'center'; g.fillText('기절', 0, -size * .7); }
    if (f.fire > 0 || f.empower > 0) {
      const col = SKILLS[t.skill]?.fx || '#ff7a1a';
      if (Math.random() < 0.8 * this.quality) this.parts.push({ k: 'ember', x: t.x + rand(-t.r, t.r), y: t.y + rand(-t.r, t.r), vx: -t.vx * .1 + rand(-30, 30), vy: -t.vy * .1 + rand(-30, 30), life: rand(.25, .5), t: 0, r: rand(5, 11), col });
    }
    if (f.haste > 0 && Math.random() < 0.6) this.parts.push({ k: 'dust', x: t.x, y: t.y, vx: -t.vx * .2, vy: -t.vy * .2, life: .35, t: 0, r: rand(8, 14), col: 'rgba(200,250,255,.4)' });
    if (f.poison > 0 && Math.random() < 0.3) this.parts.push({ k: 'dust', x: t.x + rand(-10, 10), y: t.y, vx: 0, vy: -50, life: .6, t: 0, r: rand(4, 7), col: 'rgba(120,255,80,.6)' });
    if ((f.regen > 0) && Math.random() < 0.4) this.parts.push({ k: 'plus', x: t.x + rand(-t.r, t.r), y: t.y + rand(-t.r, t.r), vx: 0, vy: -70, life: .7, t: 0 });
    if (f.pull > 0 && f.puller) {
      g.restore(); g.save();
      g.strokeStyle = 'rgba(160,110,255,.6)'; g.lineWidth = 5; g.setLineDash([6, 8]); g.lineDashOffset = this.time * 80;
      g.beginPath(); g.moveTo(t.x, t.y); g.lineTo(f.puller.x, f.puller.y); g.stroke(); g.setLineDash([]);
    }
    g.restore();
  }

  drawLaunch(g, L) {
    // L: { x, y, ring(0~1 수축), target, judge }
    g.save();
    g.translate(L.x, L.y);
    const base = L.r || 40;
    // 목표 원
    g.strokeStyle = 'rgba(255,215,64,.95)'; g.lineWidth = 5;
    g.beginPath(); g.arc(0, 0, base * 1.25, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(255,215,64,.35)'; g.lineWidth = 14;
    g.beginPath(); g.arc(0, 0, base * 1.25, 0, TAU); g.stroke();
    // 줄어드는 원
    if (L.ringR) {
      g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 4;
      g.beginPath(); g.arc(0, 0, L.ringR, 0, TAU); g.stroke();
    }
    g.restore();
  }

  drawFx(g) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      const k = 1 - p.t / p.life;
      if (p.k === 'spark') {
        g.strokeStyle = hexA(p.col, k);
        g.lineWidth = p.w; g.lineCap = 'round';
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); g.stroke();
      } else if (p.k === 'ember') {
        g.fillStyle = hexA(p.col, k * 0.8);
        g.beginPath(); g.arc(p.x, p.y, p.r * k, 0, TAU); g.fill();
      } else if (p.k === 'plus') {
        g.fillStyle = `rgba(140,255,170,${k})`; g.font = '900 20px Pretendard'; g.textAlign = 'center'; g.fillText('+', p.x, p.y);
      }
    }
    g.globalCompositeOperation = 'source-over';
    for (const p of this.parts) {
      const k = 1 - p.t / p.life;
      if (p.k === 'dust') {
        g.fillStyle = p.col; g.globalAlpha = k;
        g.beginPath(); g.arc(p.x, p.y, p.r * (1.5 - k * .5), 0, TAU); g.fill(); g.globalAlpha = 1;
      } else if (p.k === 'petal') {
        const e = p.t / p.life;
        const x = p.x + (p.tx - p.x) * e, y = p.y + (p.ty - p.y) * e - Math.sin(e * Math.PI) * 40;
        g.save(); g.translate(x, y); g.rotate(p.rot + e * 8); g.fillStyle = p.col;
        g.beginPath(); g.ellipse(0, 0, 9, 5, 0, 0, TAU); g.fill(); g.restore();
      } else if (p.k === 'shard') {
        const im = IMG['top:' + p.id];
        if (!im) continue;
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = clamp(k * 1.5, 0, 1);
        g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, p.size / 2, p.a0 - 0.8, p.a0 + 0.8); g.closePath(); g.clip();
        g.drawImage(im, -p.size / 2, -p.size / 2, p.size, p.size);
        g.restore();
      }
    }
    // 충격파
    for (const r of this.rings) {
      if (r.t < 0) continue;
      const e = r.t / r.life;
      const rad = r.shrink ? r.r + (r.max - r.r) * e : r.r + (r.max - r.r) * (1 - Math.pow(1 - e, 3));
      g.strokeStyle = hexA(r.col, (1 - e) * 0.9);
      g.lineWidth = r.w * (1 - e * .6);
      g.beginPath(); g.arc(r.x, r.y, Math.max(1, rad), 0, TAU); g.stroke();
    }
    // 번개
    for (const b of this.bolts) {
      const k = 1 - b.t / b.life;
      g.strokeStyle = `rgba(255,250,170,${k})`; g.lineWidth = 6 * k + 2; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(b.x1, b.y1);
      const segs = 7;
      for (let i = 1; i <= segs; i++) { const e = i / segs; g.lineTo(b.x1 + (b.x2 - b.x1) * e + (i < segs ? Math.sin(b.seed * 99 + i * 7) * 26 : 0), b.y1 + (b.y2 - b.y1) * e); }
      g.stroke();
      g.strokeStyle = `rgba(255,255,255,${k})`; g.lineWidth = 2; g.stroke();
    }
    // 글자
    for (const t of this.texts) {
      const k = t.t / t.life;
      const sc = t.crit ? (k < 0.15 ? 0.6 + k / 0.15 * 0.7 : 1.3 - Math.min(0.3, (k - 0.15) * 1.2)) : (k < 0.1 ? 0.7 + k * 3 : 1);
      g.save(); g.translate(t.x, t.y); g.scale(sc / this.zoom * 1.1, sc / this.zoom * 1.1);
      g.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      g.font = `400 ${t.size}px "Black Han Sans"`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 5; g.strokeStyle = '#0a0f24'; g.strokeText(t.text, 0, 0);
      g.fillStyle = t.col; g.fillText(t.text, 0, 0);
      g.restore();
    }
    g.restore();
  }
}

export function hexA(hex, a) {
  if (hex.startsWith('rgba')) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a, 0, 1)})`;
}
