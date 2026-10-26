// 모험 지도: 챕터 카드 + 스테이지 길
import { h, sleep } from '../core/util.js';
import { registerScreen, go, icon, topImg, charImg, toast, deny, backBtn, btn, modal, rich, bigText, confetti } from '../core/ui.js';
import { Save } from '../core/save.js';
import { Audio } from '../core/audio.js';
import { path, bgCss } from '../core/assets.js';
import { TOPS, TYPES } from '../data/tops.js';
import { STAGES, CHAPTERS, CHARS, MODS } from '../data/story.js';
import * as G from '../game.js';
import { playStage, stageConfig } from '../flow.js';
import { playDialog } from '../core/dialog.js';
import { levelUpPopup, newTopPopup } from './common.js';

const KIND_LABEL = { boss: '보스', royale: '난투', giant: '거대', gauntlet: '연속', tag: '태그', rival: '라이벌' };

registerScreen('adventure', (params = {}) => {
  const st = Save.state;
  const prog = Math.min(st.progress, STAGES.length - 1);
  let chIdx = params.ch ?? STAGES[prog].ch - 1;
  const el = h('div.screen.adv');
  const bg = h('div.adv-bg');
  const head = h('div.adv-head');
  const pathEl = h('div.adv-path.scroll');
  const nav = h('div.adv-nav');
  el.append(bg, head, pathEl, nav);

  const render = () => {
    const ch = CHAPTERS[chIdx];
    bg.style.backgroundImage = bgCss(ch.bg);
    head.innerHTML = '';
    const stages = STAGES.filter(s => s.ch === ch.id);
    const starSum = stages.reduce((a, s) => a + (st.stars[s.idx] || 0), 0);
    head.append(
      backBtn(() => go('home', {}, 'left')),
      h('div.adv-chinfo',
        h('div.adv-chno', { style: { background: ch.color } }, `${ch.id}장`),
        h('div', h('div.adv-chname.display.stroke-s', ch.title), h('div.adv-chsub', ch.name, MODS[ch.mod]?.label ? ` · ${MODS[ch.mod].label}` : ''))),
      h('div.adv-stars', h('span', '★'), `${starSum}/${stages.length * 3}`));
    // 스테이지 노드 (지그재그 길)
    pathEl.innerHTML = '';
    const wrap = h('div.adv-nodes');
    const n = stages.length;
    stages.forEach((s, i) => {
      const unlocked = s.idx <= st.progress;
      const cleared = !!st.cleared[s.idx];
      const isNow = s.idx === st.progress;
      const stars = st.stars[s.idx] || 0;
      const x = [50, 74, 62, 30, 22, 44, 72, 58, 34][i % 9];
      const foe = s.foes[0];
      const node = h('button.anode' + (unlocked ? '' : '.locked') + (cleared ? '.clear' : '') + (isNow ? '.now' : '') + (s.kind === 'boss' ? '.boss' : ''),
        { style: { left: x + '%', top: (i * 108 + 40) + 'px' }, onclick: () => tapStage(s, unlocked, node) },
        h('div.an-disc', unlocked ? topImg(foe.top) : icon('lock')),
        KIND_LABEL[s.kind] ? h('div.an-kind' + (s.kind === 'boss' ? '.boss' : ''), KIND_LABEL[s.kind]) : null,
        h('div.an-label', h('b', s.id), h('span', s.name)),
        cleared ? h('div.an-stars', [0, 1, 2].map(k => h('i' + (k < stars ? '.on' : ''), '★'))) : null,
        isNow ? h('div.an-now', '도전!') : null);
      wrap.append(node);
    });
    // 길 (점선)
    const svgH = n * 108 + 90;
    let d = '';
    stages.forEach((s, i) => { const x = [50, 74, 62, 30, 22, 44, 72, 58, 34][i % 9]; d += (i ? ' L ' : 'M ') + x + ' ' + (i * 108 + 76); });
    wrap.prepend(h('div.an-road', { html: `<svg viewBox="0 0 100 ${svgH}" preserveAspectRatio="none" style="width:100%;height:${svgH}px"><path d="${d}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.6" stroke-dasharray="2 2.4" vector-effect="non-scaling-stroke" style="stroke-width:5px"/></svg>` }));
    wrap.style.height = svgH + 'px';
    pathEl.append(wrap);
    // 현재 스테이지로 스크롤
    setTimeout(() => {
      const nowNode = pathEl.querySelector('.anode.now') || pathEl.querySelector('.anode.clear:last-of-type');
      if (nowNode) pathEl.scrollTop = Math.max(0, nowNode.offsetTop - pathEl.clientHeight / 2 + 40);
    }, 30);
    // 챕터 이동
    nav.innerHTML = '';
    const maxCh = STAGES[Math.min(st.progress, STAGES.length - 1)].ch - 1;
    nav.append(
      h('button.btn.small' + (chIdx > 0 ? '' : '.gray'), { onclick: () => { if (chIdx > 0) { Audio.sfx('tab'); chIdx--; render(); } } }, '이전 장'),
      h('div.adv-dots', CHAPTERS.map((c, i) => h('i' + (i === chIdx ? '.on' : i <= maxCh ? '.open' : '')))),
      h('button.btn.small' + (chIdx < maxCh ? '' : '.gray'), { onclick: () => { if (chIdx < maxCh) { Audio.sfx('tab'); chIdx++; render(); } else deny(null, '지금 장을 끝내면 열려!'); } }, '다음 장'));
  };

  async function tapStage(s, unlocked, node) {
    if (!unlocked) { deny(node, '앞 스테이지를 먼저 깨야 해!'); return; }
    Audio.sfx('click');
    await runStageLoop(s.idx);
  }

  async function runStageLoop(idx) {
    let cur = idx;
    const chBefore = STAGES[Math.min(Save.state.progress, STAGES.length - 1)].ch - 1;
    while (true) {
      const r = await playStage(cur);
      if (r.cancel) break;
      // 엔딩
      if (r.win && r.stage.final && r.first) { await ending(); return; }
      // 장 클리어 → 다음 장 안내
      const nextIdx = cur + 1;
      if (r.next === 'retry') continue;
      if (r.next === 'next' && nextIdx < STAGES.length) { cur = nextIdx; continue; }
      if (r.next === 'upgrade') { go('home', { tab: G.unlocked('upgrade') ? 'upgrade' : 'tops' }, 'left'); return; }
      break;
    }
    // 장이 바뀌었으면 그 장으로
    const ch = STAGES[Math.min(Save.state.progress, STAGES.length - 1)].ch - 1;
    if (ch !== chBefore && Save.state.progress < STAGES.length) {
      chIdx = ch;
      Audio.sfx('levelup');
      bigText(`N장 클리어!`.replace('N', String(ch)), '#ffd23f', `다음: ${CHAPTERS[ch].name}`);
      confetti(150);
    }
    Audio.playBgm('map');
    render();
  }

  async function ending() {
    // 갤럭시 오메가는 보상 단계에서 이미 지급됨. 여기서는 연출만
    Save.state.flags.endingSeen = true; Save.save();
    await newTopPopup('galaxy_omega', { isNew: true });
    const card = h('div.ending',
      h('div.end-bg', { style: { backgroundImage: `url(${path.bg('keyart')})` } }),
      h('div.end-in',
        h('div.end-sub', '동네 꼴찌, 팽이왕이 되다'),
        h('div.logo', h('span.l1', '팽생역전')),
        h('div.end-clear.display.stroke', 'CLEAR'),
        h('div.end-txt', { html: rich(`플레이해 줘서 고마워, **${Save.state.name}**!\n이제 **무한의 탑**에서 끝없이 강해져 보자.`) }),
        btn('계속하기', 'yellow big', () => { card.remove(); go('home', { tab: 'challenge' }, 'fade'); })));
    document.querySelector('#app').append(card);
    Audio.playBgm('hub');
    Audio.sfx('win');
    setTimeout(() => confetti(200), 600);
  }

  el._onShow = () => {
    Audio.playBgm('map');
    render();
    if (Save.state.flags.ending && !Save.state.flags.endingSeen) ending();
    else if (params.autoplay !== undefined) runStageLoop(params.autoplay);
  };
  return el;
});
