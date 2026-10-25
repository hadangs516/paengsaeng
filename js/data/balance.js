// 밸런스 공식 (전투 능력치, 비용, 보상)
import { TOPS, RARITY } from './tops.js';

// 타입별 기본 능력치 배율
const TYPE_STAT = {
  atk: { atk: 1.25, def: 0.9, hp: 0.95, spd: 1.12, crit: 0.12 },
  def: { atk: 0.92, def: 1.2, hp: 1.0, spd: 0.88, crit: 0.06 },
  sta: { atk: 0.9, def: 0.97, hp: 1.33, spd: 0.95, crit: 0.07 },
  bal: { atk: 1.03, def: 1.03, hp: 1.03, spd: 1.03, crit: 0.09 },
};
const BASE = { atk: 40, def: 30, hp: 400, spd: 50 };

export const MAX_LEVEL = 100;
export const MAX_STAR = 5;

export const levelMul = (L) => 1 + 0.11 * (L - 1) + 0.0035 * (L - 1) * (L - 1);
export const starMul = (S) => 1 + 0.25 * (S - 1);

// 팽이 하나의 맨몸 능력치
export function baseStats(topId, level = 1, star = 1) {
  const t = TOPS[topId];
  const ts = TYPE_STAT[t.type];
  const m = levelMul(level) * starMul(star) * RARITY[t.rarity].mul;
  return {
    atk: BASE.atk * ts.atk * m,
    def: BASE.def * ts.def * m,
    hp: BASE.hp * ts.hp * m,
    spd: Math.min(100, BASE.spd * ts.spd * (1 + (star - 1) * 0.05) + t.rarity * 2),
    crit: ts.crit + star * 0.005,
  };
}

// 전투력: 보기 좋게 커지는 숫자
export function combatPower(s) {
  return Math.round(s.atk * 3.2 + s.def * 2.6 + s.hp * 0.32 + s.spd * 2 + s.crit * 400);
}

// 레벨업 비용
export const levelCost = (L) => Math.round(25 * Math.pow(1.115, L - 1) + 10 * (L - 1));

// 별 올리기에 필요한 중복 수 (★2:1, ★3:2, ★4:3, ★5:4)
export const starNeed = (S) => S;

// 부품 강화
export const PART_MAX = 15;
export const enhanceCost = (lvl, rarity) => Math.round(40 * Math.pow(1.28, lvl) * (1 + rarity * 0.5));
export const enhanceRate = (lvl) => [1, 1, 1, 1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25][lvl] ?? 0.2;

// 부품 주 능력치 (레어도, 강화 수치, 슬롯)
export function partStats(part) {
  const r = part.rarity, e = part.lvl;
  const k = (1 + r * 0.6) * (1 + e * 0.16) * (1 + (part.tier || 0) * 0.35);
  if (part.slot === 'ring') return { atk: 9 * k, crit: 0.004 * r + e * 0.001 };
  if (part.slot === 'disc') return { def: 6 * k, hp: 55 * k };
  return { spd: 2 + r * 1.5 + e * 0.5, crit: 0.008 + r * 0.006 + e * 0.002, atk: 3 * k };
}

// 스테이지 적 레벨 (스테이지 번호 0부터)
export function enemyLevel(idx) { return Math.max(1, Math.round(1 + idx * 1.05)); }

// 스테이지별 기준 전투력 (보통으로 키운 플레이어 기준, 시뮬레이션으로 맞춤)
const REF = [[0, 600], [5, 1050], [10, 1550], [15, 2100], [20, 2750], [25, 3550], [30, 4500], [35, 5600], [40, 6700], [45, 7900], [50, 9200], [55, 10600], [61, 12400]];
export function refCP(idx) {
  for (let i = 1; i < REF.length; i++) {
    const [x1, y1] = REF[i - 1], [x2, y2] = REF[i];
    if (idx <= x2) return y1 + (y2 - y1) * (idx - x1) / (x2 - x1);
  }
  const [x, y] = REF[REF.length - 1];
  return y * Math.pow(1.04, idx - x);
}
// 종류별 적 강도 (1명당)
export const KIND_MUL = { duel: 0.8, rival: 0.83, boss: 0.85, royale: 0.6, gauntlet: 0.62, tag: 0.72, giant: 0.72, ally: 0.85 };

// 적 능력치: 기준 전투력에 맞춰 팽이 고유 비율을 유지한 채 크기만 맞춘다
export function enemyStatsFor(f, idx, kind) {
  const star = f.star || 1;
  const lv = Math.max(1, enemyLevel(idx) + (f.lv || 0));
  const s = baseStats(f.top, lv, star);
  let target = refCP(idx) * (KIND_MUL[kind] ?? 0.8) * (1 + (f.lv || 0) * 0.025) * (1 + (star - 1) * 0.03);
  if (f.dark) target *= 1.06;
  const fixed = s.spd * 2 + s.crit * 400;
  const k = Math.max(0.2, (target - fixed) / (s.atk * 3.2 + s.def * 2.6 + s.hp * 0.32));
  s.atk *= k; s.def *= k; s.hp *= k;
  if (kind === 'giant' || f.hpMul) { s.hp *= (f.hpMul || 3) * 0.62; s.atk *= (f.atkMul || 0.9) * 0.8; }
  return { ...s, lv, star };
}

// 스테이지 보상
export function stageCoins(idx, boss) { return Math.round((30 + idx * 9) * Math.pow(1.045, idx) * (boss ? 2.5 : 1)); }
export function stageXp(idx, boss) { return Math.round((12 + idx * 2) * (boss ? 2 : 1)); }

// 플레이어 계정 레벨
export const xpNeed = (lv) => Math.round(40 + lv * 25 + lv * lv * 3);

// 훈련장: 분당 코인
export function idleCoinsPerMin(progress) { return Math.round(4 + progress * 1.6 * Math.pow(1.03, progress)); }
export const IDLE_CAP_MIN = 8 * 60;

// 뽑기
export const GACHA_COST = { one: 100, ten: 900 };
export const GACHA_RATE = [0, 55, 33, 10, 2]; // 레어도별 %
export const GACHA_PITY = 30; // 전설 이상 확정
export const PART_BOX_COST = (progress) => Math.round(300 + progress * 40);

// 무한의 탑
export function towerLevel(floor) { return Math.round(30 + floor * 1.6); }
