// 여러 화면에서 같이 쓰는 조각: 상단바, 부품 카드, 보상 팝업
import { h, $ } from '../core/util.js';
import { Save } from '../core/save.js';
import { Audio } from '../core/audio.js';
import { icon, topImg, charImg, modal, countTo, flyTo, btn, rarChip, typeChip, starsEl, rich, confetti } from '../core/ui.js';
import { TOPS, RARITY, TYPES, SKILLS } from '../data/tops.js';
import { partStats, xpNeed } from '../data/balance.js';
import * as G from '../game.js';

const fmt = (n) => Math.round(n).toLocaleString('ko-KR');

// ───── 상단바 (아바타, 레벨, 재화, 설정) ─────
export function topBar(onSettings) {
  const st = Save.state;
  const xpI = h('i');
  const lvB = h('div.lvbadge', 'Lv.' + st.lv);
  const coinN = h('span.num', fmt(st.coins));
  const gemN = h('span.num', fmt(st.gems));
  const coinPill = h('div.pill.coin', icon('coin'), coinN);
  const gemPill = h('div.pill.gem', icon('gem'), gemN);
  const bar = h('div.topbar',
    h('div.profile',
      h('div.avatar', charImg(st.avatar === 'girl' ? 'player_girl' : 'player_boy')),
      lvB,
      h('div', { style: { minWidth: 0 } }, h('div.pname', st.name), h('div.xpbar', xpI))),
    h('div.cur', coinPill, gemPill),
    h('button.iconbtn', { onclick: () => { Audio.sfx('click'); onSettings && onSettings(); } }, icon('settings')));
  let shownCoins = st.coins, shownGems = st.gems;
  const refresh = () => {
    if (Save.state.coins !== shownCoins) { countTo(coinN, shownCoins, Save.state.coins, 900); shownCoins = Save.state.coins; }
    if (Save.state.gems !== shownGems) { countTo(gemN, shownGems, Save.state.gems, 900); shownGems = Save.state.gems; }
    lvB.textContent = 'Lv.' + Save.state.lv;
    xpI.style.width = Math.min(100, Save.state.xp / xpNeed(Save.state.lv) * 100) + '%';
  };
  refresh();
  const offs = [G.bus.on('coins', refresh), G.bus.on('gems', refresh), G.bus.on('xp', refresh)];
  bar._cleanup = () => offs.forEach(f => f());
  bar.coinEl = coinPill; bar.gemEl = gemPill;
  return bar;
}

// ───── 부품 카드 ─────
export const SLOT_NAME = { ring: '공격 링', disc: '무게 디스크', axis: '회전 축' };
export function partStatText(p) {
  const s = partStats(p);
  const out = [];
  if (s.atk) out.push(`공격 +${fmt(s.atk)}`);
  if (s.def) out.push(`방어 +${fmt(s.def)}`);
  if (s.hp) out.push(`체력 +${fmt(s.hp)}`);
  if (s.spd) out.push(`속도 +${s.spd.toFixed(1)}`);
  if (s.crit) out.push(`치명 +${(s.crit * 100).toFixed(1)}%`);
  return out;
}
export function partCard(p, opt = {}) {
  const r = RARITY[p.rarity];
  const el = h('div.partcard' + (opt.small ? '.small' : '') + (opt.sel ? '.sel' : ''), { style: { '--rc': r.color } },
    h('div.pc-icon', icon(p.slot)),
    p.lvl ? h('div.pc-lv', '+' + p.lvl) : null,
    p.slot === 'axis' ? h('div.pc-axis', { style: { background: TYPES[p.axis].color } }, TYPES[p.axis].short) : null,
    opt.small ? null : h('div.pc-name', p.name),
    opt.equipped ? h('div.pc-eq', '장착') : null);
  if (opt.onClick) el.addEventListener('click', () => { Audio.sfx('click'); opt.onClick(p); });
  return el;
}

// ───── 팝업들 ─────
export function levelUpPopup(lv, onClose) {
  Audio.sfx('levelup');
  confetti(70);
  modal({ title: '레벨 업!', body: h('div.center',
    h('div.display.stroke', { style: { fontSize: '64px', color: '#ffd23f', lineHeight: 1.1, animation: 'popIn .5s cubic-bezier(.2,1.6,.4,1) both' } }, 'Lv.' + lv),
    h('div', { style: { font: '700 15px/1.5 var(--f-body)', color: 'var(--sub)', marginTop: '6px' } }, '플레이어 레벨이 올랐어!')),
    buttons: [{ label: '확인', cls: 'yellow' }], onClose });
}

export function newTopPopup(id, res = {}) {
  const t = TOPS[id];
  const r = RARITY[t.rarity];
  Audio.sfx('reveal', { rarity: t.rarity });
  if (t.rarity >= 3) confetti(120);
  const title = res.isNew === false && res.starUp ? '별 등급 업!' : res.dup ? '중복 획득' : '새 팽이 획득!';
  return new Promise(resolve => modal({ title, color: t.rarity >= 3 ? '' : 'purple', body: h('div.newtop',
    h('div.newtop-glow', { style: { '--rc': r.color } }),
    h('div.newtop-img', topImg(id)),
    h('div.row', { style: { justifyContent: 'center', gap: '6px', marginTop: '6px' } }, rarChip(t.rarity), typeChip(t.type)),
    h('div.display.stroke-s', { style: { fontSize: '26px', marginTop: '6px', textAlign: 'center' } }, t.name),
    h('div.center', { style: { marginTop: '4px' } }, starsEl(G.topStar(id))),
    h('div.newtop-skill', h('b', SKILLS[t.skill].name), ' · ', SKILLS[t.skill].desc)),
    buttons: [{ label: '확인', cls: 'yellow' }], onClose: resolve }));
}

// 보상 받기 팝업 (X 없음, 받기 버튼만)
export function rewardPopup({ title = '보상', coins = 0, gems = 0, parts = [], text = '' }, coinEl, gemEl) {
  return new Promise(resolve => {
    const items = h('div.rw-items');
    if (coins) items.append(h('div.rw-item', icon('coin'), h('span.display', '+' + fmt(coins))));
    if (gems) items.append(h('div.rw-item', icon('gem'), h('span.display', '+' + fmt(gems))));
    for (const p of parts) items.append(h('div.rw-item.part', partCard(p, { small: true }), h('span', p.name)));
    Audio.sfx('open');
    const m = modal({ title, body: h('div', text ? h('div.center', { style: { font: '700 15px/1.5 var(--f-body)', color: 'var(--sub)', marginBottom: '10px' }, html: rich(text) }) : null, items),
      buttons: [{ label: '받기', cls: 'yellow', onClick: async (b) => {
        const box = m.el;
        if (coins) flyTo('coins', items, coinEl || $('.pill.coin'), 10);
        if (gems) flyTo('gems', items, gemEl || $('.pill.gem'), 8);
        return true;
      } }], onClose: resolve });
  });
}
