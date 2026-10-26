// 저장: localStorage (진행 데이터) + 개인 설정은 따로 저장
export const VERSION = 'v1.0.1';
const KEY = 'paengsaeng_save_v1';
const SKEY = 'paengsaeng_settings_v1';

export function today(d = new Date()) {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function newState() {
  const now = Date.now();
  return {
    v: 1, created: now, lastSave: now, lastSeen: now,
    name: '', avatar: 'boy',
    flags: {},
    lv: 1, xp: 0,
    coins: 0, gems: 0,
    tops: {}, main: null,
    parts: [], equip: {}, partSeq: 1,
    progress: 0, stars: {}, cleared: {},
    idleAt: now,
    gacha: { pity: 0, total: 0 },
    missions: { day: today(), counts: {}, claimed: {}, bonus: false },
    ach: {},
    stats: { wins: 0, losses: 0, burst: 0, out: 0, spin: 0, skills: 0, enhances: 0, pulls: 0, battles: 0, maxCombo: 0, perfect: 0, levelups: 0 },
    attend: { last: '', day: 0 },
    tower: { floor: 1, best: 0 },
    roulette: { lastFree: '', spins: 0 },
    raid: { nextAt: 0, until: 0, done: 0 },
    friend: { wins: 0, played: 0 },
    playMs: 0,
  };
}

export const defaultSettings = () => ({ bgm: 0.8, sfx: 0.9, vib: true, device: null, auto: false, speed: 1 });

export const Save = {
  state: null,
  settings: defaultSettings(),
  dirty: false,
  timer: null,

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      this.state = raw ? migrate(JSON.parse(raw)) : null;
    } catch (e) { this.state = null; }
    try {
      const s = localStorage.getItem(SKEY);
      this.settings = { ...defaultSettings(), ...(s ? JSON.parse(s) : {}) };
    } catch (e) { this.settings = defaultSettings(); }
    return this.state;
  },

  start() { if (!this.state) this.state = newState(); },

  save() {
    if (!this.state || this.stale) return false;
    this.state.lastSave = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(this.state)); this.dirty = false; return true; }
    catch (e) { return false; }
  },

  // 잦은 변경은 묶어서 저장
  touch() {
    this.dirty = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.save(), 1200);
  },

  saveSettings() {
    try { localStorage.setItem(SKEY, JSON.stringify(this.settings)); } catch (e) {}
  },

  reset() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    this.state = null;
  },

  // 백업 코드 (다른 기기로 옮길 때)
  exportCode() {
    const json = JSON.stringify(this.state);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return 'PS1-' + b64 + '-' + checksum(b64);
  },

  importCode(code) {
    code = (code || '').trim().replace(/\s+/g, '');
    const m = code.match(/^PS1-(.+)-([0-9a-z]+)$/);
    if (!m || checksum(m[1]) !== m[2]) return false;
    try {
      const st = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
      if (!st || !st.v || !st.tops) return false;
      const prev = this.state;
      this.state = migrate(st);
      if (!this.save()) { this.state = prev; return false; }
      return true;
    } catch (e) { return false; }
  },
};

function checksum(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

function migrate(st) {
  const base = newState();
  // 새로 추가된 항목이 있어도 깨지지 않게 기본값으로 채움
  for (const k of Object.keys(base)) if (st[k] === undefined) st[k] = base[k];
  for (const k of Object.keys(base.stats)) if (st.stats[k] === undefined) st.stats[k] = 0;
  return st;
}
