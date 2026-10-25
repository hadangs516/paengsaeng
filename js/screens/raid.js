// 돌발 이벤트: 흑회전단 습격 (문방구를 지켜라)
import { h } from '../core/util.js';
import { icon, btn, rich, toast } from '../core/ui.js';
import { Save } from '../core/save.js';
import { Audio } from '../core/audio.js';
import { path } from '../core/assets.js';
import { playDialog } from '../core/dialog.js';
import { runBattle } from '../battle/scene.js';
import { foeUnit, playerUnit } from '../flow.js';
import { stageCoins } from '../data/balance.js';
import * as G from '../game.js';

export async function playRaid(bar) {
  const st = Save.state;
  if (!(st.raid.until > Date.now())) { toast('습격이 끝났어'); return; }
  const idx = Math.min(st.progress, 61);
  await playDialog('raid_pre', { bg: 'bg_shop' });
  const foes = [
    foeUnit({ char: 'grunt', top: 'shadow_panther', lv: -1 }, idx, 'gauntlet'),
    foeUnit({ char: 'grunt', top: 'venom_viper', lv: 0 }, idx, 'gauntlet'),
    foeUnit({ char: 'grunt', top: 'chaos_demon', lv: -3 }, idx, 'gauntlet'),
  ];
  const res = await runBattle({ mode: 'raid', kind: 'gauntlet', title: '흑회전단 습격!', stadium: 'st_playground', bg: 'bg_shop', mods: {}, player: playerUnit(), allies: [], foes, timeLimit: 75, aiLevel: 0.6, recCp: 0, myCp: 0 });
  const scene = res.scene;
  if (res.cancel) { scene.close(); Audio.playBgm('hub'); return; }
  G.recordBattle(res);
  if (res.win) {
    const coins = stageCoins(idx, false) * 3, gems = 60;
    const p = G.genPart(Math.max(2, G.rollPartRarity(1)));
    st.coins += coins; st.gems += gems; st.raid.until = 0; st.raid.done++;
    G.bus.emit('coins'); G.bus.emit('gems'); Save.save();
    Audio.sfx('win');
    await new Promise(r => scene.showResult((el) => {
      el.append(h('div.res-title.win.display.stroke', '습격 저지!'),
        h('div.res-rewards', h('div.res-rw', icon('coin'), h('span', '+' + coins.toLocaleString('ko-KR'))), h('div.res-rw.first', icon('gem'), h('span', '+' + gems)), h('div.res-rw', icon('ring'), h('span', p.name))),
        h('div.res-btns', btn('확인', 'yellow', () => r())));
    }));
    scene.close();
    await playDialog('raid_post', { bg: 'bg_shop' });
  } else {
    Audio.sfx('lose');
    await new Promise(r => scene.showResult((el) => {
      el.append(h('div.res-title.lose.display.stroke', '막지 못했어…'), h('div.res-tip', { html: rich('아직 습격이 끝나지 않았어. **팽이를 키워서 다시 도전!**') }), h('div.res-btns', btn('확인', 'yellow', () => r())));
    }));
    scene.close();
  }
  Audio.playBgm('hub');
  const b = document.querySelector('.raidbanner'); if (b) b.classList.toggle('hidden', !(Save.state.raid.until > Date.now()));
}
