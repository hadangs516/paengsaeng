// 뽑기 탭: 캡슐 뽑기 (1회 / 10회), 천장 표시, 개봉 연출
import { h, sleep } from '../core/util.js';
import { icon, topImg, typeChip, rarChip, starsEl, toast, deny, btn, modal, app, confetti } from '../core/ui.js';
import { Save } from '../core/save.js';
import { Audio } from '../core/audio.js';
import { path } from '../core/assets.js';
import { TOPS, RARITY, SKILLS, GACHA_POOL } from '../data/tops.js';
import { GACHA_COST, GACHA_RATE, GACHA_PITY } from '../data/balance.js';
import * as G from '../game.js';

const fmt = (n) => Math.round(n).toLocaleString('ko-KR');

export function buildGachaTab(bar) {
  const el = h('div.gachatab');
  const pityEl = h('div.g-pity');
  const machine = h('div.g-machine', h('img', { src: path.ui('gacha_machine'), alt: '' }), h('div.g-shine'));
  const refresh = () => {
    const left = GACHA_PITY - Save.state.gacha.pity;
    pityEl.innerHTML = '';
    pityEl.append(h('span', '전설 이상 확정까지 '), h('b', left + '회'));
  };
  refresh();
  const showcase = h('div.g-show', GACHA_POOL.filter(id => TOPS[id].rarity >= 3).map(id => h('div.g-feat', { style: { '--rc': RARITY[TOPS[id].rarity].color } }, topImg(id))));
  const b1 = h('button.btn.purple.g-btn', h('span', '1회 뽑기'), h('span.cost', icon('gem'), fmt(GACHA_COST.one)));
  const b10 = h('button.btn.yellow.g-btn', h('span', '10회 뽑기'), h('span.cost', icon('gem'), fmt(GACHA_COST.ten)));
  b1.addEventListener('click', () => pull(1, b1));
  b10.addEventListener('click', () => pull(10, b10));
  el.append(
    h('div.tabhead', h('b.display', '팽이 뽑기'), h('button.btn-mini', { onclick: showRates }, '확률')),
    h('div.g-stage', showcase, machine),
    pityEl,
    h('div.g-note', '10회 뽑기는 에픽 이상 1개 보장'),
    h('div.g-btns', b1, b10));

  let busy = false;
  async function pull(n, b) {
    if (busy) return;
    const cost = n >= 10 ? GACHA_COST.ten : GACHA_COST.one;
    if (Save.state.gems < cost) { deny(b, '보석이 부족해! 스테이지 첫 클리어, 미션, 출석으로 모을 수 있어'); return; }
    busy = true;
    const res = G.gachaPull(n);
    refresh();
    await playOpening(res, machine);
    busy = false;
  }
  return el;
}

function showRates() {
  Audio.sfx('click');
  const rows = [4, 3, 2, 1].map(r => h('div.rate-row', h('span.rar-chip', { style: { background: RARITY[r].color } }, RARITY[r].name), h('span.rate-tops', GACHA_POOL.filter(id => TOPS[id].rarity === r).map(id => TOPS[id].name).join(', ')), h('b', GACHA_RATE[r] + '%')));
  modal({ title: '뽑기 확률', color: 'purple', body: h('div', rows, h('div.rate-note', `${GACHA_PITY}회 안에 전설 이상이 꼭 나와. 같은 팽이가 또 나오면 별 등급이 올라가!`)), buttons: [{ label: '확인', cls: 'yellow' }], closable: true });
}

function capsuleEl(r) {
  return h('div.capsule', { style: { '--rc': RARITY[r].color } }, h('div.cap-top'), h('div.cap-bot'), h('div.cap-band'));
}

async function playOpening(res, machine) {
  const best = Math.max(...res.map(x => x.rarity));
  // 기계 흔들기
  machine.classList.add('shake');
  Audio.sfx('drumroll', { dur: 1.0 });
  await sleep(1000);
  machine.classList.remove('shake');
  // 개봉 화면
  const ov = h('div.gopen');
  app().insertBefore(ov, document.querySelector('#modal-root'));
  const cap = capsuleEl(best >= 3 ? best : Math.min(best, 2));
  cap.classList.add('drop');
  const hint = h('div.gopen-hint', '캡슐을 눌러서 열어!');
  ov.append(h('div.gopen-rays', { style: { '--rc': RARITY[best].color } }), cap, hint);
  Audio.sfx('pop');
  await new Promise(r => { ov.addEventListener('pointerdown', r, { once: true }); setTimeout(r, 4500); });
  hint.remove();
  cap.classList.add('open');
  Audio.sfx('reveal', { rarity: best });
  ov.classList.add('flash');
  if (best >= 3) setTimeout(() => confetti(140), 200);
  await sleep(450);
  cap.remove();
  if (res.length === 1) {
    const x = res[0];
    ov.append(resultCard(x, true));
  } else {
    const grid = h('div.gopen-grid');
    ov.append(grid);
    for (let i = 0; i < res.length; i++) {
      const c = resultCard(res[i], false);
      c.style.animationDelay = (i * 0.09) + 's';
      grid.append(c);
      setTimeout(() => Audio.sfx(res[i].rarity >= 3 ? 'reveal' : 'pop', { rarity: res[i].rarity }), i * 90);
    }
  }
  await sleep(500);
  const ok = h('button.btn.yellow.big.gopen-ok', '확인');
  ov.append(ok);
  await new Promise(r => ok.addEventListener('click', r, { once: true }));
  Audio.sfx('click');
  ov.classList.add('closing');
  setTimeout(() => ov.remove(), 250);
}

function resultCard(x, big) {
  const t = TOPS[x.id];
  const tag = x.isNew ? h('span.gr-tag.new', 'NEW') : x.starUp ? h('span.gr-tag.up', '별 UP') : x.maxed ? h('span.gr-tag', `보석 +${x.gems}`) : h('span.gr-tag.dup', '중복');
  return h('div.gres' + (big ? '.big' : '') + '.r' + t.rarity, { style: { '--rc': RARITY[t.rarity].color } },
    h('div.gres-glow'),
    h('div.gres-img', topImg(x.id)),
    tag,
    h('div.gres-name', t.name),
    big ? h('div.row', { style: { justifyContent: 'center', gap: '6px', marginTop: '6px' } }, rarChip(t.rarity), typeChip(t.type)) : h('div.gres-rar', RARITY[t.rarity].name),
    big ? h('div.center', { style: { marginTop: '6px' } }, starsEl(G.topStar(x.id))) : null,
    big ? h('div.gres-skill', h('b', SKILLS[t.skill].name), ' · ', SKILLS[t.skill].desc) : null);
}
