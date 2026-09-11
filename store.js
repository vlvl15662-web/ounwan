/* ==========================================================================
   store.js — 상태 · 저장소 · 날짜/기록 계산
   ---------------------------------------------------------------------------
   저장 구조 (v0.2 대비 변경점)
     · 설정/기록 메타 → localStorage (작음, 동기)
     · 사진 원본·썸네일 → IndexedDB Blob (v0.2는 base64를 localStorage에 넣어
       5MB quota에서 20~30장이면 터졌음. 구조적 결함이라 저장소를 분리)
     · 기록은 "세트 단위". v0.2는 종목 단위라 볼륨·PR 계산이 불가능했음.
   ========================================================================== */
(function (g) {
'use strict';

/* ───────────────────── 날짜 유틸 ───────────────────── */
const pad = n => String(n).padStart(2, '0');
const dkey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = () => dkey(new Date());
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const DOW = ['일', '월', '화', '수', '목', '금', '토'];

/* ───────────────────── 기본 상태 ───────────────────── */
const DEFAULT_PREFS = {
  accent: 'lime',
  theme: 'dark',
  design: 'base',      // 앱 전체 스킨 — base(기존 화면) / sharp / glass / bold. themes.css 참조

  calType: 'A',        // A 사진 달력 / C 아이콘 달력 (개발지시서 병행안)
  unit: 'kg',
  restSec: 60,         // 기본 휴식 1분 (하체 종목은 1분 30초, 종목별로 저장되면 그 값)
  restAuto: true,
  sound: true,
  grid: false,
  mirror: true,        // 셀피 좌우반전
  logo: true,          // D-5: 기본 ON, 끄기 가능
  defLevel: 'full',    // 오운완 기본 정보량
  defTmpl: 'A',
  defTone: 'dark'
};

const BLANK = {
  v: 1,
  onboarded: false,
  split: null,         // 프리셋 키 또는 'custom'
  freq: null,
  dows: [1, 3, 5],     // 운동 요일 (0=일)
  routine: [],         // [{label, ex:[{id,nm,part,sets,reps,unit}]}]
  dayIdx: 0,           // 다음에 수행할 분할 인덱스
  logs: {},            // dateKey -> log
  pr: {},              // exId -> {kg,reps,e1rm,date}
  prefs: Object.assign({}, DEFAULT_PREFS),
  createdAt: null
};

const LS_KEY = 'owwan.v1';

let S = load();

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return clone(BLANK);
    const o = JSON.parse(raw);
    // 스키마 보강 (부분 손상/구버전 대비)
    const s = Object.assign(clone(BLANK), o);
    s.prefs = Object.assign({}, DEFAULT_PREFS, o.prefs || {});
    s.logs = o.logs || {};
    s.pr = o.pr || {};
    s.routine = Array.isArray(o.routine) ? o.routine : [];
    return migrate(s);
  } catch (e) {
    console.warn('[store] 손상된 저장본 — 초기화', e);
    return clone(BLANK);
  }
}
function clone(o) { return JSON.parse(JSON.stringify(o)); }
/** 옛 저장본 보정. 앱 시작(load)과 백업 복원(importBackup) 양쪽이 거쳐야 한다 —
    복원만 빠뜨렸더니 v1.0.16 백업을 불러온 기록에 '전신'이 그대로 남았다(2026-09-05 실기기). */
function migrate(s) {
  /* '전신' 부위는 2026-09-05에 없앴다 — 종목 사전 기준으로 되돌린다(직접 만든 종목은 코어) */
  const fixPart = e => { if (e && e.part === '전신') e.part = ((g.OWDATA && g.OWDATA.EX_BY_ID[e.id]) || {}).part || '코어'; };
  (s.routine || []).forEach(d => { (d && d.ex || []).forEach(fixPart); (d && d.ex2 || []).forEach(fixPart); });
  Object.keys(s.logs || {}).forEach(k => ((s.logs[k] || {}).ex || []).forEach(fixPart));
  return s;
}

/** 상태를 통째로 갈아끼우되 **객체 아이덴티티는 유지**한다.
    S를 재할당하면 이미 S를 붙잡고 있는 코드(app.js의 지역 참조 등)가
    옛 객체를 계속 쓰게 되어, 복원 직후 화면과 저장소가 어긋난다. */
function replaceState(next) {
  Object.keys(S).forEach(k => { delete S[k]; });
  Object.assign(S, next);
  return S;
}

let saveTimer = null;
function doSave() {
  saveTimer = null;
  try { localStorage.setItem(LS_KEY, JSON.stringify(S)); return true; }
  catch (e) {
    console.error('[store] 저장 실패', e);
    g.OW && g.OW.onStorageFull && g.OW.onStorageFull(e);
    return false;
  }
}
/** immediate로 부르면 성공 여부(boolean)를 돌려준다.
    사진 저장처럼 실패를 사용자에게 즉시 알려야 하는 경로는 반드시 immediate를 쓴다. */
function save(immediate) {
  if (saveTimer) clearTimeout(saveTimer);
  if (immediate) return doSave();
  saveTimer = setTimeout(doSave, 220);
  return true;
}

/* ───────────────────── IndexedDB (사진) ───────────────────── */
const DB_NAME = 'owwan-media', DB_VER = 1, ST = 'photos';
let dbP = null;
function db() {
  if (dbP) return dbP;
  dbP = new Promise((res, rej) => {
    if (!g.indexedDB) return rej(new Error('IndexedDB 미지원'));
    const rq = indexedDB.open(DB_NAME, DB_VER);
    rq.onupgradeneeded = () => {
      const d = rq.result;
      if (!d.objectStoreNames.contains(ST)) {
        const os = d.createObjectStore(ST, { keyPath: 'id' });
        os.createIndex('date', 'date', { unique: false });
      }
    };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  }).catch(e => { dbP = null; throw e; });
  return dbP;
}
function tx(mode) { return db().then(d => d.transaction(ST, mode).objectStore(ST)); }
function req(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }

const Photos = {
  async put(rec) { const s = await tx('readwrite'); return req(s.put(rec)); },
  async get(id) { const s = await tx('readonly'); return req(s.get(id)); },
  async del(id) { const s = await tx('readwrite'); return req(s.delete(id)); },
  async byDate(date) {
    const s = await tx('readonly');
    return req(s.index('date').getAll(IDBKeyRange.only(date)));
  },
  async all() { const s = await tx('readonly'); return req(s.getAll()); },
  async allKeys() { const s = await tx('readonly'); return req(s.getAllKeys()); },
  async count() { const s = await tx('readonly'); return req(s.count()); },
  async clear() { const s = await tx('readwrite'); return req(s.clear()); }
};

/* Blob URL 캐시 — 캘린더에서 31칸 동시 로드 시 매번 만들면 누수.
   상한(LRU)을 두지 않으면 여러 달을 넘겨볼 때 URL이 문서 수명 내내 쌓인다. */
const urlCache = new Map();
const URL_CACHE_MAX = 120;
function blobURL(id, blob) {
  if (urlCache.has(id)) {
    const u = urlCache.get(id);
    urlCache.delete(id); urlCache.set(id, u);      // LRU 갱신
    return u;
  }
  const u = URL.createObjectURL(blob);
  urlCache.set(id, u);
  while (urlCache.size > URL_CACHE_MAX) {
    const oldest = urlCache.keys().next().value;
    URL.revokeObjectURL(urlCache.get(oldest));
    urlCache.delete(oldest);
    if (oldest.charAt(0) === 't') thumbCache.delete(oldest.slice(1));
  }
  return u;
}
function dropURL(id) {
  if (urlCache.has(id)) { URL.revokeObjectURL(urlCache.get(id)); urlCache.delete(id); }
}
function dropAllURLs() { urlCache.forEach(u => URL.revokeObjectURL(u)); urlCache.clear(); }
/** 사진 하나에 딸린 캐시를 전부 정리 (삭제 시 호출) */
function dropPhotoCache(photoId) {
  dropURL('t' + photoId);
  dropURL(photoId);
  thumbCache.delete(photoId);
}

/* 썸네일 메모리 캐시 (캘린더 렌더 성능 게이트 1초 대응).
   ⚠ 실패한 Promise를 캐시에 남기면 그 사진은 새로고침 전까지 영영 공백이 된다. */
const thumbCache = new Map();
async function thumbURL(photoId) {
  if (thumbCache.has(photoId)) return thumbCache.get(photoId);
  const p = Photos.get(photoId).then(rec => {
    const b = rec && (rec.thumb || rec.full);       // 썸네일 생성이 실패한 사진도 원본으로라도 칸을 채운다
    if (!b) { thumbCache.delete(photoId); return null; }
    return blobURL('t' + photoId, b);
  }).catch(e => { thumbCache.delete(photoId); return null; });
  thumbCache.set(photoId, p);
  return p;
}

/* ───────────────────── 기록 계산 ───────────────────── */

/** 로그에서 "운동한 날"로 인정할지 — 세트를 하나라도 완료했거나 사진이 있으면 인정 */
function isWorkoutDay(log) {
  if (!log) return false;
  if (log.photos && log.photos.length) return true;
  return doneSetCount(log) > 0;
}
function doneSetCount(log) {
  if (!log || !log.ex) return 0;
  let n = 0;
  log.ex.forEach(e => (e.sets || []).forEach(s => { if (s.done) n++; }));
  return n;
}
/** 사용자가 손으로 값을 넣은 종목인가 — 체크했거나(done), 무게·횟수를 직접 친(t) 세트가 있으면 참.
    프리필·＋세트가 채워 넣은 값은 `t`가 없어 여기 걸리지 않는다.
    근거: 코드진단서 P2 "kg만 적고 체크 안 한 종목이 확인 없이 사라짐". */
function hasUserInput(e) {
  return !!e && (e.sets || []).some(s => s.done || s.t);
}
function doneExCount(log) {
  if (!log || !log.ex) return 0;
  return log.ex.filter(e => (e.sets || []).some(s => s.done)).length;
}
function fullDoneExCount(log) {
  if (!log || !log.ex) return 0;
  return log.ex.filter(e => (e.sets || []).length && (e.sets || []).every(s => s.done)).length;
}
/** 완료 종목 목록 — 오버레이에 박히는 원천 데이터 (CR-1: 전부 표시) */
function doneExercises(log) {
  if (!log || !log.ex) return [];
  return log.ex.filter(e => (e.sets || []).some(s => s.done)).map(e => {
    const done = e.sets.filter(s => s.done);
    const topKg = done.reduce((m, s) => Math.max(m, +s.kg || 0), 0);
    const reps = done.length ? (+done[0].reps || 0) : 0;
    const sameReps = done.every(s => (+s.reps || 0) === reps);
    return {
      id: e.id, nm: e.nm, part: e.part, unit: e.unit || 'kg',
      setCnt: done.length,
      reps: sameReps ? reps : Math.round(done.reduce((a, s) => a + (+s.reps || 0), 0) / done.length),
      kg: topKg,
      vol: done.reduce((a, s) => a + (+s.kg || 0) * (+s.reps || 0), 0)
    };
  });
}
function volumeOf(log) {
  if (!log || !log.ex) return 0;
  let v = 0;
  log.ex.forEach(e => (e.sets || []).forEach(s => { if (s.done) v += (+s.kg || 0) * (+s.reps || 0); }));
  return Math.round(v);
}
function durationOf(log) {
  if (!log || !log.start) return 0;
  const end = log.end || Date.now();
  return Math.max(0, Math.round((end - log.start) / 1000));
}

/* ═══════════════════ 스트릭 — PRD v1.2 §10.2 정의 ═══════════════════
   스트릭 = "루틴 예정일 연속 달성 횟수". 달력상 연속일이 아니다.
     · 예정일에 완료      → +1
     · 예정일이 아닌 날   → 통과 (달성해도 +1 아니고, 안 해도 안 끊긴다)
     · 예정일에 미완료    → 그 자리에서 끊김
   표기 단위는 전부 '회'(§8.5). "N일 연속"·"N일째"는 폐기 표기다.

   v1.0과의 차이: v1.0은 예정일이 아닌 날의 보너스 운동도 +1로 셌다. */

/** 그 날짜가 루틴 예정일인가. 요일 미설정이면 매일이 예정일. */
function isScheduled(date) {
  if (!S.dows || !S.dows.length) return true;
  return S.dows.includes(date.getDay());
}

function streak() {
  let d = new Date(); d.setHours(0, 0, 0, 0);
  /* 오늘이 예정일인데 아직 미완료라면 아직 '끊김'이 아니다 — 오늘은 빼고 어제부터 센다. */
  if (isScheduled(d) && !isWorkoutDay(S.logs[dkey(d)])) d = addDays(d, -1);
  let n = 0, guard = 0;
  while (guard++ < 800) {
    if (!isScheduled(d)) { d = addDays(d, -1); continue; }          // 예정일 아님 → 통과
    if (isWorkoutDay(S.logs[dkey(d)])) { n++; d = addDays(d, -1); continue; }
    break;                                                          // 예정일 미달성 → 끊김
  }
  return n;
}

/** 특정 날짜 '직전까지'의 스트릭 — 끊김 화면에서 "N회나 해냈어요"에 쓴다. */
function streakUpTo(dateKey) {
  let d = addDays(parseKey(dateKey), -1); d.setHours(0, 0, 0, 0);
  let n = 0, guard = 0;
  while (guard++ < 800) {
    if (!isScheduled(d)) { d = addDays(d, -1); continue; }
    if (isWorkoutDay(S.logs[dkey(d)])) { n++; d = addDays(d, -1); continue; }
    break;
  }
  return n;
}

/* 최장 스트릭 캐시 — P2. 화면을 그릴 때마다 첫 기록일부터 오늘까지 하루씩 훑던 것을
   같은 입력이면 한 번만 계산하도록 바꾼다(홈 렌더 1회에 streakBest가 여러 번 불린다).

   ★ 캐시 무효화를 save()에 걸지 않는 이유: 검증 스위트처럼 S.logs를 직접 고치는 경로가 있어
     저장을 거치지 않는 변경을 놓친다. 대신 결과를 좌우하는 값만으로 서명을 만든다.
     서명 계산은 로그 개수에 비례(O(logs))하고, 원래 계산은 첫 기록일~오늘의 날짜 수에
     비례(최대 4000회)하므로 기록이 쌓일수록 이득이 커진다. */
let sbCache = null;
function streakSig(keys) {
  /* 날짜 목록 전체를 문자열로 잇지 않고 체크섬으로 접는다 — 기록이 수천 일이 돼도
     매 호출마다 수십 KB 문자열을 만들지 않기 위해서. 중간 날짜 하나가 바뀌어도 값이 달라진다. */
  let sum = 0;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    for (let j = 0; j < k.length; j++) sum = (sum * 31 + k.charCodeAt(j)) | 0;
  }
  return keys.length + '|' + sum + '|' + today() + '|' +
    (S.dows || []).join(',') + '|' + (S.routine || []).length;
}
/** 최장 스트릭(회) — 명예의 전당용. 기록 전체를 훑어 파생 계산하며 신규 상태값이 없다. */
function streakBest() {
  const keys = Object.keys(S.logs).filter(k => isWorkoutDay(S.logs[k])).sort();
  if (!keys.length) { sbCache = null; return 0; }
  const sig = streakSig(keys);
  if (sbCache && sbCache.sig === sig) return sbCache.v;
  let d = parseKey(keys[0]); d.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(0, 0, 0, 0);
  let cur = 0, best = 0, guard = 0;
  while (d <= end && guard++ < 4000) {
    if (isScheduled(d)) {
      if (isWorkoutDay(S.logs[dkey(d)])) { cur++; if (cur > best) best = cur; }
      else cur = 0;
    }
    d = addDays(d, 1);
  }
  const v = Math.max(best, streak());
  sbCache = { sig, v };
  return v;
}

/** 다음 목표 = 최고 기록 + 1회. 단 기록이 빈약하면(3 미만) 최소 목표 3회. */
function nextGoal() {
  const b = streakBest();
  return b < 3 ? 3 : b + 1;
}

/** 가입 후 함께한 일수. '일' 단위 유지 — 스트릭이 아니므로 §8.5 '회' 통일 대상이 아니다. */
function daysTogether() {
  if (!S.createdAt) return 1;
  const a = new Date(S.createdAt); a.setHours(0, 0, 0, 0);
  const b = new Date(); b.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((b - a) / 86400000)) + 1;   // 가입 당일 = 1일
}

/** 명예의 전당 — 절대 줄지 않는 숫자들 */
function hallOfFame() {
  let photos = 0;
  Object.keys(S.logs).forEach(k => { photos += (S.logs[k].photos || []).length; });
  return { best: streakBest(), total: totalDays(), photos, days: daysTogether() };
}

/* ══ 원판 등급 — 하드 테마의 '무게가 늘어나는' 표현 ══
   근거: 08_테마시안/03_원판성장_v0.1.html §규칙 표.

   ★ 판은 '최고 기록' 기준으로만 올린다. 한 번 얻은 판은 뺏지 않는다.
     연속이 끊겼다고 45 LB가 5 LB로 돌아가면, 끊김 화면에서 위로해 놓고
     판으로 벌주는 꼴이 된다. §10.2 "명예의 전당 숫자는 줄지 않는다"와 같은 원칙.
     현재 연속은 판 위 숫자로만 내려간다.

   첫 승급을 5회로 낮게 잡은 건 일주일 안에 한 번은 판이 커지게 해
   초반 이탈을 막기 위한 것이고, 뒤로 갈수록 간격을 벌려 희소하게 만들었다. */
const PLATE_TIERS = [
  { lv: 1, lb: 5,  min: 0  },
  { lv: 2, lb: 10, min: 5  },
  { lv: 3, lb: 25, min: 10 },
  { lv: 4, lb: 35, min: 20 },
  { lv: 5, lb: 45, min: 50 }
];
/** 숫자 n에 해당하는 원판 등급 { lv, lb, min } */
function plateTier(n) {
  n = Math.max(0, Number(n) || 0);
  let t = PLATE_TIERS[0];
  for (let i = 0; i < PLATE_TIERS.length; i++) if (n >= PLATE_TIERS[i].min) t = PLATE_TIERS[i];
  return t;
}
/** 다음 판까지. 최고 등급이면 next=null, pct=100. */
function plateNext(n) {
  n = Math.max(0, Number(n) || 0);
  const cur = plateTier(n);
  const nx = PLATE_TIERS[cur.lv] || null;          // lv가 1-base라 인덱스가 곧 다음 칸
  if (!nx) return { cur, next: null, need: 0, pct: 100 };
  const span = nx.min - cur.min;
  return {
    cur, next: nx,
    need: nx.min - n,
    pct: Math.max(0, Math.min(100, Math.round((n - cur.min) / span * 100)))
  };
}

/** 가장 최근에 놓친 예정일. 없으면 null.
    오늘은 아직 할 기회가 남아 있으므로 어제부터 본다. */
function lastMissedDay() {
  let d = addDays(new Date(), -1); d.setHours(0, 0, 0, 0);
  for (let i = 0; i < 90; i++) {
    if (isScheduled(d)) {
      return isWorkoutDay(S.logs[dkey(d)]) ? null : dkey(d);   // 최근 예정일을 달성했으면 끊김 아님
    }
    d = addDays(d, -1);
  }
  return null;
}
/** 촬영 시점에 사진에 박을 D+n — 오늘 아직 기록 전이어도 "오늘 포함" 값 */
function streakForPhoto() {
  const k = today();
  if (isWorkoutDay(S.logs[k])) return streak();
  return streak() + 1;
}
function totalDays() { return Object.keys(S.logs).filter(k => isWorkoutDay(S.logs[k])).length; }
function weekDays() {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const mon = addDays(now, -((now.getDay() + 6) % 7));
  let n = 0;
  Object.keys(S.logs).forEach(k => { if (isWorkoutDay(S.logs[k]) && parseKey(k) >= mon) n++; });
  return n;
}
function monthStats(y, m) {
  let days = 0, photos = 0, vol = 0;
  Object.keys(S.logs).forEach(k => {
    const d = parseKey(k);
    if (d.getFullYear() !== y || d.getMonth() !== m) return;
    const L = S.logs[k];
    if (isWorkoutDay(L)) days++;
    photos += (L.photos || []).length;
    vol += volumeOf(L);
  });
  return { days, photos, vol };
}

/** 이번 달 부위별 운동 '횟수'(회).
    볼륨이 아니라 "그 부위를 한 날이 며칠인가"다 — MVP 원칙(§8.5). */
function partCounts(y, m) {
  const tally = {};
  Object.keys(S.logs).forEach(k => {
    const d = parseKey(k);
    if (d.getFullYear() !== y || d.getMonth() !== m) return;
    const L = S.logs[k];
    if (!isWorkoutDay(L)) return;
    const parts = new Set();
    (L.ex || []).forEach(e => { if ((e.sets || []).some(s => s.done) && e.part) parts.add(e.part); });
    parts.forEach(p => { tally[p] = (tally[p] || 0) + 1; });
  });
  return Object.entries(tally).map(([part, n]) => ({ part, n })).sort((a, b) => b.n - a.n);
}

/** 부위 배지용 — 그날의 대표 부위.
    주 배지 = 수행 종목 수가 가장 많은 부위(동률이면 루틴에 먼저 나온 부위).
    보조 배지는 최대 1개, 3부위 이상이면 주 배지를 "하체 외 2" 형태로 합산한다(배지 규격 §구성·개수). */
function badgeParts(log) {
  if (!log || !log.ex) return { main: '', sub: '', extra: 0 };
  const order = [], count = {};
  log.ex.forEach(e => {
    if (!e.part || !(e.sets || []).some(s => s.done)) return;
    if (!(e.part in count)) { count[e.part] = 0; order.push(e.part); }
    count[e.part]++;
  });
  if (!order.length) return { main: '', sub: '', extra: 0 };
  const ranked = order.slice().sort((a, b) => count[b] - count[a] || order.indexOf(a) - order.indexOf(b));
  const main = ranked[0];
  if (ranked.length === 1) return { main, sub: '', extra: 0 };
  if (ranked.length === 2) return { main, sub: ranked[1], extra: 0 };
  return { main, sub: '', extra: ranked.length - 1 };     // 3부위 이상 → "하체 외 2"
}

/* ───────────────────── PR (개인기록) ───────────────────── */
/* Epley. 1회는 그 자체가 1RM이라 공식(kg × 1.033)을 태우지 않는다 */
const e1rm = (kg, reps) => (reps > 0 && kg > 0) ? (reps === 1 ? kg : Math.round(kg * (1 + reps / 30) * 10) / 10) : 0;

/** 로그 저장 시 PR 갱신. 갱신된 종목 배열 반환 (축하 표시용) */
function updatePR(log) {
  const hits = [];
  if (!log || !log.ex) return hits;
  log.ex.forEach(e => {
    if (!e.id || e.unit === 'bw' || e.unit === 'min' || e.unit === 'sec') return;
    (e.sets || []).forEach(s => {
      if (!s.done) return;
      const kg = +s.kg || 0, reps = +s.reps || 0;
      if (kg <= 0 || reps <= 0) return;
      const est = e1rm(kg, reps);
      const cur = S.pr[e.id];
      if (!cur || est > cur.e1rm + 0.05) {
        S.pr[e.id] = { nm: e.nm, kg, reps, e1rm: est, date: log.date };
        if (cur) hits.push({ id: e.id, nm: e.nm, kg, reps, prev: cur.e1rm, now: est });
      }
    });
  });
  return hits;
}
/** 기록을 지우거나 체크를 풀면 PR을 전체 기록에서 다시 세운다 — updatePR은 올리기만 하므로 없는 날짜를 가리키는 PR이 남는다.
    ponytail: 매번 전체 스캔. 기록이 수천 일이 되면 월 단위 캐시로 */
function rebuildPR() {
  S.pr = {};
  Object.keys(S.logs).sort().forEach(k => updatePR(S.logs[k]));
  return S.pr;
}
function prList(limit) {
  return Object.keys(S.pr)
    .map(id => Object.assign({ id }, S.pr[id]))
    .sort((a, b) => b.e1rm - a.e1rm)
    .slice(0, limit || 99);
}

/* ───────────────────── 오늘의 로그 ───────────────────── */
function isRestDay(date) {
  const d = date || new Date();
  if (!S.dows || !S.dows.length) return false;
  return !S.dows.includes(d.getDay());
}
function routineDay(idx) {
  if (!S.routine.length) return null;
  return S.routine[((idx % S.routine.length) + S.routine.length) % S.routine.length];
}

/* ── 부위별 루틴 2안 ──
   같은 부위라도 분할 순서에 따라 종목이 다를 수 있다(등1 랫풀다운 / 등2 케이블 암풀다운).
   day.ex = 1안, day.ex2 = 2안. 2안이 비어 있으면 항상 1안. 2안이 있으면 그 부위가 돌아올 때마다 번갈아 쓴다(day.turn). */
function dayVariant(day, v) {
  if (!day) return [];
  return (v === 1 && Array.isArray(day.ex2) && day.ex2.length) ? day.ex2 : (day.ex || []);
}
function hasVariant2(day) { return !!(day && Array.isArray(day.ex2) && day.ex2.length); }
/** 새 기록을 만들 때 이번 차례의 안. 차례는 여기서 넘기지 않는다 — 로그를 만드는 시점에 넘기면
    앱만 열어봐도, 빈 지난 날짜를 열어봐도 차례가 넘어간다. 실제로 운동한 시점에 markVariantDone이 넘긴다. */
function pickVariant(day) { return hasVariant2(day) && day.turn === 1 ? 1 : 0; }
/** 이 기록이 '운동한 날'이 되는 순간(첫 세트 체크·사진 저장) 다음 차례를 뒤집는다. 여러 번 불러도 같은 값. */
function markVariantDone(log) {
  const day = log && routineDay(log.dayIdx);
  if (!hasVariant2(day)) return;
  day.turn = log.variant === 1 ? 0 : 1;
}

/** 오늘 로그를 가져오거나 만든다. 루틴 스냅샷을 떠서 넣으므로 이후 루틴 편집에 영향받지 않음 (F1-4) */
function ensureLog(k, forceIdx) {
  k = k || today();
  if (S.logs[k]) return S.logs[k];
  const idx = (forceIdx == null) ? S.dayIdx : forceIdx;
  const day = routineDay(idx);
  const variant = pickVariant(day);
  const log = {
    date: k,
    dayIdx: idx,
    variant,
    label: day ? day.label : '운동',
    start: null,
    end: null,
    ex: day ? dayVariant(day, variant).map(e => ({
      id: e.id, nm: e.nm, part: e.part, unit: e.unit || 'kg',
      sets: Array.from({ length: e.sets || 3 }, () => ({ kg: '', reps: e.reps || 10, done: false })),
      note: ''
    })) : [],
    photos: [],
    note: ''
  };
  // 직전 기록에서 무게 프리필 (Strong 벤치마크: 2탭 입력의 핵심)
  prefill(log);
  S.logs[k] = log;
  save();
  return log;
}
function prefill(log) {
  const keys = Object.keys(S.logs).filter(x => x < log.date).sort().reverse();
  log.ex.forEach(e => {
    for (const k of keys) {
      const prev = (S.logs[k].ex || []).find(p => p.id === e.id);
      if (!prev) continue;
      const done = (prev.sets || []).filter(s => s.done && (+s.kg > 0 || +s.reps > 0));
      if (!done.length) continue;
      e.prev = { kg: +done[0].kg || 0, reps: +done[0].reps || 0, date: k };
      e.sets.forEach((s, i) => {
        const src = done[Math.min(i, done.length - 1)];
        if (s.kg === '' || s.kg == null) s.kg = src.kg;
        if (!s.reps) s.reps = src.reps;
      });
      break;
    }
  });
}
/** 어제 이전의 미완료 로그를 정리 — 이월 금지(F2-7). 빈 로그는 삭제해 용량 절약 */
function pruneEmptyLogs() {
  const t = today();
  Object.keys(S.logs).forEach(k => {
    if (k >= t) return;
    const L = S.logs[k];
    /* isWorkoutDay는 '체크한 세트 또는 사진'만 본다. 무게만 적어둔 날은 그 기준으로는 빈 날이지만
       사용자에게는 적어둔 기록이 있는 날이다 — 앱을 껐다 켜면 조용히 사라지던 결함(P2, 2026-09-08).
       하루가 지난 뒤이므로 이월은 하지 않되, 지우지도 않는다. */
    if (!isWorkoutDay(L) && !(L.ex || []).some(hasUserInput)) { delete S.logs[k]; }
    /* 종료를 안 누르고 넘어간 세션 — 시작 시각 기준 2시간으로 닫는다.
       그날 자정 기준으로 닫으면 저녁 운동의 종료가 시작보다 앞서 시간이 0분이 된다. */
    else if (!L.end && L.start) { L.end = L.start + 2 * 3600 * 1000; }
  });
}

/* ───────────────────── 백업 / 복원 ───────────────────── */

/** 상태만 담은 백업 객체 (사진 없음) — 가볍고 즉시 만들어진다 */
function exportBackup(includePhotos) {
  return Promise.resolve({ app: 'owwan', v: 1, exportedAt: new Date().toISOString(), state: clone(S), photos: [] });
}

/**
 * 백업을 **Blob으로 스트리밍 생성**한다.
 * 사진 100장을 배열에 base64로 쌓은 뒤 JSON.stringify로 다시 복제하면
 * 300MB 넘는 연속 문자열이 만들어져 탭이 죽는다. 조각을 Blob에 흘려보낸다.
 */
async function exportBackupBlob(includePhotos, onProgress) {
  const parts = [];
  parts.push('{"app":"owwan","v":1,"exportedAt":' + JSON.stringify(new Date().toISOString()) + ',"state":');
  parts.push(JSON.stringify(S));
  parts.push(',"photos":[');
  if (includePhotos) {
    const keys = await Photos.allKeys().catch(() => []);
    let first = true;
    for (let i = 0; i < keys.length; i++) {
      let p = null;
      try { p = await Photos.get(keys[i]); } catch (e) { continue; }
      if (!p) continue;
      const rec = {
        id: p.id, date: p.date, w: p.w, h: p.h, meta: p.meta || null,
        full: await blobToDataURL(p.full),
        thumb: await blobToDataURL(p.thumb)
      };
      parts.push((first ? '' : ',') + JSON.stringify(rec));
      first = false;
      if (onProgress) onProgress(i + 1, keys.length);
      if (i % 8 === 7) await new Promise(r => setTimeout(r, 0));   // UI 양보
    }
  }
  parts.push(']}');
  return new Blob(parts, { type: 'application/json' });
}

/* ── 복원 검증 ──
   복원은 기존 데이터를 통째로 덮어쓰는 유일한 파괴적 동작이다.
   검증 없이 실행하면 손상 파일 하나로 사용자의 전 기록이 사라진다. */
const LIMITS = { logs: 4000, routineDays: 20, exPerDay: 80, sets: 60, pr: 3000, photos: 5000, nameLen: 60 };
const DANGEROUS = ['__proto__', 'constructor', 'prototype'];

/** 프로토타입 오염 키 제거 + 깊이 제한 */
function deepClean(v, depth) {
  depth = depth || 0;
  if (depth > 12 || v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(x => deepClean(x, depth + 1));
  const out = Object.create(null);
  for (const k of Object.keys(v)) {
    if (DANGEROUS.indexOf(k) >= 0) continue;
    out[k] = deepClean(v[k], depth + 1);
  }
  return Object.assign({}, out);
}
function validateState(st) {
  const bad = m => { throw new Error('백업 파일이 손상되었습니다: ' + m); };
  if (!st || typeof st !== 'object' || Array.isArray(st)) bad('상태 형식');
  if (!Array.isArray(st.routine)) bad('루틴 형식');
  if (st.routine.length > LIMITS.routineDays) bad('루틴 일수 초과');
  st.routine.forEach(d => {
    if (!d || typeof d !== 'object' || !Array.isArray(d.ex)) bad('루틴 항목 형식');
    if (d.ex.length > LIMITS.exPerDay) bad('종목 수 초과');
    d.label = String(d.label == null ? '운동' : d.label).slice(0, LIMITS.nameLen);
    d.ex.forEach(e => { if (!e || typeof e !== 'object') bad('종목 형식'); e.nm = String(e.nm || '').slice(0, LIMITS.nameLen); });
    if (d.ex2 != null) {
      if (!Array.isArray(d.ex2)) bad('루틴 2안 형식');
      if (d.ex2.length > LIMITS.exPerDay) bad('2안 종목 수 초과');
      d.ex2.forEach(e => { if (!e || typeof e !== 'object') bad('2안 종목 형식'); e.nm = String(e.nm || '').slice(0, LIMITS.nameLen); });
    }
    d.turn = d.turn === 1 ? 1 : 0;
  });
  if (st.logs && (typeof st.logs !== 'object' || Array.isArray(st.logs))) bad('기록 형식');
  const lk = Object.keys(st.logs || {});
  if (lk.length > LIMITS.logs) bad('기록 일수 초과');
  lk.forEach(k => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) { delete st.logs[k]; return; }
    const L = st.logs[k];
    if (!L || typeof L !== 'object') { delete st.logs[k]; return; }
    if (!Array.isArray(L.ex)) L.ex = [];
    if (!Array.isArray(L.photos)) L.photos = [];
    L.label = String(L.label == null ? '운동' : L.label).slice(0, LIMITS.nameLen);
    L.dayIdx = Number(L.dayIdx) || 0; L.variant = L.variant === 1 ? 1 : 0;
    L.ex = L.ex.filter(e => e && typeof e === 'object');
    L.ex.forEach(e => {
      e.nm = String(e.nm || '').slice(0, LIMITS.nameLen);
      if (!Array.isArray(e.sets)) e.sets = [];
      if (e.sets.length > LIMITS.sets) e.sets.length = LIMITS.sets;
      /* 세트·지난 기록 값은 HTML 속성(value="…")에 그대로 들어간다 — 숫자로 강제해야 조작된 백업이 스크립트가 못 된다 */
      e.sets = e.sets.filter(s => s && typeof s === 'object').map(s => ({
        kg: (s.kg === '' || s.kg == null) ? '' : (Number(s.kg) || 0), reps: Number(s.reps) || 0,
        done: !!s.done, warm: !!s.warm, t: !!s.t
      }));
      if (e.prev) e.prev = { kg: Number(e.prev.kg) || 0, reps: Number(e.prev.reps) || 0, date: String(e.prev.date || '').slice(0, 10) };
      if (e.rest != null) e.rest = Number(e.rest) || 0;
    });
  });
  if (st.pr && (typeof st.pr !== 'object' || Array.isArray(st.pr))) st.pr = {};
  if (Object.keys(st.pr || {}).length > LIMITS.pr) st.pr = {};
  Object.keys(st.pr || {}).forEach(id => {                // PR도 kg·reps·e1rm이 그대로 화면에 찍힌다
    const p = st.pr[id];
    if (!p || typeof p !== 'object') { delete st.pr[id]; return; }
    st.pr[id] = { nm: String(p.nm || '').slice(0, LIMITS.nameLen), kg: Number(p.kg) || 0, reps: Number(p.reps) || 0,
      e1rm: Number(p.e1rm) || 0, date: String(p.date || '').slice(0, 10) };
  });
  if (!Array.isArray(st.dows)) st.dows = [];
  st.dows = st.dows.filter(n => Number.isInteger(n) && n >= 0 && n <= 6);
  return st;
}

async function importBackup(payload) {
  if (!payload || payload.app !== 'owwan') throw new Error('오운완 백업 파일이 아닙니다.');
  if (Array.isArray(payload.photos) && payload.photos.length > LIMITS.photos) {
    throw new Error('백업 파일의 사진 수가 비정상적으로 많습니다.');
  }

  /* 되돌릴 수 있게 현재 상태를 먼저 떠 둔다 */
  const rollback = clone(S);
  let next = null;
  try {
    next = Object.assign(clone(BLANK), deepClean(payload.state || {}));
    next.prefs = Object.assign({}, DEFAULT_PREFS, deepClean(payload.state && payload.state.prefs) || {});
    validateState(next);
    migrate(next);
  } catch (e) {
    throw e;                                       // 검증 실패 — 기존 데이터는 손대지 않았다
  }

  replaceState(next);
  if (!save(true)) { replaceState(rollback); save(true); throw new Error('저장 공간이 부족해 복원하지 못했습니다.'); }

  /* 사진 복원 — 실패한 id는 로그에서 걷어내 유령 참조를 남기지 않는다 */
  const stored = new Set();
  if (Array.isArray(payload.photos)) {
    for (const p of payload.photos) {
      if (!p || typeof p.id !== 'string') continue;
      try {
        await Photos.put({
          id: p.id, date: String(p.date || ''), w: +p.w || 0, h: +p.h || 0,
          meta: p.meta || null,
          full: await dataURLToBlob(p.full), thumb: await dataURLToBlob(p.thumb),
          created: Date.now()
        });
        stored.add(p.id);
      } catch (e) { console.warn('[restore] 사진 복원 실패', p.id, e); }
    }
  }
  const existing = new Set(await Photos.allKeys().catch(() => []));
  Object.keys(S.logs).forEach(k => {
    const L = S.logs[k];
    L.photos = (L.photos || []).filter(id => stored.has(id) || existing.has(id));
  });
  save(true);

  thumbCache.clear(); dropAllURLs();
  return { photos: stored.size };
}
function blobToDataURL(b) {
  if (!b) return Promise.resolve(null);
  return new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(b); });
}
async function dataURLToBlob(u) {
  /* 백업 파일의 사진 필드에 외부 주소가 들어 있으면 복원하는 순간 fetch가 밖으로 나간다 — data:image/ 만 받는다 */
  if (!u || !/^data:image\//i.test(String(u))) return null;
  const r = await fetch(u); return r.blob();
}

/* ───────────────────── 저장 용량 ───────────────────── */
async function storageInfo() {
  let used = 0, quota = 0, supported = false;
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate();
      used = e.usage || 0; quota = e.quota || 0; supported = true;
    }
  } catch (e) {}
  const photoCount = await Photos.count().catch(() => 0);
  const lsBytes = (() => { try { return new Blob([localStorage.getItem(LS_KEY) || '']).size; } catch (e) { return 0; } })();
  return { used, quota, supported, photoCount, lsBytes };
}
/** 오래된 사진의 원본만 제거하고 썸네일은 남긴다 (캘린더는 유지, 용량은 절감) */
async function purgeOldPhotos(keepDays) {
  const cutoff = dkey(addDays(new Date(), -(keepDays || 90)));
  const all = await Photos.all().catch(() => []);
  let freed = 0, n = 0;
  for (const p of all) {
    if (p.date >= cutoff || !p.full) continue;
    freed += p.full.size || 0; n++;
    await Photos.put(Object.assign({}, p, { full: null, purged: true }));
  }
  return { count: n, freed };
}

/* ───────────────────── 공개 ───────────────────── */
g.OW = g.OW || {};
/* ⚠ Object.assign은 getter를 "복사"하지 않고 그 시점의 값을 복사한다.
   접근자는 반드시 defineProperty로 걸어야 S 교체가 외부에 반영된다. */
Object.defineProperty(g.OW, 'S', {
  get() { return S; },
  set(v) { replaceState(v); },
  enumerable: true, configurable: true
});
/* 공개 API — 앱·검증 스위트가 실제로 부르는 것만 둔다(P2 "미사용 공개 API 정리").
   2026-09-08에 아무도 호출하지 않던 11개를 뺐다:
     DEFAULT_PREFS, replaceState, blobURL, dropURL, dropAllURLs, thumbCache,
     doneExCount, isScheduled, PLATE_TIERS, deepClean, blobToDataURL
   함수·상수 자체는 store.js 안에 그대로 있고 내부에서 계속 쓰인다 — 밖으로 내보내지만 않을 뿐이다.
   (doneExCount만은 내부에서도 호출처가 없다. 지우지 않은 이유는 fullDoneExCount와 짝이라
    나중에 "완료 종목 수" 표시를 되살릴 때 다시 필요해질 수 있어서다.)
   되살리려면 아래 목록에 이름 한 개를 다시 적으면 된다. */
Object.assign(g.OW, {
  BLANK, LS_KEY,
  save, load, clone, migrate,
  pad, dkey, today, parseKey, addDays, DOW,
  Photos, dropPhotoCache, thumbURL,
  isWorkoutDay, doneSetCount, hasUserInput, fullDoneExCount, doneExercises,
  volumeOf, durationOf, streak, streakForPhoto, totalDays, weekDays, monthStats,
  streakUpTo, streakBest, nextGoal, daysTogether, hallOfFame, lastMissedDay,
  partCounts, badgeParts,
  plateTier, plateNext,
  e1rm, updatePR, rebuildPR, prList,
  isRestDay, routineDay, dayVariant, hasVariant2, pickVariant, markVariantDone, ensureLog, prefill, pruneEmptyLogs,
  exportBackup, exportBackupBlob, importBackup, validateState,
  storageInfo, purgeOldPhotos,
  dataURLToBlob
});

})(window);
