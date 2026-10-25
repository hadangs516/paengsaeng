// 미션/업적, 출석, 룰렛 팝업
import { h, sleep, weighted } from '../core/util.js';
import { icon, modal, toast, deny, flyTo, btn, bigText, rich } from '../core/ui.js';
import { Save, today } from '../core/save.js';
import { Audio } from '../core/audio.js';
import * as G from '../game.js';
import { partCard } from './common.js';

const fmt = (n) => Math.round(n).toLocaleString('ko-KR');

// ───────── 미션 / 업적 ─────────
export function openMissions(bar, onDone) {
  G.dailyCheck();
  let tab = 'daily';
  const body = h('div');
  const tabs = h('div.mtabs');
  const render = () => {
    tabs.innerHTML = '';
    const dR = G.missionReady(), aR = G.achReady();
    for (const [k, label, n] of [['daily', '오늘의 미션', dR], ['ach', '업적', aR]]) {
      const b = h('button.mtab' + (tab === k ? '.on' : ''), { onclick: () => { Audio.sfx('tab'); tab = k; render(); } }, label, n ? h('span.reddot', n) : null);
      tabs.append(b);
    }
    body.innerHTML = '';
    body.append(tabs);
    if (tab === 'daily') renderDaily(); else renderAch();
  };
  const claimFx = (row, gems) => {
    G.addGems(gems);
    flyTo('gems', row, bar.gemEl, 6);
    const stamp = h('div.stamp', '수령 완료');
    row.append(stamp);
    Audio.sfx('gem');
  };
  function renderDaily() {
    const m = Save.state.missions;
    const list = h('div.mlist');
    for (const d of G.DAILY) {
      const cnt = Math.min(d.goal, m.counts[d.key] || 0);
      const done = cnt >= d.goal, claimed = m.claimed[d.key];
      const row = h('div.mrow' + (claimed ? '.claimed' : ''),
        h('div.mr-info', h('b', d.name), h('div.mbar', h('i', { style: { width: (cnt / d.goal * 100) + '%' } }), h('span', `${cnt}/${d.goal}`))),
        h('div.mr-rw', icon('gem'), h('span', '+' + d.gems)),
        claimed ? h('div.stamp.static', '수령 완료') : h('button.btn.small' + (done ? '.green' : '.gray'), { onclick: (e) => {
          if (!done) { deny(e.currentTarget, '아직 덜 했어!'); return; }
          m.claimed[d.key] = true; Save.touch();
          claimFx(row, d.gems);
          e.currentTarget.remove();
          setTimeout(render, 900);
        } }, done ? '받기' : '진행중'));
      list.append(row);
    }
    const allClaimed = G.DAILY.every(d => m.claimed[d.key]);
    const bonus = h('div.mbonus' + (m.bonus ? '.claimed' : ''),
      h('div.mb-ic', icon('chest')),
      h('div.mr-info', h('b', '오늘 미션 모두 완료'), h('small', '보석 ' + G.DAILY_BONUS + ' + 부품 1개')),
      m.bonus ? h('div.stamp.static', '수령 완료') : h('button.btn.small' + (allClaimed ? '.yellow' : '.gray'), { onclick: (e) => {
        if (!allClaimed) { deny(e.currentTarget, '미션을 모두 받아야 열려!'); return; }
        m.bonus = true; const p = G.genPart(Math.max(2, G.rollPartRarity(1)));
        claimFx(bonus, G.DAILY_BONUS); toast(`**${p.name}** 획득!`, 'good');
        e.currentTarget.remove(); setTimeout(render, 900);
      } }, '받기'));
    body.append(list, bonus, h('div.mnote', '미션은 매일 자정에 새로 바뀌어'));
  }
  function renderAch() {
    const list = h('div.mlist');
    for (const a of G.ACH) {
      const s = G.achState(a);
      const goal = s.complete ? a.tiers[a.tiers.length - 1] : s.next;
      const v = Math.min(goal, s.v);
      const tierTxt = `${Math.min(s.done + 1, a.tiers.length)}단계`;
      const row = h('div.mrow.ach' + (s.complete ? '.claimed' : ''),
        h('div.mr-info', h('b', a.name, h('small', s.complete ? '  완료!' : '  ' + tierTxt)), h('div.mbar', h('i', { style: { width: (v / goal * 100) + '%' } }), h('span', `${fmt(v)}/${fmt(goal)}`))),
        s.complete ? h('div.stamp.static', '모두 완료') : h('div.mr-rw', icon('gem'), h('span', '+' + s.gems)),
        s.complete ? null : h('button.btn.small' + (s.ready ? '.green' : '.gray'), { onclick: (e) => {
          if (!s.ready) { deny(e.currentTarget, '아직 목표에 못 미쳤어!'); return; }
          Save.state.ach[a.key] = s.done + 1; Save.touch();
          claimFx(row, s.gems); e.currentTarget.remove(); setTimeout(render, 900);
        } }, s.ready ? '받기' : '진행중'));
      // ▼ 지난 단계 펼치기
      const past = h('div.ach-past.hidden', a.tiers.map((t, i) => h('div.ach-tier' + (i < s.done ? '.done' : ''), `${i + 1}단계 · ${fmt(t)}`, h('span', i < s.done ? '받음' : `보석 ${a.gems[i]}`))));
      const tog = h('button.ach-tog', { onclick: () => { Audio.sfx('tab'); past.classList.toggle('hidden'); tog.classList.toggle('open'); } }, '▼');
      row.querySelector('.mr-info b').append(tog);
      list.append(row, past);
    }
    body.append(list);
  }
  render();
  modal({ title: '미션', color: 'blue', body, closable: true, buttons: [{ label: '확인', cls: 'yellow' }], onClose: () => onDone && onDone() });
}

// ───────── 출석 ─────────
export function openAttendance(bar, onDone) {
  const st = Save.state;
  const can = G.attendAvailable();
  const day = st.attend.day; // 이번 주기에 받은 칸 수
  const claimedCount = !can && day === 0 ? 7 : day;
  const grid = h('div.attgrid');
  G.ATTEND.forEach((r, i) => {
    const got = i < claimedCount;
    const isToday = can && i === day;
    const cell = h('div.attcell' + (isToday ? '.today' : '') + (i === 6 ? '.big' : '') + (got ? '.got' : ''),
      h('div.att-day', `${i + 1}일`),
      h('div.att-ic', icon(r.gems ? 'gem' : r.part ? 'chest' : 'coin')),
      h('div.att-amt', r.gems ? fmt(r.gems) : r.part ? '부품' : fmt(r.coins)));
    if (got) cell.append(h('div.stamp.static.small', '수령 완료'));
    grid.append(cell);
  });
  const claim = async (b, close) => {
    if (!G.attendAvailable()) return true;
    const idx = Save.state.attend.day;
    const r = G.attendClaim();
    const cell = grid.children[idx];
    cell.classList.remove('today'); cell.classList.add('got');
    cell.append(h('div.stamp', '수령 완료'));
    Audio.sfx('open');
    if (r.coins) { G.addCoins(r.coins); flyTo('coins', cell, bar.coinEl, 10); }
    if (r.gems) { G.addGems(r.gems); flyTo('gems', cell, bar.gemEl, 8); }
    if (r.part) { const p = G.genPart(r.part); toast(`**${p.name}** 획득!`, 'good'); }
    await sleep(900);
    return true;
  };
  modal({ title: '출석 체크', body: h('div', h('div.att-note', can ? '오늘 출석 보상을 받아 가!' : '오늘은 이미 받았어. 내일 또 와!'), grid),
    closable: !can, buttons: can ? [{ label: '받기', cls: 'yellow', onClick: claim }] : [{ label: '확인', cls: 'yellow' }],
    onClose: () => onDone && onDone() });
}

// ───────── 룰렛 ─────────
export function openRoulette(bar, onDone) {
  const st = Save.state;
  const segs = G.ROULETTE;
  const n = segs.length;
  const wheel = h('div.wheel');
  // 원판 (SVG)
  let svg = `<svg viewBox="-100 -100 200 200">`;
  segs.forEach((s, i) => {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
    const x0 = Math.cos(a0) * 96, y0 = Math.sin(a0) * 96, x1 = Math.cos(a1) * 96, y1 = Math.sin(a1) * 96;
    svg += `<path d="M0 0 L${x0.toFixed(2)} ${y0.toFixed(2)} A96 96 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z" fill="${s.color}" stroke="#0a0f24" stroke-width="2"/>`;
    const am = (a0 + a1) / 2;
    const tx = Math.cos(am) * 62, ty = Math.sin(am) * 62;
    const deg = am * 180 / Math.PI + 90;
    svg += `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" transform="rotate(${deg.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)})" text-anchor="middle" dominant-baseline="middle" font-family="Black Han Sans" font-size="13" fill="#fff" stroke="#0a0f24" stroke-width="3" paint-order="stroke">${s.label}</text>`;
  });
  svg += `<circle r="96" fill="none" stroke="#0a0f24" stroke-width="5"/><circle r="16" fill="#ffd23f" stroke="#0a0f24" stroke-width="4"/></svg>`;
  wheel.innerHTML = svg;
  const pointer = h('div.wheel-ptr');
  const freeLeft = st.roulette.lastFree !== today();
  const cost = 30;
  const info = h('div.wheel-info');
  const setInfo = () => { info.innerHTML = ''; info.append(Save.state.roulette.lastFree !== today() ? h('b', '오늘 무료 1회!') : h('span', '보석 ', h('b', cost), '개로 한 번 더')); };
  setInfo();
  let rot = 0, busy = false;
  const spinBtn = h('button.btn.yellow.big', '돌리기');
  spinBtn.addEventListener('click', async () => {
    if (busy) return;
    const free = Save.state.roulette.lastFree !== today();
    if (!free && !G.spend('gems', cost)) { deny(spinBtn, '보석이 부족해!'); return; }
    if (free) Save.state.roulette.lastFree = today();
    Save.state.roulette.spins++; Save.touch();
    busy = true; Audio.sfx('click');
    const pick = weighted(segs.map((s, i) => ({ ...s, i })));
    const segA = 360 / n;
    const target = 360 * 6 + (360 - (pick.i * segA + segA / 2)) + (Math.random() - .5) * segA * 0.6;
    rot = Math.ceil(rot / 360) * 360 + target;
    wheel.style.transition = 'transform 4.2s cubic-bezier(.12,.75,.12,1)';
    wheel.style.transform = `rotate(${rot}deg)`;
    // 틱 소리
    let ticks = 0; const tickIv = setInterval(() => { ticks++; Audio.sfx('type'); if (ticks > 40) clearInterval(tickIv); }, 70 + ticks * 4);
    await sleep(4300);
    clearInterval(tickIv);
    // 보상
    const unit = G.rouletteCoinsUnit();
    if (pick.coins) { G.addCoins(pick.coins * unit); flyTo('coins', wheel, bar.coinEl, 10); bigText(`코인 +${fmt(pick.coins * unit)}`, '#ffd23f'); }
    if (pick.gems) { G.addGems(pick.gems); flyTo('gems', wheel, bar.gemEl, 8); bigText(pick.gems >= 300 ? '대박!!' : `보석 +${pick.gems}`, pick.gems >= 300 ? '#ff5468' : '#d59cff', pick.gems >= 300 ? `보석 +${pick.gems}` : ''); }
    if (pick.part) { const p = G.genPart(Math.max(1, G.rollPartRarity(1))); bigText('부품 획득!', '#4cb0ff', p.name); }
    Audio.sfx(pick.gems >= 300 ? 'levelup' : 'reveal', { rarity: pick.gems >= 100 ? 3 : 1 });
    setInfo();
    busy = false;
  });
  modal({ title: '럭키 룰렛', color: 'purple', body: h('div.roulette', h('div.wheel-box', wheel, pointer), info, h('div.center', spinBtn)), closable: true,
    buttons: [{ label: '확인', cls: 'ghost' }], onClose: () => onDone && onDone() });
}
