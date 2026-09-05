/* ==========================================================================
   demo.js — 피드 데모 데이터
   ---------------------------------------------------------------------------
   ★ 전부 가짜입니다. 서버도, 계정도, 네트워크 요청도 없습니다.
     사람·게시글·좋아요·댓글 전부 이 파일에 하드코딩된 값이고,
     화면에도 '데모' 배지를 띄워 실제 데이터와 헷갈리지 않게 했습니다.

   사진은 03_테스트사진의 일러스트 합성본입니다 — 실존 인물이 아니라
   초상권 문제가 없습니다(03_테스트사진/00_테스트사진_안내.md 참조).

   ★ 진짜로 동작하는 것은 '루틴 가져오기' 하나뿐입니다.
     ex의 종목 id는 실제 data.js의 id라, 눌러서 내 루틴에 그대로 넣을 수 있습니다.
     좋아요·저장은 로컬(prefs)에만 기록됩니다.

   출시를 결정하면 이 파일을 서버 응답으로 갈아끼우면 됩니다.
   그때 필요한 것: 계정·인증 / 이미지 스토리지 / 신고·차단 / 약관·개인정보처리방침.
   ========================================================================== */
(function (g) {
'use strict';

const FEED = [
  {
    id: 'd1',
    user: '김벌크', handle: '@bulk_kim', tint: '#C8FF4D',
    photo: 'demo/01_어두운헬스장_기본.jpg',
    when: '2시간 전',
    label: '하체 데이', part: '하체', sub: '둔근',
    caption: '스쿼트 100kg 첫 5개. 무릎 안쪽으로 안 말리게만 신경썼습니다.',
    vol: 8400, dur: 4260, streak: 23,
    likes: 128, liked: false,
    comments: [
      { u: '이짐순', t: '100 축하드립니다 🔥' },
      { u: '박데드', t: '깊이 좋네요' }
    ],
    ex: [
      { id: 'barbell-back-squat', sets: 5, reps: 5 },
      { id: 'leg-press', sets: 4, reps: 12 },
      { id: 'romanian-deadlift', sets: 4, reps: 10 },
      { id: 'lying-leg-curl', sets: 3, reps: 15 },
      { id: 'standing-calf-raise', sets: 4, reps: 20 }
    ]
  },
  {
    id: 'd2',
    user: '이짐순', handle: '@gymsoon', tint: '#FF6B81',
    photo: 'demo/05_네온조명_짐.jpg',
    when: '5시간 전',
    label: '어깨 집중', part: '어깨', sub: '',
    caption: '삼각근 3갈래 다 조지는 루틴. 사레레는 무게 욕심 버리는 게 답이에요.',
    vol: 3100, dur: 3300, streak: 41,
    likes: 342, liked: false,
    comments: [
      { u: '최린이', t: '사레레 몇 kg으로 하세요?' },
      { u: '이짐순', t: '@최린이 6kg요. 가볍게 15개씩!' },
      { u: '정컷팅', t: '이거 저장해갑니다' }
    ],
    ex: [
      { id: 'overhead-press', sets: 4, reps: 8 },
      { id: 'dumbbell-shoulder-press', sets: 4, reps: 12 },
      { id: 'side-lateral-raise', sets: 5, reps: 15 },
      { id: 'reverse-pec-deck', sets: 4, reps: 20 },
      { id: 'face-pull', sets: 3, reps: 20 }
    ]
  },
  {
    id: 'd3',
    user: '박데드', handle: '@dead_park', tint: '#B9A5F5',
    photo: 'demo/03_야외_주간.jpg',
    when: '어제',
    label: '등 데이', part: '등', sub: '이두',
    caption: '데드 끝나고 야외 한 컷. 오늘은 광배 자극이 제대로 왔습니다.',
    vol: 11200, dur: 4800, streak: 12,
    likes: 89, liked: false,
    comments: [
      { u: '김벌크', t: '등 두께 미쳤네요' }
    ],
    ex: [
      { id: 'deadlift', sets: 4, reps: 5 },
      { id: 'lat-pulldown', sets: 4, reps: 12 },
      { id: 'barbell-row', sets: 4, reps: 10 },
      { id: 'seated-cable-row', sets: 3, reps: 12 },
      { id: 'barbell-curl', sets: 3, reps: 12 },
      { id: 'hammer-curl', sets: 3, reps: 15 }
    ]
  },
  {
    id: 'd4',
    user: '최린이', handle: '@rookie_choi', tint: '#4DA3FF',
    photo: 'demo/04_어두운밤_홈트.jpg',
    when: '어제',
    label: '홈트 전신', part: '하체', sub: '코어',
    caption: '헬스장 못 간 날. 그래도 안 쉬었다는 게 중요하죠. 3주째 이어가는 중!',
    vol: 0, dur: 1980, streak: 9,
    likes: 56, liked: false,
    comments: [
      { u: '이짐순', t: '이게 진짜 실력이죠 👏' },
      { u: '박데드', t: '9회 연속 대단' }
    ],
    ex: [
      { id: 'plank', sets: 3, reps: 60 },
      { id: 'hanging-leg-raise', sets: 3, reps: 15 },
      { id: 'treadmill-run', sets: 1, reps: 30 }
    ]
  },
  {
    id: 'd5',
    user: '정컷팅', handle: '@cutting_j', tint: '#FFD400',
    photo: 'demo/02_밝은창가_흰벽.jpg',
    when: '2일 전',
    label: '가슴·삼두', part: '가슴', sub: '삼두',
    caption: '컷팅 6주차. 무게는 유지하고 세트만 늘렸습니다.',
    vol: 6700, dur: 3900, streak: 34,
    likes: 210, liked: false,
    comments: [
      { u: '최린이', t: '벤치 몇 kg인가요?' }
    ],
    ex: [
      { id: 'barbell-bench-press', sets: 5, reps: 8 },
      { id: 'incline-dumbbell-press', sets: 4, reps: 12 },
      { id: 'cable-crossover', sets: 4, reps: 15 },
      { id: 'cable-pushdown', sets: 4, reps: 15 }
    ]
  }
];

/** 피드 항목의 종목 id를 실제 종목으로 펼친다. 없는 id는 조용히 버린다. */
function expandFeedEx(item) {
  const D = g.OWDATA;
  if (!D) return [];
  return (item.ex || []).map(it => {
    const e = D.EX_BY_ID ? D.EX_BY_ID[it.id] : D.EXERCISES.find(x => x.id === it.id);
    if (!e) return null;
    return { id: e.id, nm: e.nm, part: e.part, unit: e.unit, sets: it.sets, reps: it.reps };
  }).filter(Boolean);
}

g.OWDEMO = { FEED, expandFeedEx };

})(window);
