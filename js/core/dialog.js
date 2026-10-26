// 대화창: 화면 아래에 붙고, 한 글자씩 출력. 탭하면 빨리, 다 나오면 다음.
import { h, $, sleep } from './util.js';
import { Audio } from './audio.js';
import { Save } from './save.js';
import { rich } from './ui.js';
import { path, bgCss } from './assets.js';
import { CHARS, DIALOGS } from '../data/story.js';
import { TOPS } from '../data/tops.js';

function fill(text, vars) {
  return text.replace(/\{name\}/g, Save.state?.name || '나').replace(/\{top\}/g, vars.top || (Save.state?.main ? TOPS[Save.state.main].name : '팽이'));
}

// script: DIALOGS 키 또는 배열. opts: { bg(이미지 경로), top }
export async function playDialog(script, opts = {}) {
  const lines = typeof script === 'string' ? DIALOGS[script] : script;
  if (!lines || !lines.length) return;
  const root = $('#dialog-root');
  const dlg = h('div.dlg');
  if (opts.bg) dlg.append(h('div', { style: { position: 'absolute', inset: 0, background: `#05081a ${bgCss(opts.bg)} center/cover`, animation: 'fadeIn .4s ease' } }));
  dlg.append(h('div.dlg-dim'));
  const left = h('img.dlg-char.left.hide', { alt: '' });
  const right = h('img.dlg-char.right.hide', { alt: '' });
  const nameEl = h('div.dlg-name');
  const textEl = h('div.dlg-text');
  const next = h('div.dlg-next');
  const box = h('div.dlg-box', nameEl, textEl, next);
  const choices = h('div.dlg-choices');
  const skip = h('button.btn-back.dlg-skip', '건너뛰기');
  dlg.append(left, right, choices, box, skip);
  root.append(dlg);
  let skipping = false;
  skip.addEventListener('click', (e) => { e.stopPropagation(); Audio.sfx('back'); skipping = true; if (resolveTap) resolveTap(); });
  let resolveTap = null;
  dlg.addEventListener('pointerdown', (e) => { if (e.target.closest('.btn')) return; if (resolveTap) resolveTap(); });
  const keyH = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (resolveTap) resolveTap(); } };
  window.addEventListener('keydown', keyH, true);
  try { document.activeElement && document.activeElement.blur && document.activeElement.blur(); } catch (e) {}
  const waitTap = () => new Promise(r => { resolveTap = () => { resolveTap = null; r(); }; });

  let lastSide = { left: null, right: null };
  const avatarId = Save.state?.avatar === 'girl' ? 'player_girl' : 'player_boy';

  const show = async (who, text) => {
    const c = CHARS[who] || CHARS.narr;
    const isMe = who === 'me';
    const img = isMe ? avatarId : c.img;
    const isNarr = who === 'narr' || (!img && !isMe);
    box.classList.toggle('narr', isNarr);
    nameEl.className = 'dlg-name' + (isNarr ? ' narr' : isMe ? '' : ' right');
    nameEl.textContent = fill(c.name, opts);
    // 캐릭터: 나는 왼쪽, 상대는 오른쪽
    if (!isNarr) {
      const el = isMe ? left : right;
      const other = isMe ? right : left;
      const key = isMe ? 'left' : 'right';
      if (lastSide[key] !== img) {
        el.src = path.char(img); el.classList.remove('hide', 'in'); void el.offsetWidth; el.classList.add('in');
        lastSide[key] = img;
      }
      el.classList.remove('dim'); other.classList.add('dim');
    } else { left.classList.add('dim'); right.classList.add('dim'); }
    // 한 글자씩
    const full = fill(text, opts);
    next.style.visibility = 'hidden';
    let i = 0, done = false;
    const plain = full.replace(/\*\*/g, '');
    const render = (n) => {
      // 강조 표기를 유지하면서 n글자까지
      let out = '', cnt = 0, bold = false;
      for (let k = 0; k < full.length && cnt < n; k++) {
        if (full.startsWith('**', k)) { bold = !bold; out += '**'; k++; continue; }
        out += full[k]; cnt++;
      }
      if (bold) out += '**';
      textEl.innerHTML = rich(out);
    };
    resolveTap = () => { i += 6; }; // 탭할 때마다 더 빠르게
    while (i < plain.length && !skipping) {
      i++;
      render(i);
      if (i % 2 === 0) Audio.sfx('type');
      await sleep(26);
    }
    render(plain.length);
    resolveTap = null;
    next.style.visibility = 'visible';
    if (!skipping) await waitTap();
  };

  const askChoice = (list) => new Promise(res => {
    choices.innerHTML = '';
    list.forEach((ch, idx) => {
      const b = h('button.btn' + (idx === 0 ? '.yellow' : '.ghost'), { style: { animationDelay: idx * 0.07 + 's' }, onclick: (e) => { e.stopPropagation(); Audio.sfx('click'); choices.innerHTML = ''; res(idx); } }, fill(ch.text || ch, opts));
      choices.append(b);
    });
  });

  for (const line of lines) {
    if (skipping) {
      // 건너뛰어도 선택지/퀴즈는 해야 한다
      if (!line.choice && !line.quiz) continue;
      skipping = false;
    }
    if (Array.isArray(line)) { await show(line[0], line[1]); continue; }
    if (line.choice) {
      next.style.visibility = 'hidden';
      const idx = await askChoice(line.choice);
      opts.onChoice && opts.onChoice(idx);
      for (const r of line.choice[idx].reply || []) await show(r[0], r[1]);
    } else if (line.quiz) {
      // 기억력 퀴즈: 틀리면 처음부터
      let ok = false;
      while (!ok) {
        ok = true;
        for (const q of line.quiz) {
          await showQ(q.q);
          const idx = await askChoice(q.options.map(t => ({ text: t })));
          if (idx !== q.answer) { ok = false; Audio.sfx('deny'); for (const r of line.fail) await show(r[0], r[1]); break; }
          Audio.sfx('star', { i: 1 });
        }
      }
    }
  }
  async function showQ(q) {
    box.classList.add('narr'); nameEl.className = 'dlg-name narr';
    textEl.innerHTML = rich(q); next.style.visibility = 'hidden';
  }

  window.removeEventListener('keydown', keyH, true);
  dlg.style.transition = 'opacity .25s'; dlg.style.opacity = '0';
  await sleep(250);
  dlg.remove();
}
