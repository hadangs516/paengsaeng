// 시작점
import { Audio } from './core/audio.js';
import { Save, VERSION } from './core/save.js';
import { preload, IMG, path } from './core/assets.js';
import { $, h } from './core/util.js';
import { go, toast, modal } from './core/ui.js';
import './screens/index.js';

// 화면 높이 (모바일 주소창 대응)
function fitHeight() {
  const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  document.documentElement.style.setProperty('--app-h', Math.round(vh) + 'px');
}
fitHeight();
window.addEventListener('resize', fitHeight);
if (window.visualViewport) window.visualViewport.addEventListener('resize', fitHeight);

// 더블탭 확대/길게 누르기 메뉴 방지
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

// 홈 화면에 추가 (지원 브라우저만)
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__installPrompt = e; });

// 첫 터치에 오디오 켜기
const unlock = () => { Audio.unlock(); Audio.setVolumes(Save.settings.bgm, Save.settings.sfx); };
['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach(t => window.addEventListener(t, unlock, { capture: true }));

// 탭을 나가면 소리 끄고 저장
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { Audio.setMuted(true); if (Save.state) Save.save(); }
  else Audio.setMuted(false);
});
window.addEventListener('pagehide', () => { if (Save.state) Save.save(); });

// 저장소 사용 가능 여부 (사생활 보호 모드 등)
try { localStorage.setItem('__ps_t', '1'); localStorage.removeItem('__ps_t'); } catch (e) { window.__noStorage = true; }
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) {}

// 다른 탭에서 저장하면 이 탭은 낡은 기록이 되므로 저장을 멈추고 새로고침을 권한다
window.addEventListener('storage', (e) => {
  if (e.key !== 'paengsaeng_save_v1' || !Save.state || Save.stale) return;
  Save.stale = true;
  modal({ title: '다른 창에서 플레이 중', color: 'blue', body: h('div.center', { style: { font: '700 15px/1.6 var(--f-body)', color: 'var(--sub)' } }, '다른 창에서 진행한 기록이 있어. 새로고침해서 최신 기록으로 이어 할게!'), buttons: [{ label: '새로고침', cls: 'yellow', onClick: () => location.reload() }] });
});

// 1분마다 자동 저장 + 플레이 시간
setInterval(() => { if (Save.state) { Save.state.playMs += 60000; Save.save(); } }, 60000);

$('.version').textContent = VERSION;
Save.load();
if (Save.settings.device) document.body.classList.toggle('pc', Save.settings.device === 'pc');
else document.body.classList.toggle('pc', !matchMedia('(pointer: coarse)').matches);
$('#backdrop').style.backgroundImage = `url(${path.bg('keyart')})`;

go('loading', {}, 'fade');
