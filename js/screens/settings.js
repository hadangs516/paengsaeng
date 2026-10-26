// 설정: BGM/효과음(바로 적용), 진동, 기기 변경, 지금 저장, 백업 코드, 초기화, 업데이트 기록
import { h } from '../core/util.js';
import { modal, toast, confirmBox, go, btn, rich } from '../core/ui.js';
import { Save, VERSION } from '../core/save.js';
import { Audio } from '../core/audio.js';

const HISTORY = [
  ['v1.0.1', '경기장 9종 그림 추가, 버그 수정, 작은 화면 최적화'],
  ['v1.0.0', '팽생역전 첫 공개! 8장 스토리, 19종 팽이, 무한의 탑, 친구 대전'],
];

export function openSettings() {
  const s = Save.settings;
  const slider = (label, key) => {
    const val = h('span.set-val', Math.round(s[key] * 100) + '');
    const input = h('input.set-range', { type: 'range', min: 0, max: 100, value: Math.round(s[key] * 100) });
    input.style.setProperty('--p', input.value + '%');
    input.addEventListener('input', () => {
      s[key] = input.value / 100; val.textContent = input.value;
      input.style.setProperty('--p', input.value + '%');
      Audio.setVolumes(s.bgm, s.sfx); Save.saveSettings();
    });
    input.addEventListener('change', () => { if (key === 'sfx') Audio.sfx('coin'); });
    return h('div.set-row', h('span.set-label', label), input, val);
  };
  const toggle = (label, get, set) => {
    const b = h('button.set-tog' + (get() ? '.on' : ''), h('i'));
    b.addEventListener('click', () => { set(!get()); b.classList.toggle('on', get()); Audio.sfx('tab'); Save.saveSettings(); });
    return h('div.set-row', h('span.set-label', label), h('div.grow'), b);
  };
  const devRow = h('div.set-row', h('span.set-label', '기기'), h('div.grow'),
    h('div.seg', ['mobile', 'pc'].map(d => h('button' + (s.device === d ? '.on' : ''), { onclick: (e) => {
      s.device = d; Save.saveSettings(); document.body.classList.toggle('pc', d === 'pc');
      e.currentTarget.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === e.currentTarget)); Audio.sfx('tab');
    } }, d === 'pc' ? 'PC' : '모바일'))));
  const body = h('div.settings',
    slider('배경음악', 'bgm'),
    slider('효과음', 'sfx'),
    toggle('진동', () => s.vib, (v) => { s.vib = v; }),
    devRow,
    h('div.set-grid',
      btn('지금 저장', 'green small', () => { if (Save.save()) toast('저장 완료!', 'good'); else toast('이 브라우저는 저장이 막혀 있어. **기록 옮기기** 코드를 꼭 복사해 둬!', 'warn'); }),
      btn('기록 옮기기', 'small', () => openBackup()),
      btn('업데이트 기록', 'small ghost', () => openHistory()),
      btn('조작법', 'small ghost', () => openHelp()),
      window.__installPrompt ? btn('홈 화면에 추가', 'small purple', () => { window.__installPrompt.prompt(); window.__installPrompt = null; }) : null,
      btn('처음부터 하기', 'red small', async () => {
        if (!(await confirmBox('모든 진행 기록이 지워지고 **되돌릴 수 없어.**\n정말 처음부터 할까?', '처음부터', '돌아가기', 'red'))) return;
        Save.reset(); location.reload();
      })),
    h('div.set-ver', '팽생역전 ' + VERSION));
  modal({ title: '설정', color: 'blue', body, closable: true, buttons: [{ label: '확인', cls: 'yellow' }] });
}

function openBackup() {
  const code = Save.exportCode();
  const out = h('textarea.codebox', { readonly: true }, code);
  const inp = h('textarea.codebox', { placeholder: '다른 기기에서 복사한 코드를 붙여 넣어 줘' });
  modal({ title: '기록 옮기기', color: 'blue', closable: true, body: h('div',
    h('div.set-sub', { html: rich('**이 기기의 기록 코드** (다른 기기에 붙여 넣으면 이어서 할 수 있어)') }), out,
    btn('코드 복사', 'small', async () => { try { await navigator.clipboard.writeText(code); toast('복사 완료!', 'good'); } catch (e) { out.select(); toast('코드를 길게 눌러 복사해 줘'); } }),
    h('div.set-sub', { style: { marginTop: '14px' }, html: rich('**다른 기기의 기록 불러오기**') }), inp),
    buttons: [{ label: '돌아가기', cls: 'ghost' }, { label: '불러오기', cls: 'yellow', onClick: async () => {
      if (!inp.value.trim()) { toast('코드를 붙여 넣어 줘', 'warn'); return false; }
      if (!(await confirmBox('지금 기록이 **불러온 기록으로 바뀌어.** 계속할까?', '불러오기'))) return false;
      if (Save.importCode(inp.value)) { toast('불러오기 완료!', 'good'); setTimeout(() => location.reload(), 600); }
      else { toast('코드가 올바르지 않아', 'warn'); return false; }
    } }] });
}

export function openHelp() {
  const row = (k, v) => h('div.help-row', h('b', k), h('span', { html: rich(v) }));
  const pc = document.body.classList.contains('pc');
  modal({ title: '조작법', color: 'blue', closable: true, body: h('div.help',
    row('발사', pc ? '원이 노란 원에 겹칠 때 **Space** 또는 클릭' : '원이 노란 원에 겹칠 때 **화면 탭**'),
    row('이동', pc ? '**WASD / 방향키** 또는 마우스 드래그' : '화면 아무 곳이나 **드래그**'),
    row('대시', pc ? '**Space** 또는 대시 버튼' : '**대시** 버튼'),
    row('필살기', pc ? '게이지가 차면 **E** 또는 필살기 버튼' : '게이지가 차면 **필살기** 버튼'),
    row('승리', '상대 체력 0, 또는 **OUT 구멍**으로 날려 보내기'),
    row('상성', '**공격 > 지구 > 방어 > 공격**')),
    buttons: [{ label: '확인', cls: 'yellow' }] });
}

function openHistory() {
  modal({ title: '업데이트 기록', color: 'blue', closable: true, body: h('div.hist', HISTORY.map(([v, t]) => h('div.hist-row', h('b', v), h('span', t)))), buttons: [{ label: '확인', cls: 'yellow' }] });
}
