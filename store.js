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
  calType: 'A',        // A 사진 달력 / C 아이콘 달력 (개발지시서 병행안)
  unit: 'kg',
  restSec: 90,
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
    return s;
  } catch (e) {
    console.warn('[store] 손상된 저장본 — 초기화', e);
    return clone(BLANK);
  }
}
function clone(o) { return JSON.parse(JSON.stringify(o)); }

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
    if (!rec || !rec.thumb) { thumbCache.delete(photoId); return null; }
    return blobURL('t' + photoId, rec.thumb);
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

/**
 * 연속일수(스트릭).
 * 규칙: 오늘 기록이 있으면 오늘부터, 없으면 어제부터 거슬러 세되
 *       "휴식일로 설정한 요일"은 스트릭을 끊지 않고 건너뛴다.
 *       (v0.2는 휴식일을 고려하지 않아 주3회 사용자의 스트릭이 항상 1이었음)
 */
function streak() {
  const restDays = new Set();
  for (let i = 0; i < 7; i++) if (!(S.dows || []).includes(i)) restDays.add(i);
  const hasAll = restDays.size === 7;      // 요일 미설정 시 전부 카운트
  let d = new Date(); d.setHours(0, 0, 0, 0);
  if (!isWorkoutDay(S.logs[dkey(d)])) d = addDays(d, -1);
  let n = 0, guard = 0;
  while (guard++ < 800) {
    const k = dkey(d);
    if (isWorkoutDay(S.logs[k])) { n++; d = addDays(d, -1); continue; }
    if (!hasAll && restDays.has(d.getDay())) { d = addDays(d, -1); continue; }  // 휴식일 통과
    break;
  }
  return n;
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

/* ───────────────────── PR (개인기록) ───────────────────── */
const e1rm = (kg, reps) => (reps > 0 && kg > 0) ? Math.round(kg * (1 + reps / 30) * 10) / 10 : 0;

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

/** 오늘 로그를 가져오거나 만든다. 루틴 스냅샷을 떠서 넣으므로 이후 루틴 편집에 영향받지 않음 (F1-4) */
function ensureLog(k, forceIdx) {
  k = k || today();
  if (S.logs[k]) return S.logs[k];
  const idx = (forceIdx == null) ? S.dayIdx : forceIdx;
  const day = routineDay(idx);
  const log = {
    date: k,
    dayIdx: idx,
    label: day ? day.label : '운동',
    start: null,
    end: null,
    ex: day ? day.ex.map(e => ({
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
    if (!isWorkoutDay(L)) { delete S.logs[k]; }
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
    L.ex.forEach(e => {
      e.nm = String(e.nm || '').slice(0, LIMITS.nameLen);
      if (!Array.isArray(e.sets)) e.sets = [];
      if (e.sets.length > LIMITS.sets) e.sets.length = LIMITS.sets;
    });
  });
  if (st.pr && (typeof st.pr !== 'object' || Array.isArray(st.pr))) st.pr = {};
  if (Object.keys(st.pr || {}).length > LIMITS.pr) st.pr = {};
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
  if (!u) return null;
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
Object.assign(g.OW, {
  DEFAULT_PREFS, BLANK, LS_KEY, replaceState,
  save, load, clone,
  pad, dkey, today, parseKey, addDays, DOW,
  Photos, blobURL, dropURL, dropAllURLs, dropPhotoCache, thumbURL, thumbCache,
  isWorkoutDay, doneSetCount, doneExCount, fullDoneExCount, doneExercises,
  volumeOf, durationOf, streak, streakForPhoto, totalDays, weekDays, monthStats,
  e1rm, updatePR, prList,
  isRestDay, routineDay, ensureLog, prefill, pruneEmptyLogs,
  exportBackup, exportBackupBlob, importBackup, validateState, deepClean,
  storageInfo, purgeOldPhotos,
  blobToDataURL, dataURLToBlob
});

})(window);
