// 스토리: 등장인물, 챕터, 스테이지, 대사
// 대사 표기: **강조** → 노란 강조, {name} → 플레이어 이름, {top} → 대표 팽이 이름

export const CHARS = {
  me: { name: '{name}', img: null }, // 플레이어 (아바타에 따라 결정)
  grandpa: { name: '문방구 할아버지', img: 'grandpa' },
  hanbyeol: { name: '한별', img: 'hanbyeol' },
  dusik: { name: '골목대장 두식', img: 'dusik' },
  jia: { name: '학생회장 지아', img: 'jia' },
  marin: { name: '서핑왕 마린', img: 'marin' },
  luna: { name: '아이돌 루나', img: 'luna' },
  magma: { name: '불꽃도사 마그마', img: 'magma' },
  baekya: { name: '설산의 백야', img: 'baekya' },
  leo: { name: '챔피언 레오', img: 'leo' },
  chaos: { name: '카오스', img: 'chaos' },
  boss_mask: { name: '그랑프리 회장', img: 'chaos' },
  kid_a: { name: '동네 꼬마 준이', img: 'kid_a' },
  kid_b: { name: '동네 꼬마 솔이', img: 'kid_b' },
  student: { name: '팽이부 민수', img: 'student' },
  grunt: { name: '흑회전단 조직원', img: 'grunt' },
  giant: { name: '???', img: null },
  narr: { name: '', img: null },
};

// 경기장 변형 규칙
export const MODS = {
  none: {},
  sand: { damp: 1.3, label: '모래 경기장: 조금 느려짐' },
  neon: { rail: 1.6, label: '네온 레일: 가장자리에서 더 빨라짐' },
  lava: { wallDmg: 3, label: '용암 벽: 벽에 부딪히면 아픔' },
  ice: { damp: 0.45, label: '빙판: 미끄러움' },
  wind: { wind: 1, label: '돌풍: 가끔 바람이 밀어냄' },
  chaos: { pocketSpin: 0.35, pockets: 4, label: '혼돈: 아웃 구멍이 움직임' },
};

// 챕터
export const CHAPTERS = [
  { id: 1, name: '동네 놀이터', title: '동네 꼴찌의 반란', bg: 'bg_playground', stadium: 'st_playground', mod: 'none', color: '#ff9f43' },
  { id: 2, name: '학교 운동장', title: '운동장의 왕', bg: 'bg_school', stadium: 'st_school', mod: 'none', color: '#2ecc71' },
  { id: 3, name: '여름 해변', title: '여름 축제 대난투', bg: 'bg_beach', stadium: 'st_beach', mod: 'sand', color: '#1fc8db' },
  { id: 4, name: '네온 시티', title: '네온 아레나 데뷔', bg: 'bg_city', stadium: 'st_city', mod: 'neon', color: '#b45cff' },
  { id: 5, name: '불꽃 화산섬', title: '불꽃 수련', bg: 'bg_volcano', stadium: 'st_volcano', mod: 'lava', color: '#ff5a2a' },
  { id: 6, name: '얼음 설산', title: '얼음 속 고수', bg: 'bg_snow', stadium: 'st_snow', mod: 'ice', color: '#7fd6ff' },
  { id: 7, name: '하늘 경기장', title: '팽이 그랑프리', bg: 'bg_sky', stadium: 'st_sky', mod: 'wind', color: '#ffcf3a' },
  { id: 8, name: '혼돈의 신전', title: '팽생역전', bg: 'bg_chaos', stadium: 'st_chaos', mod: 'chaos', color: '#ff2a5a' },
];

// 적 정의 헬퍼
const F = (char, top, o = {}) => ({ char, top, ...o });

// kind: duel 1:1 / royale 난투 / boss 보스(3점 선승) / rival 라이벌 / giant 거대 팽이 / gauntlet 연속전 / tag 2:2
export const STAGES = [
  // ── 1장 놀이터 ──
  { ch: 1, name: '첫 승부', kind: 'duel', foes: [F('kid_a', 'basic_top', { lv: -1 })], pre: 'tut_pre', tutorial: true },
  { ch: 1, name: '놀이터 꼬마', kind: 'duel', foes: [F('kid_b', 'crystal_rabbit')], pre: 's1_2' },
  { ch: 1, name: '모래밭 결투', kind: 'duel', foes: [F('kid_a', 'venom_viper')] },
  { ch: 1, name: '놀이터 대난투', kind: 'royale', foes: [F('kid_a', 'basic_top'), F('kid_b', 'crystal_rabbit'), F('student', 'stone_golem', { lv: -1 })], pre: 's1_4' },
  { ch: 1, name: '라이벌 등장', kind: 'rival', foes: [F('hanbyeol', 'thunder_wolf', { lv: 0 })], pre: 'rival1_pre', post: 'rival1_post' },
  { ch: 1, name: '골목대장', kind: 'boss', foes: [F('dusik', 'stone_golem', { lv: 1, scale: 1.15 })], pre: 'boss1_pre', post: 'boss1_post' },
  // ── 2장 학교 ──
  { ch: 2, name: '팽이부 신입', kind: 'duel', foes: [F('student', 'gaia_beetle')], pre: 'ch2_intro' },
  { ch: 2, name: '쉬는 시간 승부', kind: 'duel', foes: [F('student', 'iron_rhino')] },
  { ch: 2, name: '복도의 고수', kind: 'duel', foes: [F('kid_b', 'crystal_rabbit', { lv: 1 })] },
  { ch: 2, name: '창고 속 거대 팽이', kind: 'giant', foes: [F('giant', 'basic_top', { scale: 1.7, hpMul: 3.2, atkMul: 0.9 })], pre: 's2_4' },
  { ch: 2, name: '팽이부 에이스', kind: 'duel', foes: [F('student', 'tidal_shark', { lv: 1 })] },
  { ch: 2, name: '팽이부 3연전', kind: 'gauntlet', foes: [F('student', 'gaia_beetle', { lv: -2 }), F('student', 'iron_rhino', { lv: -1 }), F('student', 'tidal_shark', { lv: 0 })], pre: 's2_6' },
  { ch: 2, name: '라이벌 재대결', kind: 'rival', foes: [F('hanbyeol', 'thunder_wolf', { lv: 1 })], pre: 'rival2_pre', post: 'rival2_post' },
  { ch: 2, name: '학생회장', kind: 'boss', foes: [F('jia', 'frost_unicorn', { lv: 2, scale: 1.12 })], pre: 'boss2_pre', post: 'boss2_post' },
  // ── 3장 해변 ──
  { ch: 3, name: '해변 예선', kind: 'duel', foes: [F('kid_a', 'tidal_shark')], pre: 'ch3_intro' },
  { ch: 3, name: '모래성 승부', kind: 'duel', foes: [F('kid_b', 'gaia_beetle')] },
  { ch: 3, name: '파도 타기', kind: 'duel', foes: [F('student', 'venom_viper', { lv: 1 })] },
  { ch: 3, name: '해변 4인 난투', kind: 'royale', foes: [F('kid_a', 'tidal_shark'), F('kid_b', 'crystal_rabbit'), F('student', 'iron_rhino')], pre: 's3_4' },
  { ch: 3, name: '서퍼 크루', kind: 'duel', foes: [F('student', 'tidal_shark', { lv: 1 })] },
  { ch: 3, name: '라이벌과 한 팀', kind: 'tag', allies: [F('hanbyeol', 'thunder_wolf', { lv: -1 })], foes: [F('kid_a', 'tidal_shark'), F('student', 'gaia_beetle')], pre: 'tag1_pre' },
  { ch: 3, name: '파도 3연전', kind: 'gauntlet', foes: [F('kid_a', 'tidal_shark', { lv: -2 }), F('kid_b', 'venom_viper', { lv: -1 }), F('student', 'iron_rhino')] },
  { ch: 3, name: '서핑왕', kind: 'boss', foes: [F('marin', 'tidal_shark', { lv: 2, scale: 1.15 })], pre: 'boss3_pre', post: 'boss3_post' },
  // ── 4장 네온 시티 ──
  { ch: 4, name: '아레나 입장', kind: 'duel', foes: [F('student', 'shadow_panther', { lv: -1 })], pre: 'ch4_intro' },
  { ch: 4, name: '네온 레일', kind: 'duel', foes: [F('kid_a', 'thunder_wolf', { lv: -1 })] },
  { ch: 4, name: '관중의 함성', kind: 'duel', foes: [F('kid_b', 'sakura_fox', { lv: -1 })] },
  { ch: 4, name: '네온 대난투', kind: 'royale', foes: [F('student', 'shadow_panther'), F('kid_a', 'iron_rhino'), F('kid_b', 'venom_viper')] },
  { ch: 4, name: '수상한 그림자', kind: 'duel', foes: [F('grunt', 'shadow_panther', { lv: 1 })], pre: 'grunt1_pre', post: 'grunt1_post' },
  { ch: 4, name: '거대 네온 팽이', kind: 'giant', foes: [F('giant', 'iron_rhino', { scale: 1.7, hpMul: 3.4, atkMul: 0.9 })] },
  { ch: 4, name: '라이벌 3번째', kind: 'rival', foes: [F('hanbyeol', 'thunder_wolf', { lv: 2, star: 2 })], pre: 'rival3_pre', post: 'rival3_post' },
  { ch: 4, name: '아이돌 블레이더', kind: 'boss', foes: [F('luna', 'sakura_fox', { lv: 2, scale: 1.12 })], pre: 'boss4_pre', post: 'boss4_post' },
  // ── 5장 화산섬 ──
  { ch: 5, name: '화산섬 상륙', kind: 'duel', foes: [F('student', 'iron_rhino', { lv: 1 })], pre: 'ch5_intro' },
  { ch: 5, name: '용암 계곡', kind: 'duel', foes: [F('kid_a', 'flame_dragon')] },
  { ch: 5, name: '수련생 3연전', kind: 'gauntlet', foes: [F('student', 'gaia_beetle'), F('kid_b', 'thunder_wolf'), F('student', 'iron_rhino', { lv: 1 })] },
  { ch: 5, name: '흑회전단 습격', kind: 'tag', allies: [F('hanbyeol', 'thunder_wolf', { lv: 0, star: 2 })], foes: [F('grunt', 'shadow_panther'), F('grunt', 'venom_viper', { lv: 1 })], pre: 'grunt2_pre' },
  { ch: 5, name: '불꽃 난투', kind: 'royale', foes: [F('grunt', 'shadow_panther'), F('student', 'flame_dragon'), F('kid_a', 'iron_rhino')] },
  { ch: 5, name: '분화구 거대 팽이', kind: 'giant', foes: [F('giant', 'stone_golem', { scale: 1.8, hpMul: 3.6, atkMul: 0.95 })] },
  { ch: 5, name: '마그마의 제자', kind: 'duel', foes: [F('student', 'flame_dragon', { lv: 2, star: 2 })] },
  { ch: 5, name: '불꽃도사', kind: 'boss', foes: [F('magma', 'iron_rhino', { lv: 3, star: 2, scale: 1.2 })], pre: 'boss5_pre', post: 'boss5_post' },
  // ── 6장 설산 ──
  { ch: 6, name: '눈보라 길', kind: 'duel', foes: [F('kid_a', 'frost_unicorn')], pre: 'ch6_intro' },
  { ch: 6, name: '빙판 미끄럼', kind: 'duel', foes: [F('kid_b', 'gale_pegasus')] },
  { ch: 6, name: '얼음 동굴', kind: 'duel', foes: [F('grunt', 'shadow_panther', { lv: 1 })] },
  { ch: 6, name: '눈사람 대난투', kind: 'royale', foes: [F('kid_a', 'frost_unicorn'), F('grunt', 'venom_viper'), F('student', 'aqua_turtle')] },
  { ch: 6, name: '설원 3연전', kind: 'gauntlet', foes: [F('grunt', 'shadow_panther'), F('grunt', 'venom_viper'), F('grunt', 'thunder_wolf', { lv: 1 })] },
  { ch: 6, name: '라이벌 4번째', kind: 'rival', foes: [F('hanbyeol', 'thunder_wolf', { lv: 2, star: 3 })], pre: 'rival4_pre', post: 'rival4_post' },
  { ch: 6, name: '빙하 거대 팽이', kind: 'giant', foes: [F('giant', 'frost_unicorn', { scale: 1.75, hpMul: 3.6, atkMul: 0.95 })] },
  { ch: 6, name: '설산의 은둔자', kind: 'boss', foes: [F('baekya', 'luna_owl', { lv: 3, star: 2, scale: 1.12 })], pre: 'boss6_pre', post: 'boss6_post' },
  // ── 7장 하늘 경기장 ──
  { ch: 7, name: '그랑프리 1회전', kind: 'duel', foes: [F('jia', 'frost_unicorn', { lv: 1, star: 2 })], pre: 'ch7_intro' },
  { ch: 7, name: '그랑프리 2회전', kind: 'duel', foes: [F('marin', 'tidal_shark', { lv: 1, star: 2 })] },
  { ch: 7, name: '그랑프리 3회전', kind: 'duel', foes: [F('luna', 'sakura_fox', { lv: 1, star: 2 })] },
  { ch: 7, name: '하늘 대난투', kind: 'royale', foes: [F('dusik', 'stone_golem', { lv: 0, star: 2 }), F('magma', 'iron_rhino', { lv: 0, star: 2 }), F('baekya', 'luna_owl', { lv: 0, star: 2 })], pre: 's7_4' },
  { ch: 7, name: '준결승: 한별', kind: 'rival', foes: [F('hanbyeol', 'thunder_wolf', { lv: 3, star: 3 })], pre: 'rival5_pre', post: 'rival5_post' },
  { ch: 7, name: '결승 전야', kind: 'duel', foes: [F('student', 'golden_lion', { lv: 0 })] },
  { ch: 7, name: '결승: 챔피언', kind: 'boss', foes: [F('leo', 'golden_lion', { lv: 4, star: 3, scale: 1.12 })], pre: 'boss7_pre', post: 'boss7_post' },
  // ── 8장 혼돈의 신전 ──
  { ch: 8, name: '신전 입구', kind: 'gauntlet', foes: [F('grunt', 'shadow_panther'), F('grunt', 'venom_viper'), F('grunt', 'thunder_wolf')], pre: 'ch8_intro' },
  { ch: 8, name: '조종당한 지아', kind: 'tag', allies: [F('hanbyeol', 'thunder_wolf', { lv: 0, star: 3 })], foes: [F('jia', 'frost_unicorn', { lv: 1, star: 3, dark: true }), F('grunt', 'shadow_panther')], pre: 's8_2' },
  { ch: 8, name: '조종당한 마린과 루나', kind: 'tag', allies: [F('dusik', 'stone_golem', { lv: 0, star: 3 })], foes: [F('marin', 'tidal_shark', { lv: 1, star: 3, dark: true }), F('luna', 'sakura_fox', { lv: 1, star: 3, dark: true })], pre: 's8_3' },
  { ch: 8, name: '흑회전단 총공격', kind: 'royale', foes: [F('grunt', 'shadow_panther', { lv: 1 }), F('grunt', 'venom_viper', { lv: 1 }), F('grunt', 'chaos_demon', { lv: -4 })] },
  { ch: 8, name: '조종당한 고수들', kind: 'tag', allies: [F('leo', 'golden_lion', { lv: 0, star: 3 })], foes: [F('magma', 'iron_rhino', { lv: 1, star: 3, dark: true }), F('baekya', 'luna_owl', { lv: 1, star: 3, dark: true })], pre: 's8_5' },
  { ch: 8, name: '혼돈의 거대 석상', kind: 'giant', foes: [F('giant', 'chaos_demon', { scale: 1.85, hpMul: 3.8, atkMul: 0.85 })] },
  { ch: 8, name: '봉인의 문', kind: 'duel', foes: [F('grunt', 'solar_phoenix', { lv: 2, star: 2 })], pre: 'seal_quiz' },
  { ch: 8, name: '최종 결전: 카오스', kind: 'boss', final: true, foes: [F('chaos', 'chaos_demon', { lv: 5, star: 4, scale: 1.2 })], pre: 'final_pre', post: 'ending' },
];
STAGES.forEach((s, i) => { s.idx = i; s.id = `${s.ch}-${STAGES.filter((x, j) => j <= i && x.ch === s.ch).length}`; });

// 대사 스크립트: [화자, 대사] 또는 { choice: [...] }
// choice 항목: { text, reply: [[화자, 대사]...], correct? }
export const DIALOGS = {
  prologue: [
    ['narr', '여기는 평범한 동네 놀이터.'],
    ['dusik', '야 {name}! 또 왔냐? 오늘도 **3초 컷**이다~'],
    ['kid_a', '크크크, 동네 팽이 꼴찌 {name} 등장!'],
    ['me', '오늘은… 오늘은 진짜 이길 거야!'],
  ],
  prologue_after: [
    ['dusik', '봤지? 너 같은 꼴찌는 **평생 못 이겨~** 크하하!'],
    ['narr', '…그날 저녁, 단골 문방구.'],
    ['grandpa', '허허, 또 졌구나. 울 필요 없단다.'],
    ['grandpa', '이리 와 보렴. 아주 오래된 상자가 하나 있는데…'],
    ['grandpa', '이 안의 팽이들은 **주인을 스스로 고른단다.** 마음이 끌리는 녀석을 골라 보렴.'],
  ],
  starter_after: [
    ['grandpa', '**{top}**! 좋은 선택이구나. 녀석, 벌써 신나서 떨고 있는걸?'],
    ['grandpa', '하나만 기억하렴. **팽이는 마지막까지 도는 쪽이 이긴다.**'],
    { choice: [
      { text: '꼭 이길게요!', reply: [['grandpa', '그 눈빛이면 충분하다. 가서 보여주렴!']] },
      { text: '근데 저 꼴찌인데요…', reply: [['grandpa', '허허, 꼴찌는 올라갈 일만 남은 거란다. **팽생역전**, 해 보거라!']] },
    ] },
  ],
  tut_pre: [
    ['kid_a', '어? {name} 새 팽이 생겼네? 그래도 내가 이기지롱~'],
  ],
  s1_2: [['kid_b', '준이 이겼다며? 그럼 나랑도 해! 내 래빗은 **오래 버틴다?**']],
  s1_4: [['narr', '놀이터 꼬마들이 한꺼번에 덤빈다! **마지막까지 살아남으면 승리!**']],
  rival1_pre: [
    ['hanbyeol', '너가 요즘 소문난 {name}? 꼴찌라더니~'],
    ['hanbyeol', '팽이 바꿨다고 이길 것 같아? 내 **썬더 울프**는 차원이 달라!'],
  ],
  rival1_post: [['hanbyeol', '…쳇, 운이 좋았네. **다음엔 안 봐준다!**']],
  boss1_pre: [
    ['dusik', '어쭈? 새 팽이 생겼다고 까부냐?'],
    ['dusik', '내 **스톤 골렘**은 절대 안 밀린다고! 이번엔 3판 2선승… 아니 **3점 먼저 따는 쪽이 승리**다!'],
  ],
  boss1_post: [
    ['dusik', '말도 안 돼… 내가 꼴찌한테…!'],
    ['dusik', '크윽, 인정한다! 오늘부터 **너가 놀이터 대장**이다!'],
    ['grandpa', '허허, 해냈구나! 다음은 **학교 운동장**이다. 거긴 진짜 고수들이 있지.'],
  ],
  ch2_intro: [['student', '전학생이 팽이 잘한다며? 팽이부 실력 좀 볼까!']],
  s2_4: [['narr', '체육 창고에서 **엄청나게 큰 팽이**가 굴러 나왔다!? 크기에 겁먹지 말고 계속 부딪혀!']],
  s2_6: [['student', '팽이부 3명을 **연속으로** 이겨 봐! 체력은 이어진다구!']],
  rival2_pre: [['hanbyeol', '또 만났네! 이번엔 진짜 실력으로 박살 내준다!']],
  rival2_post: [['hanbyeol', '크으… 너 좀 하는데? **인정은 안 할 거야!**']],
  boss2_pre: [
    ['jia', '운동장 규칙 제1조.'],
    ['jia', '**학생회장에게 이기기 전엔 운동장의 왕이 아니다.**'],
  ],
  boss2_post: [
    ['jia', '…계산 밖이었어.'],
    ['jia', '좋아, 여름 해변 대회에선 제대로 붙자. 거기서 기다릴게.'],
  ],
  ch3_intro: [
    ['hanbyeol', '여름 해변 축제 팽이 대회 나간다며? **나도 간다!**'],
    ['narr', '모래 경기장은 조금 느려진다. **돌진 타이밍**을 잘 노려 보자!'],
  ],
  s3_4: [['narr', '해변 4인 난투! 서로서로 부딪힌다. **마지막까지 버텨라!**']],
  tag1_pre: [['hanbyeol', '야, {name}! 이번엔 같은 편이다. **발목 잡지 마라?**']],
  boss3_pre: [['marin', '헤이~ 파도 탈 준비 됐어? 내 샤크는 **파도처럼 계속 몰아친다고!**']],
  boss3_post: [
    ['marin', '와우! 완전 빅웨이브였다! 넌 바다도 이기겠는걸?'],
    ['marin', '다음은 **네온 시티 아레나**지? 거기엔 진짜 스타가 있어.'],
  ],
  ch4_intro: [['narr', '네온 시티 아레나. 수많은 관중과 카메라. **진짜 프로들의 무대**다.']],
  grunt1_pre: [['grunt', '흑회전단이다! **쓸만한 팽이는 전부 압수한다!**']],
  grunt1_post: [
    ['grunt', '크윽… 총수님께 보고해야 해!'],
    ['narr', '흑회전단… 강한 팽이만 노리는 수상한 조직이다.'],
  ],
  rival3_pre: [['hanbyeol', '방송 탄다며? 그럼 **내가 이기는 장면**이 나가야지!']],
  rival3_post: [['hanbyeol', '…너 진짜 많이 늘었다. 나도 더 세질 거야. **두고 봐!**']],
  boss4_pre: [
    ['luna', '여러분~ 루나의 방송 시작합니다!'],
    ['luna', '오늘의 상대는 요즘 **화제의 신인 {name}**! 다들 하트 눌러줘~♪'],
  ],
  boss4_post: [
    ['luna', '에엥?! 방송 중에 지다니…'],
    ['luna', '근데 시청자 폭발했어! 고마워♪'],
    ['grandpa', '({name}, 들리니? 한 가지 더 알려주마. 팽이를 돌리는 건 **세 가지 마음**이란다.)'],
    ['grandpa', '(**용기, 끈기, 우정.** 잊지 말거라. 언젠가 꼭 필요할 거다.)'],
  ],
  ch5_intro: [['narr', '불꽃 화산섬. 경기장 벽이 **용암처럼 뜨겁다.** 벽에 부딪히지 않게 조심!']],
  grunt2_pre: [
    ['grunt', '여기서 만나는군! 이번엔 둘이다!'],
    ['hanbyeol', '{name}, 나도 있다! **같이 박살내자!**'],
  ],
  boss5_pre: [['magma', '불꽃의 섬에 온 걸 환영한다! **뜨거운 승부로 너의 한계를 태워주마!**']],
  boss5_post: [['magma', '크하하! 좋은 불꽃이다! 이제 너는 **진짜 블레이더**다!']],
  ch6_intro: [['narr', '얼음 설산. 바닥이 **빙판**이라 엄청 미끄럽다!']],
  rival4_pre: [['hanbyeol', '여기까지 따라왔다! 이번엔 **별 3개짜리** 썬더 울프다!']],
  rival4_post: [['hanbyeol', '…하아. 진짜 강하다. 그랑프리에서 보자. **거기선 내가 이긴다.**']],
  boss6_pre: [['baekya', '…여기까지 올라온 건 네가 처음이야. **얼음보다 차가운 승부**를 보여주지.']],
  boss6_post: [
    ['baekya', '…따뜻하네. 너의 팽이는.'],
    ['baekya', '하늘 경기장으로 가. **그랑프리**가 열려. 기다리는 사람이 있을 거야.'],
  ],
  ch7_intro: [['narr', '구름 위 하늘 경기장. 드디어 **전국 팽이 그랑프리**가 시작된다! 가끔 **돌풍**이 분다.']],
  s7_4: [['narr', '그동안의 강자들이 한 경기장에! **하늘 대난투** 시작!']],
  rival5_pre: [['hanbyeol', '결승 가는 건 나야! **우리 승부, 여기서 끝내자!**']],
  rival5_post: [['hanbyeol', '…역시 너야. 결승 꼭 이겨라. **안 그러면 나 쪽팔리니까!**']],
  boss7_pre: [['leo', '드디어 왔구나, {name}. **챔피언의 무게**를 보여주지!']],
  boss7_post: [
    ['leo', '…졌다. 넌 진짜야, {name}.'],
    ['boss_mask', '축하하네, 새로운 챔피언. 이 **팽이왕의 왕관**을 받게.'],
    { choice: [
      { text: '왕관을 받는다', reply: [['boss_mask', '후후… **걸려들었군!**'], ['narr', '왕관이 검게 빛나며, 경기장 모든 팽이의 힘을 빨아들인다!']] },
      { text: '…왠지 수상한데?', reply: [['boss_mask', '눈치가 빠르군. 하지만 **이미 늦었다!**'], ['narr', '회장이 손을 들자, 경기장 모든 팽이의 힘이 빨려 들어간다!']] },
    ] },
    ['chaos', '나는 흑회전단 총수 **카오스**.'],
    ['chaos', '전설의 팽이를 깨우려면 최강 팽이들의 힘이 필요했지. 덕분에 다 모았다!'],
    ['chaos', '**혼돈의 신전**에서 기다리마. 올 수 있다면 말이야!'],
    ['hanbyeol', '{name}! 같이 가자. **이번엔 내가 등 맡는다!**'],
  ],
  ch8_intro: [['narr', '혼돈의 신전. 아웃 구멍이 **빙글빙글 움직인다!**']],
  s8_2: [
    ['jia', '…카오스 님을… 위하여…'],
    ['hanbyeol', '지아가 조종당하고 있어! **정신 차리게 해주자!**'],
  ],
  s8_3: [
    ['dusik', '{name}! 놀이터 대장이 도와주러 왔다! **내 골렘이 막는다!**'],
  ],
  s8_5: [['leo', '챔피언으로서 이대로 둘 순 없지. **함께 싸우자, {name}!**']],
  seal_quiz: [
    ['narr', '거대한 봉인의 문이 앞을 막고 있다. 문에서 목소리가 울린다.'],
    ['narr', '"**팽이를 돌리는 마음**을 말하라…"'],
    { quiz: [
      { q: '첫 번째 마음은?', options: ['욕심', '용기', '분노'], answer: 1 },
      { q: '두 번째 마음은?', options: ['끈기', '속도', '자랑'], answer: 0 },
      { q: '세 번째 마음은?', options: ['승리', '돈', '우정'], answer: 2 },
    ], fail: [['narr', '…봉인이 반응하지 않는다. **할아버지가 해준 말**을 떠올려 보자.']] },
    ['narr', '봉인의 문이 열린다! 그런데 문지기가 막아선다!'],
  ],
  final_pre: [
    ['chaos', '여기까지 오다니. 꼴찌 주제에 제법이군.'],
    ['chaos', '하지만 **카오스 데몬**의 힘은 차원이 다르다! 와라!'],
    ['me', '난 이제 꼴찌가 아니야. **마지막까지 도는 쪽이 이긴다!**'],
  ],
  ending: [
    ['chaos', '말도 안 돼… 동네 꼴찌한테…!'],
    ['narr', '신전 깊은 곳에서 은하빛이 터져 나온다.'],
    ['grandpa', '{name}, 해냈구나. **갤럭시 오메가**가 너를 주인으로 골랐단다.'],
    ['hanbyeol', '인정. 이제 진짜 **팽이왕**이네.'],
    ['grandpa', '허허, 그래도 팽이 인생은 이제 시작이란다. **무한의 탑**이 너를 기다리고 있지.'],
  ],
  // 흑회전단 습격 (돌발 이벤트)
  raid_pre: [
    ['grunt', '문방구를 털러 왔다! **팽이 전부 내놔!**'],
    ['grandpa', '{name}! 도와주렴! **비상이다!**'],
  ],
  raid_post: [['grandpa', '휴, 덕분에 살았다. 이건 고마움의 표시란다!']],
};
