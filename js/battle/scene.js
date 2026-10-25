// 배틀 화면: VS 소개 → 발사 → 전투 → 피니시 → 결과
import { Battle, aiControl, R, typeMul } from './engine.js';
import { BattleView } from './view.js';
import { Audio } from '../core/audio.js';
import { Save } from '../core/save.js';
import { h, $, clamp, rand, sleep, vibrate } from '../core/util.js';
import { app, modal, toast, icon, topImg, charImg, typeChip, bigText, btn, rich } from '../core/ui.js';
import { IMG, path } from '../core/assets.js';
import { TOPS, TYPES, SKILLS } from '../data/tops.js';
import { CHARS } from '../data/story.js';

const FINISH = {
  spin: { label: '스핀 피니시', color: '#7ff0ff', pt: 1 },
  out: { label: '아웃 피니시!', color: '#ff8b3d', pt: 2 },
  burst: { label: '버스트 피니시!!', color: '#ffd23f', pt: 2 },
  judge: { label: '판정승', color: '#c9d3ea', pt: 1 },
};

// cfg: { mode, title, stadium, bg, mods, kind, player, allies, foes, points, timeLimit, aiLevel, forceLose, tutorial, intro }
export function runBattle(cfg) {
  return new Promise((resolve) => {
    const s = new BattleScene(cfg, resolve);
    s.start();
  });
}

// 카드에는 짧은 이름 (골목대장 두식 → 두식)
const shortName = (n) => { const p = String(n).split(' '); return p.length > 1 && p[p.length - 1].length >= 2 ? p[p.length - 1] : n; };

class BattleScene {
  constructor(cfg, resolve) {
    this.cfg = cfg;
    this.resolve = resolve;
    this.score = { p: 0, e: 0 };
    this.round = 0;
    this.stats = { skills: 0, perfect: false, maxCombo: 0 };
    this.keys = {};
    this.steer = { x: 0, y: 0 };
    this.auto = !!Save.settings.auto && !cfg.tutorial;
    this.speed = Save.settings.speed || 1;
  }

  start() {
    document.body.classList.add('in-battle');
    const c = this.cfg;
    const root = h('div.screen.battle.enter-fade');
    this.root = root;
    this.canvas = h('canvas.bcv');
    root.append(this.canvas);
    // HUD
    this.hud = h('div.bhud');
    this.cards = h('div.bcards');
    this.center = h('div.bcenter');
    this.hud.append(this.cards, this.center);
    root.append(this.hud);
    // 조작
    this.joy = h('div.joy.hidden', h('div.joy-knob'));
    this.joyHint = h('div.joy-hint', h('div.joy-hint-ring'), h('span', '드래그로 조종'));
    this.dashBtn = h('button.bbtn.dash', h('span.bbtn-in', h('b', '대시'), h('small.key', 'Space')), h('div.cd'));
    this.skillBtn = h('button.bbtn.skill', h('div.gauge'), h('span.bbtn-in', h('b', '필살기'), h('small.key', 'E')));
    this.controls = h('div.bctrl', this.joyHint, this.joy, this.dashBtn, this.skillBtn);
    root.append(this.controls);
    // 상단 우측 버튼
    this.autoBtn = h('button.btog' + (this.auto ? '.on' : ''), 'AUTO');
    this.speedBtn = h('button.btog' + (this.speed > 1 ? '.on' : ''), this.speed > 1 ? 'x2' : 'x1');
    this.pauseBtn = h('button.btog.pause', h('i'), h('i'));
    this.tools = h('div.btools', this.autoBtn, this.speedBtn, this.pauseBtn);
    if (c.tutorial || c.mode === 'prologue') { this.autoBtn.classList.add('hidden'); this.speedBtn.classList.add('hidden'); }
    if (c.mode === 'prologue') this.pauseBtn.classList.add('hidden');
    root.append(this.tools);
    this.overlay = h('div.boverlay');
    root.append(this.overlay);
    app().insertBefore(root, $('#modal-root'));
    this.bindInput();
    this.onResize = () => { this.view && this.view.resize(); this.updateLayout(); };
    window.addEventListener('resize', this.onResize);
    this.onVis = () => { if (document.hidden && this.phase === 'fight' && !this.paused) this.pause(); };
    document.addEventListener('visibilitychange', this.onVis);
    this.updateLayout();
    Audio.playBgm(c.kind === 'boss' || c.final ? 'boss' : 'battle');
    this.intro();
  }

  updateLayout() {
    const r = this.root.getBoundingClientRect();
    this.wide = r.width / r.height > 1.05;
    this.root.classList.toggle('wide', this.wide);
    if (this.view) {
      this.view.opts.padTop = this.wide ? 20 : 104;
      this.view.opts.padBottom = this.wide ? 20 : 150;
      this.view.layout(); this.view.bgCache = null; this.view.stCache = null;
    }
  }

  // ───── VS 소개 ─────
  async intro() {
    const c = this.cfg;
    this.phase = 'intro';
    this.view = new BattleView(this.canvas, { stadium: c.stadium, bg: c.bg, padTop: 104, padBottom: 150 });
    this.updateLayout();
    this.newBattle();
    this.loop();
    if (c.mode === 'prologue') { await sleep(300); this.launchPhase(); return; }
    const p = c.player, foe = c.foes[0];
    const adv = typeMul(p.type, foe.type);
    const advTxt = adv > 1.05 ? ['유리!', 'good'] : adv < 0.95 ? ['불리…', 'bad'] : ['', ''];
    const side = (who, isFoe) => {
      const ch = who.char && CHARS[who.char];
      const img = who.char === 'me' ? charImg(Save.state.avatar === 'girl' ? 'player_girl' : 'player_boy') : ch && ch.img ? charImg(ch.img) : null;
      return h('div.vs-side' + (isFoe ? '.foe' : ''),
        img ? h('div.vs-char', img) : h('div.vs-char.notop'),
        h('div.vs-top', topImg(who.id)),
        h('div.vs-name.display.stroke-s', who.trainer || who.name),
        h('div.vs-sub', typeChip(who.type), h('span.vs-topname', who.name)));
    };
    const foesShown = c.foes.length > 1 ? h('div.vs-multi', c.foes.slice(0, 4).map(f => h('div.vs-mini', topImg(f.id)))) : null;
    const kindLabel = { boss: '보스전 · 3점 먼저!', royale: '난투 · 마지막까지 살아남기', gauntlet: `연속전 · ${c.foes.length}명 연속`, tag: '2:2 태그 배틀', giant: '거대 팽이 · 제한 시간 안에 쓰러뜨리기', rival: '라이벌전' }[c.kind] || '';
    const el = h('div.vs',
      h('div.vs-title.display.stroke-s', c.title || ''),
      kindLabel ? h('div.vs-kind', kindLabel) : null,
      h('div.vs-row', side(p, false), h('div.vs-mark.display', 'VS'), c.foes.length > 1 ? h('div.vs-side.foe', foesShown, h('div.vs-name.display.stroke-s', c.foes.length + '명'), h('div.vs-sub', '모두 쓰러뜨려!')) : side(foe, true)),
      advTxt[0] ? h('div.vs-adv.' + advTxt[1], `상성 ${advTxt[0]}`) : null,
      c.recCp ? h('div.vs-cp', h('span', '추천 전투력 '), h('b', c.recCp.toLocaleString('ko-KR')), h('span', '  ·  내 전투력 '), h('b' + (c.myCp >= c.recCp ? '.ok' : '.low'), c.myCp.toLocaleString('ko-KR'))) : null,
      h('div.vs-btns', c.noBack ? null : h('button.btn-back', { onclick: () => { Audio.sfx('back'); this.finishScene({ cancel: true }); } }, '돌아가기'),
        btn('출전!', 'yellow big', () => { el.classList.add('out'); setTimeout(() => el.remove(), 300); this.launchPhase(); })),
    );
    this.overlay.append(el);
    Audio.sfx('whoosh');
  }

  makeTopDef(u, side, extra = {}) {
    return {
      id: u.id, side, name: u.name, type: u.type, axis: u.axis || u.type, skill: u.skill,
      atk: u.atk, def: u.def, hp: u.hp, spd: u.spd, crit: u.crit, scale: u.scale || 1,
      dark: u.dark, char: u.char, trainer: u.trainer, launch: 1, ...extra,
    };
  }

  newBattle() {
    const c = this.cfg;
    const tops = [this.makeTopDef(c.player, 'p')];
    for (const a of c.allies || []) tops.push(this.makeTopDef(a, 'p', { ally: true }));
    let queue = [];
    if (c.kind === 'gauntlet') { tops.push(this.makeTopDef(c.foes[0], 'e')); queue = c.foes.slice(1).map(f => this.makeTopDef(f, 'e')); }
    else if (c.kind === 'royale') c.foes.forEach((f, i) => tops.push(this.makeTopDef(f, 'e' + i)));
    else c.foes.forEach(f => tops.push(this.makeTopDef(f, 'e')));
    this.battle = new Battle({ tops, timeLimit: c.timeLimit || 45, boss: c.kind === 'boss', mods: c.mods || {} });
    this.battle.queue = queue;
    this.me = this.battle.tops[0];
    this.buildCards();
  }

  buildCards() {
    this.cards.innerHTML = '';
    const b = this.battle;
    const mk = (t, right) => {
      const ch = t.char && CHARS[t.char];
      const face = t.side === 'p' && !t.ally ? charImg(Save.state.avatar === 'girl' ? 'player_girl' : 'player_boy') : ch && ch.img ? charImg(ch.img) : topImg(t.id);
      const card = h('div.bcard' + (right ? '.right' : '') + (t.ally ? '.ally' : ''),
        h('div.bface', face),
        h('div.binfo',
          h('div.bname', h('span', shortName(t.trainer || t.name)), h('i.tdot', { style: { background: TYPES[t.type].color } })),
          h('div.hpbar', h('i.ghost'), h('i.fill'), h('span.hpnum')),
          h('div.gbar', h('i'))));
      t._card = card;
      return card;
    };
    const mine = b.tops.filter(t => t.side === 'p');
    const foes = b.tops.filter(t => t.side !== 'p');
    const left = h('div.bcol', mine.map(t => mk(t, false)));
    const right = h('div.bcol.right', foes.map(t => mk(t, true)));
    this.cards.append(left, right);
    this.cards.classList.toggle('multi', foes.length > 1 || mine.length > 1);
    // 가운데: 타이머 / 점수
    this.center.innerHTML = '';
    this.timerEl = h('div.btimer', { html: '<svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" class="bg"/><circle cx="22" cy="22" r="18" class="fg"/></svg>' });
    this.center.append(this.timerEl);
    if (this.cfg.points) {
      const pips = (side) => h('div.pips' + (side === 'e' ? '.e' : ''), Array.from({ length: this.cfg.points }, (_, i) => h('i' + (i < this.score[side] ? '.on' : ''))));
      this.center.append(h('div.bscore', pips('p'), h('span', ':'), pips('e')));
    }
  }

  // ───── 발사 ─────
  async launchPhase() {
    this.phase = 'launch';
    const t = this.me;
    this.launch = { x: t.x, y: t.y, r: t.r, ringR: 0, judged: false, t0: 0 };
    const cd = h('div.bcount.display.stroke');
    this.overlay.append(cd);
    const showCount = async (txt, big) => {
      cd.textContent = txt; cd.classList.remove('pop'); void cd.offsetWidth; cd.classList.add('pop');
      if (big) cd.classList.add('go'); else cd.classList.remove('go');
    };
    if (this.cfg.tutorial && this.round === 0) this.showTip('원이 노란 원에 겹칠 때 **화면을 탭!**', 4200);
    for (const n of ['3', '2', '1']) { showCount(n); Audio.sfx('count'); await sleep(this.cfg.mode === 'prologue' ? 380 : 480); }
    showCount('고~ 슛!', true); Audio.sfx('go');
    // 줄어드는 원: 탭 타이밍
    this.launch.t0 = performance.now();
    this.launch.active = true;
    const dur = 1150;
    await new Promise(res => {
      this.launchRes = res;
      const tick = () => {
        if (!this.launch || !this.launch.active) return;
        const k = (performance.now() - this.launch.t0) / dur;
        this.launch.ringR = this.launch.r * (2.9 - 2.4 * k);
        if (k >= 1) { this.judgeLaunch(true); return; }
        requestAnimationFrame(tick);
      };
      tick();
      if (this.cfg.mode === 'prologue') setTimeout(() => this.judgeLaunch(false, 1), 700);
    });
    setTimeout(() => cd.remove(), 500);
  }

  judgeLaunch(timeout, force) {
    if (!this.launch || !this.launch.active) return;
    this.launch.active = false;
    let q;
    if (force !== undefined) q = force;
    else if (timeout) q = 1;
    else {
      const diff = Math.abs(this.launch.ringR - this.launch.r * 1.25) / (this.launch.r * 1.25);
      q = diff < 0.13 ? 3 : diff < 0.32 ? 2 : 1;
    }
    if (this.auto && force === undefined && timeout) q = 2;
    const label = ['약함', '굿', '그레이트!', '퍼펙트!!'][q];
    const col = ['#aab', '#9df5ff', '#7dff9a', '#ffd23f'][q];
    if (q === 3) { this.stats.perfect = true; vibrate(40); }
    this.battle.applyLaunch(this.me, q);
    // 상대 발사
    for (const t of this.battle.tops) if (t !== this.me) {
      const lv = this.cfg.aiLevel ?? 0.5;
      const eq = this.cfg.forceLose ? 3 : Math.random() < lv * 0.5 ? 3 : Math.random() < 0.6 ? 2 : 1;
      this.battle.applyLaunch(t, eq);
    }
    Audio.sfx('launch', { quality: q });
    this.view.texts.push({ x: this.me.x, y: this.me.y - 60, vy: -40, t: 0, life: 1.1, text: label, size: q === 3 ? 34 : 26, col, crit: q === 3 });
    if (q >= 2) this.view.rings.push({ x: this.me.x, y: this.me.y, r: 20, max: 120, t: 0, life: .45, col, w: 8 });
    this.launch = null;
    this.phase = 'fight';
    this.fightStart = performance.now();
    if (this.cfg.tutorial && this.round === 0) {
      setTimeout(() => this.showTip('왼쪽을 드래그해서 **팽이를 조종!**', 3500), 600);
      setTimeout(() => this.showTip('**대시**로 들이받고, 게이지가 차면 **필살기!**', 4000), 4600);
    }
    this.launchRes && this.launchRes();
  }

  showTip(text, ms = 3000) {
    const t = h('div.btip', { html: rich(text) });
    this.overlay.append(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
  }

  // ───── 입력 ─────
  bindInput() {
    const root = this.root;
    let joyId = null, ox = 0, oy = 0;
    const joy = this.joy, knob = joy.firstChild;
    const R0 = 56;
    const rootRect = () => root.getBoundingClientRect();
    const down = (e) => {
      if (this.phase === 'launch' && this.launch && this.launch.active) { e.preventDefault(); this.judgeLaunch(false); return; }
      if (this.phase !== 'fight' || this.paused) return;
      if (e.target.closest('.bbtn, .btog, .btn, .btn-back')) return;
      const rr = rootRect();
      const x = e.clientX - rr.left, y = e.clientY - rr.top;
      if (joyId !== null) return;
      joyId = e.pointerId; ox = x; oy = y;
      joy.style.left = x + 'px'; joy.style.top = y + 'px';
      joy.classList.remove('hidden'); this.joyHint.classList.add('hidden');
      knob.style.transform = 'translate(-50%,-50%)';
      try { root.setPointerCapture(e.pointerId); } catch (err) {}
    };
    const move = (e) => {
      if (e.pointerId !== joyId) return;
      const rr = rootRect();
      let dx = e.clientX - rr.left - ox, dy = e.clientY - rr.top - oy;
      const d = Math.hypot(dx, dy);
      if (d > R0) { dx = dx / d * R0; dy = dy / d * R0; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this.steer = { x: dx / R0, y: dy / R0 };
    };
    const up = (e) => {
      if (e.pointerId !== joyId) return;
      joyId = null; this.steer = { x: 0, y: 0 };
      joy.classList.add('hidden');
    };
    root.addEventListener('pointerdown', down);
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', up);
    const press = (b, fn) => b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); fn(); });
    press(this.dashBtn, () => this.doDash());
    press(this.skillBtn, () => this.doSkill());
    press(this.autoBtn, () => { this.auto = !this.auto; this.autoBtn.classList.toggle('on', this.auto); Save.settings.auto = this.auto; Save.saveSettings(); Audio.sfx('tab'); });
    press(this.speedBtn, () => { this.speed = this.speed > 1 ? 1 : 2; this.speedBtn.textContent = this.speed > 1 ? 'x2' : 'x1'; this.speedBtn.classList.toggle('on', this.speed > 1); Save.settings.speed = this.speed; Save.saveSettings(); Audio.sfx('tab'); });
    press(this.pauseBtn, () => this.pause());
    this.onKey = (e) => {
      const k = e.key.toLowerCase();
      if (e.type === 'keydown') {
        if (k === ' ' || k === 'spacebar') { e.preventDefault(); if (this.phase === 'launch') this.judgeLaunch(false); else this.doDash(); }
        if (k === 'e' || k === 'shift' || k === 'ㄷ') this.doSkill();
        if (k === 'escape' || k === 'p') this.pause();
      }
      this.keys[k] = e.type === 'keydown';
    };
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
  }

  doDash() {
    if (this.phase !== 'fight' || this.paused || !this.me.alive) return;
    if (this.me.dashCd > 0) return;
    this.me.wantDash = true;
    Audio.sfx('dash'); vibrate(15);
  }
  doSkill() {
    if (this.phase !== 'fight' || this.paused || !this.me.alive) return;
    if (this.me.gauge < 100) { this.skillBtn.classList.remove('shake-x'); void this.skillBtn.offsetWidth; this.skillBtn.classList.add('shake-x'); return; }
    this.me.wantSkill = true;
  }

  keySteer() {
    const k = this.keys;
    let x = (k['d'] || k['arrowright'] || k['ㅇ'] ? 1 : 0) - (k['a'] || k['arrowleft'] || k['ㅁ'] ? 1 : 0);
    let y = (k['s'] || k['arrowdown'] || k['ㄴ'] ? 1 : 0) - (k['w'] || k['arrowup'] || k['ㅈ'] ? 1 : 0);
    if (x || y) { const l = Math.hypot(x, y); return { x: x / l, y: y / l }; }
    return null;
  }

  pause() {
    if (this.paused || this.phase !== 'fight') return;
    this.paused = true;
    Audio.stopHums();
    modal({ title: '일시정지', color: 'blue', body: h('div.center', { style: { font: '700 16px/1.6 var(--f-body)', color: 'var(--sub)' } }, '잠깐 쉬는 중이야'),
      buttons: [
        { label: '포기하기', cls: 'red', onClick: async () => { this.paused = false; this.endMatch({ winner: 'e', how: 'giveup' }); } },
        { label: '계속하기', cls: 'green', onClick: () => { this.paused = false; this.last = performance.now(); } },
      ] });
  }

  // ───── 메인 루프 ─────
  loop() {
    this.last = performance.now();
    const frame = (now) => {
      if (this.dead) return;
      let dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (!this.paused) this.tick(dt);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  tick(dtRaw) {
    const b = this.battle, v = this.view;
    const dt = dtRaw * (this.phase === 'fight' ? this.speed : 1);
    if (this.phase === 'fight' && !b.over) {
      // 조작
      const ks = this.keySteer();
      if (this.auto) aiControl(b, this.me, 0.7, dt);
      else { const s = ks || this.steer; this.me.steer.x = s.x; this.me.steer.y = s.y; }
      for (const t of b.tops) if (t !== this.me) aiControl(b, t, t.side === 'p' ? 0.6 : (this.cfg.aiLevel ?? 0.5), dt);
      if (this.auto && this.me.gauge >= 100 && Math.random() < 0.05) this.me.wantSkill = true;
      if (this.cfg.forceLose) { this.me.steer.x = 0; this.me.steer.y = 0; }
      b.update(dt);
      for (const ev of b.events) this.onEvent(ev);
      b.events.length = 0;
    } else if (b.over) {
      b.update(dt);
      for (const ev of b.events) this.onEvent(ev);
      b.events.length = 0;
    }
    // 회전음
    if (this.phase === 'fight') for (const t of b.tops.slice(0, 4)) Audio.hum(t.side === 'p' && !t.ally ? 'p' : 'e' + t.i, t.hp / t.maxHp, t.alive && !b.over);
    v.update(dtRaw);
    v.draw(b, { launch: this.launch && this.launch.active ? this.launch : null });
    this.updateHud();
  }

  onEvent(ev) {
    const v = this.view;
    v.handle(ev);
    switch (ev.type) {
      case 'clash': Audio.sfx('clash', { power: ev.power }); if (ev.crit) Audio.sfx('crit'); if (ev.a === this.me || ev.b === this.me) vibrate(ev.power > .6 ? 30 : 12); break;
      case 'wall': if (ev.power > 0.3) Audio.sfx('wall', { power: ev.power }); break;
      case 'dmg': if (ev.src === this.me) this.stats.maxCombo = Math.max(this.stats.maxCombo, ev.combo || 0); break;
      case 'skill': this.cutIn(ev.top); if (ev.top === this.me) this.stats.skills++; break;
      case 'bolt': Audio.sfx('thunder'); break;
      case 'shockwave': Audio.sfx('burst'); break;
      case 'finish': this.onFinish(ev); break;
      case 'nextFoe': this.buildCards(); bigText('다음 상대!', '#7ff0ff', ev.left ? `남은 상대 ${ev.left + 1}` : '마지막 상대'); Audio.sfx('whoosh'); break;
      case 'end': this.onEnd(ev.result); break;
      case 'wind': this.showTip('돌풍이 분다!', 1200); Audio.sfx('wind'); break;
    }
  }

  cutIn(t) {
    const sk = SKILLS[t.skill] || SKILLS.rush;
    Audio.sfx('cutin');
    if (sk.sfx) setTimeout(() => Audio.sfx(sk.sfx), 350);
    const mine = t.side === 'p' && !t.ally;
    const ch = t.char && CHARS[t.char];
    const face = mine ? charImg(Save.state.avatar === 'girl' ? 'player_girl' : 'player_boy') : ch && ch.img ? charImg(ch.img) : null;
    const el = h('div.cutin' + (mine ? '' : '.foe'), { style: { '--c': sk.fx } },
      h('div.cutin-band'),
      face ? h('div.cutin-face', face) : null,
      h('div.cutin-top', topImg(t.id)),
      h('div.cutin-name.display.stroke', sk.name));
    this.overlay.append(el);
    setTimeout(() => el.remove(), 1100);
  }

  onFinish(ev) {
    const f = FINISH[ev.how];
    if (!f) return;
    if (ev.how === 'burst') Audio.sfx('burst');
    else if (ev.how === 'out') Audio.sfx('ringout');
    else Audio.sfx('spinout');
    vibrate([60, 40, 90]);
    // 마지막 상대가 아니면 작게
    const b = this.battle;
    const ending = b.over || !ev.top || ev.top.side === 'p' || b.alive().filter(t => t.side !== 'p').length === 0;
    if (ending || this.cfg.kind === 'royale') bigText(f.label, f.color);
  }

  async onEnd(res) {
    const c = this.cfg;
    await sleep(1300);
    const win = res.winner === 'p';
    if (c.points && res.how !== 'giveup') {
      const pt = FINISH[res.how]?.pt || 1;
      this.score[win ? 'p' : 'e'] += pt;
      this.buildCards();
      if (this.score.p < c.points && this.score.e < c.points) {
        // 다음 라운드
        this.round++;
        const msg = h('div.roundmsg', h('div.display.stroke', win ? `+${pt}점!` : `상대 +${pt}점`), h('div.display.stroke-s', `${this.score.p} : ${this.score.e}`), h('small', '다음 라운드'));
        this.overlay.append(msg);
        Audio.sfx(win ? 'upgrade' : 'deny');
        await sleep(1700);
        msg.remove();
        Audio.stopHums();
        this.newBattle();
        this.launchPhase();
        return;
      }
      this.endMatch({ winner: this.score.p >= c.points ? 'p' : 'e', how: res.how });
      return;
    }
    this.endMatch(res);
  }

  endMatch(res) {
    if (this.ended) return;
    this.ended = true;
    this.phase = 'end';
    Audio.stopHums();
    const win = res.winner === 'p';
    const me = this.me;
    this.finishScene({
      win, how: res.how, hpRatio: me.alive ? me.hp / me.maxHp : 0,
      skills: this.stats.skills, perfect: this.stats.perfect, maxCombo: this.stats.maxCombo,
      score: { ...this.score },
    });
  }

  finishScene(result) {
    this.result = result;
    this.resolve({ ...result, scene: this });
  }

  // 결과 화면은 호출한 쪽에서 내용(보상)을 채운다
  showResult(build) {
    const el = h('div.bresult');
    this.overlay.append(el);
    build(el);
    return el;
  }

  close() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    Audio.stopHums();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    document.removeEventListener('visibilitychange', this.onVis);
    document.body.classList.remove('in-battle');
    this.root.classList.add('leave-fade');
    setTimeout(() => this.root.remove(), 280);
  }

  updateHud() {
    const b = this.battle;
    for (const t of b.tops) {
      const c = t._card; if (!c) continue;
      const r = clamp(t.hp / t.maxHp, 0, 1);
      const fill = c.querySelector('.fill'), ghost = c.querySelector('.ghost');
      fill.style.width = (r * 100) + '%';
      fill.style.background = r > 0.5 ? 'linear-gradient(180deg,#8dffa9,#29c95a)' : r > 0.25 ? 'linear-gradient(180deg,#ffe27a,#ffae00)' : 'linear-gradient(180deg,#ff8f9c,#e3283f)';
      t._ghost = t._ghost === undefined ? r : Math.max(r, t._ghost - 0.008);
      ghost.style.width = (t._ghost * 100) + '%';
      c.querySelector('.hpnum').textContent = Math.max(0, Math.ceil(t.hp)).toLocaleString('ko-KR');
      c.querySelector('.gbar i').style.width = t.gauge + '%';
      c.classList.toggle('dead', !t.alive);
      c.classList.toggle('ready', t.gauge >= 100 && t.alive);
      c.classList.toggle('over', t.overspin > 0 && t.alive);
    }
    // 타이머 (숫자 없이 원으로)
    const k = clamp(1 - b.t / b.timeLimit, 0, 1);
    const fg = this.timerEl.querySelector('.fg');
    fg.style.strokeDashoffset = String(113.1 * (1 - k));
    this.timerEl.classList.toggle('low', k < 0.2);
    // 버튼
    const me = this.me;
    this.dashBtn.classList.toggle('cool', me.dashCd > 0);
    this.dashBtn.querySelector('.cd').style.height = clamp(me.dashCd / 2.4, 0, 1) * 100 + '%';
    this.skillBtn.style.setProperty('--g', (me.gauge / 100 * 360) + 'deg');
    this.skillBtn.classList.toggle('ready', me.gauge >= 100 && me.alive);
    this.controls.classList.toggle('off', this.phase !== 'fight' || !me.alive);
  }
}
