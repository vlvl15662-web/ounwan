/* =========================================================
   오운완 앱 - 운동 종목 DB (exercise_db.js)
   총 132종 | 가슴18 등20 어깨18 이두10 삼두10 하체29 코어16 유산소10 ('전신' 부위는 2026-09-05 폐지 — 8종을 주동근 기준으로 재배치)
   표기 기준: 한국 헬스장 실사용 명칭 (플랜핏/헬스로그/유튜브 통용 표기)
   muscles 그룹: chest, lats, traps, front-delt, side-delt, rear-delt,
                 biceps, triceps, forearm, abs, obliques, quads,
                 hamstrings, glutes, calves
   unit: kg(중량) | bw(맨몸) | sec(시간) | min(유산소)
   ========================================================= */

const MUSCLE_GROUPS = {
  front: ['chest', 'front-delt', 'side-delt', 'biceps', 'forearm', 'abs', 'obliques', 'quads'],
  back: ['traps', 'lats', 'rear-delt', 'triceps', 'glutes', 'hamstrings', 'calves'],
  label: {
    chest: '가슴', lats: '광배근', traps: '승모근',
    'front-delt': '전면삼각근', 'side-delt': '측면삼각근', 'rear-delt': '후면삼각근',
    biceps: '이두근', triceps: '삼두근', forearm: '전완근',
    abs: '복직근', obliques: '복사근', quads: '대퇴사두근',
    hamstrings: '햄스트링', glutes: '둔근', calves: '종아리'
  }
};

const EXERCISES = [
  /* ================= 가슴 (18) ================= */
  { id: 'barbell-bench-press', nm: '벤치프레스', alias: ['벤프', '플랫벤치', '바벨벤치프레스', 'bench press'], part: '가슴', sub: '중부가슴', eq: '바벨', lv: 2, sets: 4, reps: 8, unit: 'kg', comp: true, tip: '견갑 하강 고정, 팔꿈치 45도', muscles: { primary: ['chest'], secondary: ['front-delt', 'triceps'] } },
  { id: 'incline-barbell-bench-press', nm: '인클라인 벤치프레스', alias: ['인클벤치', '인클라인 벤프', 'incline bench press'], part: '가슴', sub: '상부가슴', eq: '바벨', lv: 2, sets: 4, reps: 10, unit: 'kg', comp: true, tip: '등판 30도, 쇄골 위로 밀기', muscles: { primary: ['chest'], secondary: ['front-delt', 'triceps'] } },
  { id: 'decline-barbell-bench-press', nm: '디클라인 벤치프레스', alias: ['디클벤치', 'decline bench press'], part: '가슴', sub: '하부가슴', eq: '바벨', lv: 2, sets: 3, reps: 10, unit: 'kg', comp: true, tip: '명치 아래로 내리고 밀어내기', muscles: { primary: ['chest'], secondary: ['triceps'] } },
  { id: 'dumbbell-bench-press', nm: '덤벨 벤치프레스', alias: ['덤벤프', '덤벨프레스', 'dumbbell bench press'], part: '가슴', sub: '중부가슴', eq: '덤벨', lv: 2, sets: 4, reps: 10, unit: 'kg', comp: true, tip: '가동범위 크게, 손목 세우기', muscles: { primary: ['chest'], secondary: ['front-delt', 'triceps'] } },
  { id: 'incline-dumbbell-press', nm: '인클라인 덤벨프레스', alias: ['인덤프', '인클덤벨', 'incline dumbbell press'], part: '가슴', sub: '상부가슴', eq: '덤벨', lv: 2, sets: 4, reps: 10, unit: 'kg', comp: true, tip: '팔꿈치 살짝 안쪽, 모아 올리기', muscles: { primary: ['chest'], secondary: ['front-delt', 'triceps'] } },
  { id: 'decline-dumbbell-press', nm: '디클라인 덤벨프레스', alias: ['디클덤벨', 'decline dumbbell press'], part: '가슴', sub: '하부가슴', eq: '덤벨', lv: 2, sets: 3, reps: 12, unit: 'kg', comp: true, tip: '하부 짜내며 정점 수축', muscles: { primary: ['chest'], secondary: ['triceps'] } },
  { id: 'dumbbell-fly', nm: '덤벨 플라이', alias: ['플라이', '덤플', 'dumbbell fly'], part: '가슴', sub: '중부가슴', eq: '덤벨', lv: 1, sets: 3, reps: 12, unit: 'kg', comp: false, tip: '팔꿈치 각 고정, 가슴만 벌리기', muscles: { primary: ['chest'], secondary: ['front-delt'] } },
  { id: 'incline-dumbbell-fly', nm: '인클라인 덤벨 플라이', alias: ['인클 플라이', 'incline fly'], part: '가슴', sub: '상부가슴', eq: '덤벨', lv: 2, sets: 3, reps: 12, unit: 'kg', comp: false, tip: '위쪽으로 안아 올리듯 모으기', muscles: { primary: ['chest'], secondary: ['front-delt'] } },
  { id: 'cable-crossover', nm: '케이블 크로스오버', alias: ['케크', '크로스오버', 'cable crossover'], part: '가슴', sub: '중부가슴', eq: '케이블', lv: 2, sets: 3, reps: 15, unit: 'kg', comp: false, tip: '한 뼘 교차까지 끝까지 모으기', muscles: { primary: ['chest'], secondary: ['front-delt'] } },
  { id: 'low-cable-fly', nm: '로우 케이블 플라이', alias: ['언더 케이블', '로우케이블', 'low cable fly'], part: '가슴', sub: '상부가슴', eq: '케이블', lv: 2, sets: 3, reps: 15, unit: 'kg', comp: false, tip: '아래에서 위로 쓸어 올리기', muscles: { primary: ['chest'], secondary: ['front-delt'] } },
  { id: 'high-cable-fly', nm: '하이 케이블 플라이', alias: ['하이케이블', 'high cable fly'], part: '가슴', sub: '하부가슴', eq: '케이블', lv: 2, sets: 3, reps: 15, unit: 'kg', comp: false, tip: '배꼽 앞으로 내려 모으기', muscles: { primary: ['chest'], secondary: [] } },
  { id: 'pec-deck-fly', nm: '펙덱 플라이', alias: ['펙덱', '버터플라이', '체스트 플라이 머신', 'pec deck'], part: '가슴', sub: '중부가슴', eq: '머신', lv: 1, sets: 3, reps: 15, unit: 'kg', comp: false, tip: '가슴 내밀고 팔꿈치로 밀기', muscles: { primary: ['chest'], secondary: ['front-delt'] } },
  { id: 'chest-press-machine', nm: '체스트 프레스', alias: ['체프', '머신 체스트프레스', 'chest press'], part: '가슴', sub: '중부가슴', eq: '머신', lv: 1, sets: 4, reps: 12, unit: 'kg', comp: true, tip: '손잡이 명치 높이로 세팅', muscles: { primary: ['chest'], secondary: ['front-delt', 'triceps'] } },
  { id: 'incline-chest-press-machine', nm: '인클라인 체스트 프레스', alias: ['인클 머신프레스', 'incline chest press'], part: '가슴', sub: '상부가슴', eq: '머신', lv: 1, sets: 3, reps: 12, unit: 'kg', comp: true, tip: '어깨 눌러 고정 후 밀기', muscles: { primary: ['chest'], secondary: ['front-delt', 'triceps'] } },
  { id: 'smith-bench-press', nm: '스미스 벤치프레스', alias: ['스미스 벤치', 'smith bench press'], part: '가슴', sub: '중부가슴', eq: '스미스', lv: 1, sets: 4, reps: 10, unit: 'kg', comp: true, tip: '궤도 고정, 유두선에 터치', muscles: { primary: ['chest'], secondary: ['front-delt', 'triceps'] } },
  { id: 'push-up', nm: '푸시업', alias: ['팔굽혀펴기', '푸쉬업', 'push up'], part: '가슴', sub: '중부가슴', eq: '맨몸', lv: 1, sets: 4, reps: 15, unit: 'bw', comp: true, tip: '몸통 일직선, 팔꿈치 45도', muscles: { primary: ['chest'], secondary: ['triceps', 'front-delt', 'abs'] } },
  { id: 'chest-dip', nm: '체스트 딥스', alias: ['딥스', '정면 딥스', 'chest dip'], part: '가슴', sub: '하부가슴', eq: '맨몸', lv: 3, sets: 3, reps: 10, unit: 'bw', comp: true, tip: '상체 앞으로 기울여 내려가기', muscles: { primary: ['chest'], secondary: ['triceps', 'front-delt'] } },
  { id: 'dumbbell-pullover', nm: '덤벨 풀오버', alias: ['풀오버', 'dumbbell pullover'], part: '가슴', sub: '가슴·전거근', eq: '덤벨', lv: 2, sets: 3, reps: 12, unit: 'kg', comp: false, tip: '갈비뼈 열며 크게 늘리기', muscles: { primary: ['chest'], secondary: ['lats', 'triceps'] } },

  /* ================= 등 (20) ================= */
  { id: 'deadlift', nm: '데드리프트', alias: ['데드', '컨벤셔널 데드', 'deadlift'], part: '등', sub: '척추기립근·광배', eq: '바벨', lv: 3, sets: 4, reps: 6, unit: 'kg', comp: true, tip: '허리 중립, 바를 정강이에 붙여', muscles: { primary: ['lats', 'glutes'], secondary: ['hamstrings', 'traps', 'forearm', 'quads'] } },
  { id: 'barbell-row', nm: '바벨로우', alias: ['바로우', '벤트오버 로우', 'barbell row'], part: '등', sub: '광배·중부등', eq: '바벨', lv: 2, sets: 4, reps: 10, unit: 'kg', comp: true, tip: '상체 45도, 배꼽으로 당기기', muscles: { primary: ['lats'], secondary: ['traps', 'rear-delt', 'biceps'] } },
  { id: 'pendlay-row', nm: '펜들레이 로우', alias: ['펜들레이', 'pendlay row'], part: '등', sub: '중부등', eq: '바벨', lv: 3, sets: 4, reps: 8, unit: 'kg', comp: true, tip: '매 회 바닥 정지 후 폭발적으로', muscles: { primary: ['lats', 'traps'], secondary: ['rear-delt', 'biceps'] } },
  { id: 't-bar-row', nm: '티바로우', alias: ['티바', 'T바 로우', 't-bar row'], part: '등', sub: '중부등', eq: '바벨', lv: 2, sets: 4, reps: 10, unit: 'kg', comp: true, tip: '가슴 펴고 명치까지 당기기', muscles: { primary: ['lats', 'traps'], secondary: ['rear-delt', 'biceps'] } },
  { id: 'lat-pulldown', nm: '랫풀다운', alias: ['랫풀', '풀다운', 'lat pulldown'], part: '등', sub: '광배', eq: '케이블', lv: 1, sets: 4, reps: 12, unit: 'kg', comp: true, tip: '가슴 열고 쇄골로 당기기', muscles: { primary: ['lats'], secondary: ['biceps', 'rear-delt'] } },
  { id: 'wide-grip-lat-pulldown', nm: '와이드 랫풀다운', alias: ['와이드 그립 풀다운', 'wide grip pulldown'], part: '등', sub: '광배 상부', eq: '케이블', lv: 1, sets: 4, reps: 12, unit: 'kg', comp: true, tip: '팔은 갈고리, 등으로만 당기기', muscles: { primary: ['lats'], secondary: ['rear-delt', 'biceps'] } },
  { id: 'reverse-grip-lat-pulldown', nm: '언더그립 랫풀다운', alias: ['리버스 랫풀다운', '언더그립 풀다운', 'reverse grip pulldown'], part: '등', sub: '광배 하부', eq: '케이블', lv: 2, sets: 3, reps: 12, unit: 'kg', comp: true, tip: '팔꿈치 몸통 뒤로 밀어 넣기', muscles: { primary: ['lats'], secondary: ['biceps'] } },
  { id: 'seated-cable-row', nm: '시티드 로우', alias: ['케이블 로우', '시티드 케이블로우', 'seated row'], part: '등', sub: '중부등', eq: '케이블', lv: 1, sets: 4, reps: 12, unit: 'kg', comp: true, tip: '반동 없이 견갑 모으기', muscles: { primary: ['lats', 'traps'], secondary: ['rear-delt', 'biceps'] } },
  { id: 'one-arm-dumbbell-row', nm: '원암 덤벨로우', alias: ['덤벨로우', '원암로우', 'one arm dumbbell row'], part: '등', sub: '광배', eq: '덤벨', lv: 2, sets: 4, reps: 12, unit: 'kg', comp: true, tip: '골반 뒤쪽으로 길게 당기기', muscles: { primary: ['lats'], secondary: ['traps', 'biceps', 'rear-delt'] } },
  { id: 'chest-supported-row', nm: '체스트 서포티드 로우', alias: ['인클라인 덤벨로우', '가슴받이 로우', 'chest supported row'], part: '등', sub: '중부등', eq: '덤벨', lv: 2, sets: 3, reps: 12, unit: 'kg', comp: true, tip: '가슴 밀착, 허리 반동 차단', muscles: { primary: ['traps', 'lats'], secondary: ['rear-delt', 'biceps'] } },
  { id: 'pull-up', nm: '풀업', alias: ['턱걸이', '오버그립 턱걸이', 'pull up'], part: '등', sub: '광배', eq: '맨몸', lv: 3, sets: 4, reps: 8, unit: 'bw', comp: true, tip: '가슴 봉에 닿게, 어깨 내려서', muscles: { primary: ['lats'], secondary: ['biceps', 'traps', 'forearm'] } },
  { id: 'chin-up', nm: '친업', alias: ['언더그립 턱걸이', 'chin up'], part: '등', sub: '광배·이두', eq: '맨몸', lv: 3, sets: 3, reps: 8, unit: 'bw', comp: true, tip: '팔꿈치 옆구리로 붙이며 당겨', muscles: { primary: ['lats', 'biceps'], secondary: ['forearm', 'traps'] } },
  { id: 'assisted-pull-up', nm: '어시스트 풀업', alias: ['그래비트론', '중량보조 턱걸이', 'assisted pull up'], part: '등', sub: '광배', eq: '머신', lv: 1, sets: 3, reps: 10, unit: 'kg', comp: true, tip: '보조 무게 줄이며 점진 도전', muscles: { primary: ['lats'], secondary: ['biceps', 'traps'] } },
  { id: 'straight-arm-pulldown', nm: '스트레이트 암 풀다운', alias: ['암풀다운', '스암풀', 'straight arm pulldown'], part: '등', sub: '광배', eq: '케이블', lv: 2, sets: 3, reps: 15, unit: 'kg', comp: false, tip: '팔 펴고 허벅지까지 눌러', muscles: { primary: ['lats'], secondary: ['triceps'] } },
  { id: 'machine-row', nm: '머신 로우', alias: ['시티드 머신로우', 'machine row'], part: '등', sub: '중부등', eq: '머신', lv: 1, sets: 4, reps: 12, unit: 'kg', comp: true, tip: '견갑 먼저, 팔은 나중에', muscles: { primary: ['traps', 'lats'], secondary: ['rear-delt', 'biceps'] } },
  { id: 'hammer-high-row', nm: '해머 하이로우', alias: ['하이로우', '아이소 하이로우', 'hammer high row'], part: '등', sub: '광배 상부', eq: '머신', lv: 2, sets: 4, reps: 10, unit: 'kg', comp: true, tip: '사선 아래로 팔꿈치 끌어내려', muscles: { primary: ['lats'], secondary: ['traps', 'biceps'] } },
  { id: 'rack-pull', nm: '랙풀', alias: ['랙풀 데드', 'rack pull'], part: '등', sub: '상부등·기립근', eq: '바벨', lv: 3, sets: 4, reps: 8, unit: 'kg', comp: true, tip: '무릎 위 세팅, 상체로 세워', muscles: { primary: ['traps', 'lats'], secondary: ['glutes', 'forearm'] } },
  { id: 'back-extension', nm: '백 익스텐션', alias: ['백익스', '하이퍼익스텐션', 'back extension'], part: '등', sub: '척추기립근', eq: '기타', lv: 1, sets: 3, reps: 15, unit: 'bw', comp: false, tip: '허리 과신전 금지, 일직선까지', muscles: { primary: ['glutes', 'hamstrings'], secondary: ['lats'] } },
  { id: 'barbell-shrug', nm: '바벨 슈러그', alias: ['슈러그', '쉬러그', 'barbell shrug'], part: '등', sub: '승모근', eq: '바벨', lv: 1, sets: 4, reps: 15, unit: 'kg', comp: false, tip: '귀 쪽으로 으쓱, 회전 금지', muscles: { primary: ['traps'], secondary: ['forearm'] } },
  { id: 'dumbbell-shrug', nm: '덤벨 슈러그', alias: ['덤벨 쉬러그', 'dumbbell shrug'], part: '등', sub: '승모근', eq: '덤벨', lv: 1, sets: 4, reps: 15, unit: 'kg', comp: false, tip: '정점에서 1초 정지 후 하강', muscles: { primary: ['traps'], secondary: ['forearm'] } },

  /* ================= 어깨 (18) ================= */
  { id: 'overhead-press', nm: '오버헤드 프레스', alias: ['OHP', '밀리터리 프레스', '바벨 숄더프레스', 'overhead press'], part: '어깨', sub: '전면삼각근', eq: '바벨', lv: 2, sets: 4, reps: 8, unit: 'kg', comp: true, tip: '갈비뼈 닫고 머리 뒤로 통과', muscles: { primary: ['front-delt'], secondary: ['side-delt', 'triceps', 'abs'] } },
  { id: 'dumbbell-shoulder-press', nm: '덤벨 숄더프레스', alias: ['숄더프레스', '덤숄프', 'dumbbell shoulder press'], part: '어깨', sub: '전면삼각근', eq: '덤벨', lv: 1, sets: 4, reps: 10, unit: 'kg', comp: true, tip: '팔꿈치 정면 30도, 귀 옆까지', muscles: { primary: ['front-delt'], secondary: ['side-delt', 'triceps'] } },
  { id: 'arnold-press', nm: '아놀드 프레스', alias: ['아놀드', 'arnold press'], part: '어깨', sub: '전면·측면삼각근', eq: '덤벨', lv: 2, sets: 3, reps: 12, unit: 'kg', comp: true, tip: '회전은 천천히, 반동 없이', muscles: { primary: ['front-delt', 'side-delt'], secondary: ['triceps'] } },
  { id: 'machine-shoulder-press', nm: '머신 숄더프레스', alias: ['머신 어깨프레스', 'machine shoulder press'], part: '어깨', sub: '전면삼각근', eq: '머신', lv: 1, sets: 4, reps: 12, unit: 'kg', comp: true, tip: '손잡이 어깨 높이로 세팅', muscles: { primary: ['front-delt'], secondary: ['side-delt', 'triceps'] } },
  { id: 'smith-shoulder-press', nm: '스미스 숄더프레스', alias: ['스미스 밀프', 'smith shoulder press'], part: '어깨', sub: '전면삼각근', eq: '스미스', lv: 1, sets: 4, reps: 10, unit: 'kg', comp: true, tip: '벤치 등판 80도로 세워두기', muscles: { primary: ['front-delt'], secondary: ['triceps'] } },
  { id: 'behind-neck-press', nm: '비하인드 넥 프레스', alias: ['비하인드넥', '백프레스', 'behind neck press'], part: '어깨', sub: '측면삼각근', eq: '바벨', lv: 3, sets: 3, reps: 10, unit: 'kg', comp: true, tip: '가벼운 중량, 귀 높이까지만', muscles: { primary: ['side-delt', 'front-delt'], secondary: ['traps', 'triceps'] } },
  { id: 'side-lateral-raise', nm: '사이드 레터럴 레이즈', alias: ['사레레', '레터럴레이즈', '사이드레이즈', 'side lateral raise'], part: '어깨', sub: '측면삼각근', eq: '덤벨', lv: 1, sets: 4, reps: 15, unit: 'kg', comp: false, tip: '새끼손가락 먼저, 어깨선까지', muscles: { primary: ['side-delt'], secondary: ['traps'] } },
  { id: 'cable-lateral-raise', nm: '케이블 레터럴 레이즈', alias: ['케이블 사레레', 'cable lateral raise'], part: '어깨', sub: '측면삼각근', eq: '케이블', lv: 2, sets: 3, reps: 15, unit: 'kg', comp: false, tip: '몸 뒤에서 시작해 끝까지 장력', muscles: { primary: ['side-delt'], secondary: [] } },
  { id: 'machine-lateral-raise', nm: '머신 레터럴 레이즈', alias: ['머신 사레레', 'machine lateral raise'], part: '어깨', sub: '측면삼각근', eq: '머신', lv: 1, sets: 3, reps: 15, unit: 'kg', comp: false, tip: '승모 힘 빼고 어깨로만 들기', muscles: { primary: ['side-delt'], secondary: [] } },
  { id: 'front-raise', nm: '프론트 레이즈', alias: ['프레레', '전면 레이즈', 'front raise'], part: '어깨', sub: '전면삼각근', eq: '덤벨', lv: 1, sets: 3, reps: 15, unit: 'kg', comp: false, tip: '눈높이까지, 허리 반동 금지', muscles: { primary: ['front-delt'], secondary: ['chest'] } },
  { id: 'plate-front-raise', nm: '원판 프론트 레이즈', alias: ['플레이트 레이즈', '원판 레이즈', 'plate front raise'], part: '어깨', sub: '전면삼각근', eq: '기타', lv: 1, sets: 3, reps: 15, unit: 'kg', comp: false, tip: '원판 양옆 잡고 천천히 올려', muscles: { primary: ['front-delt'], secondary: ['abs'] } },
  { id: 'bent-over-lateral-raise', nm: '벤트오버 레터럴 레이즈', alias: ['벤레레', '리어델트 레이즈', '후면 레이즈', 'rear lateral raise'], part: '어깨', sub: '후면삼각근', eq: '덤벨', lv: 2, sets: 4, reps: 15, unit: 'kg', comp: false, tip: '상체 숙이고 팔꿈치로 벌려', muscles: { primary: ['rear-delt'], secondary: ['traps'] } },
  { id: 'reverse-pec-deck', nm: '리버스 펙덱', alias: ['리버스 플라이 머신', '후면 펙덱', 'reverse pec deck'], part: '어깨', sub: '후면삼각근', eq: '머신', lv: 1, sets: 3, reps: 15, unit: 'kg', comp: false, tip: '가슴 붙이고 뒤로 활짝 열기', muscles: { primary: ['rear-delt'], secondary: ['traps'] } },
  { id: 'face-pull', nm: '페이스풀', alias: ['페이스 풀', 'face pull'], part: '어깨', sub: '후면삼각근·승모', eq: '케이블', lv: 2, sets: 3, reps: 15, unit: 'kg', comp: false, tip: '이마 쪽으로 손등 벌리며 당겨', muscles: { primary: ['rear-delt'], secondary: ['traps'] } },
  { id: 'cable-rear-delt-fly', nm: '케이블 리버스 플라이', alias: ['케이블 리어델트', '케이블 후면 플라이', 'cable reverse fly'], part: '어깨', sub: '후면삼각근', eq: '케이블', lv: 2, sets: 3, reps: 15, unit: 'kg', comp: false, tip: '교차 그립, 팔 편 채 열기', muscles: { primary: ['rear-delt'], secondary: ['traps'] } },
  { id: 'upright-row', nm: '업라이트 로우', alias: ['업로우', 'upright row'], part: '어깨', sub: '측면삼각근·승모', eq: '바벨', lv: 2, sets: 3, reps: 12, unit: 'kg', comp: true, tip: '어깨너비 그립, 명치까지만', muscles: { primary: ['side-delt', 'traps'], secondary: ['biceps'] } },
  { id: 'y-raise', nm: 'Y 레이즈', alias: ['와이레이즈', '인클라인 Y레이즈', 'y raise'], part: '어깨', sub: '하부승모·후면삼각근', eq: '덤벨', lv: 2, sets: 3, reps: 15, unit: 'kg', comp: false, tip: 'Y자로 뻗으며 견갑 하강', muscles: { primary: ['rear-delt', 'traps'], secondary: ['front-delt'] } },
  { id: 'pike-push-up', nm: '파이크 푸시업', alias: ['파이크 푸쉬업', 'pike push up'], part: '어깨', sub: '전면삼각근', eq: '맨몸', lv: 2, sets: 3, reps: 12, unit: 'bw', comp: true, tip: '엉덩이 높이고 정수리로 내려', muscles: { primary: ['front-delt'], secondary: ['triceps', 'chest'] } },

  /* ================= 이두 (10) ================= */
  { id: 'barbell-curl', nm: '바벨컬', alias: ['컬', '바벨 바이셉스컬', 'barbell curl'], part: '이두', sub: '이두근 전체', eq: '바벨', lv: 1, sets: 4, reps: 10, unit: 'kg', comp: false, tip: '팔꿈치 고정, 반동 없이', muscles: { primary: ['biceps'], secondary: ['forearm'] } },
  { id: 'ez-bar-curl', nm: 'EZ바 컬', alias: ['이지바컬', '이지바 컬', 'ez bar curl'], part: '이두', sub: '이두근 전체', eq: '바벨', lv: 1, sets: 4, reps: 12, unit: 'kg', comp: false, tip: '손목 편한 각도로 잡고 수축', muscles: { primary: ['biceps'], secondary: ['forearm'] } },
  { id: 'dumbbell-curl', nm: '덤벨컬', alias: ['얼터네이트 컬', '덤벨 바이셉스컬', 'dumbbell curl'], part: '이두', sub: '이두근 전체', eq: '덤벨', lv: 1, sets: 4, reps: 12, unit: 'kg', comp: false, tip: '올릴 때 새끼손가락 회전', muscles: { primary: ['biceps'], secondary: ['forearm'] } },
  { id: 'hammer-curl', nm: '해머컬', alias: ['해머 컬', 'hammer curl'], part: '이두', sub: '상완근·전완', eq: '덤벨', lv: 1, sets: 3, reps: 12, unit: 'kg', comp: false, tip: '망치 그립 유지, 팔꿈치 고정', muscles: { primary: ['biceps', 'forearm'], secondary: [] } },
  { id: 'incline-dumbbell-curl', nm: '인클라인 덤벨컬', alias: ['인클컬', 'incline dumbbell curl'], part: '이두', sub: '이두 장두', eq: '덤벨', lv: 2, sets: 3, reps: 12, unit: 'kg', comp: false, tip: '팔 뒤로 늘어뜨려 스트레치', muscles: { primary: ['biceps'], secondary: ['forearm'] } },
  { id: 'preacher-curl', nm: '프리처컬', alias: ['프리쳐컬', '스캇컬', 'preacher curl'], part: '이두', sub: '이두 단두', eq: '머신', lv: 1, sets: 3, reps: 12, unit: 'kg', comp: false, tip: '겨드랑이 패드 밀착, 끝까지', muscles: { primary: ['biceps'], secondary: ['forearm'] } },
  { id: 'concentration-curl', nm: '컨센트레이션 컬', alias: ['집중컬', '컨센컬', 'concentration curl'], part: '이두', sub: '이두 단두', eq: '덤벨', lv: 1, sets: 3, reps: 12, unit: 'kg', comp: false, tip: '팔꿈치 허벅지 고정 후 짜내기', muscles: { primary: ['biceps'], secondary: [] } },
  { id: 'cable-curl', nm: '케이블 컬', alias: ['케이블 바이셉스컬', 'cable curl'], part: '이두', sub: '이두근 전체', eq: '케이블', lv: 1, sets: 3, reps: 15, unit: 'kg', comp: false, tip: '내릴 때도 장력 유지', muscles: { primary: ['biceps'], secondary: ['forearm'] } },
  { id: 'spider-curl', nm: '스파이더 컬', alias: ['스파이더컬', 'spider curl'], part: '이두', sub: '이두 단두', eq: '덤벨', lv: 2, sets: 3, reps: 12, unit: 'kg', comp: false, tip: '팔 수직 유지, 정점 1초 수축', muscles: { primary: ['biceps'], secondary: [] } },
  { id: 'reverse-curl', nm: '리버스 컬', alias: ['역그립 컬', '리버스 바벨컬', 'reverse curl'], part: '이두', sub: '전완·상완근', eq: '바벨', lv: 1, sets: 3, reps: 15, unit: 'kg', comp: false, tip: '오버그립으로 손등 위로 올려', muscles: { primary: ['forearm', 'biceps'], secondary: [] } },

  /* ================= 삼두 (10) ================= */
  { id: 'cable-pushdown', nm: '케이블 푸시다운', alias: ['푸시다운', '프레스다운', '트라이셉스 푸시다운', 'cable pushdown'], part: '삼두', sub: '삼두 외측두', eq: '케이블', lv: 1, sets: 4, reps: 15, unit: 'kg', comp: false, tip: '팔꿈치 옆구리 고정, 끝까지 펴', muscles: { primary: ['triceps'], secondary: ['forearm'] } },
  { id: 'rope-pushdown', nm: '로프 푸시다운', alias: ['로프 프레스다운', 'rope pushdown'], part: '삼두', sub: '삼두 외측두', eq: '케이블', lv: 1, sets: 3, reps: 15, unit: 'kg', comp: false, tip: '아래서 로프 좌우로 벌리기', muscles: { primary: ['triceps'], secondary: [] } },
  { id: 'lying-triceps-extension', nm: '라잉 트라이셉스 익스텐션', alias: ['스컬크러셔', '프렌치프레스', '이마깨기', 'skull crusher'], part: '삼두', sub: '삼두 장두', eq: '바벨', lv: 2, sets: 4, reps: 12, unit: 'kg', comp: false, tip: '팔꿈치 벌어지지 않게 고정', muscles: { primary: ['triceps'], secondary: [] } },
  { id: 'overhead-dumbbell-extension', nm: '오버헤드 덤벨 익스텐션', alias: ['덤벨 프렌치프레스', '오버헤드 익스텐션', 'overhead extension'], part: '삼두', sub: '삼두 장두', eq: '덤벨', lv: 1, sets: 3, reps: 12, unit: 'kg', comp: false, tip: '팔꿈치 귀 옆, 깊게 내려', muscles: { primary: ['triceps'], secondary: [] } },
  { id: 'overhead-rope-extension', nm: '오버헤드 로프 익스텐션', alias: ['케이블 오버헤드', 'overhead rope extension'], part: '삼두', sub: '삼두 장두', eq: '케이블', lv: 2, sets: 3, reps: 15, unit: 'kg', comp: false, tip: '상체 살짝 숙이고 앞으로 뻗어', muscles: { primary: ['triceps'], secondary: [] } },
  { id: 'close-grip-bench-press', nm: '클로즈그립 벤치프레스', alias: ['클그벤', '내로우 벤치', 'close grip bench press'], part: '삼두', sub: '삼두 내측두', eq: '바벨', lv: 2, sets: 4, reps: 10, unit: 'kg', comp: true, tip: '어깨너비 그립, 팔꿈치 붙여', muscles: { primary: ['triceps'], secondary: ['chest', 'front-delt'] } },
  { id: 'triceps-dip', nm: '딥스', alias: ['삼두 딥스', '패러렐바 딥스', 'triceps dip'], part: '삼두', sub: '삼두 전체', eq: '맨몸', lv: 3, sets: 3, reps: 10, unit: 'bw', comp: true, tip: '상체 세우고 팔꿈치 뒤로', muscles: { primary: ['triceps'], secondary: ['chest', 'front-delt'] } },
  { id: 'bench-dip', nm: '벤치 딥스', alias: ['벤치딥', '의자 딥스', 'bench dip'], part: '삼두', sub: '삼두 전체', eq: '맨몸', lv: 1, sets: 3, reps: 15, unit: 'bw', comp: true, tip: '엉덩이 벤치에 붙여 수직 하강', muscles: { primary: ['triceps'], secondary: ['front-delt'] } },
  { id: 'dumbbell-kickback', nm: '덤벨 킥백', alias: ['킥백', '트라이셉스 킥백', 'triceps kickback'], part: '삼두', sub: '삼두 외측두', eq: '덤벨', lv: 1, sets: 3, reps: 15, unit: 'kg', comp: false, tip: '상완 고정, 뒤로 완전히 펴기', muscles: { primary: ['triceps'], secondary: [] } },
  { id: 'diamond-push-up', nm: '다이아몬드 푸시업', alias: ['내로우 푸시업', '삼두 푸시업', 'diamond push up'], part: '삼두', sub: '삼두 내측두', eq: '맨몸', lv: 2, sets: 3, reps: 15, unit: 'bw', comp: true, tip: '손으로 삼각형, 팔꿈치 붙여', muscles: { primary: ['triceps'], secondary: ['chest', 'abs'] } },

  /* ================= 하체 (25) ================= */
  { id: 'barbell-back-squat', nm: '바벨 스쿼트', alias: ['스쿼트', '백스쿼트', 'back squat'], part: '하체', sub: '대퇴사두·둔근', eq: '바벨', lv: 2, sets: 4, reps: 8, unit: 'kg', comp: true, tip: '무릎 발끝 방향, 허벅지 수평', muscles: { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'abs'] } },
  { id: 'front-squat', nm: '프론트 스쿼트', alias: ['프론트스쿼트', 'front squat'], part: '하체', sub: '대퇴사두', eq: '바벨', lv: 3, sets: 4, reps: 8, unit: 'kg', comp: true, tip: '팔꿈치 높게, 상체 수직 유지', muscles: { primary: ['quads'], secondary: ['glutes', 'abs'] } },
  { id: 'smith-squat', nm: '스미스 스쿼트', alias: ['스미스머신 스쿼트', 'smith squat'], part: '하체', sub: '대퇴사두', eq: '스미스', lv: 1, sets: 4, reps: 10, unit: 'kg', comp: true, tip: '발 한 발 앞에 두고 앉기', muscles: { primary: ['quads'], secondary: ['glutes'] } },
  { id: 'hack-squat', nm: '핵 스쿼트', alias: ['핵스쿼트 머신', 'hack squat'], part: '하체', sub: '대퇴사두', eq: '머신', lv: 2, sets: 4, reps: 10, unit: 'kg', comp: true, tip: '허리 등판 밀착, 깊게 앉기', muscles: { primary: ['quads'], secondary: ['glutes'] } },
  { id: 'goblet-squat', nm: '고블릿 스쿼트', alias: ['고블렛 스쿼트', 'goblet squat'], part: '하체', sub: '대퇴사두', eq: '덤벨', lv: 1, sets: 3, reps: 12, unit: 'kg', comp: true, tip: '덤벨 가슴 앞, 상체 세워서', muscles: { primary: ['quads', 'glutes'], secondary: ['abs'] } },
  { id: 'leg-press', nm: '레그프레스', alias: ['레프', '45도 레그프레스', 'leg press'], part: '하체', sub: '대퇴사두·둔근', eq: '머신', lv: 1, sets: 4, reps: 12, unit: 'kg', comp: true, tip: '무릎 완전히 펴지 말 것', muscles: { primary: ['quads', 'glutes'], secondary: ['hamstrings'] } },
  { id: 'bulgarian-split-squat', nm: '불가리안 스플릿 스쿼트', alias: ['불스', '불가리안', 'bulgarian split squat'], part: '하체', sub: '대퇴사두·둔근', eq: '덤벨', lv: 3, sets: 3, reps: 12, unit: 'kg', comp: true, tip: '앞발에 체중 80%, 수직 하강', muscles: { primary: ['quads', 'glutes'], secondary: ['hamstrings'] } },
  { id: 'lunge', nm: '런지', alias: ['워킹런지', '덤벨런지', 'lunge'], part: '하체', sub: '대퇴사두·둔근', eq: '덤벨', lv: 2, sets: 3, reps: 12, unit: 'kg', comp: true, tip: '보폭 넓게, 뒷무릎 바닥 근처', muscles: { primary: ['quads', 'glutes'], secondary: ['hamstrings'] } },
  { id: 'leg-extension', nm: '레그 익스텐션', alias: ['레그익스', '레익', 'leg extension'], part: '하체', sub: '대퇴사두', eq: '머신', lv: 1, sets: 4, reps: 15, unit: 'kg', comp: false, tip: '정점 1초 정지, 천천히 하강', muscles: { primary: ['quads'], secondary: [] } },
  { id: 'lying-leg-curl', nm: '라잉 레그컬', alias: ['레그컬', '레컬', 'lying leg curl'], part: '하체', sub: '햄스트링', eq: '머신', lv: 1, sets: 4, reps: 15, unit: 'kg', comp: false, tip: '골반 붙이고 끝까지 접기', muscles: { primary: ['hamstrings'], secondary: ['calves'] } },
  { id: 'seated-leg-curl', nm: '시티드 레그컬', alias: ['앉아서 레그컬', 'seated leg curl'], part: '하체', sub: '햄스트링', eq: '머신', lv: 1, sets: 4, reps: 15, unit: 'kg', comp: false, tip: '허벅지 패드로 고정 후 당겨', muscles: { primary: ['hamstrings'], secondary: ['calves'] } },
  { id: 'romanian-deadlift', nm: '루마니안 데드리프트', alias: ['루데', 'RDL', 'romanian deadlift'], part: '하체', sub: '햄스트링·둔근', eq: '바벨', lv: 2, sets: 4, reps: 10, unit: 'kg', comp: true, tip: '엉덩이 뒤로, 바 허벅지 스치게', muscles: { primary: ['hamstrings', 'glutes'], secondary: ['lats', 'forearm'] } },
  { id: 'stiff-leg-deadlift', nm: '스티프 레그 데드리프트', alias: ['스티프데드', 'stiff leg deadlift'], part: '하체', sub: '햄스트링', eq: '바벨', lv: 2, sets: 3, reps: 12, unit: 'kg', comp: true, tip: '무릎 거의 펴고 햄 늘리기', muscles: { primary: ['hamstrings'], secondary: ['glutes'] } },
  { id: 'sumo-deadlift', nm: '스모 데드리프트', alias: ['스모데드', 'sumo deadlift'], part: '하체', sub: '둔근·내전근', eq: '바벨', lv: 3, sets: 4, reps: 6, unit: 'kg', comp: true, tip: '발 넓게, 무릎 바깥으로 밀어', muscles: { primary: ['glutes', 'quads'], secondary: ['hamstrings', 'traps', 'forearm'] } },
  { id: 'hip-thrust', nm: '힙 쓰러스트', alias: ['힙쓰', '바벨 힙쓰러스트', 'hip thrust'], part: '하체', sub: '대둔근', eq: '바벨', lv: 2, sets: 4, reps: 12, unit: 'kg', comp: true, tip: '턱 당기고 정점에서 골반 조여', muscles: { primary: ['glutes'], secondary: ['hamstrings', 'quads'] } },
  { id: 'glute-bridge', nm: '글루트 브릿지', alias: ['브릿지', '엉덩이 들기', 'glute bridge'], part: '하체', sub: '대둔근', eq: '맨몸', lv: 1, sets: 3, reps: 15, unit: 'bw', comp: false, tip: '허리 대신 엉덩이로 밀어올려', muscles: { primary: ['glutes'], secondary: ['hamstrings'] } },
  { id: 'cable-kickback', nm: '케이블 킥백', alias: ['글루트 킥백', '케이블 힙익스텐션', 'cable kickback'], part: '하체', sub: '대둔근', eq: '케이블', lv: 1, sets: 3, reps: 15, unit: 'kg', comp: false, tip: '허리 젖히지 말고 다리만 뒤로', muscles: { primary: ['glutes'], secondary: ['hamstrings'] } },
  { id: 'hip-abduction', nm: '힙 어브덕션', alias: ['아웃타이', '외전 머신', 'hip abduction'], part: '하체', sub: '중둔근', eq: '머신', lv: 1, sets: 3, reps: 20, unit: 'kg', comp: false, tip: '상체 살짝 숙여 자극 극대화', muscles: { primary: ['glutes'], secondary: [] } },
  { id: 'hip-adduction', nm: '힙 어덕션', alias: ['인타이', '내전 머신', 'hip adduction'], part: '하체', sub: '내전근', eq: '머신', lv: 1, sets: 3, reps: 20, unit: 'kg', comp: false, tip: '천천히 벌리며 늘려주기', muscles: { primary: ['quads'], secondary: ['glutes'] } },
  { id: 'standing-calf-raise', nm: '스탠딩 카프레이즈', alias: ['카프레이즈', '종아리 운동', 'standing calf raise'], part: '하체', sub: '비복근', eq: '머신', lv: 1, sets: 4, reps: 20, unit: 'kg', comp: false, tip: '발끝 끝까지 들고 1초 정지', muscles: { primary: ['calves'], secondary: [] } },
  { id: 'seated-calf-raise', nm: '시티드 카프레이즈', alias: ['앉아서 카프', 'seated calf raise'], part: '하체', sub: '가자미근', eq: '머신', lv: 1, sets: 4, reps: 20, unit: 'kg', comp: false, tip: '무릎 90도, 아래로 깊게 늘려', muscles: { primary: ['calves'], secondary: [] } },
  { id: 'step-up', nm: '스텝업', alias: ['박스 스텝업', 'step up'], part: '하체', sub: '대퇴사두·둔근', eq: '덤벨', lv: 2, sets: 3, reps: 12, unit: 'kg', comp: true, tip: '올라가는 발로만 밀어 올리기', muscles: { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'calves'] } },
  { id: 'sissy-squat', nm: '시시 스쿼트', alias: ['시시스쿼트', 'sissy squat'], part: '하체', sub: '대퇴사두', eq: '맨몸', lv: 3, sets: 3, reps: 12, unit: 'bw', comp: false, tip: '무릎 앞으로, 골반 일직선', muscles: { primary: ['quads'], secondary: ['abs'] } },
  { id: 'good-morning', nm: '굿모닝', alias: ['굿모닝 엑서사이즈', 'good morning'], part: '하체', sub: '햄스트링·기립근', eq: '바벨', lv: 3, sets: 3, reps: 12, unit: 'kg', comp: true, tip: '가벼운 중량, 허리 중립 유지', muscles: { primary: ['hamstrings', 'glutes'], secondary: ['lats'] } },
  { id: 'wall-sit', nm: '월싯', alias: ['벽 스쿼트', '벽에 앉기', 'wall sit'], part: '하체', sub: '대퇴사두', eq: '맨몸', lv: 1, sets: 3, reps: 45, unit: 'sec', comp: false, tip: '무릎 90도, 등 벽에 붙여 버텨', muscles: { primary: ['quads'], secondary: ['glutes'] } },

  /* ================= 코어 (15) ================= */
  { id: 'plank', nm: '플랭크', alias: ['플랑크', 'plank'], part: '코어', sub: '복직근·코어', eq: '맨몸', lv: 1, sets: 3, reps: 60, unit: 'sec', comp: false, tip: '엉덩이 들지 말고 일직선', muscles: { primary: ['abs'], secondary: ['obliques', 'glutes'] } },
  { id: 'side-plank', nm: '사이드 플랭크', alias: ['옆 플랭크', 'side plank'], part: '코어', sub: '복사근', eq: '맨몸', lv: 1, sets: 3, reps: 40, unit: 'sec', comp: false, tip: '골반 아래로 처지지 않게', muscles: { primary: ['obliques'], secondary: ['abs', 'glutes'] } },
  { id: 'crunch', nm: '크런치', alias: ['상복부 크런치', 'crunch'], part: '코어', sub: '상복부', eq: '맨몸', lv: 1, sets: 3, reps: 20, unit: 'bw', comp: false, tip: '목 대신 갈비뼈를 말아 올려', muscles: { primary: ['abs'], secondary: [] } },
  { id: 'sit-up', nm: '싯업', alias: ['윗몸일으키기', 'sit up'], part: '코어', sub: '복직근', eq: '맨몸', lv: 1, sets: 3, reps: 20, unit: 'bw', comp: false, tip: '반동 없이 척추 하나씩 말아', muscles: { primary: ['abs'], secondary: ['quads'] } },
  { id: 'leg-raise', nm: '레그 레이즈', alias: ['라잉 레그레이즈', '누워 다리들기', 'leg raise'], part: '코어', sub: '하복부', eq: '맨몸', lv: 1, sets: 3, reps: 15, unit: 'bw', comp: false, tip: '허리 바닥에 붙인 채 내리기', muscles: { primary: ['abs'], secondary: ['quads'] } },
  { id: 'hanging-leg-raise', nm: '행잉 레그레이즈', alias: ['철봉 레그레이즈', 'hanging leg raise'], part: '코어', sub: '하복부', eq: '맨몸', lv: 3, sets: 3, reps: 12, unit: 'bw', comp: false, tip: '골반 말아 올려 반동 차단', muscles: { primary: ['abs'], secondary: ['obliques', 'forearm'] } },
  { id: 'captains-chair-knee-raise', nm: '캡틴체어 니레이즈', alias: ['니업', '버티컬 니레이즈', 'knee raise'], part: '코어', sub: '하복부', eq: '기타', lv: 2, sets: 3, reps: 15, unit: 'bw', comp: false, tip: '무릎을 가슴까지 끌어당겨', muscles: { primary: ['abs'], secondary: ['obliques'] } },
  { id: 'russian-twist', nm: '러시안 트위스트', alias: ['러시안트위스트', 'russian twist'], part: '코어', sub: '복사근', eq: '맨몸', lv: 2, sets: 3, reps: 20, unit: 'bw', comp: false, tip: '시선 따라 몸통 전체 회전', muscles: { primary: ['obliques'], secondary: ['abs'] } },
  { id: 'cable-crunch', nm: '케이블 크런치', alias: ['니링 크런치', '케이블 복근', 'cable crunch'], part: '코어', sub: '복직근', eq: '케이블', lv: 2, sets: 4, reps: 15, unit: 'kg', comp: false, tip: '엉덩이 고정, 복근으로만 말아', muscles: { primary: ['abs'], secondary: ['obliques'] } },
  { id: 'ab-wheel-rollout', nm: '앱 롤아웃', alias: ['AB롤러', '복근롤러', 'ab wheel'], part: '코어', sub: '복직근', eq: '기타', lv: 3, sets: 3, reps: 12, unit: 'bw', comp: false, tip: '허리 꺾이면 즉시 중단', muscles: { primary: ['abs'], secondary: ['lats', 'obliques'] } },
  { id: 'mountain-climber', nm: '마운틴 클라이머', alias: ['마클', 'mountain climber'], part: '코어', sub: '코어·심폐', eq: '맨몸', lv: 1, sets: 3, reps: 30, unit: 'sec', comp: true, tip: '엉덩이 높이 고정하고 빠르게', muscles: { primary: ['abs'], secondary: ['obliques', 'quads', 'front-delt'] } },
  { id: 'dead-bug', nm: '데드버그', alias: ['dead bug'], part: '코어', sub: '코어 안정화', eq: '맨몸', lv: 1, sets: 3, reps: 15, unit: 'bw', comp: false, tip: '허리 바닥 밀착 유지가 핵심', muscles: { primary: ['abs'], secondary: ['obliques'] } },
  { id: 'bird-dog', nm: '버드독', alias: ['bird dog'], part: '코어', sub: '코어·기립근', eq: '맨몸', lv: 1, sets: 3, reps: 15, unit: 'bw', comp: false, tip: '반대 팔다리 수평까지만 뻗어', muscles: { primary: ['abs'], secondary: ['glutes', 'traps'] } },
  { id: 'bicycle-crunch', nm: '바이시클 크런치', alias: ['자전거 크런치', 'bicycle crunch'], part: '코어', sub: '복사근', eq: '맨몸', lv: 1, sets: 3, reps: 20, unit: 'bw', comp: false, tip: '팔꿈치 대신 어깨로 회전', muscles: { primary: ['obliques'], secondary: ['abs'] } },
  { id: 'hollow-hold', nm: '할로우 홀드', alias: ['할로우바디', 'hollow hold'], part: '코어', sub: '복직근', eq: '맨몸', lv: 2, sets: 3, reps: 30, unit: 'sec', comp: false, tip: '허리 눌러 바나나 자세 유지', muscles: { primary: ['abs'], secondary: ['quads', 'obliques'] } },

  /* ================= 옛 '전신' 8종 — 주동근 기준으로 재배치 ================= */
  { id: 'burpee', nm: '버피', alias: ['버피테스트', 'burpee'], part: '유산소', sub: '전신·심폐', eq: '맨몸', lv: 2, sets: 4, reps: 15, unit: 'bw', comp: true, tip: '착지 부드럽게, 리듬 유지', muscles: { primary: ['quads', 'chest'], secondary: ['abs', 'front-delt', 'triceps', 'glutes'] } },
  { id: 'kettlebell-swing', nm: '케틀벨 스윙', alias: ['KB스윙', '케틀벨스윙', 'kettlebell swing'], part: '하체', sub: '후면사슬', eq: '기타', lv: 2, sets: 4, reps: 20, unit: 'kg', comp: true, tip: '팔 아닌 힙 힌지로 튕겨내기', muscles: { primary: ['glutes', 'hamstrings'], secondary: ['abs', 'front-delt', 'traps'] } },
  { id: 'clean-and-press', nm: '클린 앤 프레스', alias: ['클린앤프레스', 'clean and press'], part: '어깨', sub: '전신 파워', eq: '바벨', lv: 3, sets: 4, reps: 6, unit: 'kg', comp: true, tip: '하체 폭발력으로 먼저 올려', muscles: { primary: ['front-delt', 'quads'], secondary: ['traps', 'glutes', 'triceps'] } },
  { id: 'power-clean', nm: '파워 클린', alias: ['클린', 'power clean'], part: '하체', sub: '전신 파워', eq: '바벨', lv: 3, sets: 5, reps: 3, unit: 'kg', comp: true, tip: '바를 몸에 붙이고 삼중신전', muscles: { primary: ['traps', 'glutes'], secondary: ['quads', 'hamstrings', 'front-delt'] } },
  { id: 'thruster', nm: '스러스터', alias: ['덤벨 스러스터', 'thruster'], part: '하체', sub: '하체·어깨', eq: '덤벨', lv: 3, sets: 4, reps: 10, unit: 'kg', comp: true, tip: '스쿼트 반동 그대로 머리 위로', muscles: { primary: ['quads', 'front-delt'], secondary: ['glutes', 'triceps', 'abs'] } },
  { id: 'dumbbell-snatch', nm: '덤벨 스내치', alias: ['스내치', 'dumbbell snatch'], part: '어깨', sub: '전신 파워', eq: '덤벨', lv: 3, sets: 5, reps: 5, unit: 'kg', comp: true, tip: '한 번에 머리 위로, 팔꿈치 잠금', muscles: { primary: ['front-delt', 'glutes'], secondary: ['traps', 'quads', 'abs'] } },
  { id: 'farmers-walk', nm: '파머스 워크', alias: ['파머스캐리', 'farmers walk'], part: '코어', sub: '전완·코어', eq: '덤벨', lv: 2, sets: 3, reps: 40, unit: 'sec', comp: true, tip: '가슴 펴고 어깨 내린 채 걷기', muscles: { primary: ['forearm', 'traps'], secondary: ['abs', 'obliques', 'quads'] } },
  { id: 'battle-rope', nm: '배틀로프', alias: ['배틀로프 웨이브', 'battle rope'], part: '유산소', sub: '전신·심폐', eq: '기타', lv: 2, sets: 4, reps: 30, unit: 'sec', comp: true, tip: '무릎 살짝 굽히고 빠르게 웨이브', muscles: { primary: ['front-delt', 'forearm'], secondary: ['abs', 'quads', 'lats'] } },

  /* ================= 유산소 (8) ================= */
  { id: 'treadmill-run', nm: '트레드밀 러닝', alias: ['러닝머신', '달리기', 'treadmill run'], part: '유산소', sub: '심폐', eq: '머신', lv: 1, sets: 1, reps: 30, unit: 'min', comp: true, tip: '착지는 발 중앙, 상체 세우고', muscles: { primary: ['quads', 'calves'], secondary: ['hamstrings', 'glutes'] } },
  { id: 'incline-walk', nm: '경사 걷기', alias: ['인클라인 워킹', '트레드밀 경사걷기', 'incline walk'], part: '유산소', sub: '심폐·둔근', eq: '머신', lv: 1, sets: 1, reps: 40, unit: 'min', comp: true, tip: '손잡이 놓고 경사 10~12%', muscles: { primary: ['glutes', 'hamstrings'], secondary: ['quads', 'calves'] } },
  { id: 'cycling', nm: '사이클', alias: ['실내자전거', '스피닝', 'cycling'], part: '유산소', sub: '심폐·하체', eq: '머신', lv: 1, sets: 1, reps: 30, unit: 'min', comp: true, tip: '안장 높이는 무릎 살짝 굽게', muscles: { primary: ['quads'], secondary: ['glutes', 'calves', 'hamstrings'] } },
  { id: 'rowing-machine', nm: '로잉머신', alias: ['로워', '조정머신', 'rowing machine'], part: '유산소', sub: '전신·심폐', eq: '머신', lv: 2, sets: 1, reps: 20, unit: 'min', comp: true, tip: '다리→몸통→팔 순서로 당겨', muscles: { primary: ['lats', 'quads'], secondary: ['traps', 'biceps', 'glutes'] } },
  { id: 'stair-climber', nm: '스텝밀', alias: ['천국의 계단', '스테어마스터', 'stair climber'], part: '유산소', sub: '하체·심폐', eq: '머신', lv: 2, sets: 1, reps: 20, unit: 'min', comp: true, tip: '난간에 기대지 말고 상체 세워', muscles: { primary: ['glutes', 'quads'], secondary: ['calves', 'hamstrings'] } },
  { id: 'elliptical', nm: '일립티컬', alias: ['크로스트레이너', '사이클론', 'elliptical'], part: '유산소', sub: '심폐', eq: '머신', lv: 1, sets: 1, reps: 30, unit: 'min', comp: true, tip: '발 전체로 밀고 팔도 함께', muscles: { primary: ['quads', 'glutes'], secondary: ['calves', 'lats'] } },
  { id: 'jump-rope', nm: '줄넘기', alias: ['로프 스키핑', 'jump rope'], part: '유산소', sub: '심폐·종아리', eq: '기타', lv: 1, sets: 5, reps: 3, unit: 'min', comp: true, tip: '손목으로 돌리고 낮게 점프', muscles: { primary: ['calves'], secondary: ['quads', 'forearm'] } },
  { id: 'hiit-interval', nm: 'HIIT 인터벌', alias: ['고강도 인터벌', '타바타', 'hiit'], part: '유산소', sub: '심폐 고강도', eq: '기타', lv: 3, sets: 8, reps: 1, unit: 'min', comp: true, tip: '전력 20초 + 휴식 40초 반복', muscles: { primary: ['quads', 'abs'], secondary: ['glutes', 'calves', 'chest'] } }
];

/* =========================================================
   분할 프리셋 (요일별 종목 id 5~7개)
   ========================================================= */
const SPLIT_PRESETS = {
  /* 헬린이 입문 3분할 — 온보딩 '헬린이로 시작'에서만 쓰인다.
     세트·횟수가 종목 기본값과 다르므로 {id, sets, reps} 형태로 직접 지정했다
     (expandPreset이 문자열 id와 객체를 모두 받는다). */
  rookie: {
    name: '헬린이에요 !',
    desc: '처음이라면 이대로만 하세요. 기구 위주라 자세 잡기 쉽고, 3분할이라 회복도 넉넉합니다.',
    rookie: true,
    days: [
      { label: '하체', ex: [
        { id: 'leg-extension',        sets: 3, reps: 12 },
        { id: 'lying-leg-curl',       sets: 3, reps: 12 },
        { id: 'barbell-back-squat',   sets: 3, reps: 15 }
      ] },
      { label: 'push(가슴·어깨·삼두)', ex: [
        { id: 'barbell-bench-press',    sets: 4, reps: 12 },
        { id: 'dumbbell-shoulder-press',sets: 4, reps: 15 },
        { id: 'cable-pushdown',         sets: 3, reps: 12 },
        { id: 'side-lateral-raise',     sets: 5, reps: 15 }
      ] },
      { label: 'pull(등·이두)', ex: [
        { id: 'lat-pulldown',     sets: 4, reps: 15 },
        { id: 'seated-cable-row', sets: 4, reps: 15 },
        { id: 'reverse-pec-deck', sets: 4, reps: 20 },   // 후면삼각근
        { id: 'barbell-curl',     sets: 3, reps: 20 }
      ] }
    ]
  },
  full: {
    name: '무분할(전신)',
    desc: '주 2~3회, 헬린이 입문용 전신 루틴',
    days: [
      { label: '전신', ex: ['barbell-back-squat', 'barbell-bench-press', 'lat-pulldown', 'dumbbell-shoulder-press', 'romanian-deadlift', 'plank', 'treadmill-run'] }
    ]
  },
  split2: {
    name: '2분할(상체/하체)',
    desc: '주 4회, 시간 없는 직장인 추천',
    days: [
      { label: '상체', ex: ['barbell-bench-press', 'lat-pulldown', 'dumbbell-shoulder-press', 'seated-cable-row', 'side-lateral-raise', 'barbell-curl', 'cable-pushdown'] },
      { label: '하체', ex: ['barbell-back-squat', 'romanian-deadlift', 'leg-press', 'lying-leg-curl', 'leg-extension', 'standing-calf-raise', 'hanging-leg-raise'] }
    ]
  },
  ppl: {
    name: '3분할(밀당하)',
    desc: '밀기 / 당기기 / 하체 - 가장 대중적인 3분할',
    days: [
      { label: '밀기(가슴·어깨·삼두)', ex: ['barbell-bench-press', 'incline-dumbbell-press', 'overhead-press', 'side-lateral-raise', 'cable-crossover', 'cable-pushdown'] },
      { label: '당기기(등·이두)', ex: ['deadlift', 'lat-pulldown', 'barbell-row', 'seated-cable-row', 'face-pull', 'barbell-curl', 'hammer-curl'] },
      { label: '하체', ex: ['barbell-back-squat', 'leg-press', 'romanian-deadlift', 'lying-leg-curl', 'leg-extension', 'standing-calf-raise'] }
    ]
  },
  split3b: {
    name: '3분할(가슴삼두-등이두-하체어깨)',
    desc: '보디빌딩식 3분할, 팔 볼륨 확보형',
    days: [
      { label: '가슴·삼두', ex: ['barbell-bench-press', 'incline-dumbbell-press', 'pec-deck-fly', 'chest-dip', 'lying-triceps-extension', 'rope-pushdown'] },
      { label: '등·이두', ex: ['pull-up', 'barbell-row', 'lat-pulldown', 'seated-cable-row', 'barbell-curl', 'incline-dumbbell-curl'] },
      { label: '하체·어깨', ex: ['barbell-back-squat', 'romanian-deadlift', 'leg-extension', 'overhead-press', 'side-lateral-raise', 'reverse-pec-deck', 'standing-calf-raise'] }
    ]
  },
  split4: {
    name: '4분할',
    desc: '가슴삼두 / 등이두 / 어깨복근 / 하체',
    days: [
      { label: '가슴·삼두', ex: ['barbell-bench-press', 'incline-dumbbell-press', 'cable-crossover', 'chest-press-machine', 'close-grip-bench-press', 'cable-pushdown'] },
      { label: '등·이두', ex: ['deadlift', 'lat-pulldown', 'barbell-row', 'one-arm-dumbbell-row', 'straight-arm-pulldown', 'ez-bar-curl', 'hammer-curl'] },
      { label: '어깨·복근', ex: ['overhead-press', 'dumbbell-shoulder-press', 'side-lateral-raise', 'bent-over-lateral-raise', 'face-pull', 'cable-crunch', 'hanging-leg-raise'] },
      { label: '하체', ex: ['barbell-back-squat', 'leg-press', 'romanian-deadlift', 'bulgarian-split-squat', 'seated-leg-curl', 'standing-calf-raise'] }
    ]
  },
  split5: {
    name: '5분할',
    desc: '가슴 / 등 / 어깨 / 팔 / 하체 - 부위별 집중',
    days: [
      { label: '가슴', ex: ['barbell-bench-press', 'incline-barbell-bench-press', 'dumbbell-fly', 'cable-crossover', 'pec-deck-fly', 'chest-dip'] },
      { label: '등', ex: ['deadlift', 'pull-up', 'barbell-row', 'lat-pulldown', 'seated-cable-row', 'straight-arm-pulldown', 'barbell-shrug'] },
      { label: '어깨', ex: ['overhead-press', 'dumbbell-shoulder-press', 'side-lateral-raise', 'cable-lateral-raise', 'bent-over-lateral-raise', 'face-pull'] },
      { label: '팔(이두·삼두)', ex: ['barbell-curl', 'incline-dumbbell-curl', 'preacher-curl', 'hammer-curl', 'lying-triceps-extension', 'rope-pushdown', 'dumbbell-kickback'] },
      { label: '하체', ex: ['barbell-back-squat', 'leg-press', 'romanian-deadlift', 'leg-extension', 'lying-leg-curl', 'hip-thrust', 'standing-calf-raise'] }
    ]
  },
  ppl6: {
    name: '6분할(PPL x2)',
    desc: '주 6일 푸시/풀/레그 2사이클 - 상급자용',
    days: [
      { label: 'Push A(중량)', ex: ['barbell-bench-press', 'overhead-press', 'incline-dumbbell-press', 'side-lateral-raise', 'close-grip-bench-press', 'cable-pushdown'] },
      { label: 'Pull A(중량)', ex: ['deadlift', 'pull-up', 'barbell-row', 'seated-cable-row', 'face-pull', 'barbell-curl'] },
      { label: 'Legs A(스쿼트)', ex: ['barbell-back-squat', 'leg-press', 'romanian-deadlift', 'leg-extension', 'standing-calf-raise', 'plank'] },
      { label: 'Push B(펌핑)', ex: ['incline-dumbbell-press', 'machine-shoulder-press', 'cable-crossover', 'cable-lateral-raise', 'overhead-rope-extension', 'diamond-push-up'] },
      { label: 'Pull B(펌핑)', ex: ['lat-pulldown', 'chest-supported-row', 'hammer-high-row', 'straight-arm-pulldown', 'reverse-pec-deck', 'preacher-curl', 'hammer-curl'] },
      { label: 'Legs B(햄·둔근)', ex: ['romanian-deadlift', 'hip-thrust', 'bulgarian-split-squat', 'seated-leg-curl', 'hip-abduction', 'seated-calf-raise', 'cable-crunch'] }
    ]
  }
};

/* 운동일수 → 추천 분할 매핑 */
const SPLIT_RECOMMEND = {
  2: ['full', 'split2'],
  3: ['ppl', 'split3b'],
  4: ['split4', 'split2'],
  5: ['split5', 'split4'],
  6: ['ppl6', 'split5']
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EXERCISES, SPLIT_PRESETS, SPLIT_RECOMMEND, MUSCLE_GROUPS };
}

/* =========================================================
   조회 헬퍼 (앱에서 사용)
   ========================================================= */
const EX_BY_ID = (function () {
  const m = Object.create(null);
  EXERCISES.forEach(e => { m[e.id] = e; });
  return m;
})();

const PARTS = ['가슴', '등', '어깨', '이두', '삼두', '하체', '코어', '유산소'];

/** 정규화: 공백·기호 제거 + 소문자 */
function _norm(s) { return String(s || '').toLowerCase().replace(/[\s\-_·()[\]]/g, ''); }

const _SEARCH_INDEX = EXERCISES.map(e => ({
  e,
  hay: _norm(e.nm) + '|' + e.alias.map(_norm).join('|') + '|' + _norm(e.sub) + '|' + _norm(e.id)
}));

/** 종목 검색 — 한글명·별칭·은어·영문·id 전부 대상 */
function searchExercises(q, part, limit) {
  const n = _norm(q);
  let out = _SEARCH_INDEX;
  if (part) out = out.filter(x => x.e.part === part);
  if (n) {
    out = out
      .map(x => {
        const i = x.hay.indexOf(n);
        if (i < 0) return null;
        // 이름 앞에서 매치되면 우선순위 상승
        const rank = _norm(x.e.nm).startsWith(n) ? 0 : (i === 0 ? 1 : 2);
        return { e: x.e, rank, i };
      })
      .filter(Boolean)
      .sort((a, b) => a.rank - b.rank || a.i - b.i);
  } else {
    out = out.map(x => ({ e: x.e, rank: 0, i: 0 }));
  }
  return out.slice(0, limit || 60).map(x => x.e);
}

/** 프리셋 키 → 앱 루틴 형태로 전개 (id 배열 → 종목 객체 배열) */
function expandPreset(key) {
  const p = SPLIT_PRESETS[key];
  if (!p) return null;
  return {
    key, name: p.name, desc: p.desc,
    days: p.days.map(d => ({
      label: d.label,
      /* 항목은 문자열 id, 또는 세트·횟수를 덮어쓰는 {id, sets, reps} 둘 다 받는다. */
      ex: d.ex.map(it => {
        const id = typeof it === 'string' ? it : it.id;
        const e = EX_BY_ID[id];
        if (!e) return null;
        return {
          id: e.id, nm: e.nm, part: e.part, unit: e.unit,
          sets: (it && it.sets) || e.sets,
          reps: (it && it.reps) || e.reps
        };
      }).filter(Boolean)
    }))
  };
}

/** 종목 → 루틴 항목 */
function toRoutineItem(e) {
  return { id: e.id, nm: e.nm, part: e.part, sets: e.sets, reps: e.reps, unit: e.unit };
}

/** 부위별 근육 그룹 집계 (통계 히트맵용) */
function musclesOf(id) {
  const e = EX_BY_ID[id];
  return e ? e.muscles : { primary: [], secondary: [] };
}

window.OWDATA = {
  EXERCISES, EX_BY_ID, SPLIT_PRESETS, SPLIT_RECOMMEND, MUSCLE_GROUPS, PARTS,
  searchExercises, expandPreset, toRoutineItem, musclesOf
};
