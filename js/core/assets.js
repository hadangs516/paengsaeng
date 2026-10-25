// 이미지 목록 + 미리 불러오기 (진행률 표시용)
import { TOP_IDS } from '../data/tops.js';

const CHAR_IDS = ['player_boy', 'player_girl', 'grandpa', 'hanbyeol', 'dusik', 'jia', 'marin', 'luna', 'magma', 'baekya', 'leo', 'chaos', 'kid_a', 'kid_b', 'student', 'grunt'];
export const STADIUM_IDS = ['st_playground', 'st_school', 'st_beach', 'st_city', 'st_volcano', 'st_snow', 'st_sky', 'st_chaos', 'st_tower'];
export const BG_IDS = ['bg_playground', 'bg_school', 'bg_beach', 'bg_city', 'bg_volcano', 'bg_snow', 'bg_sky', 'bg_chaos', 'bg_shop'];
export const ICON_IDS = ['coin', 'gem', 'chest', 'trophy', 'part_ring', 'part_disc', 'part_axis', 'capsule', 'tab_home', 'tab_tops', 'tab_upgrade', 'tab_gacha', 'tab_challenge', 'icon_settings', 'icon_mission', 'icon_calendar', 'icon_roulette', 'icon_training', 'icon_friend', 'icon_boss', 'xp_star', 'lock', 'ticket', 'crown'];

// 아직 없는 파일은 불러오지 않도록 실제 있는 것만 적는다 (배포 때 갱신)
export const AVAILABLE = {
  stadiums: ['st_playground', 'st_school', 'st_sky'],
  bg: ['keyart', 'bg_playground', 'bg_school', 'bg_city', 'bg_sky'],
  icons: [],
};

export const IMG = {};

export const path = {
  top: (id) => `assets/tops/${id}.webp`,
  char: (id) => `assets/chars/${id}.webp`,
  stadium: (id) => `assets/stadiums/${id}.webp`,
  bg: (id) => `assets/bg/${id}.webp`,
  icon: (id) => `assets/icons/${id}.webp`,
  ui: (id) => `assets/ui/${id}.webp`,
};

// CSS 배경: 없는 그림이면 키아트로 대신
export const bgCss = (id) => hasBg(id) ? `url(${path.bg(id)})` : `url(${path.bg('keyart')})`;

export function hasStadium(id) { return AVAILABLE.stadiums.includes(id); }
export function hasBg(id) { return AVAILABLE.bg.includes(id); }
export function hasIcon(id) { return AVAILABLE.icons.includes(id); }

function loadImg(key, src) {
  return new Promise((res) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { IMG[key] = im; res(true); };
    im.onerror = () => res(false);
    im.src = src;
  });
}

// 진행률 콜백: onStep(비율, 단계 이름)
export async function preload(onStep) {
  const groups = [
    ['팽이 닦는 중', TOP_IDS.map(id => ['top:' + id, path.top(id)])],
    ['라이벌 부르는 중', CHAR_IDS.map(id => ['char:' + id, path.char(id)])],
    ['경기장 청소하는 중', AVAILABLE.stadiums.map(id => ['st:' + id, path.stadium(id)])],
    ['동네 풍경 그리는 중', AVAILABLE.bg.map(id => ['bg:' + id, path.bg(id)])],
    ['아이콘 챙기는 중', [...AVAILABLE.icons.map(id => ['ic:' + id, path.icon(id)]), ['ui:gacha_machine', path.ui('gacha_machine')]]],
  ];
  const total = groups.reduce((s, g) => s + g[1].length, 0) || 1;
  let done = 0;
  for (const [label, items] of groups) {
    onStep(done / total, label);
    await Promise.all(items.map(([k, src]) => loadImg(k, src).then(() => { done++; onStep(done / total, label); })));
  }
}

// 회전 블러 원판: 팽이가 빠르게 돌 때 쓰는 미리 그린 이미지
const blurCache = {};
export function spinBlur(id, size = 160) {
  const key = id + size;
  if (blurCache[key]) return blurCache[key];
  const im = IMG['top:' + id];
  if (!im) return null;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const n = 18;
  g.translate(size / 2, size / 2);
  for (let i = 0; i < n; i++) {
    g.globalAlpha = 1 / (i + 1) * 1.2;
    g.rotate((Math.PI * 2) / n);
    g.drawImage(im, -size / 2, -size / 2, size, size);
  }
  blurCache[key] = c;
  return c;
}

// 어둡게 물든 팽이 (조종당한 보스용)
const darkCache = {};
export function darkTop(id, size = 160) {
  const key = id + size;
  if (darkCache[key]) return darkCache[key];
  const im = IMG['top:' + id];
  if (!im) return null;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.drawImage(im, 0, 0, size, size);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(70,0,40,.55)';
  g.fillRect(0, 0, size, size);
  darkCache[key] = c;
  return c;
}
