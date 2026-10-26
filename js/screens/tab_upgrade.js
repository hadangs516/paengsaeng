// 강화 탭: 부품 장착 / 강화 / 판매 / 부품 상자
import { h, sleep } from '../core/util.js';
import { icon, topImg, toast, deny, btn, bigText, modal, confirmBox, rich, countTo } from '../core/ui.js';
import { Save } from '../core/save.js';
import { Audio } from '../core/audio.js';
import { TOPS, RARITY, TYPES } from '../data/tops.js';
import { enhanceCost, enhanceRate, PART_MAX, PART_BOX_COST } from '../data/balance.js';
import * as G from '../game.js';
import { partCard, partStatText, SLOT_NAME } from './common.js';

const fmt = (n) => Math.round(n).toLocaleString('ko-KR');
const SLOTS = ['ring', 'disc', 'axis'];

export function buildUpgradeTab(bar) {
  const el = h('div.upgtab');
  let filter = 'all';
  let selUid = null;
  const main = () => Save.state.main;
  const slotsEl = h('div.eqslots');
  const detail = h('div.pdetail.panel');
  const inv = h('div.pgrid');
  const filters = h('div.pfilter');
  const head = h('div.tabhead',
    h('b.display', '부품 강화'),
    h('div.row', { style: { gap: '6px' } },
      btn('자동 장착', 'small green', () => {
        const n = G.autoEquip(main());
        if (n) { Audio.sfx('upgrade'); toast(`더 좋은 부품 **${n}개** 장착!`, 'good'); } else toast('이미 제일 좋은 부품을 끼고 있어');
        renderAll();
      }),
      btn(h('span', '부품 상자'), 'small purple', () => openBox())));
  el.append(head, slotsEl, detail, filters, h('div.pgrid-wrap.scroll', inv));

  const sel = () => Save.state.parts.find(p => p.uid === selUid);

  function renderSlots() {
    slotsEl.innerHTML = '';
    const eq = G.equippedParts(main());
    const t = TOPS[main()];
    slotsEl.append(h('div.eq-top', topImg(main()), h('div.eq-cp', h('small', '전투력'), h('b.num', fmt(G.topCP(main()))))));
    SLOTS.forEach((slot, i) => {
      const p = eq[i];
      const s = h('button.eqslot' + (p && p.uid === selUid ? '.sel' : ''), { onclick: () => { Audio.sfx('tab'); if (p) { selUid = p.uid; renderAll(); } else { filter = slot; renderAll(); toast(`아래에서 **${SLOT_NAME[slot]}**를 골라 장착해 봐`); } } },
        p ? partCard(p, { small: true }) : h('div.eq-empty', icon(slot)),
        h('span.eq-label', SLOT_NAME[slot]));
      slotsEl.append(s);
    });
  }

  function renderDetail() {
    detail.innerHTML = '';
    const p = sel();
    if (!p) {
      detail.append(h('div.pd-empty', h('b', '부품을 눌러서 강화해 봐!'), h('small', '공격 링 = 공격력, 무게 디스크 = 방어/체력, 회전 축 = 속도/치명타')));
      return;
    }
    const owner = G.equippedBy(p.uid);
    const isMine = owner === main();
    const r = RARITY[p.rarity];
    const cost = enhanceCost(p.lvl, p.rarity);
    const rate = Math.min(1, enhanceRate(p.lvl) + (p.bonus || 0));
    const maxed = p.lvl >= PART_MAX;
    const enhBtn = h('button.btn.enh' + (maxed ? '.gray' : Save.state.coins >= cost ? '.yellow' : '.gray'), h('span', maxed ? '최대 강화' : '강화'), maxed ? null : h('span.cost', icon('coin'), fmt(cost)));
    enhBtn.addEventListener('click', () => doEnhance(enhBtn));
    detail.append(
      h('div.pd-top',
        partCard(p, { small: true }),
        h('div.pd-info',
          h('div.pd-name', { style: { color: r.color } }, p.name, p.lvl ? h('span.pd-lv', ' +' + p.lvl) : null),
          h('div.pd-sub', `${r.name} · ${SLOT_NAME[p.slot]}`, p.slot === 'axis' ? h('span', { style: { color: TYPES[p.axis].color } }, ` · ${TYPES[p.axis].short} 움직임`) : null),
          h('div.pd-stats', partStatText(p).map(s => h('span', s))))),
      h('div.pd-rate', maxed ? h('span', '더 이상 강화할 수 없어') : h('span', '성공 확률 ', h('b' + (rate < 0.6 ? '.low' : ''), Math.round(rate * 100) + '%'), p.bonus ? h('em', `  (실패 보너스 +${Math.round(p.bonus * 100)}%)`) : null)),
      h('div.pd-btns',
        btn(owner && !isMine ? '다른 팽이 장착중' : isMine ? '해제' : '장착', isMine ? 'ghost small' : 'small', () => {
          if (isMine) G.unequip(main(), p.slot); else { G.equip(main(), p); Audio.sfx('upgrade'); }
          renderAll();
        }),
        btn('판매', 'red small', async () => {
          if (owner) { deny(null, '장착한 부품은 팔 수 없어'); return; }
          if (p.rarity >= 2 || p.lvl >= 5) { if (!(await confirmBox(`**${p.name}** 판매할까?`, '판매', '돌아가기', 'red'))) return; }
          if (!Save.state.parts.includes(p)) { renderAll(); return; }
          const v = G.sellPart(p); selUid = null; Audio.sfx('coin'); toast(`+${fmt(v)} 코인`, 'good'); renderAll();
        }),
        enhBtn));
  }

  async function doEnhance(b) {
    const p = sel(); if (!p) return;
    if (b.dataset.busy) return;
    const res = G.enhance(p);
    if (res.max) { deny(b, '최대 강화야!'); return; }
    if (res.poor) { deny(b, '코인이 부족해!'); return; }
    b.dataset.busy = '1';
    // 망치질 연출
    const card = detail.querySelector('.partcard');
    card && card.classList.add('hammer');
    Audio.sfx('charge', { p: .3 });
    await sleep(380);
    if (res.ok) {
      Audio.sfx(p.lvl >= 10 ? 'levelup' : 'upgrade');
      bigText(`+${p.lvl} 성공!`, p.lvl >= 10 ? '#ff6fb5' : '#ffd23f');
    } else {
      Audio.sfx('deny');
      bigText('실패…', '#9aa4c8', '다음 확률 +10%');
    }
    renderAll();
  }

  function renderFilters() {
    filters.innerHTML = '';
    for (const [k, label] of [['all', '전체'], ['ring', '공격 링'], ['disc', '디스크'], ['axis', '회전 축']]) {
      filters.append(h('button.pf' + (filter === k ? '.on' : ''), { onclick: () => { Audio.sfx('tab'); filter = k; renderFilters(); renderInv(); } }, label));
    }
    const sellAll = h('button.pf.sell', { onclick: async () => {
      const list = Save.state.parts.filter(p => !G.equippedBy(p.uid) && p.rarity <= 1 && p.lvl === 0);
      if (!list.length) { toast('정리할 일반/레어 부품이 없어'); return; }
      if (!(await confirmBox(`강화 안 한 일반·레어 부품 **${list.length}개**를 한 번에 팔까?`, '판매', '돌아가기', 'red'))) return;
      let sum = 0; list.filter(p => Save.state.parts.includes(p)).forEach(p => sum += G.sellPart(p));
      Audio.sfx('coin'); toast(`+${fmt(sum)} 코인`, 'good'); selUid = null; renderAll();
    } }, '일괄 판매');
    filters.append(sellAll);
  }

  function renderInv() {
    inv.innerHTML = '';
    let list = Save.state.parts.filter(p => filter === 'all' || p.slot === filter);
    list.sort((a, b) => G.partScore(b) - G.partScore(a));
    if (!list.length) { inv.append(h('div.pempty', '부품이 없어. 배틀에서 이기면 떨어져!')); return; }
    for (const p of list) {
      const owner = G.equippedBy(p.uid);
      inv.append(partCard(p, { small: true, sel: p.uid === selUid, equipped: !!owner, onClick: (pp) => { selUid = pp.uid; renderAll(); } }));
    }
  }

  async function openBox() {
    const cost = PART_BOX_COST(Save.state.progress);
    const ok = await confirmBox(`코인 **${fmt(cost)}**개로 부품 상자를 열까?\n부품 3개가 들어 있어!`, '열기', '돌아가기');
    if (!ok) return;
    if (!G.spend('coins', cost)) { deny(null, '코인이 부족해!'); return; }
    const parts = [0, 1, 2].map((_, i) => G.genPart(i === 2 ? Math.max(1, G.rollPartRarity(0.5)) : G.rollPartRarity(0)));
    Audio.sfx('drumroll', { dur: 0.8 });
    await sleep(800);
    const best = Math.max(...parts.map(p => p.rarity));
    Audio.sfx('reveal', { rarity: best });
    modal({ title: '부품 상자', color: 'purple', body: h('div.boxres', parts.map((p, i) => h('div.boxitem', { style: { animationDelay: i * 0.15 + 's' } }, partCard(p), h('small', partStatText(p).slice(0, 2).join(' / '))))),
      buttons: [{ label: '확인', cls: 'yellow' }] });
    renderAll();
  }

  function renderAll() { renderSlots(); renderDetail(); renderFilters(); renderInv(); }
  renderAll();
  const off = G.bus.on('coins', () => { const b = detail.querySelector('.enh'); const p = sel(); if (b && p && p.lvl < PART_MAX) { const ok = Save.state.coins >= enhanceCost(p.lvl, p.rarity); b.classList.toggle('yellow', ok); b.classList.toggle('gray', !ok); } });
  el._cleanup = () => off();
  return el;
}
