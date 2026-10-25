// 게임 규칙: 능력치, 성장, 보상, 미션 (화면 코드와 분리)
import { Save, today } from './core/save.js';
import { TOPS, RARITY, GACHA_POOL } from './data/tops.js';
import * as B from './data/balance.js';
import { STAGES, CHAPTERS } from './data/story.js';
import { weighted, pick, rand } from './core/util.js';

const S = () => Save.state;

// ───────── 이벤트 버스 (화면 갱신용) ─────────
const subs = {};
export const bus = {
  on(ev, fn) { (subs[ev] = subs[ev] || []).push(fn); return () => { subs[ev] = subs[ev].filter(f => f !== fn); }; },
  emit(ev, data) { (subs[ev] || []).forEach(f => f(data)); },
};

// ───────── 팽이 ─────────
export function owned(id) { return !!S().tops[id]; }
export function ownedIds() { return Object.keys(S().tops); }
export function topLv(id) { return S().tops[id]?.lv || 1; }
export function topStar(id) { return S().tops[id]?.star || 1; }

export function collectionBonus() { return 1 + Math.max(0, ownedIds().length - 1) * 0.02; }

export function equippedParts(id) {
  const eq = S().equip[id] || {};
  return ['ring', 'disc', 'axis'].map(slot => S().parts.find(p => p.uid === eq[slot]) || null);
}

export function topStats(id, opt = {}) {
  const lv = opt.lv ?? topLv(id), star = opt.star ?? topStar(id);
  const s = B.baseStats(id, lv, star);
  if (!opt.bare) {
    const cb = collectionBonus();
    s.atk *= cb; s.def *= cb; s.hp *= cb;
    for (const p of equippedParts(id)) if (p) {
      const ps = B.partStats(p);
      for (const k in ps) s[k] = (s[k] || 0) + ps[k];
    }
  }
  s.spd = Math.min(100, s.spd); s.crit = Math.min(0.5, s.crit);
  return s;
}
export const topCP = (id, opt) => B.combatPower(topStats(id, opt));

export function axisType(id) {
  const ax = equippedParts(id)[2];
  return ax ? ax.axis : TOPS[id].type;
}

export function addTop(id) {
  const st = S();
  const t = st.tops[id];
  if (!t) { st.tops[id] = { lv: 1, star: 1, dup: 0 }; bus.emit('top', id); return { isNew: true }; }
  if (t.star >= B.MAX_STAR) { const g = 30 + TOPS[id].rarity * 40; st.gems += g; return { maxed: true, gems: g }; }
  t.dup++;
  let up = false;
  while (t.star < B.MAX_STAR && t.dup >= B.starNeed(t.star)) { t.dup -= B.starNeed(t.star); t.star++; up = true; }
  bus.emit('top', id);
  return { dup: true, starUp: up, star: t.star };
}

export function levelUp(id, times = 1) {
  const st = S(); const t = st.tops[id];
  let n = 0;
  while (n < times && t.lv < B.MAX_LEVEL) {
    const c = B.levelCost(t.lv);
    if (st.coins < c) break;
    st.coins -= c; t.lv++; n++;
  }
  if (n) { st.stats.levelups += n; mission('levelup', n); bus.emit('coins'); bus.emit('top', id); Save.touch(); }
  return n;
}

// ───────── 재화 ─────────
export function addCoins(n) { S().coins += Math.round(n); bus.emit('coins'); Save.touch(); }
export function addGems(n) { S().gems += Math.round(n); bus.emit('gems'); Save.touch(); }
export function spend(kind, n) {
  const st = S();
  if (st[kind] < n) return false;
  st[kind] -= n; bus.emit(kind); Save.touch(); return true;
}

export function addXp(n) {
  const st = S(); st.xp += n;
  let ups = 0;
  while (st.xp >= B.xpNeed(st.lv)) { st.xp -= B.xpNeed(st.lv); st.lv++; ups++; }
  bus.emit('xp');
  return ups;
}

// ───────── 부품 ─────────
const PART_NAMES = {
  ring: ['블레이드 링', '클로 링', '스파이크 링', '윙 링', '팽 링'],
  disc: ['헤비 디스크', '코어 디스크', '기어 디스크', '실드 디스크', '스톤 디스크'],
  axis: { atk: '플랫 축', def: '러버 축', sta: '니들 축', bal: '볼 축' },
};
const RARITY_PREFIX = ['', '강화 ', '하이퍼 ', '레전드 ', '갓 '];

export function genPart(rarity, slot, tier) {
  const st = S();
  slot = slot || pick(['ring', 'disc', 'axis']);
  tier = tier ?? Math.floor(st.progress / 8);
  const p = { uid: st.partSeq++, slot, rarity, lvl: 0, tier, bonus: 0 };
  if (slot === 'axis') { p.axis = pick(['atk', 'def', 'sta', 'bal']); p.name = RARITY_PREFIX[rarity] + PART_NAMES.axis[p.axis]; }
  else p.name = RARITY_PREFIX[rarity] + pick(PART_NAMES[slot]);
  st.parts.push(p);
  Save.touch();
  return p;
}

export function rollPartRarity(boost = 0) {
  const prog = S().progress;
  const w = [
    { r: 0, w: Math.max(10, 60 - prog * 1.2) },
    { r: 1, w: 30 + prog * 0.3 },
    { r: 2, w: 8 + prog * 0.45 + boost * 10 },
    { r: 3, w: 1.5 + prog * 0.12 + boost * 4 },
    { r: 4, w: 0.15 + prog * 0.02 + boost },
  ];
  return weighted(w).r;
}

export function partScore(p) { const s = B.partStats(p); return (s.atk || 0) * 3.2 + (s.def || 0) * 2.6 + (s.hp || 0) * 0.32 + (s.spd || 0) * 2 + (s.crit || 0) * 400; }

export function equip(topId, part) {
  const st = S();
  st.equip[topId] = st.equip[topId] || {};
  // 다른 팽이가 끼고 있으면 해제
  for (const [tid, eq] of Object.entries(st.equip)) if (eq[part.slot] === part.uid && tid !== topId) delete eq[part.slot];
  st.equip[topId][part.slot] = part.uid;
  bus.emit('top', topId); Save.touch();
}
export function unequip(topId, slot) { const eq = S().equip[topId]; if (eq) delete eq[slot]; bus.emit('top', topId); Save.touch(); }
export function equippedBy(uid) { for (const [tid, eq] of Object.entries(S().equip)) for (const s in eq) if (eq[s] === uid) return tid; return null; }

export function autoEquip(topId) {
  let changed = 0;
  for (const slot of ['ring', 'disc', 'axis']) {
    const cur = equippedParts(topId)[['ring', 'disc', 'axis'].indexOf(slot)];
    const free = S().parts.filter(p => p.slot === slot && (!equippedBy(p.uid) || equippedBy(p.uid) === topId));
    free.sort((a, b) => partScore(b) - partScore(a));
    if (free[0] && (!cur || partScore(free[0]) > partScore(cur))) { equip(topId, free[0]); changed++; }
  }
  return changed;
}

// 대표 팽이에 더 좋은 부품이 있는지 (빨간 점 표시용)
export function autoEquipPreview(topId = S().main) {
  const cur = equippedParts(topId);
  return ['ring', 'disc', 'axis'].some((slot, i) => S().parts.some(p => p.slot === slot && !equippedBy(p.uid) && (!cur[i] || partScore(p) > partScore(cur[i]) * 1.02)));
}

export function enhance(part) {
  const st = S();
  if (part.lvl >= B.PART_MAX) return { max: true };
  const cost = B.enhanceCost(part.lvl, part.rarity);
  if (st.coins < cost) return { poor: true, cost };
  st.coins -= cost;
  const rate = Math.min(1, B.enhanceRate(part.lvl) + (part.bonus || 0));
  st.stats.enhances++; mission('enhance', 1);
  const ok = Math.random() < rate;
  if (ok) { part.lvl++; part.bonus = 0; }
  else part.bonus = Math.min(0.5, (part.bonus || 0) + 0.1);
  bus.emit('coins'); Save.touch();
  return { ok, lvl: part.lvl, rate };
}

export function sellPart(part) {
  const st = S();
  if (equippedBy(part.uid)) return 0;
  const val = Math.round((20 + part.rarity * 60) * (1 + part.lvl * 0.5) * (1 + part.tier * 0.4));
  st.parts = st.parts.filter(p => p !== part);
  st.coins += val; bus.emit('coins'); Save.touch();
  return val;
}

// ───────── 뽑기 ─────────
export function gachaPull(n) {
  const st = S();
  const cost = n >= 10 ? B.GACHA_COST.ten : B.GACHA_COST.one * n;
  if (st.gems < cost) return null;
  st.gems -= cost;
  const res = [];
  for (let i = 0; i < n; i++) {
    st.gacha.pity++; st.gacha.total++;
    let r;
    if (st.gacha.pity >= B.GACHA_PITY) r = Math.random() < 0.85 ? 3 : 4;
    else r = weighted(B.GACHA_RATE.map((w, k) => ({ r: k, w }))).r;
    if (n >= 10 && i === n - 1 && !res.some(x => x.rarity >= 2) && r < 2) r = 2; // 10연 에픽 이상 1개 보장
    if (r >= 3) st.gacha.pity = 0;
    const pool = GACHA_POOL.filter(id => TOPS[id].rarity === r);
    const id = pick(pool.length ? pool : GACHA_POOL.filter(id => TOPS[id].rarity === 2));
    const out = addTop(id);
    res.push({ id, rarity: TOPS[id].rarity, ...out });
  }
  st.stats.pulls += n; mission('pull', n);
  bus.emit('gems'); Save.touch();
  return res;
}

// ───────── 스테이지 ─────────
export function stageAvailable(idx) { return idx <= S().progress; }
export function chapterOf(idx) { return CHAPTERS[STAGES[idx].ch - 1]; }

export function enemyStats(f, idx, kind) {
  const k = kind === 'rival' || STAGES[idx]?.kind === 'rival' ? 'rival' : kind;
  return B.enemyStatsFor(f, idx, k);
}

// 승리 시 별 (1: 승리, 2: 체력 50% 이상, 3: 버스트/아웃 피니시)
export function stageReward(idx, res) {
  const st = S();
  const stage = STAGES[idx];
  const boss = stage.kind === 'boss';
  const first = !st.cleared[idx];
  const finMul = res.how === 'burst' ? 1.5 : res.how === 'out' ? 1.3 : 1;
  const coins = Math.round(B.stageCoins(idx, boss) * finMul * (first ? 1.5 : 1));
  const xp = B.stageXp(idx, boss);
  let gems = first ? (boss ? 120 : stage.kind === 'giant' || stage.kind === 'royale' ? 40 : 20) : 0;
  const stars = 1 + (res.hpRatio >= 0.5 ? 1 : 0) + (res.how === 'burst' || res.how === 'out' ? 1 : 0);
  const prevStars = st.stars[idx] || 0;
  if (stars > prevStars) { st.stars[idx] = stars; if (stars === 3 && prevStars < 3) gems += 10; }
  // 부품 드랍
  const parts = [];
  const dropChance = boss ? 1 : first ? 0.7 : 0.35;
  if (Math.random() < dropChance) parts.push(genPart(rollPartRarity(boss ? 1 : 0)));
  if (boss && first) parts.push(genPart(Math.max(2, rollPartRarity(1))));
  st.cleared[idx] = (st.cleared[idx] || 0) + 1;
  const newProgress = first && idx === st.progress;
  if (newProgress) st.progress = Math.min(STAGES.length, idx + 1);
  st.coins += coins; st.gems += gems;
  const lvUps = addXp(xp);
  bus.emit('coins'); bus.emit('gems');
  Save.save();
  return { coins, xp, gems, parts, stars, prevStars, first, lvUps, newProgress };
}

export function recordBattle(res, mode) {
  const st = S();
  st.stats.battles++;
  if (res.win) { st.stats.wins++; mission('win', 1); if (res.how && st.stats[res.how] !== undefined) st.stats[res.how]++; }
  else st.stats.losses++;
  if (res.skills) { st.stats.skills += res.skills; mission('skill', res.skills); }
  if (res.perfect) { st.stats.perfect++; }
  st.stats.maxCombo = Math.max(st.stats.maxCombo, res.maxCombo || 0);
  Save.touch();
}

// 패배 위로금
export function loseReward(idx) {
  const c = Math.round(B.stageCoins(idx, false) * 0.35);
  addCoins(c);
  return c;
}

// ───────── 훈련장 (방치 보상) ─────────
export function idlePending() {
  const st = S();
  const min = Math.min(B.IDLE_CAP_MIN, (Date.now() - st.idleAt) / 60000);
  return { coins: Math.floor(min * B.idleCoinsPerMin(st.progress)), min, full: min >= B.IDLE_CAP_MIN, rate: B.idleCoinsPerMin(st.progress) };
}
export function idleCollect() {
  const p = idlePending();
  if (p.coins <= 0) return 0;
  S().idleAt = Date.now();
  addCoins(p.coins); mission('idle', 1);
  return p.coins;
}

// ───────── 미션 / 업적 / 출석 ─────────
export const DAILY = [
  { key: 'win', name: '배틀 5번 이기기', goal: 5, gems: 30 },
  { key: 'skill', name: '필살기 5번 쓰기', goal: 5, gems: 20 },
  { key: 'levelup', name: '팽이 레벨업 5번', goal: 5, gems: 20 },
  { key: 'enhance', name: '부품 강화 3번', goal: 3, gems: 20 },
  { key: 'idle', name: '훈련장 보상 받기', goal: 1, gems: 15 },
  { key: 'pull', name: '팽이 뽑기 1번', goal: 1, gems: 25 },
];
export const DAILY_BONUS = 100;

export function dailyCheck() {
  const st = S();
  if (st.missions.day !== today()) st.missions = { day: today(), counts: {}, claimed: {}, bonus: false };
}
export function mission(key, n) {
  dailyCheck();
  const m = S().missions;
  m.counts[key] = (m.counts[key] || 0) + n;
  bus.emit('mission');
}
export function missionReady() {
  dailyCheck();
  const m = S().missions;
  return DAILY.filter(d => !m.claimed[d.key] && (m.counts[d.key] || 0) >= d.goal).length + (!m.bonus && DAILY.every(d => m.claimed[d.key]) ? 1 : 0);
}

export const ACH = [
  { key: 'clear', name: '스테이지 클리어', val: () => S().progress, tiers: [5, 15, 30, 45, 62], gems: [30, 50, 80, 120, 200] },
  { key: 'burst', name: '버스트 피니시', val: () => S().stats.burst, tiers: [3, 10, 30, 80], gems: [20, 40, 80, 150] },
  { key: 'out', name: '아웃 피니시', val: () => S().stats.out, tiers: [3, 10, 30, 80], gems: [20, 40, 80, 150] },
  { key: 'collect', name: '팽이 수집', val: () => ownedIds().length, tiers: [3, 6, 10, 14, 19], gems: [30, 60, 100, 150, 300] },
  { key: 'cp', name: '전투력 달성', val: () => topCP(S().main), tiers: [1000, 3000, 10000, 30000, 100000], gems: [20, 40, 80, 150, 300] },
  { key: 'perfect', name: '퍼펙트 슛', val: () => S().stats.perfect, tiers: [5, 20, 50, 150], gems: [20, 40, 80, 150] },
  { key: 'tower', name: '무한의 탑', val: () => S().tower.best, tiers: [5, 10, 20, 30, 50], gems: [40, 60, 100, 150, 300] },
];
export function achState(a) {
  const done = S().ach[a.key] || 0; // 받은 단계 수
  const v = a.val();
  return { done, v, next: a.tiers[done], gems: a.gems[done], ready: done < a.tiers.length && v >= a.tiers[done], complete: done >= a.tiers.length };
}
export function achReady() { return ACH.filter(a => achState(a).ready).length; }

export const ATTEND = [
  { coins: 300 }, { gems: 50 }, { coins: 800 }, { gems: 80 }, { part: 2 }, { coins: 2000 }, { gems: 200 },
];
export function attendAvailable() { return S().attend.last !== today(); }
export function attendClaim() {
  const st = S();
  if (!attendAvailable()) return null;
  const r = ATTEND[st.attend.day % 7];
  st.attend.last = today(); st.attend.day = (st.attend.day + 1) % 7;
  Save.touch();
  return r;
}

// ───────── 룰렛 ─────────
export const ROULETTE = [
  { label: '코인', coins: 1, w: 26, color: '#ffc531' },
  { label: '보석 30', gems: 30, w: 20, color: '#b45cff' },
  { label: '코인 x3', coins: 3, w: 12, color: '#ff9f43' },
  { label: '부품', part: 1, w: 16, color: '#3fa2ff' },
  { label: '보석 100', gems: 100, w: 8, color: '#ff3b8a' },
  { label: '코인', coins: 1, w: 26, color: '#ffc531' },
  { label: '보석 50', gems: 50, w: 12, color: '#8a5cff' },
  { label: '대박', gems: 300, w: 2, color: '#ff3b3b' },
];
export function rouletteCoinsUnit() { return Math.round(200 + S().progress * 60); }

// 새 기능 열림 조건
export const UNLOCK = {
  upgrade: { at: 2, text: '1-2 스테이지를 깨면 열려요' },
  gacha: { at: 6, text: '1장 보스를 이기면 열려요' },
  training: { at: 7, text: '2장에 들어가면 열려요' },
  challenge: { at: 22, text: '3장을 끝내면 열려요' },
};
export function unlocked(key) { return S().progress >= UNLOCK[key].at; }

export function totalStars() { return Object.values(S().stars).reduce((a, b) => a + b, 0); }
