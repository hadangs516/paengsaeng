// 도전 탭: 무한의 탑, 친구 대전 (팽이 코드)
import { h, sleep } from '../core/util.js';
import { icon, topImg, charImg, typeChip, toast, deny, btn, modal, rich, countTo } from '../core/ui.js';
import { Save } from '../core/save.js';
import { Audio } from '../core/audio.js';
import { path, bgCss } from '../core/assets.js';
import { TOPS, TYPES } from '../data/tops.js';
import { combatPower } from '../data/balance.js';
import { runBattle } from '../battle/scene.js';
import { towerConfig, playerUnit } from '../flow.js';
import * as G from '../game.js';
import { rewardPopup } from './common.js';

const fmt = (n) => Math.round(n).toLocaleString('ko-KR');

export function buildChallengeTab(bar) {
  const el = h('div.chaltab');
  const render = () => {
    el.innerHTML = '';
    const tw = Save.state.tower;
    const cfg = towerConfig(tw.floor);
    const foe = cfg.foes[0];
    el.append(h('div.tabhead', h('b.display', '도전')));
    // 무한의 탑
    el.append(h('div.chcard.tower',
      h('div.chc-bg', { style: { backgroundImage: bgCss('bg_chaos') } }),
      h('div.chc-body',
        h('div.chc-title.display.stroke-s', '무한의 탑'),
        h('div.chc-floor', h('b.display', tw.floor + '층'), h('span', `최고 ${tw.best}층`)),
        h('div.chc-foe', h('div.chc-foeimg', topImg(foe.id)), h('div', h('div', h('b', foe.trainer)), h('div.row', { style: { gap: '6px' } }, typeChip(foe.type), h('span.chc-cp', '전투력 ' + fmt(cfg.recCp))))),
        h('div.chc-rw', h('span', '첫 돌파 보상'), icon('gem'), h('b', '+' + towerGems(tw.floor)), tw.floor % 10 === 0 ? h('em', '보스층!') : null),
        btn('도전하기', 'yellow', () => playTower()))));
    // 친구 대전
    el.append(h('div.chcard.friend',
      h('div.chc-body',
        h('div.chc-title.display.stroke-s', '친구 대전'),
        h('div.chc-desc', { html: rich('내 **팽이 코드**를 친구에게 보내고,\n친구 코드를 붙여 넣으면 친구 팽이와 대결!') }),
        h('div.chc-stat', `친구 대전 ${Save.state.friend.played}판 · ${Save.state.friend.wins}승`),
        h('div.row', { style: { gap: '8px' } }, btn('내 코드 복사', 'small', copyCode), btn('친구랑 대결', 'small green', enterCode)))));
  };
  render();
  return el;

  async function playTower() {
    const floor = Save.state.tower.floor;
    const cfg = towerConfig(floor);
    const res = await runBattle(cfg);
    const scene = res.scene;
    if (res.cancel) { scene.close(); Audio.playBgm('hub'); return; }
    G.recordBattle(res);
    const tw = Save.state.tower;
    let gems = 0, coins = Math.round(150 + floor * 40);
    if (res.win) {
      if (floor > tw.best) { tw.best = floor; gems = towerGems(floor); }
      tw.floor = floor + 1;
      Save.state.coins += coins; Save.state.gems += gems;
      G.bus.emit('coins'); G.bus.emit('gems'); Save.save();
      Audio.sfx('win');
    } else { coins = res.how === 'giveup' ? 0 : Math.round(coins * 0.3); Save.state.coins += coins; G.bus.emit('coins'); Save.save(); Audio.sfx('lose'); }
    await new Promise(r => scene.showResult((el2) => {
      el2.append(h('div.res-title.display.stroke.' + (res.win ? 'win' : 'lose'), res.win ? `${floor}층 돌파!` : '패배…'),
        h('div.res-rewards', h('div.res-rw', icon('coin'), h('span', '+' + fmt(coins))), gems ? h('div.res-rw.first', icon('gem'), h('span', '+' + fmt(gems))) : null),
        res.win ? null : h('div.res-tip', { html: rich('팽이를 더 키우고 다시 도전해 보자!') }),
        h('div.res-btns', btn('확인', 'yellow', () => r())));
    }));
    scene.close();
    Audio.playBgm('hub');
    render();
  }
}

const towerGems = (f) => 15 + Math.floor(f / 2) * 2 + (f % 10 === 0 ? 100 : 0);

// ───── 팽이 코드 ─────
function checksum(s) { let x = 7; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) % 99991; return x.toString(36); }
function makeCode() {
  const u = playerUnit();
  const data = { n: Save.state.name, a: Save.state.avatar, t: u.id, x: u.axis, s: [u.atk, u.def, u.hp, u.spd, u.crit].map(v => Math.round(v * 100) / 100), l: G.topLv(u.id), r: G.topStar(u.id) };
  const b = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  return 'TOP-' + b + '-' + checksum(b);
}
function readCode(code) {
  const m = (code || '').trim().replace(/\s+/g, '').match(/^TOP-(.+)-([0-9a-z]+)$/);
  if (!m || checksum(m[1]) !== m[2]) return null;
  try { const d = JSON.parse(decodeURIComponent(escape(atob(m[1])))); if (!TOPS[d.t]) return null; return d; } catch (e) { return null; }
}
async function copyCode() {
  const code = makeCode();
  try { await navigator.clipboard.writeText(code); toast('내 팽이 코드 복사 완료! 친구한테 보내 봐', 'good'); }
  catch (e) {
    modal({ title: '내 팽이 코드', color: 'blue', body: h('div', h('div.center', { style: { color: 'var(--sub)', font: '700 14px/1.5 var(--f-body)', marginBottom: '8px' } }, '아래 코드를 길게 눌러 복사해'), h('textarea.codebox', { readonly: true }, code)), buttons: [{ label: '확인', cls: 'yellow' }], closable: true });
  }
}
function enterCode() {
  const ta = h('textarea.codebox', { placeholder: '친구의 팽이 코드를 붙여 넣어 줘' });
  const err = h('div.nameerr');
  modal({ title: '친구랑 대결', color: 'blue', body: h('div', ta, err), closable: true,
    buttons: [{ label: '돌아가기', cls: 'ghost' }, { label: '대결!', cls: 'yellow', onClick: (b, close) => {
      const d = readCode(ta.value);
      if (!d) { err.textContent = '코드가 올바르지 않아. 다시 확인해 줘'; Audio.sfx('deny'); return false; }
      close(); setTimeout(() => friendBattle(d), 250);
      return false;
    } }] });
}
async function friendBattle(d) {
  const t = TOPS[d.t];
  const foe = { id: d.t, name: t.name, type: t.type, axis: d.x || t.type, skill: t.skill, atk: d.s[0], def: d.s[1], hp: d.s[2], spd: d.s[3], crit: d.s[4], char: null, trainer: d.n };
  const res = await runBattle({ mode: 'friend', kind: 'boss', points: 3, title: `${d.n}의 ${t.name}`, stadium: 'st_city', bg: 'bg_city', mods: {}, player: playerUnit(), allies: [], foes: [foe], timeLimit: 45, aiLevel: 0.75, recCp: combatPower(foe), myCp: G.topCP(Save.state.main) });
  const scene = res.scene;
  if (res.cancel) { scene.close(); Audio.playBgm('hub'); return; }
  Save.state.friend.played++; if (res.win) Save.state.friend.wins++;
  G.recordBattle(res); Save.save();
  Audio.sfx(res.win ? 'win' : 'lose');
  await new Promise(r => scene.showResult((el) => {
    el.append(h('div.res-title.display.stroke.' + (res.win ? 'win' : 'lose'), res.win ? '승리!' : '패배…'),
      h('div.res-how', `${d.n} 상대로 ${res.score.p} : ${res.score.e}`),
      h('div.res-btns', btn('확인', 'yellow', () => r())));
  }));
  scene.close(); Audio.playBgm('hub');
}
