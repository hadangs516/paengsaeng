// 오디오 엔진: WebAudio 합성 BGM 시퀀서 + 효과음 + 팽이 회전음
// 외부 음원 없이 전부 실시간 합성한다. 첫 터치/클릭 때 unlock() 호출 필요.

const N = (m) => 440 * Math.pow(2, (m - 69) / 12); // MIDI → Hz

let ctx = null;
let master, comp, limiter, bgmBus, sfxBus, humBus, delay, delayFb, delayWet, noiseBuf;
let bgmVol = 0.8, sfxVol = 0.9;
let current = null; // 재생 중인 곡 상태
let schedTimer = null;
let muted = false;

function makeNoise() {
  const len = ctx.sampleRate * 1.5;
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function curveDist(amount) {
  const n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / n) * 2 - 1; c[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x)); }
  return c;
}
let distCurve;

export const Audio = {
  get ready() { return !!ctx; },

  unlock() {
    if (ctx) { if (ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC({ latencyHint: 'interactive' });
    // 마스터 체인: 버스 → 컴프 → 메이크업 → 리미터 → 출력 (작게 들린다는 피드백 반영: 충분히 크게)
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.18;
    const makeup = ctx.createGain(); makeup.gain.value = 1.9;
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -4; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.0005; limiter.release.value = 0.08;
    master = ctx.createGain(); master.gain.value = 1;
    comp.connect(makeup); makeup.connect(limiter); limiter.connect(master); master.connect(ctx.destination);

    bgmBus = ctx.createGain(); bgmBus.gain.value = bgmVol * 1.2; bgmBus.connect(comp);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxVol; sfxBus.connect(comp);
    humBus = ctx.createGain(); humBus.gain.value = sfxVol * 0.5; humBus.connect(comp);

    // 공용 딜레이(리드 멜로디용)
    delay = ctx.createDelay(1.0); delayFb = ctx.createGain(); delayWet = ctx.createGain();
    const dFilt = ctx.createBiquadFilter(); dFilt.type = 'lowpass'; dFilt.frequency.value = 2600;
    delay.connect(dFilt); dFilt.connect(delayFb); delayFb.connect(delay); dFilt.connect(delayWet); delayWet.connect(bgmBus);
    delayFb.gain.value = 0.32; delayWet.gain.value = 0.28;

    noiseBuf = makeNoise();
    distCurve = curveDist(18);
    if (ctx.state === 'suspended') ctx.resume();
    if (pendingSong) { const s = pendingSong; pendingSong = null; this.playBgm(s); }
  },

  setVolumes(b, s) {
    bgmVol = b; sfxVol = s;
    if (!ctx) return;
    const t = ctx.currentTime;
    bgmBus.gain.setTargetAtTime(muted ? 0 : b * 1.2, t, 0.05);
    sfxBus.gain.setTargetAtTime(muted ? 0 : s, t, 0.05);
    humBus.gain.setTargetAtTime(muted ? 0 : s * 0.5, t, 0.05);
  },

  // 탭이 숨겨지면 소리 끄기
  setMuted(m) { muted = m; this.setVolumes(bgmVol, sfxVol); if (ctx) { if (m) ctx.suspend().catch(() => {}); else if (ctx.state !== 'closed') ctx.resume().catch(() => {}); } },

  playBgm(name) {
    if (!ctx) { pendingSong = name; return; }
    if (current && current.name === name) return;
    stopSong(0.6);
    const song = SONGS[name];
    if (!song) return;
    current = { name, song, step: 0, next: ctx.currentTime + 0.08, gain: ctx.createGain() };
    current.gain.gain.value = 0.0001;
    current.gain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.5);
    current.gain.connect(bgmBus);
    // 음원 파일이 등록돼 있으면 합성 대신 파일을 반복 재생 (나중에 직접 만든 음악으로 교체 가능)
    if (MUSIC_FILES[name]) {
      const c = current;
      c.file = true;
      loadBuffer(MUSIC_FILES[name]).then(buf => {
        if (current !== c || !buf) { if (current === c) c.file = false; return; }
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        src.connect(c.gain); src.start(); c.src = src;
      });
    }
    if (!schedTimer) schedTimer = setInterval(scheduler, 25);
  },

  stopBgm(fade = 0.5) { stopSong(fade); },

  sfx(name, opt = {}) {
    if (!ctx || muted) return;
    const f = SFX[name];
    if (f) f(ctx.currentTime + 0.005, opt);
  },

  // 팽이 회전음: 배틀 중 매 프레임 갱신. id별로 오실레이터 유지
  hum(id, spinRatio, active) {
    if (!ctx) return;
    let h = hums.get(id);
    if (!h && active) {
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
      o1.type = 'sawtooth'; o2.type = 'triangle';
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4;
      const g = ctx.createGain(); g.gain.value = 0;
      const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 9; lfoG.gain.value = 0;
      lfo.connect(lfoG); lfoG.connect(g.gain);
      o1.connect(f); o2.connect(f); f.connect(g); g.connect(humBus);
      o1.start(); o2.start(); lfo.start();
      h = { o1, o2, f, g, lfo, lfoG };
      hums.set(id, h);
    }
    if (!h) return;
    const t = ctx.currentTime;
    if (!active || spinRatio <= 0.01) {
      h.g.gain.setTargetAtTime(0, t, 0.08);
      h.lfoG.gain.setTargetAtTime(0, t, 0.08);
      setTimeout(() => { try { h.o1.stop(); h.o2.stop(); h.lfo.stop(); } catch (e) {} }, 400);
      hums.delete(id);
      return;
    }
    const base = 70 + spinRatio * 190 + (id === 'p' ? 0 : 7);
    h.o1.frequency.setTargetAtTime(base, t, 0.06);
    h.o2.frequency.setTargetAtTime(base * 2.01, t, 0.06);
    h.f.frequency.setTargetAtTime(base * 3.2, t, 0.06);
    h.g.gain.setTargetAtTime(0.05 + spinRatio * 0.07, t, 0.06);
    // 회전이 약해지면 떨리는 소리
    h.lfo.frequency.setTargetAtTime(4 + spinRatio * 14, t, 0.1);
    h.lfoG.gain.setTargetAtTime(spinRatio < 0.3 ? (0.3 - spinRatio) * 0.12 : 0, t, 0.1);
  },

  stopHums() { for (const id of [...hums.keys()]) this.hum(id, 0, false); },
};

const hums = new Map();
let pendingSong = null;

// 직접 만든 음원으로 바꾸고 싶으면 여기에 경로를 적으면 된다. 예) battle: 'assets/audio/battle.mp3'
const MUSIC_FILES = {};
const bufCache = {};
function loadBuffer(url) {
  if (!bufCache[url]) bufCache[url] = fetch(url).then(r => r.ok ? r.arrayBuffer() : null).then(a => a ? ctx.decodeAudioData(a) : null).catch(() => null);
  return bufCache[url];
}

function stopSong(fade) {
  if (!current) return;
  const c = current; current = null;
  const t = ctx.currentTime;
  c.gain.gain.cancelScheduledValues(t);
  c.gain.gain.setValueAtTime(Math.max(0.0001, c.gain.gain.value), t);
  c.gain.gain.exponentialRampToValueAtTime(0.0001, t + fade);
  if (c.src) try { c.src.stop(t + fade + 0.05); } catch (e) {}
  setTimeout(() => c.gain.disconnect(), fade * 1000 + 200);
}

// ───────────────────────── 악기 ─────────────────────────
function env(g, t, a, peak, d, sus, r, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sus), t + a + d);
  g.gain.setValueAtTime(Math.max(0.0001, peak * sus), t + Math.max(a + d, dur));
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + d, dur) + r);
}

function kick(t, out, vel = 1) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.12);
  g.gain.setValueAtTime(1.1 * vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.4);
  // 클릭
  const n = ctx.createBufferSource(), ng = ctx.createGain(), nf = ctx.createBiquadFilter();
  n.buffer = noiseBuf; nf.type = 'highpass'; nf.frequency.value = 2500;
  ng.gain.setValueAtTime(0.25 * vel, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.015);
  n.connect(nf); nf.connect(ng); ng.connect(out); n.start(t); n.stop(t + 0.03);
}

function snare(t, out, vel = 1) {
  const n = ctx.createBufferSource(), nf = ctx.createBiquadFilter(), ng = ctx.createGain();
  n.buffer = noiseBuf; nf.type = 'bandpass'; nf.frequency.value = 2200; nf.Q.value = 0.7;
  ng.gain.setValueAtTime(0.55 * vel, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  n.connect(nf); nf.connect(ng); ng.connect(out); n.start(t, Math.random()); n.stop(t + 0.22);
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
  g.gain.setValueAtTime(0.45 * vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.14);
}

function clap(t, out, vel = 1) {
  for (let i = 0; i < 3; i++) {
    const n = ctx.createBufferSource(), nf = ctx.createBiquadFilter(), ng = ctx.createGain();
    n.buffer = noiseBuf; nf.type = 'bandpass'; nf.frequency.value = 1400; nf.Q.value = 1.2;
    const tt = t + i * 0.011;
    ng.gain.setValueAtTime(0.4 * vel, tt); ng.gain.exponentialRampToValueAtTime(0.0001, tt + (i === 2 ? 0.16 : 0.02));
    n.connect(nf); nf.connect(ng); ng.connect(out); n.start(tt, Math.random()); n.stop(tt + 0.2);
  }
}

function hat(t, out, vel = 1, open = false) {
  const n = ctx.createBufferSource(), nf = ctx.createBiquadFilter(), ng = ctx.createGain();
  n.buffer = noiseBuf; nf.type = 'highpass'; nf.frequency.value = 7500;
  const d = open ? 0.18 : 0.04;
  ng.gain.setValueAtTime(0.22 * vel, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + d);
  n.connect(nf); nf.connect(ng); ng.connect(out); n.start(t, Math.random()); n.stop(t + d + 0.02);
}

function tom(t, out, f = 110, vel = 1) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.1);
  g.gain.setValueAtTime(0.7 * vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.32);
}

function crash(t, out, vel = 1) {
  const n = ctx.createBufferSource(), nf = ctx.createBiquadFilter(), ng = ctx.createGain();
  n.buffer = noiseBuf; nf.type = 'highpass'; nf.frequency.value = 4000;
  ng.gain.setValueAtTime(0.28 * vel, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
  n.connect(nf); nf.connect(ng); ng.connect(out); n.start(t); n.stop(t + 1.35);
}

function bass(t, out, midi, dur, vel = 1, dist = false) {
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'sawtooth'; o2.type = 'square';
  o.frequency.value = N(midi); o2.frequency.value = N(midi - 12);
  f.type = 'lowpass'; f.Q.value = 6;
  f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(260, t + dur * 0.9);
  env(g, t, 0.005, 0.32 * vel, 0.08, 0.6, 0.05, dur);
  o.connect(f); o2.connect(f);
  if (dist) { const ws = ctx.createWaveShaper(); ws.curve = distCurve; f.connect(ws); ws.connect(g); } else f.connect(g);
  g.connect(out); o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
}

function lead(t, out, midi, dur, vel = 1, type = 'sawtooth', bright = 3200) {
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = type; o2.type = type;
  o.frequency.value = N(midi); o2.frequency.value = N(midi); o2.detune.value = 12;
  // 비브라토
  const lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(6, t + Math.min(0.3, dur));
  lfo.connect(lg); lg.connect(o.detune); lg.connect(o2.detune);
  f.type = 'lowpass'; f.frequency.setValueAtTime(bright * 1.4, t); f.frequency.exponentialRampToValueAtTime(bright, t + 0.15); f.Q.value = 2;
  env(g, t, 0.012, 0.16 * vel, 0.12, 0.7, 0.12, dur);
  o.connect(f); o2.connect(f); f.connect(g); g.connect(out); g.connect(delay);
  o.start(t); o2.start(t); lfo.start(t);
  const e = t + dur + 0.2; o.stop(e); o2.stop(e); lfo.stop(e);
}

function pluck(t, out, midi, vel = 1) {
  const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'square'; o.frequency.value = N(midi);
  f.type = 'lowpass'; f.frequency.setValueAtTime(4200, t); f.frequency.exponentialRampToValueAtTime(500, t + 0.18);
  g.gain.setValueAtTime(0.085 * vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(f); f.connect(g); g.connect(out); g.connect(delay); o.start(t); o.stop(t + 0.25);
}

function pad(t, out, midis, dur, vel = 1) {
  const g = ctx.createGain(), f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 1400; f.Q.value = 0.5;
  env(g, t, 0.25, 0.06 * vel, 0.3, 0.8, 0.4, dur);
  f.connect(g); g.connect(out);
  for (const m of midis) for (const dt of [-9, 9]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = N(m); o.detune.value = dt;
    o.connect(f); o.start(t); o.stop(t + dur + 0.5);
  }
}

function stab(t, out, midis, vel = 1) {
  const g = ctx.createGain(), f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.setValueAtTime(5000, t); f.frequency.exponentialRampToValueAtTime(900, t + 0.2);
  g.gain.setValueAtTime(0.09 * vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  f.connect(g); g.connect(out);
  for (const m of midis) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = N(m); o.connect(f); o.start(t); o.stop(t + 0.3); }
}

// ───────────────────────── 곡 정의 ─────────────────────────
// 화음: 근음 MIDI + 종류. 멜로디: [스텝, MIDI, 길이(스텝)] (16스텝 = 1마디)
const CH = { maj: [0, 4, 7], min: [0, 3, 7] };
const chord = (root, q) => CH[q].map(i => root + i);

const SONGS = {
  // 메인 화면: 밝고 경쾌한 팝 일렉
  hub: {
    bpm: 120,
    chords: [[53, 'maj'], [48, 'maj'], [50, 'min'], [46, 'maj'], [53, 'maj'], [48, 'maj'], [46, 'maj'], [48, 'maj']],
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.',
    bassPat: [[0, 0, 2], [3, 12, 1], [4, 0, 2], [6, 0, 1], [8, 0, 2], [11, 12, 1], [12, 0, 2], [14, 7, 2]],
    arp: true, arpOct: 24, pad: true,
    melody: [
      [[0, 72, 2], [2, 69, 2], [4, 72, 2], [6, 77, 4], [10, 76, 2], [12, 74, 2], [14, 72, 2]],
      [[0, 74, 2], [2, 72, 2], [4, 67, 4], [8, 72, 2], [10, 74, 2], [12, 76, 4]],
      [[0, 77, 3], [3, 76, 1], [4, 74, 2], [6, 69, 2], [8, 74, 2], [10, 76, 2], [12, 77, 4]],
      [[0, 77, 2], [2, 74, 2], [4, 70, 2], [6, 74, 2], [8, 72, 6]],
      [[0, 72, 2], [2, 69, 2], [4, 72, 2], [6, 77, 4], [10, 79, 2], [12, 81, 4]],
      [[0, 79, 2], [2, 76, 2], [4, 72, 4], [8, 74, 2], [10, 76, 2], [12, 79, 4]],
      [[0, 77, 2], [2, 74, 2], [4, 70, 2], [6, 74, 2], [8, 77, 4], [12, 76, 4]],
      [[0, 74, 2], [2, 76, 2], [4, 79, 4], [8, 77, 8]],
    ],
    leadType: 'square', bright: 2600, leadVel: 0.9,
  },
  // 지도/준비: 살짝 설레는 느낌
  map: {
    bpm: 108,
    chords: [[48, 'maj'], [45, 'min'], [41, 'maj'], [43, 'maj']],
    kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
    bassPat: [[0, 0, 3], [3, 0, 1], [6, 7, 2], [8, 0, 3], [12, 12, 2], [14, 7, 2]],
    arp: true, arpOct: 24, pad: true,
    melody: [
      [[0, 76, 4], [4, 79, 2], [6, 76, 2], [8, 74, 4], [12, 72, 4]],
      [[0, 72, 2], [2, 74, 2], [4, 76, 4], [8, 69, 8]],
      [[0, 69, 2], [2, 72, 2], [4, 77, 4], [8, 76, 2], [10, 74, 2], [12, 72, 4]],
      [[0, 71, 4], [4, 74, 4], [8, 79, 8]],
    ],
    leadType: 'triangle', bright: 3000, leadVel: 1.1,
  },
  // 배틀: 빠르고 박력있게
  battle: {
    bpm: 150,
    chords: [[45, 'min'], [41, 'maj'], [48, 'maj'], [43, 'maj'], [45, 'min'], [41, 'maj'], [43, 'maj'], [40, 'maj']],
    kick: 'x...x...x...x.x.', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx',
    bassPat: [[0, 0, 1], [1, 0, 1], [2, 12, 1], [3, 0, 1], [4, 0, 1], [5, 0, 1], [6, 12, 1], [7, 0, 1], [8, 0, 1], [9, 0, 1], [10, 12, 1], [11, 0, 1], [12, 0, 1], [13, 7, 1], [14, 12, 1], [15, 7, 1]],
    stabs: [0, 6, 10], dist: true,
    melody: [
      [[0, 69, 2], [2, 72, 2], [4, 76, 2], [6, 81, 3], [9, 79, 1], [10, 76, 2], [12, 72, 2], [14, 74, 2]],
      [[0, 72, 2], [2, 69, 2], [4, 72, 2], [6, 77, 4], [10, 76, 2], [12, 74, 2], [14, 72, 2]],
      [[0, 76, 2], [2, 79, 2], [4, 76, 2], [6, 72, 2], [8, 74, 2], [10, 76, 2], [12, 79, 4]],
      [[0, 74, 2], [2, 71, 2], [4, 67, 2], [6, 71, 2], [8, 74, 4], [12, 76, 2], [14, 79, 2]],
      [[0, 81, 3], [3, 79, 1], [4, 76, 2], [6, 72, 2], [8, 76, 2], [10, 79, 2], [12, 81, 4]],
      [[0, 81, 2], [2, 77, 2], [4, 72, 2], [6, 77, 2], [8, 76, 4], [12, 72, 4]],
      [[0, 74, 2], [2, 79, 2], [4, 83, 4], [8, 81, 2], [10, 79, 2], [12, 74, 4]],
      [[0, 76, 4], [4, 74, 2], [6, 72, 2], [8, 71, 4], [12, 68, 4]],
    ],
    leadType: 'sawtooth', bright: 3600, leadVel: 1,
    fill: true,
  },
  // 보스전: 묵직하고 긴장감
  boss: {
    bpm: 140,
    chords: [[38, 'min'], [46, 'maj'], [43, 'min'], [45, 'maj'], [38, 'min'], [46, 'maj'], [41, 'maj'], [45, 'maj']],
    kick: 'x..x..x.x..x..x.', snare: '....x.......x..x', hat: 'x.xxx.xxx.xxx.xx',
    bassPat: [[0, 0, 1], [1, 0, 1], [2, 0, 1], [3, 12, 1], [4, 0, 1], [5, 0, 1], [6, 1, 1], [7, 0, 1], [8, 0, 1], [9, 0, 1], [10, 0, 1], [11, 12, 1], [12, 0, 1], [13, 0, 1], [14, 3, 1], [15, 1, 1]],
    stabs: [0, 3, 6], dist: true, pad: true, toms: true,
    melody: [
      [[0, 74, 4], [4, 77, 2], [6, 76, 2], [8, 74, 2], [10, 73, 2], [12, 74, 4]],
      [[0, 77, 4], [4, 74, 2], [6, 70, 2], [8, 74, 8]],
      [[0, 79, 4], [4, 77, 2], [6, 74, 2], [8, 70, 2], [10, 74, 2], [12, 79, 4]],
      [[0, 81, 6], [6, 79, 2], [8, 77, 2], [10, 76, 2], [12, 73, 4]],
      [[0, 86, 4], [4, 84, 2], [6, 82, 2], [8, 81, 4], [12, 77, 4]],
      [[0, 82, 4], [4, 81, 2], [6, 77, 2], [8, 74, 8]],
      [[0, 77, 2], [2, 81, 2], [4, 84, 4], [8, 82, 2], [10, 81, 2], [12, 77, 4]],
      [[0, 81, 4], [4, 79, 4], [8, 76, 4], [12, 73, 4]],
    ],
    leadType: 'sawtooth', bright: 2800, leadVel: 1,
    fill: true,
  },
};

function scheduler() {
  if (!current || !ctx || current.file) return;
  const c = current, s = c.song;
  const stepDur = 60 / s.bpm / 4;
  while (c.next < ctx.currentTime + 0.14) {
    playStep(c, s, c.step, c.next, stepDur);
    c.step++;
    c.next += stepDur;
  }
}

function playStep(c, s, step, t, sd) {
  const out = c.gain;
  const st = step % 16;
  const bar = Math.floor(step / 16);
  const ci = bar % s.chords.length;
  const [root, q] = s.chords[ci];
  const isFillBar = s.fill && ci === s.chords.length - 1;
  // 드럼
  if (s.kick[st] === 'x') kick(t, out, st === 0 ? 1 : 0.9);
  if (isFillBar && st >= 12) { snare(t, out, 0.5 + (st - 12) * 0.15); }
  else if (s.snare[st] === 'x') (s.bpm < 125 ? clap : snare)(t, out, 0.9);
  if (s.hat[st] === 'x') hat(t, out, st % 4 === 2 ? 1 : 0.55, s.bpm < 125 && st % 8 === 6);
  if (s.toms && isFillBar && st >= 8 && st < 12) tom(t, out, 140 - (st - 8) * 15, 0.8);
  if (st === 0 && ci === 0 && bar > 0) crash(t, out, 0.8);
  // 베이스
  for (const [bs, off, len] of s.bassPat) if (bs === st) bass(t, out, root - 12 + off + 12, len * sd * 0.95, 1, s.dist);
  // 패드
  if (s.pad && st === 0) pad(t, out, chord(root + 12, q), sd * 16, 1);
  // 스탭
  if (s.stabs && s.stabs.includes(st)) stab(t, out, chord(root + 24, q), 1);
  // 아르페지오
  if (s.arp && st % 2 === 0) {
    const tones = chord(root + s.arpOct, q); tones.push(root + s.arpOct + 12);
    pluck(t, out, tones[(st / 2) % 4], 0.9);
  }
  // 멜로디 (8마디 중 앞 4마디는 1회차에서 쉬게 해 구성감을 준다)
  const mi = bar % s.melody.length;
  const phrase = Math.floor(bar / s.melody.length) % 4;
  if (phrase !== 3 || mi >= 4) {
    for (const [ms, m, len] of s.melody[mi]) if (ms === st) lead(t, out, m, len * sd, s.leadVel, s.leadType, s.bright);
  }
}

// ───────────────────────── 효과음 ─────────────────────────
function noiseHit(t, freq, q, dur, vol, type = 'bandpass', dest = sfxBus) {
  const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  n.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(f); f.connect(g); g.connect(dest); n.start(t, Math.random()); n.stop(t + dur + 0.02);
  return f;
}
function tone(t, freq, dur, vol, type = 'sine', toFreq = null, dest = sfxBus, attack = 0.004) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
  return o;
}
function metal(t, base, vol, dur) {
  // 비조화 배음 = 금속성 충돌음
  for (const [r, v] of [[1, 1], [2.76, 0.6], [5.4, 0.4], [8.93, 0.25]]) tone(t, base * r * (0.98 + Math.random() * 0.04), dur * (1.2 - r * 0.08), vol * v, 'sine');
}

const SFX = {
  click: (t) => { tone(t, 900, 0.06, 0.22, 'triangle', 600); },
  tab: (t) => { tone(t, 620, 0.05, 0.2, 'triangle', 820); tone(t + 0.04, 1040, 0.07, 0.15, 'triangle'); },
  back: (t) => { tone(t, 700, 0.07, 0.18, 'triangle', 420); },
  deny: (t) => { tone(t, 180, 0.16, 0.25, 'square', 140); tone(t + 0.09, 160, 0.16, 0.2, 'square', 120); },
  type: (t) => { tone(t, 1100 + Math.random() * 200, 0.025, 0.05, 'square'); },
  coin: (t, o) => { const k = o.pitch || 0; tone(t, 1568 * Math.pow(2, k / 12), 0.08, 0.2, 'square'); tone(t + 0.06, 2093 * Math.pow(2, k / 12), 0.22, 0.18, 'square'); },
  gem: (t) => { [2093, 2637, 3136, 4186].forEach((f, i) => tone(t + i * 0.04, f, 0.3, 0.12, 'sine')); },
  levelup: (t) => {
    [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => tone(t + i * 0.055, N(m), 0.35, 0.18, 'square'));
    [72, 76, 79].forEach(m => tone(t + 0.42, N(m), 0.7, 0.14, 'sawtooth'));
    noiseHit(t + 0.4, 6000, 0.5, 0.6, 0.15, 'highpass');
  },
  upgrade: (t) => { tone(t, 520, 0.12, 0.22, 'square', 1040); tone(t + 0.08, 1040, 0.25, 0.18, 'triangle', 1560); noiseHit(t + 0.06, 5000, 0.6, 0.25, 0.12, 'highpass'); },
  count: (t) => { tone(t, 880, 0.14, 0.3, 'square'); tone(t, 440, 0.14, 0.2, 'square'); },
  go: (t) => { tone(t, 1320, 0.4, 0.3, 'square'); tone(t, 660, 0.4, 0.25, 'sawtooth'); noiseHit(t, 3000, 0.4, 0.4, 0.3, 'bandpass'); },
  charge: (t, o) => { const p = o.p || 0; tone(t, 200 + p * 900, 0.06, 0.08, 'sawtooth'); },
  launch: (t, o) => {
    const q = o.quality || 0;
    const f = noiseHit(t, 600, 0.8, 0.5, 0.6, 'bandpass'); f.frequency.exponentialRampToValueAtTime(5000, t + 0.35);
    tone(t, 140, 0.35, 0.5, 'sawtooth', 600);
    metal(t + 0.05, 900, 0.18, 0.4);
    if (q >= 2) { [72, 76, 79, 84].forEach((m, i) => tone(t + 0.1 + i * 0.05, N(m), 0.3, 0.14, 'square')); }
  },
  clash: (t, o) => {
    const p = Math.min(1, o.power || 0.5);
    metal(t, 700 + Math.random() * 500, 0.16 + p * 0.22, 0.25 + p * 0.3);
    noiseHit(t, 3500, 0.8, 0.12 + p * 0.15, 0.35 + p * 0.35, 'bandpass');
    if (p > 0.6) { tone(t, 120, 0.25, 0.5 * p, 'sine', 50); noiseHit(t, 800, 0.5, 0.3, 0.4 * p, 'lowpass'); }
  },
  wall: (t, o) => { const p = Math.min(1, o.power || 0.5); tone(t, 90, 0.18, 0.35 * p, 'sine', 50); noiseHit(t, 500, 0.6, 0.12, 0.25 * p, 'lowpass'); },
  crit: (t) => { metal(t, 1300, 0.3, 0.6); tone(t, 2400, 0.25, 0.15, 'square', 1200); noiseHit(t, 6000, 0.3, 0.3, 0.3, 'highpass'); },
  dash: (t) => { const f = noiseHit(t, 400, 1, 0.3, 0.45, 'bandpass'); f.frequency.exponentialRampToValueAtTime(3000, t + 0.25); tone(t, 200, 0.2, 0.18, 'sawtooth', 500); },
  cutin: (t) => {
    const f = noiseHit(t, 300, 0.7, 0.45, 0.5, 'bandpass'); f.frequency.exponentialRampToValueAtTime(6000, t + 0.4);
    tone(t + 0.35, 80, 0.6, 0.7, 'sine', 40); noiseHit(t + 0.35, 1200, 0.4, 0.5, 0.5, 'lowpass');
    [62, 69, 74].forEach(m => tone(t + 0.35, N(m), 0.8, 0.12, 'sawtooth'));
  },
  fire: (t) => { const f = noiseHit(t, 300, 0.4, 1.2, 0.6, 'lowpass'); f.frequency.exponentialRampToValueAtTime(1600, t + 0.6); },
  thunder: (t) => { noiseHit(t, 4000, 0.3, 0.08, 0.7, 'highpass'); noiseHit(t + 0.05, 200, 0.5, 0.9, 0.7, 'lowpass'); tone(t, 60, 0.6, 0.5, 'sawtooth', 30); },
  wind: (t) => { const f = noiseHit(t, 500, 2, 1.4, 0.4, 'bandpass'); f.frequency.exponentialRampToValueAtTime(2500, t + 0.7); },
  ice: (t) => { [3136, 3520, 4186, 4699].forEach((fq, i) => tone(t + i * 0.05, fq, 0.4, 0.1, 'sine')); noiseHit(t, 7000, 1, 0.3, 0.2, 'highpass'); },
  shield: (t) => { tone(t, 300, 0.6, 0.2, 'sine', 900); tone(t, 450, 0.6, 0.15, 'triangle', 1350); },
  heal: (t) => { [67, 71, 74, 79].forEach((m, i) => tone(t + i * 0.07, N(m), 0.4, 0.12, 'sine')); },
  burst: (t) => {
    tone(t, 70, 1.0, 0.9, 'sine', 30); noiseHit(t, 1200, 0.3, 1.2, 0.9, 'lowpass');
    metal(t, 500, 0.4, 0.9); noiseHit(t, 5000, 0.4, 0.5, 0.5, 'highpass');
  },
  ringout: (t) => { tone(t, 900, 0.7, 0.3, 'sawtooth', 120); noiseHit(t, 2000, 0.5, 0.6, 0.4, 'bandpass'); tone(t + 0.5, 60, 0.5, 0.6, 'sine', 35); },
  spinout: (t) => { tone(t, 400, 0.9, 0.25, 'triangle', 80); },
  win: (t) => {
    const seq = [[72, 0], [76, 0.1], [79, 0.2], [84, 0.32]];
    seq.forEach(([m, d]) => { tone(t + d, N(m), 0.25, 0.22, 'square'); tone(t + d, N(m - 12), 0.25, 0.14, 'sawtooth'); });
    [72, 76, 79, 84].forEach(m => tone(t + 0.48, N(m), 1.2, 0.12, 'sawtooth'));
    kickSfx(t + 0.48); crashSfx(t + 0.48);
  },
  lose: (t) => { [67, 63, 60, 55].forEach((m, i) => tone(t + i * 0.18, N(m), 0.4, 0.18, 'triangle')); },
  drumroll: (t, o) => { const d = o.dur || 1.4; for (let x = 0; x < d; x += 0.045) { snareSfx(t + x, 0.25 + 0.6 * (x / d)); } },
  reveal: (t, o) => {
    const r = o.rarity || 0;
    const roots = [60, 62, 64, 65, 67, 69];
    const base = roots[Math.min(r, 5)];
    [0, 4, 7, 12, 16].slice(0, 3 + Math.min(2, r)).forEach((iv, i) => tone(t + i * 0.06, N(base + iv + 12), 0.9, 0.16, r >= 3 ? 'sawtooth' : 'square'));
    if (r >= 3) { crashSfx(t); tone(t, 60, 0.8, 0.6, 'sine', 30); [0, 4, 7].forEach(iv => tone(t + 0.4, N(base + iv + 24), 1.4, 0.08, 'sine')); }
    if (r >= 4) { noiseHit(t + 0.2, 8000, 0.5, 1.5, 0.25, 'highpass'); }
  },
  whoosh: (t) => { const f = noiseHit(t, 800, 1, 0.35, 0.35, 'bandpass'); f.frequency.exponentialRampToValueAtTime(3500, t + 0.3); },
  pop: (t) => { tone(t, 500, 0.08, 0.25, 'sine', 1200); },
  star: (t, o) => { const k = o.i || 0; tone(t, N(76 + k * 4), 0.4, 0.2, 'square'); tone(t, N(88 + k * 4), 0.3, 0.08, 'sine'); },
  open: (t) => { tone(t, 200, 0.2, 0.3, 'sawtooth', 800); noiseHit(t + 0.1, 5000, 0.5, 0.4, 0.25, 'highpass'); },
};
function kickSfx(t) { kick(t, sfxBus, 0.9); }
function crashSfx(t) { crash(t, sfxBus, 1); }
function snareSfx(t, v) { snare(t, sfxBus, v); }
