// 메인 화면: 상단바 + 탭(홈/팽이/강화/뽑기/도전) + 하단 탭바. 탭은 옆으로 넘어간다.
import { h, $, sleep } from '../core/util.js';
import { registerScreen, go, icon, topImg, charImg, typeChip, starsEl, toast, deny, flyTo, modal, btn, rich, countTo, updateVersionPos } from '../core/ui.js';
import { Save, today } from '../core/save.js';
import { Audio } from '../core/audio.js';
import { path, bgCss } from '../core/assets.js';
import { TOPS, TYPES, RARITY } from '../data/tops.js';
import { STAGES, CHAPTERS } from '../data/story.js';
import * as G from '../game.js';
import { topBar, rewardPopup, levelUpPopup, partCard } from './common.js';
import { buildTopsTab } from './tab_tops.js';
import { buildUpgradeTab } from './tab_upgrade.js';
import { buildGachaTab } from './tab_gacha.js';
import { buildChallengeTab } from './tab_challenge.js';
import { openSettings } from './settings.js';
import { openMissions, openAttendance, openRoulette } from './popups.js';
import { playRaid } from './raid.js';
import { stageConfig } from '../flow.js';

const TABS = [
  { key: 'home', label: '홈', icon: 'tab_home' },
  { key: 'tops', label: '팽이', icon: 'tab_tops' },
  { key: 'upgrade', label: '강화', icon: 'tab_upgrade', lock: 'upgrade' },
  { key: 'gacha', label: '뽑기', icon: 'tab_gacha', lock: 'gacha' },
  { key: 'challenge', label: '도전', icon: 'tab_challenge', lock: 'challenge' },
];
const TAB_FALLBACK = { tab_home: 'home', tab_tops: 'tops', tab_upgrade: 'upgrade', tab_gacha: 'gacha', tab_challenge: 'tower' };
// 아이콘 그림이 없으면 실제 게임 그림으로 대신한다
function tabArt(key) {
  if (key === 'tab_tops') return h('img.tabimg', { src: path.top(Save.state.main || 'flame_dragon'), alt: '' });
  if (key === 'tab_gacha') return h('img.tabimg', { src: path.ui('gacha_machine'), alt: '' });
  return icon(TAB_FALLBACK[key]);
}

registerScreen('home', (params = {}) => {
  G.dailyCheck();
  const el = h('div.screen.home');
  const bar = topBar(() => openSettings());
  const content = h('div.tabcontent');
  const tabbar = h('div.tabbar');
  el.append(bar, content, tabbar);
  let cur = null, curIdx = 0, panel = null;
  const tabEls = {};

  const build = {
    home: () => buildHomeTab(bar, switchTab),
    tops: () => buildTopsTab(bar),
    upgrade: () => buildUpgradeTab(bar),
    gacha: () => buildGachaTab(bar),
    challenge: () => buildChallengeTab(bar),
  };

  function switchTab(key, force) {
    const t = TABS.find(x => x.key === key);
    if (t.lock && !G.unlocked(t.lock)) { deny(tabEls[key], G.UNLOCK[t.lock].text); return; }
    if (cur === key && !force) return;
    const idx = TABS.indexOf(t);
    const dir = idx > curIdx ? 'right' : 'left';
    const old = panel;
    if (old) {
      old.classList.add(dir === 'right' ? 'tp-out-left' : 'tp-out-right');
      if (old._cleanup) old._cleanup();
      setTimeout(() => old.remove(), 260);
    }
    panel = build[key]();
    panel.classList.add('tabpanel', old ? (dir === 'right' ? 'tp-in-right' : 'tp-in-left') : 'tp-in-fade');
    content.append(panel);
    cur = key; curIdx = idx;
    Object.entries(tabEls).forEach(([k, b]) => b.classList.toggle('on', k === key));
    Save.state.flags.lastTab = key;
  }

  for (const t of TABS) {
    const fileOk = icon(t.icon, 'tabimg');
    const b = h('button.tab' + (t.lock && !G.unlocked(t.lock) ? '.locked' : ''), { onclick: () => { Audio.sfx('tab'); switchTab(t.key); } },
      h('div.ti', fileOk.tagName === 'IMG' ? fileOk : tabArt(t.icon)), h('span', t.label));
    tabEls[t.key] = b;
    tabbar.append(b);
  }
  const refreshDots = () => {
    const setDot = (key, n) => {
      const b = tabEls[key]; let d = b.querySelector('.reddot');
      if (n > 0) { if (!d) { d = h('span.reddot'); b.append(d); } d.textContent = n > 9 ? '9+' : n; } else if (d) d.remove();
    };
    setDot('gacha', G.unlocked('gacha') && Save.state.gems >= 100 ? 1 : 0);
    setDot('upgrade', G.unlocked('upgrade') && canQuickUpgrade() ? 1 : 0);
    Object.entries(tabEls).forEach(([k, b]) => { const t = TABS.find(x => x.key === k); b.classList.toggle('locked', !!(t.lock && !G.unlocked(t.lock))); });
  };
  refreshDots();
  const offs = [G.bus.on('coins', refreshDots), G.bus.on('gems', refreshDots), G.bus.on('top', refreshDots)];
  el._cleanup = () => { offs.forEach(f => f()); bar._cleanup(); if (panel && panel._cleanup) panel._cleanup(); };
  el._onShow = () => {
    Audio.playBgm('hub');
    switchTab(params.tab || 'home', true);
    afterEnter(params, bar);
  };
  return el;
});

function canQuickUpgrade() {
  const st = Save.state;
  return st.parts.some(p => !G.equippedBy(p.uid)) && G.autoEquipPreview();
}

// 홈 탭
function buildHomeTab(bar, switchTab) {
  const st = Save.state;
  const prog = Math.min(st.progress, STAGES.length - 1);
  const stage = STAGES[prog];
  const ch = CHAPTERS[stage.ch - 1];
  const main = st.main;
  const t = TOPS[main];
  const cpEl = h('span.num', G.topCP(main).toLocaleString('ko-KR'));
  const el = h('div.hometab');
  el.append(h('div.home-bg', { style: { backgroundImage: bgCss(ch.bg) } }));

  // 왼쪽/오른쪽 둥근 메뉴
  const sideBtn = (ic, label, fn, dot) => {
    const b = h('button.sidebtn', { onclick: () => { Audio.sfx('click'); fn(b); } }, h('div.sb-ic', icon(ic)), h('span', label));
    if (dot) b.append(h('span.reddot', dot === true ? '!' : dot));
    return b;
  };
  const leftCol = h('div.sidecol.left');
  const rightCol = h('div.sidecol.right');
  const refreshSide = () => {
    leftCol.innerHTML = ''; rightCol.innerHTML = '';
    leftCol.append(
      sideBtn('calendar', '출석', () => openAttendance(bar, refreshSide), G.attendAvailable()),
      sideBtn('mission', '미션', () => openMissions(bar, refreshSide), G.missionReady() + G.achReady() || 0));
    rightCol.append(sideBtn('roulette', '룰렛', () => openRoulette(bar, refreshSide), Save.state.roulette.lastFree !== today()));
  };
  refreshSide();

  // 가운데: 대표 팽이
  const showcase = h('div.showcase',
    h('div.sc-ring', { style: { '--tc': TYPES[t.type].color } }),
    h('div.sc-top', topImg(main)),
    h('div.sc-shadow'));
  showcase.addEventListener('click', () => { Audio.sfx('pop'); showcase.classList.remove('boost'); void showcase.offsetWidth; showcase.classList.add('boost'); });
  const info = h('div.sc-info',
    h('div.row', { style: { justifyContent: 'center', gap: '6px' } }, typeChip(t.type), h('span.sc-name.display.stroke-s', t.name)),
    h('div.center', starsEl(G.topStar(main))),
    h('div.sc-cp', h('span.sc-cplabel', '전투력'), cpEl),
    h('div.sc-lv', 'Lv.' + G.topLv(main)));
  // 다음 스테이지보다 약하면 강화하라고 알려준다
  const hint = h('button.cp-hint.hidden', { onclick: () => { Audio.sfx('click'); switchTab(G.unlocked('upgrade') ? 'tops' : 'tops'); } });
  const updHint = () => {
    if (st.progress >= STAGES.length) { hint.classList.add('hidden'); return; }
    const rec = stageConfig(st.progress).recCp, my = G.topCP(Save.state.main);
    hint.classList.toggle('hidden', my >= rec * 0.95);
    hint.innerHTML = '';
    hint.append('다음 상대 추천 전투력 ', h('b', rec.toLocaleString('ko-KR')), ' · 레벨업하러 가기');
  };
  updHint();
  info.append(hint);

  // 훈련장 말풍선
  const idle = h('button.idlebub');
  const updIdle = () => {
    if (!G.unlocked('training')) { idle.classList.add('hidden'); return; }
    const p = G.idlePending();
    idle.classList.remove('hidden');
    idle.innerHTML = '';
    idle.append(h('div.ib-ic', icon('training')), h('div.ib-txt', h('small', p.full ? '훈련장 가득!' : '훈련장'), h('b', h('span', icon('coin')), (p.coins).toLocaleString('ko-KR'))));
    idle.classList.toggle('full', p.full);
    idle.classList.toggle('ready', p.coins > 0);
  };
  idle.addEventListener('click', () => {
    const p = G.idlePending();
    if (p.coins <= 0) { toast('조금만 기다리면 코인이 쌓여!'); return; }
    Audio.sfx('open');
    flyTo('coins', idle, bar.coinEl, 10);
    setTimeout(() => G.idleCollect(), 500);
    setTimeout(updIdle, 600);
  });
  updIdle();
  const idleTimer = setInterval(updIdle, 5000);

  // 흑회전단 습격 배너
  const raidBanner = h('button.raidbanner.hidden', { onclick: () => { Audio.sfx('click'); playRaid(bar); } }, h('div.rb-ic', icon('boss')), h('div', h('b', '흑회전단 습격!'), h('small', '문방구를 지켜줘! 보상 2배')));
  const updRaid = () => { raidBanner.classList.toggle('hidden', !(Save.state.raid.until > Date.now())); };
  updRaid();

  // 모험 버튼
  const cleared = st.progress >= STAGES.length;
  const adv = h('button.advbtn', { onclick: () => { Audio.sfx('click'); go('adventure', {}, 'right'); } },
    h('div.adv-ch', { style: { background: ch.color } }, `${ch.id}장`),
    h('div.adv-txt', h('small', cleared ? '모든 스테이지 클리어!' : ch.name), h('b.display', cleared ? '팽이왕' : `${stage.id} ${stage.name}`)),
    h('div.adv-go.display.stroke-s', '모험'));

  el.append(leftCol, rightCol, h('div.homecenter', idle, showcase, info), raidBanner, h('div.homebottom', adv));
  const off = G.bus.on('top', () => { cpEl.textContent = G.topCP(Save.state.main).toLocaleString('ko-KR'); updHint(); });
  const off2 = G.bus.on('mission', refreshSide);
  el._cleanup = () => { clearInterval(idleTimer); off(); off2(); };
  return el;
}

// 홈 진입 직후: 새로 열린 기능 안내, 습격 이벤트 생성
async function afterEnter(params, bar) {
  const st = Save.state;
  // 기능 열림 알림 (한 번만)
  const notes = [
    ['upgrade', '**강화** 탭이 열렸어! 부품을 끼우고 강화해 보자.'],
    ['gacha', '**뽑기** 탭이 열렸어! 보석으로 새 팽이를 뽑아 봐.'],
    ['training', '**훈련장**이 열렸어! 게임을 꺼도 코인이 쌓여.'],
    ['challenge', '**도전** 탭이 열렸어! 무한의 탑과 친구 대전!'],
  ];
  for (const [k, txt] of notes) {
    if (G.unlocked(k) && !st.flags['open_' + k]) {
      st.flags['open_' + k] = true;
      if (k === 'training') st.idleAt = Date.now() - 20 * 60000; // 처음엔 조금 쌓아둔다
      await sleep(400);
      toast(txt, 'good');
    }
  }
  // 홈 화면에 추가 안내 (한 번만, 지원 브라우저만)
  if (params.fromTutorial && window.__installPrompt && !st.flags.installAsked) {
    st.flags.installAsked = true;
    await sleep(900);
    modal({ title: '홈 화면에 추가', color: 'blue', body: h('div.center', { style: { font: '700 15px/1.6 var(--f-body)', color: 'var(--sub)' }, html: rich('홈 화면에 추가하면 **앱처럼 바로** 들어올 수 있어!') }),
      buttons: [{ label: '나중에', cls: 'ghost' }, { label: '추가하기', cls: 'yellow', onClick: () => { const p = window.__installPrompt; window.__installPrompt = null; if (p) p.prompt(); } }] });
  }
  // 습격 이벤트: 4장 이후, 가끔 등장 (10분 동안)
  if (st.progress >= 28 && st.raid.until < Date.now() && st.raid.nextAt < Date.now() && Math.random() < 0.35) {
    st.raid.until = Date.now() + 10 * 60000;
    st.raid.nextAt = Date.now() + 40 * 60000;
    Save.touch();
    setTimeout(() => { const b = $('.raidbanner'); if (b) { b.classList.remove('hidden'); Audio.sfx('deny'); } }, 800);
  }
  Save.save();
}
