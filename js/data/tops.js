// 팽이 도감 데이터
// type: atk 공격 / def 방어 / sta 지구 / bal 밸런스
// rarity: 0 일반, 1 레어, 2 에픽, 3 전설, 4 신화

export const TYPES = {
  atk: { name: '공격형', short: '공격', color: '#ff4d5e', desc: '빠르게 돌진해서 강하게 친다' },
  def: { name: '방어형', short: '방어', color: '#3fa2ff', desc: '무겁고 튼튼해서 잘 밀리지 않는다' },
  sta: { name: '지구형', short: '지구', color: '#3ddc84', desc: '오래 돌고 중앙을 지킨다' },
  bal: { name: '밸런스형', short: '밸런스', color: '#ffc531', desc: '모든 능력이 고르다' },
};

export const RARITY = [
  { name: '일반', color: '#a9b4c8', glow: 'rgba(169,180,200,.55)', mul: 0.85 },
  { name: '레어', color: '#3fa2ff', glow: 'rgba(63,162,255,.6)', mul: 1.0 },
  { name: '에픽', color: '#b45cff', glow: 'rgba(180,92,255,.65)', mul: 1.22 },
  { name: '전설', color: '#ffa31a', glow: 'rgba(255,163,26,.7)', mul: 1.5 },
  { name: '신화', color: '#ff3b6b', glow: 'rgba(255,59,107,.75)', mul: 1.85 },
];

export const SKILLS = {
  rush: { name: '회전 돌격', desc: '상대에게 돌진해 2배 피해', fx: '#ffffff' },
  flameRush: { name: '화염 돌진', desc: '불꽃을 두르고 돌진해 3배 피해', fx: '#ff6a1a', sfx: 'fire' },
  tidalGuard: { name: '해일 방패', desc: '3초간 피해 80% 감소, 체력 회복', fx: '#3fd0ff', sfx: 'shield' },
  galeStorm: { name: '질풍 폭풍', desc: '4초간 엄청 빨라지고 체력이 안 줄어듦', fx: '#bff6ff', sfx: 'wind' },
  thunderStrike: { name: '뇌격', desc: '번개 5번 연속 공격', fx: '#ffe94a', sfx: 'thunder' },
  frostPrison: { name: '빙결', desc: '상대를 얼려서 느리게 만듦', fx: '#a8e6ff', sfx: 'ice' },
  rockFortress: { name: '바위 요새', desc: '4초간 무거워지고 체력 회복', fx: '#d9a35b', sfx: 'shield' },
  venomFang: { name: '맹독 송곳니', desc: '돌진해서 독을 묻힘', fx: '#7dff4a', sfx: 'dash' },
  shadowStep: { name: '그림자 일격', desc: '상대 뒤로 순간이동해 치명타', fx: '#b45cff', sfx: 'whoosh' },
  solarFlare: { name: '태양 폭발', desc: '주변을 날려버리고 체력 회복', fx: '#ffd84a', sfx: 'burst' },
  sharkFrenzy: { name: '상어 광란', desc: '3번 연속 돌진', fx: '#3f8bff', sfx: 'dash' },
  earthquake: { name: '대지 진동', desc: '충격파로 밀어내고 느리게 만듦', fx: '#9ad94a', sfx: 'burst' },
  moonHeal: { name: '달빛 치유', desc: '체력을 크게 회복', fx: '#dfe8ff', sfx: 'heal' },
  sakuraDance: { name: '벚꽃 난무', desc: '꽃잎 8번 연속 공격', fx: '#ff8cc6', sfx: 'wind' },
  galaxyNova: { name: '갤럭시 노바', desc: '끌어당긴 뒤 은하 폭발', fx: '#9a7bff', sfx: 'burst' },
  chaosRage: { name: '혼돈의 분노', desc: '폭발 후 상대 체력을 빨아들임', fx: '#ff2a3a', sfx: 'burst' },
  lionRoar: { name: '사자후', desc: '상대를 기절시키고 돌진', fx: '#ffcf4a', sfx: 'cutin' },
  crystalShine: { name: '수정 빛', desc: '체력 회복 + 상대 느리게', fx: '#e7b8ff', sfx: 'ice' },
  ironCharge: { name: '강철 돌진', desc: '무거운 몸으로 돌진', fx: '#ff9a3a', sfx: 'dash' },
};

export const TOPS = {
  basic_top: { name: '연습용 팽이', type: 'bal', rarity: 0, skill: 'rush', color: '#c9d3e3' },
  flame_dragon: { name: '블레이즈 드래곤', type: 'atk', rarity: 2, skill: 'flameRush', color: '#ff5a2a', starter: true },
  aqua_turtle: { name: '아쿠아 터틀', type: 'def', rarity: 2, skill: 'tidalGuard', color: '#21c7d9', starter: true },
  gale_pegasus: { name: '게일 페가수스', type: 'sta', rarity: 2, skill: 'galeStorm', color: '#7fd6ff', starter: true },
  stone_golem: { name: '스톤 골렘', type: 'def', rarity: 1, skill: 'rockFortress', color: '#d0954a' },
  crystal_rabbit: { name: '크리스탈 래빗', type: 'sta', rarity: 1, skill: 'crystalShine', color: '#d9a6ff' },
  venom_viper: { name: '베놈 바이퍼', type: 'bal', rarity: 1, skill: 'venomFang', color: '#6fe03a' },
  tidal_shark: { name: '타이달 샤크', type: 'atk', rarity: 1, skill: 'sharkFrenzy', color: '#2f7bff' },
  gaia_beetle: { name: '가이아 비틀', type: 'def', rarity: 1, skill: 'earthquake', color: '#4fbf5a' },
  iron_rhino: { name: '아이언 라이노', type: 'def', rarity: 1, skill: 'ironCharge', color: '#ff8a2a' },
  thunder_wolf: { name: '썬더 울프', type: 'atk', rarity: 2, skill: 'thunderStrike', color: '#ffe23a' },
  frost_unicorn: { name: '프로스트 유니콘', type: 'sta', rarity: 2, skill: 'frostPrison', color: '#9fdcff' },
  shadow_panther: { name: '섀도 팬서', type: 'atk', rarity: 2, skill: 'shadowStep', color: '#a24dff' },
  luna_owl: { name: '루나 아울', type: 'sta', rarity: 2, skill: 'moonHeal', color: '#8aa7ff' },
  sakura_fox: { name: '사쿠라 폭스', type: 'bal', rarity: 2, skill: 'sakuraDance', color: '#ff7ab8' },
  solar_phoenix: { name: '솔라 피닉스', type: 'bal', rarity: 3, skill: 'solarFlare', color: '#ffb23a' },
  golden_lion: { name: '골든 라이온', type: 'def', rarity: 3, skill: 'lionRoar', color: '#ffcf3a' },
  chaos_demon: { name: '카오스 데몬', type: 'atk', rarity: 4, skill: 'chaosRage', color: '#ff2a3a' },
  galaxy_omega: { name: '갤럭시 오메가', type: 'bal', rarity: 4, skill: 'galaxyNova', color: '#9a7bff' },
};

export const TOP_IDS = Object.keys(TOPS);

// 뽑기 풀 (스토리 전용 갤럭시는 제외)
export const GACHA_POOL = TOP_IDS.filter(id => id !== 'galaxy_omega' && id !== 'basic_top');
