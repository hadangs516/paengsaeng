// 배틀 시뮬레이션 (DOM 없음). 렌더러는 events 배열을 읽어 이펙트를 만든다.
// 좌표: 경기장 중심 (0,0), 반지름 R. 단위는 "px 같은 월드 단위".

import { clamp, rand, TAU } from '../core/util.js';

export const TYPE_ADV = { atk: 'sta', sta: 'def', def: 'atk' }; // 공격>지구>방어>공격
export function typeMul(a, b) {
  if (TYPE_ADV[a] === b) return 1.15;
  if (TYPE_ADV[b] === a) return 0.9;
  if (a === 'bal' && b !== 'bal') return 1.08;
  return 1;
}

// 축(이동 패턴) 프리셋
// petal: 꽃잎 궤적 (주기적으로 중앙을 가로지름) 크기, pf: 그 주기
const AXIS = {
  atk: { drive: 230, center: 1.25, damp: 0.75, grip: 0.9, jitter: 50, petal: 1.15, pf: 2.6 },
  def: { drive: 60, center: 2.2, damp: 1.2, grip: 1.6, jitter: 20, petal: 0.3, pf: 1.5 },
  sta: { drive: 50, center: 2.6, damp: 0.85, grip: 1.85, jitter: 15, petal: 0.2, pf: 1.2 },
  bal: { drive: 115, center: 1.8, damp: 0.8, grip: 1.15, jitter: 35, petal: 0.75, pf: 2.0 },
};

export const R = 300;          // 경기장 반지름
const SLOPE = 1.25;            // 그릇 경사(중심으로 끌림)
const POCKET_W = 0.36;         // 아웃 포켓 각도 폭(rad)
const K = 1.3;                 // 피해 계수
const DECAY = { atk: 1.0, def: 1.05, sta: 0.6, bal: 0.9 };
export const dmgBase = (a, d) => (a.atk * a.atk) / (a.atk + d.def) * K;

export class Battle {
  constructor({ tops, pockets = 3, timeLimit = 45, boss = false, mods = {} }) {
    this.mods = mods;
    if (mods.pockets) pockets = mods.pockets;
    this.windT = 3; this.wind = { x: 0, y: 0, t: 0 };
    this.t = 0;
    this.timeLimit = timeLimit;
    this.events = [];
    this.over = false;
    this.result = null;
    this.slowmo = 1;
    this.hitstop = 0;
    this.boss = boss;
    // 아웃 포켓 위치
    this.pockets = [];
    const off = rand(TAU);
    for (let i = 0; i < pockets; i++) this.pockets.push((off + (i / pockets) * TAU) % TAU);
    this.tops = tops.map((d, i) => this.makeTop(d, i, tops.length));
    this.started = false;
    this.timers = [];
  }

  // 시뮬레이션 시간 기준 타이머 (탭 비활성/히트스톱에도 안전)
  later(delay, fn) { this.timers.push({ at: this.t + delay, fn }); }
  realLater(delay, fn) { this.timers.push({ real: delay, fn }); }
  every(count, interval, fn) { for (let i = 0; i < count; i++) this.later(interval * i, () => fn(i)); }
  runTimers(dt, dtReal) {
    if (!this.timers.length) return;
    const due = [];
    this.timers = this.timers.filter(tm => {
      if (tm.real !== undefined) { tm.real -= dtReal; if (tm.real <= 0) { due.push(tm.fn); return false; } return true; }
      if (tm.at <= this.t) { due.push(tm.fn); return false; } return true;
    });
    due.forEach(fn => fn());
  }

  makeTop(d, i, n) {
    // d: { id, side, name, type, axis, atk, def, hp, spd, crit, skill, scale, img, launch(0~3), ai, lvl }
    if (this.startOff === undefined) this.startOff = rand(-0.5, 0.5);
    const ang = (n === 2 ? (i === 0 ? Math.PI / 2 : -Math.PI / 2 + rand(-0.7, 0.7)) : (i / n) * TAU + Math.PI / 2) + (i === 0 ? 0 : this.startOff);
    const dist = R * 0.72;
    const launchMul = [0.85, 1.0, 1.1, 1.22][d.launch ?? 1];
    const r = 46 * (d.scale || 1);
    const ax = AXIS[d.axis || d.type] || AXIS.bal;
    const t = {
      ...d, i,
      x: Math.cos(ang) * dist, y: Math.sin(ang) * dist,
      vx: 0, vy: 0,
      r, mass: (1 + d.def / (d.def + d.atk + 1)) * (d.scale || 1) * (d.axis === 'def' || d.type === 'def' ? 1.18 : 1),
      maxHp: d.hp, hp: d.hp * Math.min(1, launchMul), launchMul, overspin: 0,
      ang: rand(TAU), dir: d.dir || 1,
      axisP: ax,
      gauge: d.launch === 3 ? 35 : 0,
      dashCd: 0.8, alive: true, finish: null,
      fx: { shield: 0, haste: 0, slow: 0, fort: 0, poison: 0, poisonDps: 0, empower: 0, stun: 0, pull: 0, drainDps: 0, fire: 0, petals: 0, bolts: 0, regen: 0 },
      lastHit: -9, combo: 0, comboT: 0,
      steer: { x: 0, y: 0 }, wantDash: false, wantSkill: false,
      wob: 0, tilt: 0, outAnim: 0,
      dealt: 0, hits: 0, crits: 0,
    };
    // 발사 초기속도: 접선 방향 + 약간 안쪽
    const tang = ang + Math.PI / 2 * t.dir;
    const sp = 230 * launchMul * (d.side === 'p' ? 1 : rand(0.85, 1.15));
    t.vx = Math.cos(tang) * sp - Math.cos(ang) * 80;
    t.vy = Math.sin(tang) * sp - Math.sin(ang) * 80;
    return t;
  }

  emit(e) { this.events.push(e); }

  alive() { return this.tops.filter(t => t.alive); }

  update(dtReal) {
    if (this.over) { this.tickVisual(dtReal); return; }
    if (this.hitstop > 0) { this.hitstop -= dtReal; return; }
    const dt = Math.min(0.033, dtReal) * this.slowmo;
    this.t += dt;
    this.runTimers(dt, Math.min(0.05, dtReal));
    const steps = 3; // 서브스텝으로 충돌 안정화
    for (let s = 0; s < steps; s++) this.step(dt / steps);
    this.checkEnd();
  }

  tickVisual(dt) {
    for (const t of this.tops) {
      t.ang += t.dir * (t.alive ? 18 : 2) * dt;
      if (!t.alive && t.finish === 'out') t.outAnim = Math.min(1, t.outAnim + dt * 1.6);
      if (!t.alive) { t.vx *= 0.9; t.vy *= 0.9; t.x += t.vx * dt; t.y += t.vy * dt; t.tilt = Math.min(1, t.tilt + dt * 2); }
    }
  }

  step(dt) {
    const tops = this.tops;
    if (this.mods.pocketSpin) this.pockets = this.pockets.map(p => (p + this.mods.pocketSpin * dt) % TAU);
    if (this.mods.wind) {
      this.wind.t -= dt; this.windT -= dt;
      if (this.windT <= 0) { const a = rand(TAU); this.wind = { x: Math.cos(a), y: Math.sin(a), t: 1.4 }; this.windT = rand(5, 8); this.emit({ type: 'wind', dir: a }); }
    }
    for (const t of tops) {
      if (!t.alive) {
        // 쓰러진 팽이 미끄러짐
        t.vx *= Math.pow(0.1, dt); t.vy *= Math.pow(0.1, dt);
        t.x += t.vx * dt; t.y += t.vy * dt;
        if (t.finish === 'out') t.outAnim = Math.min(1, t.outAnim + dt * 1.6);
        t.tilt = Math.min(1, t.tilt + dt * 2.5);
        continue;
      }
      const ratio = t.hp / t.maxHp;
      const f = t.fx;
      for (const k of ['shield', 'haste', 'slow', 'fort', 'poison', 'empower', 'stun', 'pull', 'fire', 'petals', 'regen']) if (f[k] > 0) f[k] = Math.max(0, f[k] - dt);
      // 회전 감소 (지구력)
      let decay = t.maxHp * (1 / 70) * (DECAY[t.type] || 1) * (this.mods.decay || 1);
      if (f.haste > 0) decay *= 0.2;
      if (f.fort > 0) decay = -t.maxHp * 0.02;
      if (f.regen > 0) decay = -t.maxHp * 0.04;
      t.hp -= decay * dt;
      if (f.poison > 0) { this.damage(t, f.poisonDps * dt, null, { silent: true, dot: true }); }
      if (t.hp > t.maxHp) t.hp = t.maxHp;
      // 필살 게이지 자연 충전
      t.gauge = Math.min(100, t.gauge + dt * 4.5);
      t.dashCd = Math.max(0, t.dashCd - dt);
      if (t.overspin > 0) t.overspin = Math.max(0, t.overspin - dt);
      t.comboT = Math.max(0, t.comboT - dt); if (t.comboT === 0) t.combo = 0;

      // 힘 계산
      const ax = t.axisP;
      const d = Math.hypot(t.x, t.y) || 0.001;
      const nx = t.x / d, ny = t.y / d;
      let fx = -t.x * SLOPE * ax.center, fy = -t.y * SLOPE * ax.center;
      // 회전 구동력: 접선 방향 (드리프트 궤도)
      const drive = ax.drive * (0.35 + 0.65 * ratio) * (f.haste > 0 ? 2 : 1) * (f.slow > 0 || f.stun > 0 ? 0.15 : 1);
      // 접선 방향을 안쪽으로 주기적으로 꺾어서 꽃잎 모양 궤적을 만든다
      const cut = ax.petal * (0.5 + 0.5 * Math.sin(this.t * ax.pf + t.i * 1.7));
      const tgx = -ny * t.dir, tgy = nx * t.dir;
      fx += (tgx * Math.cos(cut) - nx * Math.sin(cut)) * drive;
      fy += (tgy * Math.cos(cut) - ny * Math.sin(cut)) * drive;
      // 비틀거림 (회전 약할수록)
      const wob = ratio < 0.35 ? (0.35 - ratio) * 900 : 0;
      t.wob = ratio < 0.35 ? (0.35 - ratio) / 0.35 : 0;
      fx += rand(-1, 1) * (ax.jitter + wob); fy += rand(-1, 1) * (ax.jitter + wob);
      // 조작 (기울이기)
      if (f.stun <= 0) {
        const steerPow = 620 * (0.6 + t.spd / 100 * 0.6) * (f.slow > 0 ? 0.35 : 1) * (f.haste > 0 ? 1.5 : 1);
        fx += t.steer.x * steerPow; fy += t.steer.y * steerPow;
      }
      // 블랙홀 등 끌어당김
      if (f.pull > 0 && f.puller) {
        const p = f.puller; const dx = p.x - t.x, dy = p.y - t.y, dd = Math.hypot(dx, dy) || 1;
        fx += dx / dd * 900; fy += dy / dd * 900;
        this.damage(t, f.drainDps * dt, p, { silent: true, dot: true });
        p.hp = Math.min(p.maxHp, p.hp + f.drainDps * dt * 0.5);
      }
      // 대시 레일: 가장자리를 따라 돌면 가속 (공격형이 잘 탐)
      if (d > R * 0.78) {
        const tv = (-ny * t.vx + nx * t.vy) * t.dir;
        if (tv > 140 && tv < 520) { const boost = 150 * (this.mods.rail || 1) * (ax.drive / 230); fx += -ny * boost * t.dir; fy += nx * boost * t.dir; t.onRail = true; } else t.onRail = false;
      } else t.onRail = false;
      if (this.wind.t > 0) { fx += this.wind.x * 520; fy += this.wind.y * 520; }
      const foe = this.nearestFoe(t);
      if (foe) { const ex = foe.x - t.x, ey = foe.y - t.y, ed = Math.hypot(ex, ey) || 1; if (ed < 190) { const pull = 260 * (1 - ed / 190) + 60; fx += ex / ed * pull; fy += ey / ed * pull; } }
      const damp = ax.damp * (f.slow > 0 ? 3 : 1) * (f.fort > 0 ? 2 : 1) * (this.mods.damp || 1);
      t.vx += fx * dt; t.vy += fy * dt;
      t.vx *= Math.max(0, 1 - damp * dt); t.vy *= Math.max(0, 1 - damp * dt);
      // 대시
      if (t.wantDash && t.dashCd <= 0 && f.stun <= 0) {
        t.wantDash = false;
        let dx = t.steer.x, dy = t.steer.y;
        if (Math.hypot(dx, dy) < 0.2) { const e = this.nearestFoe(t); if (e) { dx = e.x - t.x; dy = e.y - t.y; } }
        const dl = Math.hypot(dx, dy) || 1;
        const pow = 560 * (0.75 + t.spd / 100 * 0.5);
        t.vx = t.vx * 0.3 + dx / dl * pow; t.vy = t.vy * 0.3 + dy / dl * pow;
        t.dashCd = 2.4; t.dashT = 0.35;
        this.emit({ type: 'dash', top: t });
      }
      t.wantDash = false;
      if (t.dashT > 0) t.dashT -= dt;
      // 필살기
      if (t.wantSkill && t.gauge >= 100 && f.stun <= 0) { this.castSkill(t); }
      t.wantSkill = false;
      // 속도 제한
      const sp = Math.hypot(t.vx, t.vy), maxSp = (t.dashT > 0 || f.empower > 0 ? 1000 : 640) * (f.haste > 0 ? 1.3 : 1);
      if (sp > maxSp) { t.vx *= maxSp / sp; t.vy *= maxSp / sp; }
      t.x += t.vx * dt; t.y += t.vy * dt;
      // 회전 각도 (보이는 회전속도)
      t.ang += t.dir * (6 + 34 * ratio) * dt;
      // 벽 / 포켓
      const d2 = Math.hypot(t.x, t.y);
      if (d2 + t.r > R) {
        const nx2 = t.x / d2, ny2 = t.y / d2;
        const vOut = t.vx * nx2 + t.vy * ny2;
        const a = (Math.atan2(t.y, t.x) + TAU) % TAU;
        const inPocket = this.pockets.some(p => angDiff(a, p) < POCKET_W / 2);
        // 체력이 많을수록 잘 안 빠진다 (초반에 허무하게 지는 일 방지)
        const outThresh = 300 * (t.axisP.grip) * (f.fort > 0 ? 3 : 1) * (t.scale || 1) * (0.7 + 0.9 * ratio);
        // 맞고 튕겨 나갔거나 비틀거릴 때만 아웃 (혼자 빠지는 억울함 방지)
        const knocked = this.t - (t.hitAt ?? -9) < 0.8 || ratio < 0.22;
        if (inPocket && knocked && vOut > outThresh && this.t > 1.2) {
          this.kill(t, 'out', t.lastAttacker);
          continue;
        }
        // 벽 반사
        t.x = nx2 * (R - t.r); t.y = ny2 * (R - t.r);
        if (vOut > 0) {
          t.vx -= (1.55) * vOut * nx2; t.vy -= (1.55) * vOut * ny2;
          if (vOut > 160) {
            this.emit({ type: 'wall', x: t.x + nx2 * t.r, y: t.y + ny2 * t.r, power: clamp(vOut / 600, 0, 1), top: t });
            this.damage(t, t.maxHp * 0.006 * (vOut / 300) * (this.mods.wallDmg || 1), null, { silent: (this.mods.wallDmg || 1) < 2 });
          }
        }
      }
    }
    // 팽이끼리 충돌
    for (let i = 0; i < tops.length; i++) for (let j = i + 1; j < tops.length; j++) {
      const a = tops[i], b = tops[j];
      if (!a.alive || !b.alive) continue;
      if (a.side === b.side) continue;
      this.collide(a, b);
    }
  }

  nearestFoe(t) {
    let best = null, bd = 1e9;
    for (const o of this.tops) if (o.alive && o.side !== t.side) { const d = Math.hypot(o.x - t.x, o.y - t.y); if (d < bd) { bd = d; best = o; } }
    return best;
  }

  collide(a, b) {
    let dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 0.01;
    const minD = a.r + b.r;
    if (d >= minD) return;
    const nx = dx / d, ny = dy / d;
    // 겹침 해소
    const ma = a.mass * (a.fx.fort > 0 ? 3 : 1), mb = b.mass * (b.fx.fort > 0 ? 3 : 1);
    const pen = minD - d;
    a.x -= nx * pen * (mb / (ma + mb)); a.y -= ny * pen * (mb / (ma + mb));
    b.x += nx * pen * (ma / (ma + mb)); b.y += ny * pen * (ma / (ma + mb));
    const rvx = a.vx - b.vx, rvy = a.vy - b.vy;
    const vn = rvx * nx + rvy * ny; // 양수면 서로 접근
    const key = a.i * 31 + b.i;
    this.pairCd = this.pairCd || {};
    const last = this.pairCd[key] || -9;
    const ra = a.hp / a.maxHp, rb = b.hp / b.maxHp;
    // 회전 반발 (팽이 특유의 튕김)
    const rep = 260 * (0.4 + 0.6 * (ra + rb) / 2);
    let j = 0;
    if (vn > 0) j = (1 + 0.8) * vn / (1 / ma + 1 / mb);
    const jr = rep / (1 / ma + 1 / mb) * 0.016 * 60 * 0.12;
    const shieldA = a.fx.shield > 0, shieldB = b.fx.shield > 0;
    const J = j + jr;
    // 돌진 중인 쪽은 덜 튕겨 나간다 (밀고 들어감)
    const ka = a.dashT > 0 || a.fx.empower > 0 ? 0.75 : 1, kb = b.dashT > 0 || b.fx.empower > 0 ? 0.75 : 1;
    a.vx -= (J / ma) * nx * ka * (shieldA ? 0.3 : 1) * (shieldB ? 1.8 : 1); a.vy -= (J / ma) * ny * ka * (shieldA ? 0.3 : 1) * (shieldB ? 1.8 : 1);
    b.vx += (J / mb) * nx * kb * (shieldB ? 0.3 : 1) * (shieldA ? 1.8 : 1); b.vy += (J / mb) * ny * kb * (shieldB ? 0.3 : 1) * (shieldA ? 1.8 : 1);
    // 접선 마찰 (같은 방향 회전이면 서로 밀어냄)
    const tx = -ny, ty = nx;
    const tk = 70 * (a.dir === b.dir ? 1 : -0.4);
    a.vx += tx * tk / ma; a.vy += ty * tk / ma; b.vx -= tx * tk / mb; b.vy -= ty * tk / mb;

    if (this.t - last < 0.12) return; // 같은 접촉 연속 판정 방지
    this.pairCd[key] = this.t;
    // 각자 상대를 향한 속도로 공격력 결정
    const sa = Math.max(0, a.vx * nx + a.vy * ny);
    const sb = Math.max(0, -(b.vx * nx + b.vy * ny));
    const px = a.x + nx * a.r, py = a.y + ny * a.r;
    const power = clamp((sa + sb) / 900, 0.1, 1.5);
    // 충돌 세기: 내 돌진 속도 + 서로 부딪힌 속도 (가만히 있던 쪽도 반격 피해를 준다)
    const rel = sa + sb;
    const hitA = this.hit(a, b, sa * 0.45 + rel * 0.55, px, py);
    const hitB = this.hit(b, a, sb * 0.45 + rel * 0.55, px, py);
    // 동시에 쓰러지는 경우: 덜 깎인 쪽이 간신히 버팀 (순서에 따른 불공평 방지)
    const aAfter = a.hp - hitB.dmg, bAfter = b.hp - hitA.dmg;
    if (aAfter <= 0 && bAfter <= 0) { if (aAfter >= bAfter) hitB.dmg = Math.max(0, a.hp - a.maxHp * 0.02); else hitA.dmg = Math.max(0, b.hp - b.maxHp * 0.02); }
    if (hitA.dmg > 0) this.damage(b, hitA.dmg, a, { crit: hitA.crit, x: px, y: py });
    if (hitB.dmg > 0) this.damage(a, hitB.dmg, b, { crit: hitB.crit, x: px, y: py });
    this.emit({ type: 'clash', x: px, y: py, nx, ny, power, crit: hitA.crit || hitB.crit, a, b });
    if (power > 0.55 || hitA.crit || hitB.crit) this.hitstop = Math.max(this.hitstop, hitA.crit || hitB.crit ? 0.09 : 0.05);
  }

  hit(att, def, speedToward, px, py) {
    const f = 0.3 + speedToward / 300;
    let mult = typeMul(att.type, def.type);
    let crit = Math.random() < (att.crit || 0.08) * (speedToward > 250 ? 1.6 : 1);
    if (att.fx.empower > 0) { mult *= att.empowerMul || 2.5; crit = true; att.fx.empower = 0; this.emit({ type: 'empowerHit', x: px, y: py, top: att }); }
    if (att.fx.fire > 0) mult *= 1.25;
    if (att.overspin > 0) mult *= 1.2;
    if (def.fx.slow > 0) mult *= 1.3;
    if (def.fx.shield > 0) mult *= 0.2;
    if (def.fx.fort > 0) mult *= 0.5;
    if (def.type === 'sta') mult *= 0.85; // 지구형: 안정적인 회전으로 피해 감소
    let dmg = dmgBase(att, def) * f * mult * (crit ? 1.8 : 1) * rand(0.9, 1.1);
    // 1회 데미지 상한 (한 방에 끝나지 않게)
    dmg = Math.min(dmg, def.maxHp * (crit ? 0.3 : 0.2));
    if (att.venomNext) { def.fx.poison = 5; def.fx.poisonDps = def.maxHp * 0.035; att.venomNext = false; this.emit({ type: 'poison', top: def }); }
    if (dmg > 0) {
      att.dealt += dmg; att.hits++; if (crit) att.crits++;
      if (att.type === 'sta') att.hp = Math.min(att.maxHp, att.hp + dmg * 0.55); // 지구형: 회전 흡수
      att.gauge = Math.min(100, att.gauge + 5 + f * 4);
      def.gauge = Math.min(100, def.gauge + 3);
      if (this.t - att.lastHit < 1.4) { att.combo++; } else att.combo = 1;
      att.lastHit = this.t; att.comboT = 1.4;
      def.lastAttacker = att;
    }
    return { crit, dmg };
  }

  damage(t, dmg, src, o = {}) {
    if (!t.alive || dmg <= 0) return;
    t.hp -= dmg;
    if (src && !o.dot) t.hitAt = this.t;
    if (!o.silent) this.emit({ type: 'dmg', top: t, dmg, crit: o.crit, x: o.x ?? t.x, y: o.y ?? t.y, src, combo: src ? src.combo : 0 });
    if (t.hp <= 0) {
      t.hp = 0;
      const burst = !o.dot && (o.crit || o.skill) && src;
      this.kill(t, burst ? 'burst' : 'spin', src);
    }
  }

  kill(t, how, src) {
    if (!t.alive) return;
    t.alive = false; t.finish = how; t.killer = src || null;
    if (how === 'out') { t.hp = Math.max(0, t.hp); }
    this.emit({ type: 'finish', top: t, how, src });
    this.slowmo = 0.3;
    this.realLater(0.9, () => { this.slowmo = 1; });
  }

  // 발사 결과 반영 (0 약함, 1 좋음, 2 굿, 3 퍼펙트)
  applyLaunch(t, q) {
    const mul = [0.85, 1.0, 1.1, 1.22][q];
    t.launch = q;
    t.hp = t.maxHp * Math.min(1, mul);
    t.vx *= mul; t.vy *= mul;
    // 굿/퍼펙트 발사: 잠깐 동안 공격력 상승 (오버 스핀)
    t.overspin = q === 3 ? 7 : q === 2 ? 3.5 : 0;
    if (q === 3) t.gauge = Math.max(t.gauge, 40);
  }

  // 연속전: 다음 상대 입장
  spawn(d) {
    const n = this.tops.length;
    const t = this.makeTop(d, n, 2);
    t.i = n;
    t.x = rand(-60, 60); t.y = -R * 0.72;
    this.tops.push(t);
    this.emit({ type: 'spawn', top: t });
    return t;
  }

  checkEnd() {
    if (this.over) return;
    const alive = this.alive();
    const pAlive = alive.some(t => t.side === 'p');
    const sides = new Set(alive.map(t => t.side));
    // 연속전: 다음 상대
    if (pAlive && sides.size === 1 && this.queue && this.queue.length) {
      const d = this.queue.shift();
      for (const t of alive) t.hp = Math.min(t.maxHp, t.hp + t.maxHp * 0.15);
      this.spawn(d);
      this.emit({ type: 'nextFoe', left: this.queue.length });
      this.t = Math.min(this.t, this.timeLimit - 30);
      return;
    }
    if (!pAlive || sides.size <= 1) {
      this.over = true;
      const winner = pAlive ? 'p' : (sides.size ? [...sides][0] : 'e');
      this.result = { winner, how: this.lastFinishHow(), time: this.t, judge: false };
      this.emit({ type: 'end', result: this.result });
      return;
    }
    if (this.t >= this.timeLimit) {
      // 판정: 남은 회전력 비율 합
      const score = {};
      for (const t of this.alive()) score[t.side] = Math.max(score[t.side] || 0, t.hp / t.maxHp);
      const winner = Object.entries(score).sort((a, b) => b[1] - a[1])[0][0];
      for (const t of this.alive()) if (t.side !== winner) { t.alive = false; t.finish = 'judge'; }
      this.over = true;
      this.result = { winner, how: 'judge', time: this.t, judge: true };
      this.emit({ type: 'finish', top: null, how: 'judge' });
      this.emit({ type: 'end', result: this.result });
    }
  }

  lastFinishHow() {
    const dead = this.tops.filter(t => t.finish);
    return dead.length ? dead[dead.length - 1].finish : 'spin';
  }

  // ───────────── 필살기 ─────────────
  castSkill(t) {
    t.gauge = 0;
    const e = this.nearestFoe(t);
    const sk = t.skill || 'rush';
    this.emit({ type: 'skill', top: t, skill: sk, target: e });
    this.slowmo = 0.25;
    this.realLater(0.65, () => { this.slowmo = 1; });
    const toward = (pow) => { if (!e) return; const dx = e.x - t.x, dy = e.y - t.y, d = Math.hypot(dx, dy) || 1; t.vx = dx / d * pow; t.vy = dy / d * pow; };
    switch (sk) {
      case 'flameRush': t.fx.empower = 1.6; t.empowerMul = 3; t.fx.fire = 3; toward(950); break;
      case 'rush': t.fx.empower = 1.4; t.empowerMul = 2; toward(850); break;
      case 'tidalGuard': t.fx.shield = 2.6; t.hp = Math.min(t.maxHp, t.hp + t.maxHp * 0.12); break;
      case 'galeStorm': t.fx.haste = 4; if (e) { const dx = e.x - t.x, dy = e.y - t.y, d = Math.hypot(dx, dy) || 1; e.vx += dx / d * 500; e.vy += dy / d * 500; } break;
      case 'thunderStrike': t.fx.bolts = 5; t.boltTimer = 0; this.boltLoop(t); break;
      case 'frostPrison': if (e) { e.fx.slow = 3.2; this.damage(e, dmgBase(t, e) * 1.2, t, { skill: false }); } break;
      case 'rockFortress': t.fx.fort = 4; break;
      case 'venomFang': t.venomNext = true; t.fx.empower = 1.6; t.empowerMul = 1.6; toward(800); break;
      case 'shadowStep': if (e) { const a = Math.atan2(e.vy, e.vx) + Math.PI; t.x = clampR(e.x + Math.cos(a) * (e.r + t.r + 4)); t.y = clampR(e.y + Math.sin(a) * (e.r + t.r + 4)); this.emit({ type: 'teleport', top: t }); t.fx.empower = 1.2; t.empowerMul = 2.6; toward(700); } break;
      case 'solarFlare': this.shockwave(t, 1100, 1.6); t.hp = Math.min(t.maxHp, t.hp + t.maxHp * 0.15); break;
      case 'blackHole': if (e) { e.fx.pull = 3; e.fx.puller = t; e.fx.drainDps = dmgBase(t, e) * 1.1; } break;
      case 'moonHeal': t.hp = Math.min(t.maxHp, t.hp + t.maxHp * 0.4); t.fx.regen = 2; break;
      case 'sakuraDance': t.fx.petals = 3; t.petalTimer = 0; this.petalLoop(t); break;
      case 'lionRoar': if (e) { e.fx.stun = 1.6; } t.fx.empower = 2; t.empowerMul = 2.2; this.later(0.3, () => toward(900)); break;
      case 'chaosRage': this.shockwave(t, 1000, 1.2); if (e) { e.fx.pull = 2.2; e.fx.puller = t; e.fx.drainDps = dmgBase(t, e) * 1.0; } break;
      case 'galaxyNova': if (e) { e.fx.pull = 1.6; e.fx.puller = t; e.fx.drainDps = dmgBase(t, e) * 0.9; } this.later(1.5, () => { if (t.alive && !this.over) this.shockwave(t, 1300, 2.2); }); break;
      case 'ironCharge': t.fx.fort = 2; t.fx.empower = 2; t.empowerMul = 2.4; toward(780); break;
      case 'sharkFrenzy': this.every(3, 0.4, () => { if (t.alive && !this.over) { t.fx.empower = 0.45; t.empowerMul = 1.6; toward(820); this.emit({ type: 'dash', top: t }); } }); break;
      case 'earthquake': this.shockwave(t, 800, 1.0); if (e) e.fx.slow = 1.8; break;
      case 'crystalShine': t.hp = Math.min(t.maxHp, t.hp + t.maxHp * 0.2); if (e) e.fx.slow = 2; break;
      default: t.fx.empower = 1.4; t.empowerMul = 2; toward(850);
    }
  }

  shockwave(t, pow, dmgMul) {
    this.emit({ type: 'shockwave', x: t.x, y: t.y, top: t });
    for (const e of this.tops) {
      if (!e.alive || e.side === t.side) continue;
      const dx = e.x - t.x, dy = e.y - t.y, d = Math.hypot(dx, dy) || 1;
      const k = clamp(1.4 - d / 400, 0.3, 1.2);
      e.vx += dx / d * pow * k; e.vy += dy / d * pow * k;
      e.lastAttacker = t;
      this.damage(e, dmgBase(t, e) * 1.6 * dmgMul * k * typeMul(t.type, e.type), t, { skill: true, crit: true, x: e.x, y: e.y });
    }
  }

  boltLoop(t) {
    this.every(5, 0.26, (n) => {
      if (this.over || !t.alive) return;
      const e = this.nearestFoe(t);
      if (!e) return;
      this.emit({ type: 'bolt', from: t, to: e, x: e.x, y: e.y });
      const dx = e.x - t.x, dy = e.y - t.y, d = Math.hypot(dx, dy) || 1;
      e.vx += dx / d * 180; e.vy += dy / d * 180;
      e.lastAttacker = t;
      this.damage(e, dmgBase(t, e) * 0.85 * typeMul(t.type, e.type), t, { skill: true, crit: n === 4, x: e.x, y: e.y });
    });
  }

  petalLoop(t) {
    this.every(8, 0.22, (n) => {
      if (this.over || !t.alive) return;
      const e = this.nearestFoe(t);
      if (!e) return;
      this.emit({ type: 'petal', from: t, to: e, x: e.x, y: e.y });
      e.lastAttacker = t;
      this.damage(e, dmgBase(t, e) * 0.55 * typeMul(t.type, e.type), t, { skill: true, crit: n === 7, x: e.x, y: e.y });
    });
  }
}

function angDiff(a, b) { let d = Math.abs(a - b) % TAU; return d > Math.PI ? TAU - d : d; }
function clampR(v) { return clamp(v, -R + 40, R - 40); }

// ───────────── AI ─────────────
// level: 0(쉬움)~1(어려움). 팽이 성향에 따라 움직임이 다르다.
export function aiControl(b, t, level = 0.5, dt = 0.016) {
  if (!t.alive) return;
  const e = b.nearestFoe(t);
  if (!e) return;
  t.aiT = (t.aiT || 0) - dt;
  const dx = e.x - t.x, dy = e.y - t.y, d = Math.hypot(dx, dy) || 1;
  let sx = 0, sy = 0;
  const myR = Math.hypot(t.x, t.y);
  const style = t.type;
  if (style === 'atk' || (style === 'bal' && t.hp / t.maxHp > e.hp / e.maxHp)) {
    // 예측 추격
    const lead = 0.18;
    const tx = e.x + e.vx * lead - t.x, ty = e.y + e.vy * lead - t.y, tl = Math.hypot(tx, ty) || 1;
    sx = tx / tl; sy = ty / tl;
  } else if (style === 'sta') {
    // 중앙 유지 + 회피
    sx = -t.x / 200; sy = -t.y / 200;
    if (d < 150 && e.dashT > 0) { sx -= dx / d * 0.9; sy -= dy / d * 0.9; }
  } else {
    // 방어/밸런스: 중앙 사수, 가까우면 맞받아침
    sx = -t.x / 160; sy = -t.y / 160;
    if (d < 120) { sx += dx / d * 0.6; sy += dy / d * 0.6; }
  }
  // 포켓 근처면 안쪽으로
  if (myR > R * 0.72) {
    const a = (Math.atan2(t.y, t.x) + TAU) % TAU;
    if (b.pockets.some(p => angDiff(a, p) < 0.5)) { sx -= t.x / myR * 1.4; sy -= t.y / myR * 1.4; }
  }
  const sl = Math.hypot(sx, sy);
  if (sl > 1) { sx /= sl; sy /= sl; }
  // 반응 지연 (쉬운 AI는 둔하다)
  const k = 0.25 + level * 0.75;
  t.steer.x += (sx * k - t.steer.x) * Math.min(1, dt * (3 + level * 8));
  t.steer.y += (sy * k - t.steer.y) * Math.min(1, dt * (3 + level * 8));
  if (t.aiT <= 0) {
    t.aiT = 0.25 + (1 - level) * 0.6;
    const dashRange = { atk: 380, bal: 320, def: 240, sta: 200 }[style] || 300;
    if (d < dashRange && t.dashCd <= 0 && (style !== 'sta' || t.hp / t.maxHp > 0.4) && Math.random() < 0.45 + level * 0.5) t.wantDash = true;
    if (t.gauge >= 100 && Math.random() < 0.3 + level * 0.6) {
      const close = d < 260;
      const sk = t.skill;
      const needClose = ['flameRush', 'rush', 'venomFang', 'ironCharge', 'lionRoar', 'shadowStep'].includes(sk);
      if (!needClose || close) t.wantSkill = true;
    }
  }
}
