// 처음 시작: 기기 선택 → 이름/캐릭터 → 프롤로그 → 첫 팽이 고르기 → 튜토리얼 배틀
import { h, sleep } from '../core/util.js';
import { registerScreen, go, btn, topImg, charImg, typeChip, rarChip, toast, deny, rich } from '../core/ui.js';
import { Save } from '../core/save.js';
import { Audio } from '../core/audio.js';
import { path } from '../core/assets.js';
import { playDialog } from '../core/dialog.js';
import { runBattle } from '../battle/scene.js';
import { TOPS, TYPES, SKILLS } from '../data/tops.js';
import { baseStats } from '../data/balance.js';
import * as G from '../game.js';
import { playStage } from '../flow.js';

const PHONE = `<svg viewBox="0 0 64 64"><rect x="18" y="6" width="28" height="52" rx="6" fill="#2a3678" stroke="#fff" stroke-width="3"/><rect x="22" y="12" width="20" height="36" rx="2" fill="#7fd0ff"/><circle cx="32" cy="53" r="2.5" fill="#fff"/></svg>`;
const PC = `<svg viewBox="0 0 64 64"><rect x="6" y="10" width="52" height="34" rx="4" fill="#2a3678" stroke="#fff" stroke-width="3"/><rect x="11" y="15" width="42" height="24" rx="2" fill="#7fd0ff"/><path d="M24 54h16M32 44v10" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>`;

registerScreen('device', () => {
  const guess = matchMedia('(pointer: coarse)').matches ? 'mobile' : 'pc';
  const pick = (d) => {
    Audio.sfx('click');
    Save.settings.device = d; Save.saveSettings();
    document.body.classList.toggle('pc', d === 'pc');
    if (!Save.state || !Save.state.flags.starter) go('intro', {}, 'right'); else go('home', {}, 'right');
  };
  const card = (d, label, svg) => h('button.devcard' + (guess === d ? '.rec' : ''), { onclick: () => pick(d) },
    h('div.devicon', { html: svg }), h('div.display', label), guess === d ? h('div.devrec', '추천') : null);
  return h('div.screen.devsel',
    h('div.devtitle.display.stroke', '어디서 플레이해?'),
    h('div.devrow', card('mobile', '모바일', PHONE), card('pc', 'PC', PC)),
    h('div.devnote', '설정에서 언제든 바꿀 수 있어'));
});

registerScreen('intro', () => {
  const st = Save.state;
  const el = h('div.screen.intro', { style: { backgroundImage: `url(${path.bg('keyart')})` } });
  if (st && st.name) { setTimeout(() => prologue(el), 50); return el; }
  let avatar = 'boy';
  const input = h('input.nameinput', { maxlength: 8, placeholder: '이름 입력', autocomplete: 'off', spellcheck: 'false' });
  const av = (id, img) => {
    const b = h('button.avpick' + (avatar === id ? '.on' : ''), { onclick: () => { avatar = id; Audio.sfx('tab'); el.querySelectorAll('.avpick').forEach(x => x.classList.toggle('on', x === b)); } }, charImg(img));
    return b;
  };
  const err = h('div.nameerr');
  const startBtn = btn('시작하기', 'yellow big wide', async () => {
    const name = input.value.trim();
    if (name.length < 2 || name.length > 8 || !/^[가-힣a-zA-Z0-9]+$/.test(name)) {
      err.textContent = '2~8글자 (한글, 영어, 숫자)로 정해줘';
      deny(err); return;
    }
    Save.start();
    Save.state.name = name; Save.state.avatar = avatar;
    Save.save();
    prologue(el);
  });
  const form = h('div.introform.panel',
    h('div.intro-q.display.stroke-s', '너의 이름은?'),
    h('div.avrow', av('boy', 'player_boy'), av('girl', 'player_girl')),
    input, err, startBtn,
    h('div.intro-note', '진행 상황은 이 기기에 저장돼'));
  el.append(h('div.logo.small', h('span.l1', '팽생역전')), form);
  // 한글 조합 중 Enter 방지
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) startBtn.click(); });
  return el;
});

async function prologue(el) {
  el.innerHTML = '';
  Audio.playBgm('map');
  await playDialog('prologue', { bg: 'bg_playground' });
  // 지는 배틀 (연출)
  const me = baseStats('basic_top', 1, 1);
  const foe = baseStats('stone_golem', 6, 1);
  const res = await runBattle({
    mode: 'prologue', kind: 'duel', title: '', stadium: 'st_playground', bg: 'bg_playground', mods: {},
    player: { id: 'basic_top', name: '연습용 팽이', type: 'bal', skill: 'rush', ...me, char: 'me', trainer: Save.state.name },
    foes: [{ id: 'stone_golem', name: '스톤 골렘', type: 'def', skill: 'rockFortress', ...foe, atk: foe.atk * 2.5, char: 'dusik', trainer: '골목대장 두식' }],
    allies: [], timeLimit: 30, aiLevel: 1, forceLose: true, noBack: true,
  });
  await sleep(600);
  res.scene.close();
  await playDialog('prologue_after', { bg: 'bg_shop' });
  starterSelect(el);
}

function starterSelect(el) {
  el.innerHTML = '';
  el.style.backgroundImage = `url(${path.bg('keyart')})`;
  const ids = ['flame_dragon', 'aqua_turtle', 'gale_pegasus'];
  let sel = null;
  const detail = h('div.st-detail');
  const confirm = btn('이 팽이로 할래!', 'yellow big wide', async () => {
    if (!sel) return;
    G.addTop(sel); G.addTop('basic_top');
    Save.state.main = sel;
    Save.state.flags.starter = true;
    Save.state.coins += 200;
    Save.save();
    Audio.sfx('reveal', { rarity: 3 });
    await playDialog('starter_after', { bg: 'bg_shop', top: TOPS[sel].name });
    // 튜토리얼 배틀 (1-1)
    let r = await playStage(0);
    while (r && r.next === 'retry') r = await playStage(0);
    Save.state.flags.tutorial = true; Save.save();
    if (r && r.next === 'next') go('adventure', { autoplay: 1 }, 'fade');
    else go('home', { fromTutorial: true, tab: r && r.next === 'upgrade' ? 'tops' : 'home' }, 'fade');
  });
  confirm.classList.add('disabled');
  const cards = ids.map(id => {
    const t = TOPS[id];
    const c = h('button.stcard', { style: { '--tc': TYPES[t.type].color }, onclick: () => {
      sel = id; Audio.sfx('tab');
      cards.forEach(x => x.classList.toggle('on', x === c));
      confirm.classList.remove('disabled');
      detail.innerHTML = '';
      detail.append(h('div.row', { style: { justifyContent: 'center' } }, typeChip(t.type), h('b', { style: { font: '400 22px/1 var(--f-display)' } }, t.name)),
        h('div.st-desc', TYPES[t.type].desc),
        h('div.st-skill', h('span', '필살기'), h('b', SKILLS[t.skill].name), h('small', SKILLS[t.skill].desc)));
    } }, h('div.stcard-top', topImg(id)), h('div.stcard-name', t.name), typeChip(t.type));
    return c;
  });
  el.append(
    h('div.st-title.display.stroke', '마음이 끌리는 팽이를 골라!'),
    h('div.strow', cards),
    detail,
    h('div', { style: { padding: '0 18px calc(24px + var(--safe-b))', width: '100%' } }, confirm));
  detail.append(h('div.st-desc', '팽이를 눌러서 살펴봐'));
}
