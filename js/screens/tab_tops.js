// 팽이 탭: 도감 + 선택한 팽이 정보 + 레벨업 + 대표 설정
import { h } from '../core/util.js';
import { icon, topImg, typeChip, rarChip, starsEl, toast, deny, countTo, btn } from '../core/ui.js';
import { Save } from '../core/save.js';
import { Audio } from '../core/audio.js';
import { TOPS, TYPES, RARITY, SKILLS, TOP_IDS } from '../data/tops.js';
import { levelCost, MAX_LEVEL, starNeed, MAX_STAR } from '../data/balance.js';
import * as G from '../game.js';

const fmt = (n) => Math.round(n).toLocaleString('ko-KR');

export function buildTopsTab(bar) {
  const st = Save.state;
  let sel = st.main;
  const el = h('div.topstab');
  const detail = h('div.td.panel');
  const grid = h('div.tgrid');
  const head = h('div.tabhead');
  el.append(head, detail, h('div.tgrid-wrap.scroll', grid));

  const renderHead = () => {
    head.innerHTML = '';
    head.append(h('b.display', '내 팽이'), h('span.thead-sub', `도감 ${G.ownedIds().length}/${TOP_IDS.length}`, h('em', `모든 능력 +${Math.round((G.collectionBonus() - 1) * 100)}%`)));
  };

  let holdT = null, holdN = 0;
  const stopHold = () => { clearTimeout(holdT); holdT = null; holdN = 0; };

  const doLv = () => {
    const id = sel;
    if (G.topLv(id) >= MAX_LEVEL) { deny(detail.querySelector('.td-lvbtn'), '최대 레벨이야!'); stopHold(); return false; }
    if (Save.state.coins < levelCost(G.topLv(id))) { deny(detail.querySelector('.td-lvbtn'), '코인이 부족해! 배틀이나 훈련장에서 모아 보자'); stopHold(); return false; }
    const before = G.topCP(id);
    G.levelUp(id, 1);
    Audio.sfx('upgrade');
    renderDetail(true);
    const n = detail.querySelector('.td-cp b'); if (n) countTo(n, before, G.topCP(id), 450);
    const lvTag = grid.querySelector(`[data-id="${id}"] .lv`); if (lvTag) lvTag.textContent = 'Lv.' + G.topLv(id);
    return true;
  };

  const renderDetail = (pop) => {
    const id = sel, t = TOPS[id];
    detail.innerHTML = '';
    if (!G.owned(id)) {
      detail.append(h('div.td-locked',
        h('div.td-img.locked', { style: { '--rc': RARITY[t.rarity].color } }, topImg(id)),
        h('div', h('div.display', { style: { fontSize: '24px' } }, '???'),
          h('div.td-hint', h('span', { style: { color: RARITY[t.rarity].color } }, RARITY[t.rarity].name + ' 팽이'), h('br'), id === 'galaxy_omega' ? '이야기 마지막에 만날 수 있어' : '뽑기에서 만날 수 있어'))));
      return;
    }
    const s = G.topStats(id);
    const lv = G.topLv(id), star = G.topStar(id);
    const cost = levelCost(lv);
    const isMain = Save.state.main === id;
    const lvBtn = h('button.btn.td-lvbtn' + (lv >= MAX_LEVEL || Save.state.coins < cost ? '.gray' : '.green'), h('span', lv >= MAX_LEVEL ? '최대 레벨' : '레벨업'), lv < MAX_LEVEL ? h('span.cost', icon('coin'), fmt(cost)) : null);
    lvBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (!doLv()) return;
      const rep = () => { holdN++; holdT = setTimeout(() => { if (doLv()) rep(); }, Math.max(60, 240 - holdN * 25)); };
      holdT = setTimeout(rep, 380);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => lvBtn.addEventListener(ev, stopHold));
    const mainBtn = h('button.btn' + (isMain ? '.gray' : '.yellow'), { onclick: () => {
      Audio.sfx('click');
      if (isMain) return;
      Save.state.main = id; Save.touch(); G.bus.emit('top', id);
      Audio.sfx('upgrade'); toast(`**${t.name}** 대표 팽이로 설정!`, 'good');
      renderDetail(); renderGrid();
    } }, isMain ? '대표 팽이' : '대표로 설정');
    const imgWrap = h('div.td-img' + (pop ? '.lvpop' : ''), { style: { '--rc': RARITY[t.rarity].color } }, topImg(id));
    const ref = Math.max(s.atk * 1.1, s.def * 1.3, s.hp / 9, 1) * 1.1;
    const statRow = (name, val, max, col, txt) => h('div.statline', h('span.st-ic', { style: { background: col } }), h('span.st-name', name), h('div.bar', h('i', { style: { width: Math.min(100, val / max * 100) + '%', background: col } })), h('b.num', txt ?? fmt(val)));
    const dupNeed = star < MAX_STAR ? starNeed(star) : 0;
    const dupHave = Save.state.tops[id].dup || 0;
    detail.append(
      h('div.td-top',
        imgWrap,
        h('div.td-info',
          h('div.row', { style: { gap: '5px', flexWrap: 'wrap' } }, rarChip(t.rarity), typeChip(t.type)),
          h('div.td-name.display.stroke-s', t.name),
          h('div.row', { style: { gap: '8px' } }, starsEl(star), h('span.td-lv', 'Lv.' + lv)),
          star < MAX_STAR ? h('div.td-dup', h('div.dupbar', h('i', { style: { width: Math.min(100, dupHave / dupNeed * 100) + '%' } })), h('span', `별 ${dupHave}/${dupNeed}`)) : h('div.td-dup', h('span', '최고 별 등급!')),
          h('div.td-cp', h('span', '전투력'), h('b.num', fmt(G.topCP(id)))))),
      h('div.td-stats',
        statRow('공격력', s.atk, ref, '#ff5468'),
        statRow('방어력', s.def, ref, '#4cb0ff'),
        statRow('체력', s.hp / 9, ref, '#4fe07a', fmt(s.hp)),
        statRow('속도', s.spd, 100, '#ffd23f')),
      h('div.td-skill', h('span.sk-tag', '필살기'), h('b', SKILLS[t.skill].name), h('small', SKILLS[t.skill].desc)),
      h('div.td-btns', mainBtn, lvBtn));
  };

  const renderGrid = () => {
    grid.innerHTML = '';
    const ids = [...TOP_IDS].sort((a, b) => {
      const oa = G.owned(a) ? 1 : 0, ob = G.owned(b) ? 1 : 0;
      if (oa !== ob) return ob - oa;
      return TOPS[b].rarity - TOPS[a].rarity;
    });
    for (const id of ids) {
      const t = TOPS[id], has = G.owned(id);
      const cell = h('button.topthumb.r' + t.rarity + (has ? '' : '.locked') + (id === sel ? '.sel' : ''), { 'data-id': id, onclick: () => {
        Audio.sfx('tab'); sel = id; stopHold(); renderDetail();
        grid.querySelectorAll('.topthumb').forEach(x => x.classList.toggle('sel', x === cell));
      } },
        topImg(id),
        has ? starsEl(G.topStar(id)) : null,
        has ? h('span.lv', 'Lv.' + G.topLv(id)) : null,
        h('span.tc', { style: { background: TYPES[t.type].color } }),
        Save.state.main === id ? h('span.tag', '대표') : null);
      grid.append(cell);
    }
  };
  renderHead(); renderDetail(); renderGrid();
  el._cleanup = () => stopHold();
  return el;
}
