// 로딩 화면: 실제 진행률 + 단계 문구 + 5초마다 꿀팁 + 5초 지나면 새로고침 버튼
import { h, pick, sleep } from '../core/util.js';
import { registerScreen, go, rich } from '../core/ui.js';
import { preload, path } from '../core/assets.js';
import { Save, VERSION } from '../core/save.js';
import { Audio } from '../core/audio.js';

const TIPS = [
  '고~ 슛! 할 때 원이 겹치는 순간 탭하면 **퍼펙트 슛!**',
  '**공격형**은 지구형에 강하고, **지구형**은 방어형에 강해요.',
  '**방어형**은 공격형의 돌진을 잘 버텨요.',
  '체력이 줄면 팽이가 **비틀거려요.** 그때가 기회!',
  '빨간 **OUT 구멍** 근처에서 세게 맞으면 튕겨 나가요.',
  '필살기 게이지는 **부딪힐수록** 빨리 차요.',
  '같은 팽이를 또 뽑으면 **별 등급**이 올라가요.',
  '**훈련장**은 게임을 꺼도 코인을 모아줘요.',
  '부품 강화가 실패해도 **다음 확률이 올라가요.**',
  '친구랑 **팽이 코드**로 대결해 보세요!',
];

registerScreen('loading', () => {
  const bar = h('i');
  const step = h('div.load-step', '');
  const pct = h('div.load-pct', '0%');
  const tip = h('div.load-tip', { html: rich(pick(TIPS)) });
  const box = h('div.load-box', step, h('div.load-bar', bar), pct, tip);
  const el = h('div.screen.loading', { style: { backgroundImage: `url(${path.bg('keyart')})` } },
    h('div.logo', h('span.l1', '팽생역전'), h('span.l2', '팽이 키우기 RPG')),
    box);
  let tipTimer = setInterval(() => {
    tip.style.opacity = 0;
    setTimeout(() => { tip.innerHTML = rich(pick(TIPS)); tip.style.opacity = 1; }, 300);
  }, 5000);
  const refreshTimer = setTimeout(() => {
    if (el._done) return;
    box.append(h('button.btn.small.ghost.load-refresh', { onclick: () => location.reload() }, '새로고침'));
  }, 5000);
  el._cleanup = () => { clearInterval(tipTimer); clearTimeout(refreshTimer); };
  (async () => {
    let shown = 0;
    await preload((k, label) => {
      step.textContent = label;
      shown = Math.max(shown, k);
      bar.style.width = (shown * 92) + '%';
      pct.textContent = Math.round(shown * 92) + '%';
    });
    step.textContent = '글꼴 준비하는 중';
    try { await Promise.race([document.fonts.ready, sleep(2500)]); await document.fonts.load('40px "Black Han Sans"'); } catch (e) {}
    bar.style.width = '100%'; pct.textContent = '100%';
    step.textContent = '준비 완료!';
    el._done = true;
    await sleep(250);
    box.innerHTML = '';
    box.append(h('div.center', h('div.tap-start', '화면을 터치해서 시작')));
    const startGame = () => {
      el.removeEventListener('pointerdown', startGame);
      window.removeEventListener('keydown', startGame);
      Audio.unlock();
      Audio.setVolumes(Save.settings.bgm, Save.settings.sfx);
      Audio.sfx('go');
      Audio.playBgm(Save.state && Save.state.flags.starter ? 'hub' : 'map');
      if (!Save.settings.device) go('device', {}, 'fade');
      else if (!Save.state || !Save.state.flags.starter) go('intro', {}, 'fade');
      else go('home', {}, 'fade');
    };
    el.addEventListener('pointerdown', startGame);
    window.addEventListener('keydown', startGame);
  })();
  return el;
});
