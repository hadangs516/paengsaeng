// 스테이지 진행: 대사 → 배틀 → 결과/보상 → 대사
import { runBattle } from './battle/scene.js';
import { playDialog } from './core/dialog.js';
import { Save } from './core/save.js';
import { Audio } from './core/audio.js';
import { h, sleep } from './core/util.js';
import { icon, topImg, countTo, btn, modal, toast, rich, go, confetti } from './core/ui.js';
import { path } from './core/assets.js';
import { TOPS, TYPES, RARITY } from './data/tops.js';
import { STAGES, CHAPTERS, CHARS, MODS } from './data/story.js';
import * as G from './game.js';
import { combatPower, baseStats, towerLevel } from './data/balance.js';
import { partCard, levelUpPopup, newTopPopup } from './screens/common.js';

export function playerUnit(id = Save.state.main) {
  const s = G.topStats(id);
  const t = TOPS[id];
  return { id, name: t.name, type: t.type, axis: G.axisType(id), skill: t.skill, ...s, char: 'me', trainer: Save.state.name };
}

export function foeUnit(f, idx, kind) {
  const s = G.enemyStats(f, idx, kind);
  const t = TOPS[f.top];
  const ch = CHARS[f.char];
  return { id: f.top, name: t.name, type: t.type, axis: t.type, skill: t.skill, ...s, scale: f.scale || 1, dark: f.dark, char: f.char, trainer: ch ? ch.name : t.name };
}

export function stageConfig(idx) {
  const st = STAGES[idx];
  const ch = CHAPTERS[st.ch - 1];
  const foes = st.foes.map(f => foeUnit(f, idx, st.kind));
  const allies = (st.allies || []).map(f => ({ ...foeUnit(f, idx, 'ally'), ally: true }));
  const player = playerUnit();
  const recCp = Math.round(combatPower(foes[0]) * (st.kind === 'royale' ? 1.05 : st.kind === 'gauntlet' ? 1.15 : st.kind === 'giant' ? 0.9 : 1));
  return {
    mode: 'story', stageIdx: idx, kind: st.kind === 'rival' ? 'duel' : st.kind,
    title: `${st.id}  ${st.name}`, stadium: ch.stadium, bg: ch.bg, mods: MODS[ch.mod] || {},
    player, allies, foes,
    points: st.kind === 'boss' ? 3 : 0,
    final: st.final,
    timeLimit: st.kind === 'giant' ? 75 : st.kind === 'royale' ? 55 : st.kind === 'gauntlet' ? 70 : 45,
    aiLevel: Math.min(0.85, 0.3 + idx * 0.01 + (st.kind === 'boss' ? 0.15 : 0)),
    tutorial: !!st.tutorial,
    recCp, myCp: G.topCP(Save.state.main),
  };
}

// 스토리 스테이지 한 판
export async function playStage(idx, opts = {}) {
  const st = STAGES[idx];
  const first = !Save.state.cleared[idx];
  const ch = CHAPTERS[st.ch - 1];
  if (st.pre && (first || opts.replayDialog)) await playDialog(st.pre, { bg: ch.bg });
  const cfg = stageConfig(idx);
  const res = await runBattle(cfg);
  const scene = res.scene;
  if (res.cancel) { scene.close(); Audio.playBgm('map'); return { cancel: true }; }
  G.recordBattle(res);
  let next = null;
  if (res.win) {
    const rw = G.stageReward(idx, res);
    next = await new Promise(r => showWin(scene, cfg, res, rw, r));
  } else {
    const coins = res.how === 'giveup' ? 0 : G.loseReward(idx);
    next = await new Promise(r => showLose(scene, cfg, res, coins, r));
  }
  scene.close();
  if (res.win && st.post && first) {
    await playDialog(st.post, { bg: ch.bg });
  }
  // 레벨업 축하는 결과/대사가 끝난 뒤에 (다음 배틀을 가리지 않게)
  if (scene._lvUps && next !== 'next' && next !== 'retry') await new Promise(r => { levelUpPopup(Save.state.lv, r); });
  else if (scene._lvUps) toast('플레이어 **레벨 업!** Lv.' + Save.state.lv, 'good');
  return { win: res.win, next, first, stage: st };
}

function rewardRow(kind, amount, cls = '') {
  const num = h('span.num', '0');
  const el = h('div.res-rw' + (cls ? '.' + cls : ''), kind === 'xp' ? h('span.exp-tag', 'EXP') : icon(kind === 'gems' ? 'gem' : 'coin'), num);
  setTimeout(() => countTo(num, 0, amount, 900), 200);
  return el;
}

function showWin(scene, cfg, res, rw, done) {
  Audio.stopBgm(0.3);
  Audio.sfx('win');
  if (rw.stars === 3 || cfg.points) setTimeout(() => confetti(cfg.points ? 140 : 80), 300);
  scene.showResult((el) => {
    const howTxt = { burst: '버스트 피니시', out: '아웃 피니시', spin: '스핀 피니시', judge: '판정승' }[res.how] || '';
    el.append(h('div.res-title.win.display.stroke', '승리!'), h('div.res-how', howTxt));
    if (rw.first) el.append(h('div.firstclear', '첫 클리어 보너스'));
    const stars = h('div.res-stars', [0, 1, 2].map(() => h('div.res-star.display', '★')));
    const conds = h('div.res-star-cond', h('span', '승리'), h('span', '체력 반 이상'), h('span', '버스트·아웃'));
    el.append(stars, conds);
    [...stars.children].forEach((s, i) => { if (i < rw.stars) setTimeout(() => { s.classList.add('on'); conds.children[i].classList.add('on'); Audio.sfx('star', { i }); }, 400 + i * 280); });
    const rws = h('div.res-rewards', rewardRow('coins', rw.coins), rewardRow('xp', rw.xp), rw.gems ? rewardRow('gems', rw.gems, 'first') : null);
    el.append(rws);
    if (rw.parts.length) {
      const pr = h('div.res-parts', rw.parts.map(p => partCard(p, { small: true })));
      el.append(pr);
    }
    const nextIdx = cfg.stageIdx + 1;
    const hasNext = nextIdx < STAGES.length && STAGES[nextIdx].ch === STAGES[cfg.stageIdx].ch;
    el.append(h('div.res-btns',
      btn('돌아가기', 'ghost', () => done('back')),
      btn('다시하기', '', () => done('retry')),
      hasNext ? btn('다음 스테이지', 'yellow', () => done('next')) : btn('확인', 'yellow', () => done('back'))));
  });
  scene._lvUps = rw.lvUps;
}

function showLose(scene, cfg, res, coins, done) {
  Audio.stopBgm(0.3);
  Audio.sfx('lose');
  scene.showResult((el) => {
    el.append(h('div.res-title.lose.display.stroke', '패배…'));
    // 왜 졌는지 한 줄 팁
    const p = cfg.player, f = cfg.foes[0];
    let tip;
    const adv = TYPES[p.type];
    if (cfg.myCp < cfg.recCp * 0.92) tip = `전투력이 부족해! **팽이 레벨업**이나 **부품 강화**로 키워 보자.`;
    else if ((p.type === 'atk' && f.type === 'def') || (p.type === 'def' && f.type === 'sta') || (p.type === 'sta' && f.type === 'atk')) tip = `상성이 불리했어. **${TYPES[Object.keys(TYPES).find(k => ({ atk: 'sta', sta: 'def', def: 'atk' })[k] === f.type)]?.name || '다른'} 팽이**로 바꿔 보자!`;
    else tip = `**대시**로 먼저 들이받고, 게이지가 차면 바로 **필살기!**`;
    el.append(h('div.res-tip', { html: rich(tip) }));
    if (coins) el.append(h('div.res-rewards', rewardRow('coins', coins)));
    el.append(h('div.res-btns',
      btn('돌아가기', 'ghost', () => done('back')),
      btn('강화하러 가기', 'green', () => done('upgrade')),
      btn('다시하기', 'yellow', () => done('retry'))));
  });
}

// 무한의 탑
export function towerConfig(floor) {
  const pool = Object.keys(TOPS).filter(id => id !== 'basic_top');
  const id = pool[(floor * 7 + 3) % pool.length];
  const boss = floor % 10 === 0;
  const lv = towerLevel(floor);
  const s = baseStats(id, lv, Math.min(5, 1 + Math.floor(floor / 12)));
  const gear = 1.6 + floor * 0.02;
  const foe = { id, name: TOPS[id].name, type: TOPS[id].type, axis: TOPS[id].type, skill: TOPS[id].skill, ...s, atk: s.atk * gear, def: s.def * gear, hp: s.hp * gear * (boss ? 1.6 : 1), scale: boss ? 1.25 : 1, char: boss ? 'chaos' : 'grunt', trainer: boss ? `${floor}층 수호자` : `${floor}층 도전자` };
  const mods = [{}, MODS.ice, MODS.lava, MODS.sand, MODS.wind, MODS.neon, MODS.chaos][floor % 7];
  return {
    mode: 'tower', title: `무한의 탑 ${floor}층`, stadium: 'st_tower', bg: 'bg_chaos', mods,
    kind: boss ? 'boss' : 'duel', points: boss ? 3 : 0,
    player: playerUnit(), allies: [], foes: [foe], timeLimit: 45,
    aiLevel: Math.min(0.9, 0.5 + floor * 0.01),
    recCp: combatPower(foe), myCp: G.topCP(Save.state.main),
  };
}
