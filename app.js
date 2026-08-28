/* ==========================================================================
   app.js — 오운완 v1.0 앱 로직
   화면: 오늘 / 캘린더 / 오운완 / 통계 / 설정
   ========================================================================== */
(function (g) {
'use strict';

const OW = g.OW, D = g.OWDATA;
const $ = id => document.getElementById(id);
const $$ = sel => Array.from(document.querySelectorAll(sel));
let S = OW.S;
/* 지난 날짜 기록을 보고 있을 때의 날짜 키. null이면 오늘.
   오늘 화면·카메라의 "오늘"은 전부 curKey()를 쓴다 — 캘린더에서 지난 날짜 수정으로 들어오면 그 날짜가 된다. */
let viewDate = null;
const curKey = () => viewDate || OW.today();

/* ══════════════════ 공통 UI ══════════════════ */
let toastT = null;
function toast(msg, kind) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'on ' + (kind || '');
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.className = ''; }, kind === 'bad' ? 3200 : 2000);
}
function confirmBox(title, sub, yesLabel) {
  return new Promise(res => {
    $('cfTitle').textContent = title;
    $('cfSub').textContent = sub || '';
    $('cfYes').textContent = yesLabel || '확인';
    const m = $('mConfirm'); m.classList.add('on');
    const close = v => { m.classList.remove('on'); $('cfYes').onclick = null; $('cfNo').onclick = null; res(v); };
    $('cfYes').onclick = () => close(true);
    $('cfNo').onclick = () => close(false);
    m.onclick = e => { if (e.target === m) close(false); };
  });
}
function choiceBox(title, sub, options, current) {
  return new Promise(res => {
    $('chTitle').textContent = title;
    $('chSub').textContent = sub || '';
    const box = $('chOpts'); box.innerHTML = '';
    options.forEach(o => {
      const b = document.createElement('button');
      b.className = 'opt' + (o.v === current ? ' sel' : '');
      b.innerHTML = `<b>${esc(o.t)}</b>${o.d ? `<span>${esc(o.d)}</span>` : ''}`;
      b.onclick = () => { close(o.v); };
      box.appendChild(b);
    });
    const m = $('mChoice'); m.classList.add('on');
    const close = v => { m.classList.remove('on'); res(v); };
    $('chCancel').onclick = () => close(null);
    m.onclick = e => { if (e.target === m) close(null); };
  });
}
function toastUndo(msg, undo) {
  const t = $('toast');
  t.innerHTML = '';
  const span = document.createElement('span'); span.textContent = msg;
  const b = document.createElement('button');
  b.textContent = '되돌리기';
  b.style.cssText = 'margin-left:12px; color:var(--ac); font-weight:800; font-size:13px; min-height:32px;';
  b.onclick = () => { t.className = ''; t.textContent = ''; undo(); };
  t.appendChild(span); t.appendChild(b);
  t.className = 'on';
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.className = ''; t.textContent = ''; }, 4200);
}
function haptic(ms) { try { navigator.vibrate && navigator.vibrate(ms || 12); } catch (e) {} }

/* ── 모달 포커스 관리 ──
   열릴 때 첫 요소로 포커스를 옮기고, Tab을 모달 안에 가두고, 닫을 때 원래 자리로 되돌린다.
   없으면 키보드·스크린리더 사용자는 모달 뒤 화면을 헤매게 된다. */
let focusReturn = null;
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])';
/** 가장 위에 보이는 모달 — 마지막에 열린 것(열림 순서 스택). 스택이 비어 있으면 z-index 기준.
    (종목 추가는 루틴 편집 위에 뜨므로 DOM 순서로 고르면 틀린다) */
const modalStack = [];
function topModal() {
  const open = $$('.modal.on');
  if (!open.length) return null;
  for (let i = modalStack.length - 1; i >= 0; i--) if (open.includes(modalStack[i])) return modalStack[i];
  let best = open[0], bz = -1;
  open.forEach(m => {
    const z = parseInt(getComputedStyle(m).zIndex, 10) || 0;
    if (z >= bz) { bz = z; best = m; }
  });
  return best;
}
/** −/＋ 로 숫자를 고르는 시트 (휴식 시간 등). 취소하면 null */
function stepperBox(title, sub, value, step, min, max, unit) {
  return new Promise(res => {
    let v = value;
    const show = () => { $('stVal').innerHTML = `${v}<small>${esc(unit || '')}</small>`; };
    $('stTitle').textContent = title; $('stSub').textContent = sub || '';
    show();
    const m = $('mStep'); m.classList.add('on');
    const close = r => {
      m.classList.remove('on');
      $('stOk').onclick = $('stCancel').onclick = $('stMinus').onclick = $('stPlus').onclick = null;
      res(r);
    };
    $('stMinus').onclick = () => { v = Math.max(min, v - step); show(); haptic(8); };
    $('stPlus').onclick = () => { v = Math.min(max, v + step); show(); haptic(8); };
    $('stOk').onclick = () => close(v);
    $('stCancel').onclick = () => close(null);
    m.onclick = e => { if (e.target === m) close(null); };
  });
}
(function modalFocus() {
  const obs = new MutationObserver(muts => {
    muts.forEach(m => {
      const el = m.target;
      if (!el.classList || !el.classList.contains('modal')) return;
      const on = el.classList.contains('on');
      const at = modalStack.indexOf(el);
      if (at >= 0) modalStack.splice(at, 1);
      if (on) modalStack.push(el);
      if (on) {
        if (!focusReturn) focusReturn = document.activeElement;
        const f = el.querySelector(FOCUSABLE);
        if (f) setTimeout(() => { try { f.focus({ preventScroll: true }); } catch (e) {} }, 30);
      } else if (!topModal()) {
        const back = focusReturn; focusReturn = null;
        if (back && back.focus) setTimeout(() => { try { back.focus({ preventScroll: true }); } catch (e) {} }, 0);
      }
    });
  });
  $$('.modal').forEach(m => obs.observe(m, { attributes: true, attributeFilter: ['class'] }));

  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const m = topModal(); if (!m) return;
    const items = Array.from(m.querySelectorAll(FOCUSABLE)).filter(x => x.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
})();

let audioCtx = null;
function beep(times) {
  if (!S.prefs.sound) return;
  try {
    audioCtx = audioCtx || new (g.AudioContext || g.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    for (let i = 0; i < (times || 2); i++) {
      const o = audioCtx.createOscillator(), gn = audioCtx.createGain();
      const t0 = audioCtx.currentTime + i * 0.22;
      o.frequency.setValueAtTime(i === (times || 2) - 1 ? 1046 : 784, t0);
      gn.gain.setValueAtTime(0.0001, t0);
      gn.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02);
      gn.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      o.connect(gn); gn.connect(audioCtx.destination);
      o.start(t0); o.stop(t0 + 0.2);
    }
  } catch (e) {}
}

/* ══════════════════ 테마 / 프리퍼런스 적용 ══════════════════ */
function applyPrefs() {
  const r = document.documentElement;
  r.setAttribute('data-accent', S.prefs.accent || 'lime');
  r.setAttribute('data-theme', S.prefs.theme || 'dark');
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.setAttribute('content', S.prefs.theme === 'light' ? '#F6F6F7' : '#141414');
  $('gridLines').classList.toggle('on', !!S.prefs.grid);
}
function accentHex() {
  return getComputedStyle(document.documentElement).getPropertyValue('--ac').trim() || '#C8FF4D';
}

/* ══════════════════ 네비게이션 ══════════════════ */
let curPage = 'today';
function go(pg) {
  curPage = pg;
  document.body.dataset.pg = pg;              // 타이머 원형 버튼은 오늘 화면에서만 보인다
  if (pg !== 'today') closeTimerPanel();
  $$('.page').forEach(p => p.classList.toggle('on', p.id === 'pg-' + pg));
  $$('nav .tab').forEach(b => b.classList.toggle('on', b.dataset.pg === pg));
  if (pg !== 'cam') stopCamera();
  if (pg !== 'today' && pg !== 'cam') viewDate = null;      // 다른 탭으로 가면 지난 날짜 편집 종료
  const titles = { today: '오운완', cal: '캘린더', cam: '오운완 남기기', stat: '통계', set: '설정' };
  let title = titles[pg] || '오운완';
  if (viewDate) { const d = OW.parseKey(viewDate); title = `${d.getMonth() + 1}/${d.getDate()} ` + (pg === 'cam' ? '오운완 남기기' : '기록 수정'); }
  $('barTitle').textContent = title;
  if (pg === 'today') renderToday();
  if (pg === 'cal') renderCal();
  if (pg === 'stat') renderStats();
  if (pg === 'set') renderSettings();
  if (pg === 'cam') enterCamera();
  window.scrollTo({ top: 0, behavior: 'instant' });
}
$$('nav .tab').forEach(b => b.onclick = () => go(b.dataset.pg));
$('fabCam').onclick = () => go('cam');
$('btnGoCam').onclick = () => go('cam');
$('btnCalGoCam').onclick = () => go('cam');

/* ══════════════════ 온보딩 (3스텝, F1-1) ══════════════════ */
let obStep = 1, obFreq = null, obSplit = null, obDows = [];
function openOnboard() {
  obStep = 1; obFreq = S.freq || null; obSplit = S.split || null; obDows = (S.dows || []).slice();
  $('mOnboard').classList.add('on');
  renderOb();
}
function renderOb() {
  $('obSub').textContent = `${obStep}/3 단계 · 나중에 언제든 바꿀 수 있습니다.`;
  $('obStep1').style.display = obStep === 1 ? 'block' : 'none';
  $('obStep2').style.display = obStep === 2 ? 'block' : 'none';
  $('obStep3').style.display = obStep === 3 ? 'block' : 'none';
  $('obBack').style.display = obStep > 1 ? 'flex' : 'none';
  $('obNext').textContent = obStep === 3 ? '이걸로 시작하기' : '다음';

  if (obStep === 1) {
    $('obTitle').textContent = '주에 몇 번 운동하실 계획인가요?';
    const box = $('obStep1'); box.innerHTML = '';
    const notes = { 2: '주말 위주 · 부담 없이', 3: '가장 흔한 선택', 4: '몸이 바뀌기 시작하는 구간', 5: '부위별로 집중', 6: '상급자 · 회복 관리 필수' };
    [2, 3, 4, 5, 6].forEach(n => {
      const b = document.createElement('button');
      b.className = 'opt' + (obFreq === n ? ' sel' : '');
      b.innerHTML = `<b>주 ${n}회</b><span>${notes[n]}</span>`;
      b.onclick = () => { obFreq = n; obSplit = null; obDows = defaultDows(n); renderOb(); };
      box.appendChild(b);
    });
    $('obNext').disabled = !obFreq;
  }

  if (obStep === 2) {
    $('obTitle').textContent = '분할을 고르세요';
    const box = $('obStep2'); box.innerHTML = '';
    const rec = D.SPLIT_RECOMMEND[obFreq] || ['ppl', 'split4'];
    const keys = rec.concat(Object.keys(D.SPLIT_PRESETS).filter(k => rec.indexOf(k) < 0));
    keys.forEach((k, i) => {
      const p = D.SPLIT_PRESETS[k];
      const b = document.createElement('button');
      b.className = 'opt' + (obSplit === k ? ' sel' : '');
      b.innerHTML = `<b>${p.name}${i === 0 ? ' · 추천' : ''}</b><span>${p.desc}<br>${p.days.map(d => d.label).join(' / ')}</span>`;
      b.onclick = () => { obSplit = k; renderOb(); };
      box.appendChild(b);
    });
    $('obNext').disabled = !obSplit;
  }

  if (obStep === 3) {
    $('obTitle').textContent = '운동할 요일을 고르세요';
    const box = $('obDows'); box.innerHTML = '';
    OW.DOW.forEach((d, i) => {
      const b = document.createElement('button');
      b.className = obDows.includes(i) ? 'on' : '';
      b.textContent = d;
      b.onclick = () => {
        const at = obDows.indexOf(i);
        if (at >= 0) obDows.splice(at, 1); else obDows.push(i);
        renderOb();
      };
      box.appendChild(b);
    });
    const p = D.SPLIT_PRESETS[obSplit];
    $('obSummary').innerHTML = obDows.length
      ? `<b>${p.name}</b> · 주 ${obDows.length}회 (${obDows.slice().sort().map(i => OW.DOW[i]).join('·')})<br>
         분할이 ${p.days.length}일치라 요일마다 순서대로 돌아갑니다. 고른 요일 수와 분할 수가 달라도 괜찮습니다.`
      : '요일을 하나 이상 고르세요. (전부 안 고르면 매일 운동일로 취급합니다)';
    $('obNext').disabled = false;
  }
}
/** 기본 운동 요일.
    오늘이 빠져 있으면 가장 가까운 요일 하나와 맞바꿔 오늘을 포함시킨다 —
    앱을 막 설치한 사람이 첫 화면에서 "오늘은 휴식일"을 보는 건 말이 안 된다. */
function defaultDows(freq) {
  const base = ({ 2: [2, 5], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6] })[freq] || [1, 3, 5];
  const td = new Date().getDay();
  if (base.includes(td)) return base;
  const near = base.reduce((b, d) => (Math.abs(d - td) < Math.abs(b - td) ? d : b), base[0]);
  return base.filter(d => d !== near).concat(td).sort((a, b) => a - b);
}
$('obNext').onclick = () => {
  if (obStep < 3) { obStep++; renderOb(); return; }
  const p = D.expandPreset(obSplit);
  S.split = obSplit; S.freq = obFreq; S.dows = obDows.slice().sort();
  S.routine = p.days.map(d => ({ label: d.label, ex: d.ex.slice() }));
  S.dayIdx = 0; S.onboarded = true;
  if (!S.createdAt) S.createdAt = Date.now();
  // 오늘 로그가 이미 있으면 새 루틴을 반영해 다시 만든다 (아직 세트 안 했을 때만)
  const k = curKey(), L = S.logs[k];
  if (L && OW.doneSetCount(L) === 0 && !(L.photos || []).length) delete S.logs[k];
  OW.save(true);
  $('mOnboard').classList.remove('on');
  toast('루틴이 준비됐습니다', 'ok');
  go('today');
};
$('obBack').onclick = () => { if (obStep > 1) { obStep--; renderOb(); } };
$('btnReOnboard').onclick = openOnboard;
/* 이미 루틴이 있는 사용자는 배경 탭·ESC로 빠져나올 수 있어야 한다 (감사 F-22).
   최초 실행에는 탈출구를 두지 않는다 — 루틴 없이는 앱이 성립하지 않으므로. */
$('mOnboard').onclick = e => {
  if (e.target !== $('mOnboard')) return;
  if (S.onboarded && S.routine.length) $('mOnboard').classList.remove('on');
  else toast('먼저 루틴을 정해주세요');
};
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const open = $$('.modal.on');
  if (!open.length) return;
  const m = open[open.length - 1];
  if (m.id === 'mOnboard' && !(S.onboarded && S.routine.length)) return;
  m.classList.remove('on');
  if (m.id === 'mDay') closeDD();
});

/* ══════════════════ 오늘 화면 ══════════════════ */
let sessionTimer = null;

function todayLog() { return OW.ensureLog(curKey()); }

function renderToday() {
  S = OW.S;
  if (!S.onboarded || !S.routine.length) { openOnboard(); return; }

  const now = viewDate ? OW.parseKey(viewDate) : new Date();
  const k = curKey();
  const rest = OW.isRestDay(now);
  const existing = S.logs[k];

  $('todayDate').textContent = `${now.getMonth() + 1}월 ${now.getDate()}일 (${OW.DOW[now.getDay()]})`;
  renderViewBanner();

  // 휴식일이고 아직 아무것도 안 했으면 휴식 화면 (지난 날짜를 수정 중일 때는 바로 목록으로)
  if (rest && !existing && !viewDate) {
    $('restDayBox').style.display = 'block';
    $('routineBox').style.display = 'none';
    $('todayLabel').innerHTML = '<span class="rest">휴식일</span>';
    $('btnSwapDay').style.display = 'none';
    renderTopStats();
    return;
  }
  $('restDayBox').style.display = 'none';
  $('routineBox').style.display = 'block';
  $('btnSwapDay').style.display = 'flex';

  const L = todayLog();
  const splitName = S.split === 'custom' ? '커스텀' : (D.SPLIT_PRESETS[S.split] || {}).name || '';
  $('todayLabel').textContent = `${splitName} · ${L.label}`;

  renderExList(L);
  renderProgress(L);
  renderTopStats();
  renderSession(L);
  renderTip(L);
}

function renderProgress(L) {
  const total = L.ex.length;
  const done = OW.fullDoneExCount(L);
  $('progBar').style.width = total ? (done / total * 100) + '%' : '0%';
  $('progDone').textContent = done;
  $('progTotal').textContent = total;
  const vol = OW.volumeOf(L);
  const sets = OW.doneSetCount(L);
  $('progVol').innerHTML = vol ? `<b>${vol.toLocaleString()}</b>kg · ${sets}세트` : (sets ? `${sets}세트` : '');
}

function renderTopStats() {
  $('stTotal').textContent = OW.totalDays();
  $('stStreak').textContent = OW.streak();
  $('stWeek').textContent = OW.weekDays();
  const now = new Date();
  const ms = OW.monthStats(now.getFullYear(), now.getMonth());
  $('stVol').textContent = (ms.vol / 1000).toFixed(ms.vol >= 10000 ? 0 : 1);
}

/** 지난 날짜 편집 배너 — 날짜 표시 + 운동 시간(분) 직접 입력 + 오늘로 돌아가기 */
function renderViewBanner() {
  const b = $('viewBanner');
  if (!viewDate) { b.style.display = 'none'; return; }
  const d = OW.parseKey(viewDate);
  b.style.display = 'flex';
  $('viewBannerTxt').textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 기록 수정 중`;
  const L = S.logs[viewDate];
  $('viewDur').value = L && L.start ? Math.round(OW.durationOf(L) / 60) || '' : '';
}
$('btnViewToday').onclick = () => { viewDate = null; openEx = null; go('today'); };
$('viewDur').onchange = () => {
  if (!viewDate) return;
  const min = Math.max(0, Math.min(600, +$('viewDur').value || 0));
  const L = todayLog();
  if (!min) { L.start = null; L.end = null; }
  else {
    /* 시작 시각을 모르니 그날 정오를 기준으로 길이만 기록한다 */
    const base = OW.parseKey(viewDate); base.setHours(12, 0, 0, 0);
    L.start = base.getTime(); L.end = L.start + min * 60000;
  }
  OW.save(true); renderProgress(L);
};
function renderSession(L) {
  const bar = $('sessionBar');
  if (viewDate) { bar.style.display = 'none'; if (sessionTimer) { clearInterval(sessionTimer); sessionTimer = null; } return; }
  if (L.start && !L.end) {
    bar.style.display = 'flex';
    tickSession();
    if (!sessionTimer) sessionTimer = setInterval(tickSession, 1000);
  } else {
    bar.style.display = 'none';
    if (sessionTimer) { clearInterval(sessionTimer); sessionTimer = null; }
  }
}
function tickSession() {
  const L = S.logs[curKey()];
  if (!L || !L.start || L.end) { if (sessionTimer) { clearInterval(sessionTimer); sessionTimer = null; } return; }
  const s = Math.floor((Date.now() - L.start) / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  $('sessionTime').textContent = (h ? h + ':' + OW.pad(m) : m) + ':' + OW.pad(sec);
  $('sessionVol').textContent = OW.volumeOf(L).toLocaleString();
}
$('btnEndSession').onclick = async () => {
  const L = S.logs[curKey()]; if (!L) return;
  if (!await confirmBox('운동을 종료할까요?', '기록은 그대로 남고, 시간 측정만 멈춥니다.', '종료')) return;
  L.end = Date.now(); OW.save(true); renderToday();
  toast('수고하셨습니다');
};

/* ───── 종목 리스트 ───── */
let openEx = null;   // 펼쳐진 종목 index

function renderExList(L) {
  const list = $('exList');
  list.innerHTML = '';
  if (!L.ex.length) {
    list.innerHTML = `<div class="empty"><p>이 부위에 종목이 없습니다</p><small>아래 ＋ 종목 추가로 넣어주세요.</small></div>`;
    return;
  }
  L.ex.forEach((e, i) => list.appendChild(exCard(L, e, i)));
}

function exCard(L, e, i) {
  const sets = e.sets || [];
  const doneN = sets.filter(s => s.done).length;
  const allDone = sets.length > 0 && doneN === sets.length;
  const isOpen = openEx === i;

  const div = document.createElement('div');
  div.className = 'ex' + (allDone ? ' done' : '') + (isOpen ? ' open' : '');

  const meta = [];
  meta.push(`${doneN}/${sets.length}세트`);
  const best = sets.filter(s => s.done).reduce((m, s) => Math.max(m, +s.kg || 0), 0);
  if (best) meta.push(`${best}kg`);
  const pr = S.pr[e.id];
  const isPR = pr && sets.some(s => s.done && OW.e1rm(+s.kg || 0, +s.reps || 0) >= pr.e1rm - 0.05 && pr.date === L.date);

  const head = document.createElement('div');
  head.className = 'exhead';
  head.innerHTML = `
    <div class="chk">✓</div>
    <div class="exname">
      <div class="n">${esc(e.nm)}</div>
      <div class="m">${meta.join(' · ')}${isPR ? ' · <span class="pr">PR</span>' : ''}${e.prev ? ` · <span style="opacity:.7">지난번 ${e.prev.kg}kg</span>` : ''}</div>
    </div>
    <div class="caret">▾</div>`;
  head.onclick = ev => {
    if (ev.target.closest('.chk')) {
      /* 체크박스 직접 탭 = 전체 세트 토글 (빠른 완료).
         오탭이면 전 세트가 한 번에 바뀌므로 되돌리기를 제공한다. */
      const before = sets.map(s => ({ done: s.done, kg: s.kg }));
      const turnOn = !allDone;
      sets.forEach(s => { s.done = turnOn; if (turnOn && !s.kg && e.prev) s.kg = e.prev.kg; });
      if (turnOn) touchSession(L);
      afterSetChange(L, turnOn);
      toastUndo(e.nm + (turnOn ? ' 전체 완료' : ' 완료 해제'), () => {
        before.forEach((b, i) => { if (sets[i]) { sets[i].done = b.done; sets[i].kg = b.kg; } });
        OW.save(); renderExList(L); renderProgress(L); renderTopStats();
      });
      return;
    }
    openEx = isOpen ? null : i;
    renderExList(L);
  };
  div.appendChild(head);

  const box = document.createElement('div');
  box.className = 'sets';
  const isTime = e.unit === 'sec' || e.unit === 'min';
  const w1 = isTime ? (e.unit === 'min' ? '분' : '초') : 'kg';
  const w2 = isTime ? '세트' : '회';

  const hd = document.createElement('div');
  hd.className = 'sethead';
  hd.innerHTML = `<span class="no">세트</span><span class="prev">지난 기록</span>
    <span class="fld">${w1}</span><span class="fld">${w2}</span><span class="sdone">완료</span>`;
  box.appendChild(hd);

  /* 유산소(분·초 단위)는 세트 개념 없이 한 줄 — 시간(reps 필드)만 적는다 */
  if (isTime && sets.length > 1) sets.splice(1);
  if (isTime && !sets.length) sets.push({ kg: 0, reps: e.reps || 30, done: false });
  sets.forEach((s, si) => {
    const row = document.createElement('div');
    row.className = 'setrow swipe-del' + (s.done ? ' on' : '') + (isTime ? ' timerow' : '');
    row.innerHTML = isTime
      ? `<div class="srbg">밀어서 삭제</div><div class="srin">
      <span class="no">⏱</span>
      <span class="prev">${e.prev && e.prev.reps ? `지난 ${e.prev.reps}${w1}` : '—'}</span>
      <span class="fld"><input type="number" inputmode="numeric" value="${s.reps || ''}" placeholder="0" data-f="reps"><span>${w1}</span></span>
      <button class="sdone" data-act="done">✓</button></div>`
      : `<div class="srbg">밀어서 삭제</div><div class="srin">
      <span class="no${s.warm ? ' warm' : ''}">${s.warm ? 'W' : si + 1}</span>
      <span class="prev">${e.prev ? `${e.prev.kg || '-'}kg × ${e.prev.reps}` : '—'}</span>
      <span class="fld"><input type="number" inputmode="decimal" step="0.5" value="${s.kg === '' || s.kg == null ? '' : s.kg}" placeholder="0" data-f="kg"><span>${w1}</span></span>
      <span class="fld"><input type="number" inputmode="numeric" value="${s.reps || ''}" placeholder="0" data-f="reps"><span>${w2}</span></span>
      <button class="sdone" data-act="done">✓</button></div>`;
    if (!isTime) swipeToDelete(row, () => deleteSet(L, e, sets, si));
    row.querySelectorAll('input').forEach(inp => {
      inp.onfocus = () => inp.select();
      inp.oninput = () => { s[inp.dataset.f] = inp.value === '' ? '' : +inp.value; OW.save(); renderProgress(L); };
      inp.onblur = () => { renderExHeadMeta(L); };
    });
    row.querySelector('[data-act=done]').onclick = () => {
      s.done = !s.done;
      if (s.done) {
        if (s.kg === '' || s.kg == null) s.kg = e.prev ? e.prev.kg : 0;
        if (!s.reps) s.reps = e.reps || 10;
        touchSession(L);
        if (S.prefs.restAuto) startRest(e.nm, si + 1);
        haptic(14);
      }
      afterSetChange(L, s.done);
    };
    box.appendChild(row);
  });

  const acts = document.createElement('div');
  acts.className = 'setacts';
  acts.innerHTML = isTime
    ? `<button data-a="note">메모</button><button data-a="del" class="del">종목 삭제</button>`
    : `<button data-a="add">＋ 세트</button><button data-a="warm">워밍업</button>
    <button data-a="plate">원판</button>
    <button data-a="note">메모</button><button data-a="del" class="del">종목 삭제</button>`;
  if (!isTime) {
    acts.querySelector('[data-a=plate]').onclick = () => {
      const w = sets.reduce((m, s) => Math.max(m, +s.kg || 0), 0) || (e.prev ? e.prev.kg : 0);
      showPlates(w, e.nm);
    };
    acts.querySelector('[data-a=add]').onclick = () => {
      const last = sets[sets.length - 1] || { kg: e.prev ? e.prev.kg : '', reps: e.reps || 10 };
      sets.push({ kg: last.kg, reps: last.reps, done: false });
      OW.save(); renderExList(L); renderProgress(L);
    };
    acts.querySelector('[data-a=warm]').onclick = () => {
      sets.unshift({ kg: '', reps: e.reps || 10, done: false, warm: true });
      OW.save(); renderExList(L);
    };
  }
  acts.querySelector('[data-a=note]').onclick = () => {
    const ta = box.querySelector('.exnote');
    if (ta) { ta.style.display = ta.style.display === 'none' ? 'block' : 'none'; ta.focus(); }
  };
  acts.querySelector('[data-a=del]').onclick = async () => {
    if (!await confirmBox('종목을 뺄까요?', `${e.nm} — 오늘 기록에서만 빠집니다. 루틴 자체는 그대로입니다.`, '빼기')) return;
    L.ex.splice(i, 1); openEx = null;
    /* 루틴 편집을 닫을 때 오늘 목록을 루틴과 맞추는데, 오늘만 뺀 종목이 되살아나지 않게 기억한다 */
    (L.hidden = L.hidden || []).push(e.id);
    OW.save(true); renderToday();
  };
  box.appendChild(acts);

  const note = document.createElement('textarea');
  note.className = 'exnote'; note.placeholder = '메모 (자세, 컨디션 등)';
  note.value = e.note || '';
  note.style.display = e.note ? 'block' : 'none';
  note.oninput = () => { e.note = note.value; OW.save(); };
  box.appendChild(note);

  const tipEx = D.EX_BY_ID[e.id];
  if (tipEx && tipEx.tip) {
    const tip = document.createElement('div');
    tip.className = 'hint'; tip.style.marginTop = '8px';
    tip.innerHTML = `<b style="color:var(--txt2)">${esc(tipEx.nm)}</b> — ${esc(tipEx.tip)}`;
    box.appendChild(tip);
  }

  div.appendChild(box);
  return div;
}
function renderExHeadMeta(L) { renderProgress(L); }

/** 세트 한 줄 삭제 + 되돌리기 */
function deleteSet(L, e, sets, si) {
  const removed = sets.splice(si, 1)[0];
  if (!removed) return;
  OW.save(); renderExList(L); renderProgress(L); renderTopStats();
  haptic(16);
  toastUndo(`${e.nm} ${removed.warm ? '워밍업' : (si + 1) + '세트'} 삭제`, () => {
    sets.splice(Math.min(si, sets.length), 0, removed);
    OW.save(); renderExList(L); renderProgress(L); renderTopStats();
  });
}

/** 행을 왼쪽으로 밀어 삭제. 세로로 움직이면 스크롤에 양보한다(touch-action: pan-y). */
function swipeToDelete(row, onDelete) {
  const inner = row.querySelector('.srin');
  let id = null, sx = 0, sy = 0, dx = 0, axis = null;
  const W = () => row.clientWidth || 300;
  row.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    id = e.pointerId; sx = e.clientX; sy = e.clientY; dx = 0; axis = null;
  });
  row.addEventListener('pointermove', e => {
    if (e.pointerId !== id) return;
    const mx = e.clientX - sx, my = e.clientY - sy;
    if (!axis) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      axis = Math.abs(mx) > Math.abs(my) * 1.3 ? 'x' : 'y';
      if (axis === 'x') {
        row.classList.add('swiping');
        try { row.setPointerCapture(id); } catch (x) {}
        if (document.activeElement && row.contains(document.activeElement)) document.activeElement.blur();
      }
    }
    if (axis !== 'x') return;
    dx = Math.min(0, mx);
    inner.style.transform = `translateX(${dx}px)`;
    row.classList.toggle('armed', -dx > W() * 0.42);
    e.preventDefault();
  });
  const end = e => {
    if (e.pointerId !== id) return;
    id = null;
    if (axis !== 'x') { axis = null; return; }
    row.classList.remove('swiping');
    try { row.releasePointerCapture(e.pointerId); } catch (x) {}
    if (-dx > W() * 0.42) { inner.style.transform = `translateX(${-W()}px)`; setTimeout(onDelete, 120); }
    else { inner.style.transform = ''; row.classList.remove('armed'); }
    axis = null;
  };
  row.addEventListener('pointerup', end);
  row.addEventListener('pointercancel', end);
}

function touchSession(L) {
  if (!L.start) { L.start = Date.now(); renderSession(L); }
  if (L.end) L.end = null;
}
function afterSetChange(L, turnedOn) {
  OW.save();
  const hits = OW.updatePR(L);
  renderExList(L); renderProgress(L); renderTopStats();
  if (hits.length && turnedOn) toast(`${hits[0].nm} 개인 기록 경신`, 'ok');
  checkComplete(L);
}

/* ───── 원판 계산기 ─────
   국내 근력앱 중 거의 없는 기능. 헬스장에서 매번 하는 암산을 없앤다. */
const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const PLATE_COLOR = { 25: '#D64545', 20: '#3B6FD4', 15: '#E0B33A', 10: '#4CA35E', 5: '#DDDDDD', 2.5: '#9A9A9A', 1.25: '#7A7A7A' };

/** 목표 무게를 한쪽에 끼울 원판 조합으로 분해. 딱 안 맞으면 가장 가까운 조합을 준다. */
function platesFor(target, bar) {
  const perSide = (target - bar) / 2;
  if (perSide <= 0) return { list: [], actual: bar, exact: target === bar };
  let left = perSide;
  const list = [];
  for (const p of PLATES) {
    while (left >= p - 0.001) { list.push(p); left -= p; }
  }
  const used = list.reduce((a, b) => a + b, 0);
  return { list, actual: Math.round((bar + used * 2) * 100) / 100, exact: Math.abs(left) < 0.001 };
}
let plateBar = 20;
function showPlates(target, exName) {
  target = +target || 0;
  const render = () => {
    const r = platesFor(target, plateBar);
    const counts = {};
    r.list.forEach(p => { counts[p] = (counts[p] || 0) + 1; });
    const rows = Object.keys(counts).sort((a, b) => b - a).map(p => `
      <div class="plate-row">
        <span class="chip" style="background:${PLATE_COLOR[p] || '#888'}"></span>
        <span class="pw">${p}kg</span><span class="pc">× ${counts[p]}</span>
      </div>`).join('');
    const bars = [20, 15, 10].map(b =>
      `<button class="${b === plateBar ? 'on' : ''}" data-bar="${b}">${b}kg 바</button>`).join('');
    $('chOpts').innerHTML = `
      <div class="chips" style="margin-bottom:14px;" id="plateBars">${bars}</div>
      <div class="plate-box">
        ${target <= plateBar
          ? `<p class="sub" style="margin:0;">목표 무게가 바(${plateBar}kg) 이하입니다. 원판이 필요 없습니다.</p>`
          : `<div class="plate-side">한쪽에</div>${rows || '<p class="sub">맞는 원판 조합이 없습니다.</p>'}`}
      </div>
      <div class="sub" style="margin-top:12px;">
        바 ${plateBar}kg + 원판 양쪽 → <b style="color:var(--txt)">${r.actual}kg</b>
        ${r.exact ? '' : `<br><span style="color:var(--warn)">목표 ${target}kg과 다릅니다 — 보유 원판으로 정확히 맞출 수 없습니다.</span>`}
      </div>`;
    $$('#plateBars button').forEach(b => b.onclick = () => { plateBar = +b.dataset.bar; render(); });
  };
  $('chTitle').textContent = '원판 계산기';
  $('chSub').textContent = (exName ? exName + ' · ' : '') + `목표 ${target}kg`;
  render();
  $('mChoice').classList.add('on');
  $('chCancel').textContent = '닫기';
  const close = () => { $('mChoice').classList.remove('on'); $('chCancel').textContent = '취소'; };
  $('chCancel').onclick = close;
  $('mChoice').onclick = e => { if (e.target === $('mChoice')) close(); };
}

/* ───── 완료 축하 (F2-5) ───── */
function checkComplete(L) {
  if (!L.ex.length || L.celebrated) return;
  const allDone = L.ex.every(e => (e.sets || []).length && e.sets.every(s => s.done));
  if (!allDone) return;
  L.celebrated = true;
  if (!L.end) L.end = Date.now();
  OW.save(true);
  if (viewDate) return;                         // 지난 날짜를 채우는 중엔 축하 화면을 띄우지 않는다
  showCelebrate(L);
}
function showCelebrate(L) {
  const vol = OW.volumeOf(L), dur = OW.durationOf(L), sets = OW.doneSetCount(L);
  $('cbTitle').textContent = `${L.label} 완료`;
  const fun = OW.volFun(vol);
  $('cbSub').textContent = fun
    ? `오늘 ${vol.toLocaleString()}kg — ${fun}을 들었습니다.`
    : '편집 앱 켤 필요 없습니다. 사진 한 장이면 끝납니다.';
  $('cbSum').innerHTML = `
    <div><b>${L.ex.length}</b><span>종목</span></div>
    <div><b>${sets}</b><span>세트</span></div>
    <div><b>${vol >= 1000 ? (vol / 1000).toFixed(1) + 't' : vol}</b><span>볼륨</span></div>
    <div><b>${dur ? Math.round(dur / 60) : '-'}</b><span>분</span></div>`;
  $('celebrate').classList.add('on');
  confetti();
  beep(3);
  haptic([18, 60, 18]);
}
$('cbGoCam').onclick = () => { $('celebrate').classList.remove('on'); go('cam'); };
$('cbLater').onclick = () => { $('celebrate').classList.remove('on'); renderToday(); };

function confetti() {
  const c = $('confetti'); c.style.display = 'block';
  const dpr = Math.min(2, devicePixelRatio || 1);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  c.style.width = innerWidth + 'px'; c.style.height = innerHeight + 'px';
  const x = c.getContext('2d'); x.scale(dpr, dpr);
  const ac = accentHex();
  const cols = [ac, '#FFFFFF', '#9A9A9A', ac];
  const P = Array.from({ length: 90 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 120,
    y: innerHeight * 0.42 + (Math.random() - 0.5) * 60,
    vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 13 - 3,
    w: 5 + Math.random() * 7, h: 3 + Math.random() * 5,
    r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
    c: cols[(Math.random() * cols.length) | 0], a: 1
  }));
  let t = 0;
  (function loop() {
    t++;
    x.clearRect(0, 0, innerWidth, innerHeight);
    P.forEach(p => {
      p.vy += 0.42; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      if (t > 48) p.a -= 0.022;
      if (p.a <= 0) return;
      x.save(); x.globalAlpha = Math.max(0, p.a);
      x.translate(p.x, p.y); x.rotate(p.r);
      x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      x.restore();
    });
    if (t < 130) requestAnimationFrame(loop);
    else { x.clearRect(0, 0, innerWidth, innerHeight); c.style.display = 'none'; }
  })();
}

/* ───── 휴식 타이머 ─────
   상태 idle / running / paused 하나를 바(#restBar)·원형 버튼(#timerFab)·상세 패널(#timerPanel)이 함께 본다.
   10초 단위 조절, 수동 시작, 일시정지 지원. */
let restT = null, restEnd = 0, restTotal = 0, restLeftPaused = 0, restState = 'idle';
let tpDur = 0;                                  // 패널에서 고르는 중인(아직 시작 전) 시간
function restDefault() { return Math.max(10, Math.min(600, +S.prefs.restSec || 90)); }
function restLeft() { return restState === 'paused' ? restLeftPaused : Math.max(0, restEnd - Date.now()); }
function fmtT(ms) { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + OW.pad(s % 60); }
let restLabel = '';
/** 상단 알림(네이티브)에 현재 상태를 밀어 넣는다 — 백그라운드에서도 카운트다운·종료 알림이 뜬다 */
function syncNativeRest() {
  if (!NATIVE.on) return;
  NATIVE.restTimer({ running: restState === 'running', endAt: restEnd, label: restLabel || '휴식 중' });
}
function startRest(exName, setNo, sec) {
  restTotal = sec || restDefault();
  restEnd = Date.now() + restTotal * 1000;
  restState = 'running';
  restLabel = exName ? `${exName} ${setNo}세트 끝` : '수동 타이머';
  $('restNext').textContent = restLabel;
  $('restBar').classList.add('on');
  if (restT) clearInterval(restT);
  restT = setInterval(tickRest, 200);
  tickRest();
  syncNativeRest();
}
function tickRest() {
  const leftMs = restLeft();
  const txt = fmtT(leftMs);
  const pct = restTotal ? 100 - Math.max(0, leftMs / (restTotal * 10)) : 0;
  $('restTime').textContent = txt;
  $('restProg').style.width = pct + '%';
  syncTimerUI(txt, pct);
  if (restState === 'running' && leftMs <= 0) {
    /* 백그라운드에 있다가 한참 뒤에 돌아온 경우: 종료 알림은 네이티브가 이미 울렸으니 조용히 정리 */
    stopRest(Date.now() - restEnd < 3000);
  }
}
function pauseRest() {
  if (restState !== 'running') return;
  restLeftPaused = Math.max(0, restEnd - Date.now());
  restState = 'paused';
  if (restT) { clearInterval(restT); restT = null; }
  tickRest(); syncNativeRest();
}
function resumeRest() {
  if (restState !== 'paused') return;
  restEnd = Date.now() + restLeftPaused;
  restState = 'running';
  restT = setInterval(tickRest, 200);
  tickRest(); syncNativeRest();
}
/** 10초 단위 가감. 시작 전이면 예정 시간을, 진행 중이면 남은 시간을 바꾼다 */
function adjustRest(d) {
  if (restState === 'idle') { tpDur = Math.max(10, Math.min(600, (tpDur || restDefault()) + d)); syncTimerUI(); return; }
  if (restState === 'paused') restLeftPaused = Math.max(0, restLeftPaused + d * 1000);
  else restEnd += d * 1000;
  restTotal = Math.max(1, restTotal + d);
  tickRest(); syncNativeRest();
}
function stopRest(rang) {
  if (restT) { clearInterval(restT); restT = null; }
  const was = restState;
  restState = 'idle';
  $('restBar').classList.remove('on');
  syncTimerUI();
  if (was !== 'idle') syncNativeRest();
  if (rang) { beep(2); haptic([30, 80, 30]); }
}
$('restSkip').onclick = () => stopRest(false);
$('restPlus').onclick = () => adjustRest(10);

/* 원형 버튼(우하단) + 하단 가로 패널 */
function syncTimerUI(txt, pct) {
  const fab = $('timerFab');
  fab.classList.toggle('run', restState === 'running');
  fab.classList.toggle('paused', restState === 'paused');
  $('timerFabTxt').textContent = restState === 'idle' ? '' : (txt || fmtT(restLeft()));
  if (!$('timerPanel').classList.contains('on')) return;
  const dur = tpDur || restDefault();
  $('tpTime').textContent = restState === 'idle' ? fmtT(dur * 1000) : (txt || fmtT(restLeft()));
  const p = restState === 'idle' ? 0 : (pct != null ? pct : (restTotal ? 100 - restLeft() / (restTotal * 10) : 0));
  $('tpProg').style.width = p + '%';
  const go = $('tpStart');
  go.textContent = restState === 'running' ? '일시정지' : (restState === 'paused' ? '계속' : '시작');
  go.classList.toggle('pause', restState === 'running');
  $$('#tpPresets button').forEach(b => b.classList.toggle('on', restState === 'idle' && +b.dataset.s === dur));
  const isDef = (restState === 'idle' ? dur : restTotal) === restDefault();
  $('tpDefault').classList.toggle('saved', isDef);
  $('tpDefault').textContent = isDef ? '기본값 ✓' : '기본값으로 저장';
}
function openTimerPanel() {
  if (restState === 'idle') tpDur = restDefault();
  const pr = $('tpPresets'); pr.innerHTML = '';
  [60, 90, 120, 180].forEach(s => {
    const b = document.createElement('button');
    b.dataset.s = s; b.textContent = s % 60 === 0 ? (s / 60) + '분' : s + '초';
    b.onclick = () => {
      if (restState === 'idle') { tpDur = s; syncTimerUI(); return; }
      restTotal = s; restEnd = Date.now() + s * 1000;
      if (restState === 'paused') restLeftPaused = s * 1000;
      tickRest();
    };
    pr.appendChild(b);
  });
  $('timerPanel').classList.add('on'); document.body.classList.add('tp-open');
  syncTimerUI();
}
function closeTimerPanel() { $('timerPanel').classList.remove('on'); document.body.classList.remove('tp-open'); }
$('timerFab').onclick = openTimerPanel;
$('tpClose').onclick = closeTimerPanel;
$('tpMinus').onclick = () => adjustRest(-10);
$('tpPlus').onclick = () => adjustRest(10);
$('tpStart').onclick = () => {
  if (restState === 'running') pauseRest();
  else if (restState === 'paused') resumeRest();
  else startRest(null, 0, tpDur || restDefault());
  syncTimerUI();
};
$('tpSkip').onclick = () => stopRest(false);
$('tpDefault').onclick = () => {
  const d = restState === 'idle' ? (tpDur || restDefault()) : restTotal;
  S.prefs.restSec = Math.max(10, Math.min(600, d));
  OW.save(); syncTimerUI();
  toast(`기본 휴식 시간을 ${S.prefs.restSec}초로 저장했습니다`, 'ok');
};

/* 입력 중(키보드 올라옴): 하단 바는 접고 원형 버튼만 남긴다 */
let typingT = null;
document.addEventListener('focusin', e => {
  const t = e.target;
  if (!t || !t.matches || !t.matches('input:not([type=file]):not([type=color]), textarea')) return;
  clearTimeout(typingT); document.body.classList.add('typing');
});
document.addEventListener('focusout', () => {
  clearTimeout(typingT);
  typingT = setTimeout(() => document.body.classList.remove('typing'), 120);
});

/* ───── 부위 변경 / 휴식일 무시 ───── */
$('btnSwapDay').onclick = async () => {
  const opts = S.routine.map((d, i) => ({ v: i, t: d.label, d: d.ex.map(e => e.nm).slice(0, 4).join(', ') + (d.ex.length > 4 ? ` 외 ${d.ex.length - 4}` : '') }));
  const L = S.logs[curKey()];
  const pick = await choiceBox('오늘 어느 부위를 할까요?', '이미 체크한 세트가 있으면 사라집니다.', opts, L ? L.dayIdx : S.dayIdx);
  if (pick == null) return;
  const k = curKey();
  if (S.logs[k] && (OW.doneSetCount(S.logs[k]) > 0 || S.logs[k].start || (S.logs[k].ex || []).some(e => e.note))) {
    if (!await confirmBox('오늘 기록을 버릴까요?', '체크한 세트가 모두 사라집니다.', '버리고 변경')) return;
  }
  (S.logs[k] && S.logs[k].photos || []).length ? null : delete S.logs[k];
  if (S.logs[k]) { // 사진이 있으면 로그는 유지하고 종목만 교체
    const day = OW.routineDay(pick);
    S.logs[k].dayIdx = pick; S.logs[k].label = day.label;
    S.logs[k].ex = day.ex.map(e => ({ id: e.id, nm: e.nm, part: e.part, unit: e.unit || 'kg',
      sets: Array.from({ length: e.sets || 3 }, () => ({ kg: '', reps: e.reps || 10, done: false })), note: '' }));
    OW.prefill(S.logs[k]);
  } else {
    OW.ensureLog(k, pick);
  }
  S.dayIdx = pick;
  OW.save(true); openEx = null; renderToday();
};
$('btnDoAnyway').onclick = () => { OW.ensureLog(); renderToday(); };

/* ───── 팁 카드 ───── */
function renderTip(L) {
  const box = $('tipCard'), t = $('tipTxt');
  if (viewDate) { box.style.display = 'none'; return; }
  const tips = [];
  const st = OW.streak();
  if (st >= 3) tips.push(`<b>${st}일 연속</b> 진행 중입니다. 오늘 오운완 한 장이면 ${st + (OW.isWorkoutDay(L) ? 0 : 1)}일이 됩니다.`);
  if (OW.totalDays() === 0) tips.push('첫 기록을 남겨보세요. 캘린더가 사진으로 채워지기 시작합니다.');
  const noPhotoDays = Object.keys(S.logs).filter(k => OW.isWorkoutDay(S.logs[k]) && !(S.logs[k].photos || []).length).length;
  if (noPhotoDays >= 3) tips.push(`사진 없는 운동일이 <b>${noPhotoDays}일</b> 있습니다. 캘린더가 비어 보이는 이유입니다.`);
  if (!tips.length) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  t.innerHTML = tips[0];
}

/* ══════════════════ 종목 추가 (검색) ══════════════════ */
let pkPicked = [], pkPart = null, pkTarget = null;   // pkTarget: {type:'today'} | {type:'routine', dayIdx}
function openPicker(target) {
  pkTarget = target; pkPicked = []; pkPart = null;
  $('pkSearch').value = '';
  $('pkSub').textContent = target.type === 'today'
    ? '오늘 기록에만 추가됩니다. 루틴은 그대로입니다.'
    : `루틴 "${S.routine[target.dayIdx].label}"에 추가됩니다.`;
  const pf = $('pkParts'); pf.innerHTML = '';
  [{ k: null, t: '전체' }].concat(D.PARTS.map(p => ({ k: p, t: p }))).forEach(o => {
    const b = document.createElement('button');
    b.className = o.k === pkPart ? 'on' : '';
    b.textContent = o.t;
    b.onclick = () => { pkPart = o.k; Array.from(pf.children).forEach(c => c.classList.remove('on')); b.classList.add('on'); renderPk(); };
    pf.appendChild(b);
  });
  $('mPicker').classList.add('on');
  renderPk();
  setTimeout(() => $('pkSearch').focus(), 120);
}
function renderPk() {
  const q = $('pkSearch').value.trim();
  const res = D.searchExercises(q, pkPart, 80);
  const box = $('pkResults'); box.innerHTML = '';
  if (!res.length) {
    box.innerHTML = `<div class="empty"><p>검색 결과가 없습니다</p><small>직접 만든 이름으로 추가하려면 아래 버튼을 누르세요.</small></div>`;
    if (q) {
      const b = document.createElement('button');
      b.className = 'btn ghost block-sm';
      const clean = cleanExName(q);
      b.textContent = `"${clean}" 직접 추가`;
      b.onclick = () => {
        if (!clean) return toast('종목 이름을 확인해 주세요', 'bad');
        /* id를 Date.now()로 발급하면 같은 종목을 다시 추가할 때마다 다른 종목이 된다.
           → 지난 무게 프리필도, PR 누적도 영원히 동작하지 않는다. 이름으로 고정한다. */
        pkPicked.push({ id: customId(clean), nm: clean, part: '전신', sets: 3, reps: 10, unit: 'kg' });
        commitPicker();
      };
      box.appendChild(b);
    }
    return;
  }
  res.forEach(e => {
    const picked = pkPicked.some(p => p.id === e.id);
    const b = document.createElement('button');
    b.className = 'exitem' + (picked ? ' picked' : '');
    b.innerHTML = `<span class="eq">${esc(e.eq.slice(0, 2))}</span>
      <span class="info"><b>${esc(e.nm)}</b><span>${esc(e.part)} · ${esc(e.sub)} · ${e.sets}×${e.reps}</span></span>
      <span class="add">${picked ? '✓' : '＋'}</span>`;
    b.onclick = () => {
      const at = pkPicked.findIndex(p => p.id === e.id);
      if (at >= 0) pkPicked.splice(at, 1); else pkPicked.push(D.toRoutineItem(e));
      renderPk();
    };
    box.appendChild(b);
  });
  $('pkCount').textContent = pkPicked.length ? `(${pkPicked.length})` : '';
}
$('pkSearch').oninput = renderPk;
$('pkCancel').onclick = () => $('mPicker').classList.remove('on');
$('pkDone').onclick = commitPicker;
function commitPicker() {
  if (!pkPicked.length) { $('mPicker').classList.remove('on'); return; }
  if (pkTarget.type === 'today') {
    const L = todayLog();
    pkPicked.forEach(e => L.ex.push({
      id: e.id, nm: e.nm, part: e.part, unit: e.unit || 'kg',
      sets: Array.from({ length: e.sets || 3 }, () => ({ kg: '', reps: e.reps || 10, done: false })), note: '',
      adhoc: true                     // 오늘만 추가 — 루틴 동기화 때 지워지지 않는다
    }));
    OW.prefill(L); OW.save(true); renderToday();
  } else {
    S.routine[pkTarget.dayIdx].ex.push(...pkPicked);
    /* 오늘 목록에서 뺐던 종목을 루틴에 다시 넣으면 다시 보이게 한다 */
    const L = S.logs[curKey()];
    if (L && L.hidden) L.hidden = L.hidden.filter(id => !pkPicked.some(p => p.id === id));
    OW.save(true); renderRoutineEditor();
  }
  $('mPicker').classList.remove('on');
  toast(`${pkPicked.length}개 종목 추가`, 'ok');
}
$('btnAddEx').onclick = () => openPicker({ type: 'today' });

/* ══════════════════ 루틴 편집 ══════════════════ */
let rtDay = 0;
$('btnEditRoutine').onclick = () => {
  const L = S.logs[curKey()];
  rtDay = L ? L.dayIdx % S.routine.length : S.dayIdx;
  $('mRoutine').classList.add('on');
  renderRoutineEditor();
};
$('rtDone').onclick = closeRoutineEditor;
$('mRoutine').onclick = e => { if (e.target === $('mRoutine')) closeRoutineEditor(); };
$('rtAdd').onclick = () => openPicker({ type: 'routine', dayIdx: rtDay });
function closeRoutineEditor() {
  $('mRoutine').classList.remove('on');
  syncTodayWithRoutine();
  openEx = null; renderToday();
}
function newLogEx(r) {
  return { id: r.id, nm: r.nm, part: r.part, unit: r.unit || 'kg',
    sets: Array.from({ length: r.sets || 3 }, () => ({ kg: '', reps: r.reps || 10, done: false })), note: '' };
}
/** 오늘 목록을 루틴과 맞춘다 — 루틴 순서대로 재배열하고, 새 종목은 넣고, 루틴에서 뺀 종목은 제거.
    단 이미 체크한 세트가 있거나 오늘만 추가한(adhoc) 종목은 남긴다. 오늘만 뺀(hidden) 종목은 되살리지 않는다. */
function syncTodayWithRoutine() {
  const L = S.logs[curKey()];
  if (!L || !S.routine.length) return;
  const day = OW.routineDay(L.dayIdx);
  if (!day) return;
  const byId = {}; L.ex.forEach(e => { byId[e.id] = e; });
  const hidden = new Set(L.hidden || []);
  const next = [];
  day.ex.forEach(r => {
    if (byId[r.id]) next.push(byId[r.id]);
    else if (!hidden.has(r.id)) next.push(newLogEx(r));
  });
  const inRoutine = new Set(day.ex.map(r => r.id));
  L.ex.forEach(e => {
    if (!inRoutine.has(e.id) && (e.adhoc || (e.sets || []).some(s => s.done))) next.push(e);
  });
  L.ex = next; L.label = day.label;
  OW.prefill(L); OW.save(true);
}
/** 꾹 눌러(약 0.4초) 위아래로 끌어 순서 바꾸기. 짧게 밀면 스크롤로 넘긴다. */
function setupRoutineDrag(list, day) {
  /* 렌더마다 불리지만 리스너는 한 번만 단다 — 대상 day만 갈아끼운다 */
  list._dragDay = day;
  if (list._dragBound) return;
  list._dragBound = true;
  let pressT = null, dragging = false, srcEl = null, srcIdx = -1, startY = 0, startX = 0, pid = null;
  const clearPress = () => {
    clearTimeout(pressT); pressT = null;
    list.querySelectorAll('.pressing').forEach(x => x.classList.remove('pressing'));
  };
  list.addEventListener('pointerdown', e => {
    const row = e.target.closest('.ex');
    if (!row || e.target.closest('button')) return;
    srcEl = row; startY = e.clientY; startX = e.clientX; pid = e.pointerId;
    row.classList.add('pressing');
    pressT = setTimeout(() => {
      pressT = null;
      dragging = true;
      srcIdx = Array.from(list.querySelectorAll('.ex')).indexOf(row);
      row.classList.remove('pressing'); row.classList.add('lifting');
      try { list.setPointerCapture(pid); } catch (x) {}
      haptic(18);
    }, 380);
  });
  list.addEventListener('pointermove', e => {
    if (!dragging) {
      /* 위아래든 옆이든 움직이기 시작하면 꾹 누르기가 아니다 (옆은 밀어서 삭제로 넘어간다) */
      if (pressT && (Math.abs(e.clientY - startY) > 8 || Math.abs(e.clientX - startX) > 8)) clearPress();
      return;
    }
    e.preventDefault();
    let dy = e.clientY - startY;
    srcEl.style.transform = `translateY(${dy}px) scale(1.02)`;
    const r0 = srcEl.getBoundingClientRect();
    const cy = r0.top + r0.height / 2;
    let target = null;
    for (const o of list.querySelectorAll('.ex')) {
      if (o === srcEl) continue;
      const r = o.getBoundingClientRect();
      if (cy < r.top + r.height / 2) { target = o; break; }
    }
    const needMove = target ? srcEl.nextElementSibling !== target : list.lastElementChild !== srcEl;
    if (needMove) {
      const before = srcEl.getBoundingClientRect().top;
      if (target) list.insertBefore(srcEl, target); else list.appendChild(srcEl);
      const after = srcEl.getBoundingClientRect().top;
      startY += (after - before);               // DOM이 옮겨진 만큼 보정 → 손가락 밑에 그대로 붙어 있다
      dy = e.clientY - startY;
      srcEl.style.transform = `translateY(${dy}px) scale(1.02)`;
    }
  });
  const end = e => {
    if (pressT) clearPress();
    if (!dragging) { srcEl = null; return; }
    dragging = false;
    srcEl.classList.remove('lifting'); srcEl.style.transform = '';
    try { list.releasePointerCapture(e.pointerId); } catch (x) {}
    const d = list._dragDay;
    const newIdx = Array.from(list.querySelectorAll('.ex')).indexOf(srcEl);
    if (d && newIdx >= 0 && srcIdx >= 0 && newIdx !== srcIdx) {
      const it = d.ex.splice(srcIdx, 1)[0];
      d.ex.splice(newIdx, 0, it);
      OW.save(); haptic(10);
    }
    srcEl = null;
    renderRoutineEditor();
  };
  list.addEventListener('pointerup', end);
  list.addEventListener('pointercancel', end);
  list.addEventListener('contextmenu', e => e.preventDefault());
  /* 끄는 동안 시트가 같이 스크롤되지 않게 — touchmove는 non-passive여야 막을 수 있다 */
  list.addEventListener('touchmove', ev => { if (dragging) ev.preventDefault(); }, { passive: false });
}
function renderRoutineEditor() {
  const p = S.split === 'custom' ? { name: '커스텀' } : (D.SPLIT_PRESETS[S.split] || { name: '' });
  $('rtSub').textContent = `${p.name} · ${S.routine.length}일 분할`;
  const tabs = $('rtDayTabs'); tabs.innerHTML = '';
  S.routine.forEach((d, i) => {
    const b = document.createElement('button');
    b.className = i === rtDay ? 'on' : '';
    b.textContent = d.label;
    b.onclick = () => { rtDay = i; renderRoutineEditor(); };
    tabs.appendChild(b);
  });
  const list = $('rtList'); list.innerHTML = '';
  if (rtDay >= S.routine.length || rtDay < 0) rtDay = 0;
  const day = S.routine[rtDay] || { label: '', ex: [] };
  if (!day.ex.length) list.innerHTML = `<div class="empty"><p>종목이 없습니다</p></div>`;
  day.ex.forEach((e, i) => {
    const div = document.createElement('div');
    div.className = 'ex swipe-del';
    const isTime = e.unit === 'min' || e.unit === 'sec';
    const meta = isTime ? `${esc(e.part)} · 기본 ${+e.reps || 0}${e.unit === 'min' ? '분' : '초'}` : `${esc(e.part)} · 기본 ${+e.sets || 0}×${+e.reps || 0}`;
    div.innerHTML = `<div class="srbg">밀어서 삭제</div><div class="srin"><div class="exhead">
      <span class="grip">≡</span>
      <div class="exname"><div class="n">${esc(e.nm)}</div><div class="m">${meta}</div></div>
    </div></div>`;
    /* 삭제는 왼쪽으로 밀기 하나로 통일 — 되돌리기 제공 */
    swipeToDelete(div, () => {
      const removed = day.ex.splice(i, 1)[0];
      OW.save(); renderRoutineEditor(); haptic(16);
      toastUndo(`${removed.nm} 삭제`, () => { day.ex.splice(Math.min(i, day.ex.length), 0, removed); OW.save(); renderRoutineEditor(); });
    });
    list.appendChild(div);
  });
  setupRoutineDrag(list, day);
}
$('btnEditDays').onclick = async () => {
  obStep = 3; obFreq = S.freq; obSplit = S.split; obDows = (S.dows || []).slice();
  $('mOnboard').classList.add('on'); renderOb();
};

/* ══════════════════ 캘린더 ══════════════════ */
let calY = new Date().getFullYear(), calM = new Date().getMonth();
$('calPrev').onclick = () => { calM--; if (calM < 0) { calM = 11; calY--; } renderCal(); };
$('calNext').onclick = () => { calM++; if (calM > 11) { calM = 0; calY++; } renderCal(); };
$('calModeBtn').onclick = () => {
  S.prefs.calType = S.prefs.calType === 'A' ? 'C' : 'A';
  OW.save(); renderCal();
  toast(S.prefs.calType === 'A' ? '사진 달력 (A타입)' : '아이콘 달력 (C타입)');
};

function renderCal() {
  const t0 = performance.now();
  const A = S.prefs.calType === 'A';
  $('calModeBtn').textContent = A ? '▦' : '◉';
  $('calTitle').textContent = `${calY}년 ${calM + 1}월`;

  const ms = OW.monthStats(calY, calM);
  $('calMonthDays').textContent = ms.days;
  $('calStreak').textContent = OW.streak();
  $('calPhotos').textContent = ms.photos;

  const grid = $('calGrid'); grid.innerHTML = '';
  ['일', '월', '화', '수', '목', '금', '토'].forEach((d, i) => {
    const s = document.createElement('div');
    s.className = 'dow' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '');
    s.textContent = d; grid.appendChild(s);
  });
  const first = new Date(calY, calM, 1).getDay();
  const days = new Date(calY, calM + 1, 0).getDate();
  for (let i = 0; i < first; i++) { const p = document.createElement('div'); p.className = 'pad'; grid.appendChild(p); }

  const tk = OW.today();
  const anyRecord = Object.keys(S.logs).some(k => OW.isWorkoutDay(S.logs[k]));
  const pending = [];

  for (let d = 1; d <= days; d++) {
    const key = `${calY}-${OW.pad(calM + 1)}-${OW.pad(d)}`;
    const L = S.logs[key];
    const worked = OW.isWorkoutDay(L);
    const photos = (L && L.photos) || [];
    const b = document.createElement('button');
    b.className = 'day';
    if (key > tk) b.classList.add('future');
    if (new Date(calY, calM, d).getDay() === 0) b.classList.add('sun');

    if (A && photos.length) {
      b.innerHTML = `<span class="ph"></span><span class="dim"></span><span class="dnum">${d}</span>` +
        (photos.length > 1 ? `<span class="multi">${photos.slice(0, 3).map(() => '<i></i>').join('')}</span>` : '');
      pending.push({ el: b.querySelector('.ph'), id: photos[photos.length - 1] });   // A-4: 마지막 저장분
    } else if (A) {
      b.classList.add('noph');
      if (worked) b.classList.add('logged');
      b.innerHTML = `<span class="dnum">${d}</span>`;
    } else {
      b.classList.add('noph');
      b.innerHTML = `<span class="dnum">${d}</span>` +
        `<span class="cico ${photos.length ? 'photo' : worked ? 'done' : 'no'}"></span>`;
    }

    if (key === tk) {
      if (!anyRecord && !worked) { b.classList.add('todayEmpty'); b.innerHTML += `<span class="hintcam">◉</span>`; }
      else b.classList.add('today');
    }
    /* 색·아이콘만으로 정보를 전달하지 않는다 (스크린리더) */
    const parts = [(calM + 1) + '월 ' + d + '일'];
    if (key === tk) parts.push('오늘');
    if (photos.length) parts.push('오운완 사진 ' + photos.length + '장');
    else if (worked) parts.push('운동 기록 있음');
    else if (key <= tk) parts.push('기록 없음');
    b.setAttribute('aria-label', parts.join(', '));
    if (L) b.onclick = () => showDay(key);
    else if (key === tk) b.onclick = () => go('cam');
    else if (key < tk) b.onclick = () => showDay(key);          // 기록 없는 지난 날짜도 열어서 채울 수 있다
    grid.appendChild(b);
  }

  $('calEmptyCard').style.display = anyRecord ? 'none' : 'block';

  /* 썸네일 지연 로드 (A-6: 그리드는 즉시, 사진은 뒤따라) */
  pending.forEach(async p => {
    const url = await OW.thumbURL(p.id);
    if (url) { p.el.style.backgroundImage = `url("${url}")`; p.el.classList.add('in'); }
  });

  const ms2 = Math.round(performance.now() - t0);
  if (ms2 > 1000) console.warn('[캘린더] 렌더 ' + ms2 + 'ms — 성능 게이트(1000ms) 초과');
}

/* ───── 날짜 상세 시트 ───── */
let ddPhotos = [], ddIdx = 0, ddKey = null, ddURL = null, ddSeq = 0;
/** 날짜 상세 시트의 파괴적 액션 노출 — 자가진단 등 다른 용도로 재사용할 때 반드시 끈다 */
function setDayActions(show) {
  $('ddSave').style.display = show ? 'flex' : 'none';
  $('ddDelete').style.display = show ? 'flex' : 'none';
}
async function showDay(key) {
  const L = S.logs[key] || null;             // 기록 없는 지난 날짜도 연다 (채워 넣을 수 있게)
  ddKey = key; ddIdx = 0;
  setDayActions(!!L);
  $('ddEditRow').style.display = 'flex';
  ddPhotos = ((L && L.photos) || []).slice();
  const d = OW.parseKey(key);
  $('ddTitle').textContent = `${d.getMonth() + 1}월 ${d.getDate()}일 (${OW.DOW[d.getDay()]})`;
  $('ddSub').textContent = L ? (L.label || '') : '기록이 없는 날 — 기록 수정으로 채울 수 있습니다';

  const rows = $('ddRows'); rows.innerHTML = '';
  const vol = OW.volumeOf(L), dur = OW.durationOf(L), sets = OW.doneSetCount(L);
  const items = OW.doneExercises(L);
  const add = (k, v) => { if (!v) return; const r = document.createElement('div'); r.className = 'dd-row';
    r.innerHTML = `<span class="k">${esc(k)}</span><span>${esc(v)}</span>`; rows.appendChild(r); };
  add('종목', items.length ? `${items.length}개 완료 / ${L.ex.length}개` : '기록 없음');
  add('세트', sets ? sets + '세트' : '');
  add('볼륨', vol ? vol.toLocaleString() + 'kg' : '');
  add('시간', dur ? OW.fmtDur(dur) : '');

  const exBox = $('ddEx'); exBox.innerHTML = '';
  items.forEach(it => {
    const s = document.createElement('span');
    const isTime = it.unit === 'min' || it.unit === 'sec';
    s.textContent = it.nm + (isTime ? ` ${it.reps}${it.unit === 'min' ? '분' : '초'}`
      : (it.kg ? ` ${it.setCnt}×${it.reps} ${it.kg}kg` : ` ${it.setCnt}×${it.reps}`));
    exBox.appendChild(s);
  });
  $('ddPhoto').textContent = ddPhotos.length ? '사진 다시 남기기' : '사진 남기기';

  $('mDay').classList.add('on');
  renderDDPhoto();
}
/* 지난 날짜 수정: 오늘 화면을 그 날짜로 열어 종목·세트·시간을 고친다 / 카메라를 그 날짜로 연다 */
$('ddEdit').onclick = () => { viewDate = ddKey; openEx = null; closeDD(); go('today'); };
$('ddPhoto').onclick = () => { viewDate = ddKey; closeDD(); go('cam'); };
async function renderDDPhoto() {
  const wrap = $('ddPhotoWrap'), img = $('ddImg'), dots = $('ddDots');
  if (!ddPhotos.length) { wrap.style.display = 'none'; dots.innerHTML = ''; $('ddNav').style.display = 'none'; return; }
  wrap.style.display = 'flex';
  $('ddNav').style.display = ddPhotos.length > 1 ? 'flex' : 'none';
  dots.innerHTML = ddPhotos.map((_, i) => `<i class="${i === ddIdx ? 'on' : ''}"></i>`).join('');
  /* 빠르게 넘기면 늦게 도착한 이전 요청이 새 URL을 revoke하고 덮어쓴다 — 세대 토큰으로 차단 */
  const my = ++ddSeq;
  const rec = await OW.Photos.get(ddPhotos[ddIdx]).catch(() => null);
  if (my !== ddSeq) return;
  const blob = rec && (rec.full || rec.thumb);
  if (!blob) { img.removeAttribute('src'); return; }
  const next = URL.createObjectURL(blob);
  if (ddURL) URL.revokeObjectURL(ddURL);
  ddURL = next;
  img.src = ddURL;
  /* ★ 원본 비율 유지 — CSS object-fit:contain. 9:16 사진의 좌우 오버레이가 잘리지 않음 */
}
$('ddPrev').onclick = () => { ddIdx = (ddIdx - 1 + ddPhotos.length) % ddPhotos.length; renderDDPhoto(); };
$('ddNext').onclick = () => { ddIdx = (ddIdx + 1) % ddPhotos.length; renderDDPhoto(); };
$('ddClose').onclick = () => closeDD();
$('mDay').onclick = e => { if (e.target === $('mDay')) closeDD(); };
function closeDD() {
  $('mDay').classList.remove('on');
  if (ddURL) { URL.revokeObjectURL(ddURL); ddURL = null; }
}
$('ddSave').onclick = async () => {
  if (!ddPhotos.length) return toast('저장할 사진이 없습니다', 'bad');
  const rec = await OW.Photos.get(ddPhotos[ddIdx]);
  const blob = rec && (rec.full || rec.thumb);
  if (!blob) return toast('원본이 정리되어 없습니다 (썸네일만 남아 있습니다)', 'bad');
  const how = await exportBlob(blob, `오운완_${ddKey}.jpg`);
  if (how === 'tab') toast('새 탭에 열었습니다. 길게 눌러 저장하세요');
  else if (how === 'gallery') toast('갤러리에 저장했습니다', 'ok');
};
$('ddDelete').onclick = async () => {
  if (!await confirmBox('이 날 기록을 지울까요?', '사진과 세트 기록이 함께 사라집니다. 되돌릴 수 없습니다.', '삭제')) return;
  for (const id of ddPhotos) { await OW.Photos.del(id).catch(() => {}); OW.dropPhotoCache(id); }
  delete S.logs[ddKey];
  OW.save(true); closeDD(); renderCal(); renderToday();
  toast('삭제했습니다');
};
function downloadBlob(blob, name) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = u; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 8000);
}

/* ══════════════════ 오운완 카메라 ══════════════════ */
let stream = null, facing = 'environment', hasShot = false;     // 기본은 후방 카메라
let camOpts = { level: 'full', tmpl: 'A', ratio: 'orig', tone: 'dark', fields: null,
                scale: 1, pos: { x: 0, y: 0 }, photoPos: { x: 0, y: 0 }, customColor: '#1E3A8A',
                transparent: false };
let renderQueued = false;

function enterCamera() {
  if (!hasShot) {
    camOpts.level = S.prefs.defLevel || 'full';
    camOpts.tmpl = S.prefs.defTmpl || 'A';
    camOpts.tone = S.prefs.defTone || 'dark';
    camOpts.fields = OW.levelFields(camOpts.level);
    camOpts.fields.logo = !!S.prefs.logo;
    camOpts.scale = 1; camOpts.pos = { x: 0, y: 0 }; camOpts.photoPos = { x: 0, y: 0 };
    camOpts.transparent = false;
    $('camStage').classList.remove('checker');
    syncCamUI();
  }
  $('gridLines').classList.toggle('on', !!S.prefs.grid && !hasShot);
  /* 카메라 화면에 들어오면 바로 후방 카메라를 켠다 ("카메라 켜기" 단계 없음) */
  if (!hasShot && !stream) startCamera();
  OW.ensureFonts();
  const L = S.logs[curKey()];
  const n = L ? OW.doneExercises(L).length : 0;
  $('camEditHint').innerHTML = n
    ? `오늘 완료한 <b>${n}종목</b>이 사진에 들어갑니다. 항목을 끄면 빠집니다.`
    : `아직 완료한 종목이 없어 날짜와 연속일수만 들어갑니다. <b>운동 중에도 찍을 수 있습니다.</b>`;
}
/* 카메라 요청 세대. getUserMedia는 비동기라, 응답이 오기 전에 탭을 옮기거나
   버튼을 다시 누르면 옛 스트림이 살아남아 LED가 안 꺼진다(프라이버시·심사 리스크). */
let camGen = 0;
function stopCamera() {
  camGen++;                                   // 진행 중인 요청 무효화
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  const v = $('vid');
  try { v.srcObject = null; } catch (e) {}
  v.style.display = 'none';
  $('camPlaceholder').style.display = hasShot ? 'none' : 'block';
}
async function startCamera() {
  stopCamera();
  const my = camGen;
  let s = null;
  /* 네이티브에서는 getUserMedia 전에 안드로이드 카메라 권한부터 확보한다 */
  if (NATIVE.on) await NATIVE.ensureCamPermission();
  if (my !== camGen) return;                  // 권한 창이 뜬 사이 화면을 떠났으면 중단
  try {
    s = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1920 } }, audio: false
    });
  } catch (e) {
    if (my === camGen) toast('카메라를 열 수 없습니다 (' + e.name + '). 앨범에서 선택으로 진행하세요.', 'bad');
    return;
  }
  /* 기다리는 사이에 화면을 떠났거나 다시 눌렀으면 즉시 반납한다 */
  if (my !== camGen || curPage !== 'cam') { s.getTracks().forEach(t => t.stop()); return; }
  stream = s;
  const v = $('vid');
  v.srcObject = stream;
  v.style.display = 'block';
  v.classList.toggle('mirror', facing === 'user' && S.prefs.mirror);
  $('camPlaceholder').style.display = 'none';
  $('previewCanvas').style.display = 'none';
  $('gridLines').classList.toggle('on', !!S.prefs.grid);
}
$('btnFlip').onclick = () => { facing = facing === 'user' ? 'environment' : 'user'; startCamera(); };
$('btnPick').onclick = () => $('filePick').click();
$('btnPick2').onclick = () => $('filePick').click();
$('btnShutter').onclick = capture;

async function capture() {
  if (!stream) { await startCamera(); if (!stream) return; }
  const v = $('vid');
  if (!v.videoWidth) return toast('카메라 준비 중입니다', 'bad');
  $('shutterFlash').classList.remove('on'); void $('shutterFlash').offsetWidth; $('shutterFlash').classList.add('on');
  haptic(20);
  const c = document.createElement('canvas');
  c.width = v.videoWidth; c.height = v.videoHeight;
  const x = c.getContext('2d');
  if (facing === 'user' && S.prefs.mirror) { x.translate(c.width, 0); x.scale(-1, 1); }
  x.drawImage(v, 0, 0);
  stopCamera();
  await useSource(c);
}
$('filePick').onchange = async e => {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!f) return;
  busy(true);
  try {
    const src = await OW.loadOriented(f);
    stopCamera();
    await useSource(src);
  } catch (err) {
    busy(false);
    toast('사진을 불러오지 못했습니다: ' + (err.message || err), 'bad');
  }
};

async function useSource(src) {
  const t0 = performance.now();
  busy(true);
  await OW.ensureFonts();
  OW.Overlay.setSource(src);
  hasShot = true;
  savedPhotoId = null;               // 새 사진 — 이전 저장 레코드와 무관
  $('camCapture').style.display = 'none';
  $('camEdit').style.display = 'block';
  $('camPlaceholder').style.display = 'none';
  $('previewCanvas').style.display = 'block';
  $('camStage').classList.add('edit');          // 사진은 위에 고정, 아래 옵션만 스크롤
  $('gridLines').classList.remove('on');
  camOpts.pos = { x: 0, y: 0 }; camOpts.scale = 1; camOpts.photoPos = { x: 0, y: 0 };
  autoTemplate();
  doRender(t0);
  busy(false);
}
function busy(on) { $('camBusy').classList.toggle('on', !!on); }

/** CR-1 F3-3c: 종목 7개 이상이면 사이드 리스트를 기본값으로 제안 */
let tmplManual = false;
function autoTemplate() {
  if (tmplManual) return;
  const n = overlayData().items.length;
  camOpts.tmpl = n >= 7 ? 'B' : (S.prefs.defTmpl || 'A');   // CR-1 F3-3c
  syncCamUI();
}

function overlayData() {
  const L = S.logs[curKey()];
  const d = new Date();
  const items = L ? OW.doneExercises(L) : [];
  return {
    date: `${d.getFullYear()}.${OW.pad(d.getMonth() + 1)}.${OW.pad(d.getDate())}`,
    label: L ? L.label : '',
    items,
    vol: L ? OW.volumeOf(L) : 0,
    dur: L ? OW.durationOf(L) : 0,
    streak: OW.streakForPhoto(),
    logo: '오운완'
  };
}

function doRender(t0, fast) {
  if (!OW.Overlay.src) return;
  const m = OW.Overlay.render($('previewCanvas'), Object.assign({}, camOpts, {
    accent: accentHex(), data: overlayData(), mirror: false,
    fast: !!fast                    // 드래그 중에는 대비 실측을 건너뛴다 (프레임 예산 확보)
  }));
  if (fast) return;
  const total = t0 ? Math.round(performance.now() - t0) : m.ms;
  const p = $('perfTxt');
  const c = m.contrast;
  p.textContent = `${m.W}×${m.H} · 합성 ${total}ms` + (c ? ` · 글자 대비 ${c}:1 ${c >= 4.5 ? '통과' : '주의'}` : '');
  p.className = 'perf' + (total > 1500 || (c && c < 4.5) ? ' slow' : '');
}
function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; doRender(null, true); });
}

/* ── 컨트롤 바인딩 ── */
$$('#segLevel button').forEach(b => b.onclick = () => {
  camOpts.level = b.dataset.lv;
  camOpts.fields = OW.levelFields(camOpts.level);
  camOpts.fields.logo = !!S.prefs.logo;
  syncCamUI(); doRender();
});
$$('#segTmpl button').forEach(b => b.onclick = () => {
  camOpts.tmpl = b.dataset.t; tmplManual = true;
  camOpts.pos = { x: 0, y: 0 };
  syncCamUI(); doRender();
});
$$('#segRatio button').forEach(b => b.onclick = () => { camOpts.ratio = b.dataset.r; syncCamUI(); doRender(); });
$$('#segTone button').forEach(b => b.onclick = () => {
  if (b.dataset.tone === 'custom') {
    /* 커스텀: 색 고르기 창을 띄우고, 고르는 즉시 미리보기에 반영 */
    if (camOpts.tone !== 'custom') { camOpts.tone = 'custom'; syncCamUI(); doRender(); }
    $('toneColor').value = camOpts.customColor || '#1E3A8A';
    try { $('toneColor').click(); } catch (e) {}
    return;
  }
  camOpts.tone = b.dataset.tone; syncCamUI(); doRender();
});
$('toneColor').oninput = () => { camOpts.customColor = $('toneColor').value; camOpts.tone = 'custom'; syncCamUI(); queueRender(); };
$('toneColor').onchange = () => { camOpts.customColor = $('toneColor').value; camOpts.tone = 'custom'; syncCamUI(); doRender(); };
$$('#segOut button').forEach(b => b.onclick = () => {
  camOpts.transparent = b.dataset.out === 'sticker';
  /* 투명 스티커는 스토리에 얹는 용도라 9:16이 기본 */
  if (camOpts.transparent && camOpts.ratio === 'orig') camOpts.ratio = '9:16';
  $('camStage').classList.toggle('checker', camOpts.transparent);
  syncCamUI(); doRender();
});
$('btnRetake').onclick = resetCam;

function syncCamUI() {
  $$('#segLevel button').forEach(x => x.classList.toggle('sel', x.dataset.lv === camOpts.level));
  $$('#segTmpl button').forEach(x => x.classList.toggle('sel', x.dataset.t === camOpts.tmpl));
  $$('#segRatio button').forEach(x => x.classList.toggle('sel', x.dataset.r === camOpts.ratio));
  $$('#segTone button').forEach(x => x.classList.toggle('sel', x.dataset.tone === camOpts.tone));
  $('toneSwatch').style.background = camOpts.customColor || '#1E3A8A';
  $$('#segOut button').forEach(x => x.classList.toggle('sel',
    (x.dataset.out === 'sticker') === !!camOpts.transparent));
  $('btnSave').textContent = camOpts.transparent ? 'PNG 저장' : '저장';
  const box = $('chipFields'); box.innerHTML = '';
  const F = camOpts.fields || OW.levelFields(camOpts.level);
  Object.keys(OW.FIELD_LABELS).forEach(k => {
    const b = document.createElement('button');
    b.className = F[k] ? 'on' : '';
    b.textContent = OW.FIELD_LABELS[k];
    b.onclick = () => { F[k] = F[k] ? 0 : 1; camOpts.fields = F; syncCamUI(); doRender(); };
    box.appendChild(b);
  });
}

function resetCam() {
  hasShot = false; tmplManual = false; savedPhotoId = null;
  OW.Overlay.clear();
  $('camCapture').style.display = 'block';
  $('camEdit').style.display = 'none';
  $('previewCanvas').style.display = 'none';
  $('camStage').classList.remove('edit');
  $('camPlaceholder').style.display = 'block';
  $('perfTxt').textContent = '';
  enterCamera();
}

/* ── 미리보기 제스처 ──
   한 손가락: 글자 박스 안 → 글자 이동 / 밖 → 배경 사진 이동 (비율 크롭 여유 안에서)
   두 손가락: 벌리고 오므려 글자 크기 */
(function dragSetup() {
  const cv = $('previewCanvas');
  const pts = new Map();                       // 눌린 포인터들
  let mode = null;                             // 'overlay' | 'photo' | 'pinch'
  let sx = 0, sy = 0, ox = 0, oy = 0, px0 = 0, py0 = 0, pinchD0 = 1, scale0 = 1;
  const toCanvas = e => {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * cv.width, y: (e.clientY - r.top) / r.height * cv.height };
  };
  const inBox = p => {
    const box = OW.Overlay.lastBox;
    if (!box || box.fixed) return false;
    const pad = cv.width * 0.06;
    return !(p.x < box.x - pad || p.x > box.x + box.w + pad || p.y < box.y - pad || p.y > box.y + box.h + pad);
  };
  const dist = () => { const a = Array.from(pts.values()); return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1; };
  cv.addEventListener('pointerdown', e => {
    if (!hasShot) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { cv.setPointerCapture(e.pointerId); } catch (x) {}
    e.preventDefault();
    if (pts.size >= 2) { mode = 'pinch'; pinchD0 = dist(); scale0 = camOpts.scale; return; }
    sx = e.clientX; sy = e.clientY;
    if (inBox(toCanvas(e))) { mode = 'overlay'; ox = camOpts.pos.x; oy = camOpts.pos.y; }
    else { mode = 'photo'; px0 = camOpts.photoPos.x; py0 = camOpts.photoPos.y; }
  });
  cv.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mode === 'pinch') {
      if (pts.size < 2) return;
      camOpts.scale = Math.max(0.5, Math.min(2.2, scale0 * dist() / pinchD0));
      queueRender();
      return;
    }
    const r = cv.getBoundingClientRect();
    if (mode === 'overlay') {
      camOpts.pos = { x: ox + (e.clientX - sx) / r.width, y: oy + (e.clientY - sy) / r.height };
      queueRender();
    } else if (mode === 'photo') {
      const sl = OW.Overlay.photoSlack || { x: 0, y: 0 };
      const dxC = (e.clientX - sx) / r.width * cv.width, dyC = (e.clientY - sy) / r.height * cv.height;
      const nx = sl.x > 0 ? Math.max(-1, Math.min(1, px0 - dxC / sl.x * 2)) : 0;
      const ny = sl.y > 0 ? Math.max(-1, Math.min(1, py0 - dyC / sl.y * 2)) : 0;
      if (nx !== camOpts.photoPos.x || ny !== camOpts.photoPos.y) { camOpts.photoPos = { x: nx, y: ny }; queueRender(); }
    }
  });
  const end = e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    try { cv.releasePointerCapture(e.pointerId); } catch (x) {}
    if (pts.size >= 1) { if (mode === 'pinch') mode = null; return; }   // 남은 손가락은 새 제스처로 치지 않는다
    const was = mode; mode = null;
    doRender();
    /* 렌더가 클램프한 실제 위치를 pos에 되돌려 쓴다.
       안 하면 화면 밖으로 민 만큼 "먹통 구간"이 생겨 되돌릴 때 반응이 없다. */
    if (was === 'overlay') {
      const b = OW.Overlay.lastBox;
      if (b && !b.fixed && b.appliedPos) camOpts.pos = { x: b.appliedPos.x, y: b.appliedPos.y };
    }
    if (was === 'photo' && camOpts.ratio === 'orig' && !photoHintShown) {
      photoHintShown = true;
      toast('원본 비율에서는 사진이 전부 보여 옮길 여유가 없습니다. 1:1·4:5·9:16에서 옮겨보세요.');
    }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
})();
let photoHintShown = false;

/* ── 저장 / 공유 ── */
/** 같은 합성본을 두 번 저장하지 않기 위한 표시.
    저장/공유를 연달아 눌러도 캘린더에 사진이 두 장 생기지 않는다. */
let savedPhotoId = null;
let persisting = false;

async function persistShot(preBlob) {
  const cv = $('previewCanvas');
  const key = curKey();

  const full = preBlob || await OW.overlayToBlob(cv, 0.92);
  const thumbCv = OW.makeThumb(cv, 300);
  const thumb = await OW.overlayToBlob(thumbCv, 0.72);

  /* 같은 사진을 다시 저장하는 경우(연타, 또는 템플릿 바꿔 재저장)는
     새 레코드를 만들지 않고 기존 레코드를 갱신한다. 캘린더에 같은 사진이 두 장 생기지 않게. */
  if (savedPhotoId) {
    const exists = await OW.Photos.get(savedPhotoId).catch(() => null);
    if (exists) {
      await OW.Photos.put(Object.assign({}, exists, {
        full, thumb, w: cv.width, h: cv.height,
        meta: { level: camOpts.level, tmpl: camOpts.tmpl, ratio: camOpts.ratio, tone: camOpts.tone }
      }));
      OW.dropPhotoCache(savedPhotoId);
      return { id: savedPhotoId, full, key, updated: true };
    }
    savedPhotoId = null;
  }

  const id = 'p' + Date.now() + Math.random().toString(36).slice(2, 7);
  await OW.Photos.put({
    id, date: key, w: cv.width, h: cv.height,
    full, thumb, created: Date.now(),
    meta: { level: camOpts.level, tmpl: camOpts.tmpl, ratio: camOpts.ratio, tone: camOpts.tone }
  });

  const L = OW.ensureLog(key);
  L.photos = L.photos || [];
  L.photos.push(id);
  /* ★ 운동 중에 찍는 경우(F3-10)가 정상 시나리오다. 진행 중인 세션을 끝내면 안 된다. */
  if (!L.start) { L.start = Date.now() - 1000; L.end = Date.now(); }

  /* localStorage 저장이 실패하면 사진만 IDB에 남는 고아가 된다 — 되돌린다 */
  if (!OW.save(true)) {
    L.photos.pop();
    await OW.Photos.del(id).catch(() => {});
    throw new Error('저장 공간이 부족합니다. 설정 > 데이터에서 오래된 사진을 정리하세요.');
  }
  savedPhotoId = id;
  return { id, full, key };
}

/* 사진 파일을 사용자에게 내보낸다.
   네이티브 앱에서는 갤러리에 직접 저장한다(native.js). 실패하면 웹 경로로 폴백.
   <a download>은 iOS Safari 등에서 무시되므로(감사 F-15) Web Share를 먼저 시도하고,
   그마저 안 되면 새 탭으로 띄워 "길게 눌러 저장"을 안내한다. 산출물이 조용히 사라지지 않게. */
async function exportBlob(blob, name, mime) {
  if (NATIVE.on) {
    try { return await NATIVE.saveImage(blob, name, mime); }
    catch (e) { console.error('[native saveImage]', e); /* 아래 웹 경로로 폴백 */ }
  }
  try {
    const file = new File([blob], name, { type: mime || 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      return 'share';
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return 'abort';
  }
  const a = document.createElement('a');
  if ('download' in a) { downloadBlob(blob, name); return 'download'; }
  const u = URL.createObjectURL(blob);
  const w = window.open(u, '_blank');
  setTimeout(() => URL.revokeObjectURL(u), 20000);
  return w ? 'tab' : 'fail';
}

/** 저장/공유 재진입 방지 — busy 오버레이는 미리보기 위에만 깔려서 버튼을 막지 못한다 */
function lockSaveButtons(on) {
  persisting = !!on;
  $('btnSave').disabled = !!on;
  $('btnShare').disabled = !!on;
  busy(on);
}

$('btnSave').onclick = async () => {
  if (persisting) return;
  lockSaveButtons(true);
  try {
    const cv = $('previewCanvas');
    const png = !!camOpts.transparent;
    const full = await OW.overlayToBlob(cv, png ? 1 : 0.92, png ? 'image/png' : 'image/jpeg');
    if (!full) return toast('이미지를 만들지 못했습니다', 'bad');
    /* 사용자 산출물(사진)을 먼저 확정하고, 그 다음에 저장소에 기록한다 */
    const key = curKey();
    const how = await exportBlob(full, `오운완_${key}.${png ? 'png' : 'jpg'}`, png ? 'image/png' : 'image/jpeg');
    if (how === 'abort') return toast('저장을 취소했습니다.');

    let stored = true, why = '';
    try { await persistShot(full); }
    catch (e) { stored = false; why = e.message || String(e); console.error('[persist]', e); }

    if (!stored) toast((png ? 'PNG는' : '사진은') + ' 내보냈지만 캘린더 기록에 실패했습니다.\n' + why, 'bad');
    else if (how === 'tab') toast('새 탭에 열었습니다. 사진을 길게 눌러 저장하세요 · 캘린더 기록 완료', 'ok');
    else if (how === 'fail') toast('사진 내보내기에 실패했습니다. 캘린더 기록은 남았습니다.', 'bad');
    else toast('저장 + 캘린더 기록 완료', 'ok');
    checkStorage();
  } catch (e) { toast('저장 실패: ' + (e.message || e), 'bad'); }
  finally { lockSaveButtons(false); }
};

$('btnShare').onclick = async () => {
  if (persisting) return;
  lockSaveButtons(true);
  try {
    const cv = $('previewCanvas');
    const png = !!camOpts.transparent;
    const mime = png ? 'image/png' : 'image/jpeg';
    const full = await OW.overlayToBlob(cv, png ? 1 : 0.92, mime);
    if (!full) return toast('이미지를 만들지 못했습니다', 'bad');
    const key = curKey();
    const file = new File([full], `오운완_${key}.${png ? 'png' : 'jpg'}`, { type: mime });
    const tags = hashtags();
    const persist = async () => {
      try { await persistShot(full); return ''; }
      catch (e) { console.error('[persist]', e); return e.message || String(e); }
    };
    if (NATIVE.on) {
      /* 네이티브 공유 시트 (WebView에는 navigator.share가 없다) */
      const how = await NATIVE.shareImage(full, `오운완_${key}.${png ? 'png' : 'jpg'}`, mime, tags);
      if (how === 'abort') return toast('공유를 취소했습니다. 기록되지 않았습니다.');
      const err = await persist();
      toast(err ? '공유는 됐지만 캘린더 기록에 실패했습니다.\n' + err : '공유 완료 · 캘린더에 기록됨', err ? 'bad' : 'ok');
    } else if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: tags });
      } catch (e) {
        /* 취소했으면 기록하지 않는다 */
        if (e && e.name === 'AbortError') return toast('공유를 취소했습니다. 기록되지 않았습니다.');
        throw e;
      }
      const err = await persist();
      toast(err ? '공유는 됐지만 캘린더 기록에 실패했습니다.\n' + err : '공유 완료 · 캘린더에 기록됨', err ? 'bad' : 'ok');
    } else {
      const err = await persist();
      await exportBlob(full, `오운완_${key}.${png ? 'png' : 'jpg'}`, mime);
      copyText(tags);
      toast(err ? '사진은 저장했지만 캘린더 기록에 실패했습니다.\n' + err
                : '이 브라우저는 공유 시트를 지원하지 않아 사진 저장 + 해시태그 복사로 처리했습니다', err ? 'bad' : 'ok');
    }
    checkStorage();
  } catch (e) { toast('공유 실패: ' + (e.message || e), 'bad'); }
  finally { lockSaveButtons(false); }
};

function defaultHashtags() {
  const L = S.logs[curKey()];
  const part = L ? (L.label || '').replace(/[^가-힣a-zA-Z]/g, '') : '';
  const st = OW.streakForPhoto();
  const t = ['#오운완', '#오늘운동완료', '#헬스타그램', '#운동스타그램', '#헬스', '#운동기록', '#웨이트트레이닝'];
  if (part) t.splice(2, 0, '#' + part + '운동');
  if (st >= 2) t.push('#' + st + '일차');
  return t.join(' ');
}
/** 사용자가 편집해 저장한 해시태그가 있으면 그것을, 없으면 자동 생성값을 쓴다 */
function hashtags() {
  const c = (S.prefs.customTags || '').trim();
  return c || defaultHashtags();
}
function cleanTags(s) { return String(s || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 500); }
function saveTags() {
  const v = cleanTags($('tagEdit').value);
  S.prefs.customTags = (!v || v === defaultHashtags()) ? '' : v;
  OW.save();
  return v || defaultHashtags();
}
$('tagReset').onclick = () => { $('tagEdit').value = defaultHashtags(); };
$('tagSave').onclick = () => { saveTags(); $('mTags').classList.remove('on'); toast('해시태그를 저장했습니다', 'ok'); };
$('tagCopy').onclick = () => { const t = saveTags(); copyText(t); $('mTags').classList.remove('on'); toast('해시태그 저장 + 복사됨\n' + t, 'ok'); };
$('mTags').onclick = e => { if (e.target === $('mTags')) $('mTags').classList.remove('on'); };
$('btnDual').onclick = async () => {
  if (persisting) return;
  lockSaveButtons(true);
  const keepRatio = camOpts.ratio;
  try {
    const cv = $('previewCanvas');
    const png = !!camOpts.transparent;
    const mime = png ? 'image/png' : 'image/jpeg';
    const ext = png ? 'png' : 'jpg';
    const key = curKey();
    const made = [];
    for (const [r, tag] of [['1:1', '카톡'], ['9:16', '스토리']]) {
      camOpts.ratio = r;
      doRender();
      const b = await OW.overlayToBlob(cv, png ? 1 : 0.92, mime);
      if (!b) continue;
      await exportBlob(b, `오운완_${key}_${tag}.${ext}`, mime);
      made.push({ tag, blob: b, ratio: r });
    }
    if (!made.length) return toast('이미지를 만들지 못했습니다', 'bad');
    /* 캘린더에는 스토리 판(마지막 렌더)을 기록한다 */
    if (!png) { try { await persistShot(made[made.length - 1].blob); } catch (e) { console.error(e); } }
    copyText(hashtags());
    toast(`${made.map(m => m.tag).join(' + ')} ${made.length}장 저장 · 해시태그 복사됨`, 'ok');
    checkStorage();
  } catch (e) { toast('저장 실패: ' + (e.message || e), 'bad'); }
  finally {
    camOpts.ratio = keepRatio;
    doRender();
    syncCamUI();
    lockSaveButtons(false);
  }
};

$('btnTags').onclick = () => { $('tagEdit').value = hashtags(); $('mTags').classList.add('on'); };
function copyText(t) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).catch(() => fallbackCopy(t));
  } else fallbackCopy(t);
}
function fallbackCopy(t) {
  const ta = document.createElement('textarea');
  ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (e) { prompt('길게 눌러 복사하세요', t); }
  ta.remove();
}

/* ══════════════════ 통계 ══════════════════ */
function renderStats() {
  renderVolBars();
  renderParts();
  renderHeat();
  renderPR();
}
function weekKey(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return OW.dkey(OW.addDays(x, -((x.getDay() + 6) % 7))); }
function renderVolBars() {
  const weeks = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) weeks.push(weekKey(OW.addDays(now, -i * 7)));
  const vols = weeks.map(wk => {
    let v = 0;
    for (let i = 0; i < 7; i++) {
      const k = OW.dkey(OW.addDays(OW.parseKey(wk), i));
      if (S.logs[k]) v += OW.volumeOf(S.logs[k]);
    }
    return v;
  });
  const max = Math.max(1, ...vols);
  const box = $('volBars'); box.innerHTML = '';
  vols.forEach((v, i) => {
    const d = OW.parseKey(weeks[i]);
    const b = document.createElement('div');
    b.className = 'b' + (i === vols.length - 1 ? ' hot' : '');
    b.innerHTML = `<em>${v ? (v >= 1000 ? (v / 1000).toFixed(0) + 't' : v) : ''}</em>
      <i style="height:${Math.max(3, v / max * 100)}%"></i>
      <span>${d.getMonth() + 1}/${d.getDate()}</span>`;
    box.appendChild(b);
  });
  const cur = vols[vols.length - 1], prev = vols[vols.length - 2] || 0;
  const diff = prev ? Math.round((cur - prev) / prev * 100) : 0;
  $('volTrend').textContent = prev ? (diff >= 0 ? `+${diff}%` : `${diff}%`) : '주간';
  const totalV = vols.reduce((a, b) => a + b, 0);
  $('volSummary').innerHTML = totalV
    ? `최근 8주 누적 <b>${totalV.toLocaleString()}kg</b> · 이번 주 <b>${cur.toLocaleString()}kg</b>`
    : '아직 무게를 기록한 세트가 없습니다. 세트 입력에 kg를 넣으면 볼륨이 쌓입니다.';
}
function renderParts() {
  const since = OW.dkey(OW.addDays(new Date(), -27));
  const map = {};
  Object.keys(S.logs).forEach(k => {
    if (k < since) return;
    const L = S.logs[k];
    (L.ex || []).forEach(e => {
      const v = (e.sets || []).reduce((a, s) => a + (s.done ? (+s.kg || 0) * (+s.reps || 0) : 0), 0);
      const sets = (e.sets || []).filter(s => s.done).length;
      if (!sets) return;
      const p = e.part || (D.EX_BY_ID[e.id] || {}).part || '기타';
      map[p] = map[p] || { vol: 0, sets: 0 };
      map[p].vol += v; map[p].sets += sets;
    });
  });
  const rows = Object.keys(map).map(p => ({ p, ...map[p] })).sort((a, b) => b.sets - a.sets);
  const box = $('partList'); box.innerHTML = '';
  if (!rows.length) { box.innerHTML = `<div class="empty"><p>최근 4주 기록이 없습니다</p></div>`; $('partAdvice').textContent = ''; return; }
  const maxS = Math.max(...rows.map(r => r.sets));
  rows.forEach(r => {
    const div = document.createElement('div');
    div.className = 'partrow';
    div.innerHTML = `<span class="pn">${esc(r.p)}</span>
      <span class="pb"><i style="width:${r.sets / maxS * 100}%"></i></span>
      <span class="pv">${r.sets}세트</span>`;
    box.appendChild(div);
  });
  const trained = new Set(rows.map(r => r.p));
  const missing = ['가슴', '등', '어깨', '하체'].filter(p => !trained.has(p));
  $('partAdvice').innerHTML = missing.length
    ? `최근 4주간 <b style="color:var(--warn)">${missing.join(', ')}</b> 기록이 없습니다. 불균형이 쌓이면 부상으로 옵니다.`
    : `주요 4부위 모두 최근 4주 안에 기록이 있습니다. 균형은 괜찮습니다.`;
}
function renderHeat() {
  const box = $('heatGrid'); box.innerHTML = '';
  const days = 119;
  const vols = [];
  for (let i = days - 1; i >= 0; i--) {
    const k = OW.dkey(OW.addDays(new Date(), -i));
    const L = S.logs[k];
    vols.push({ k, v: L ? (OW.volumeOf(L) || (OW.isWorkoutDay(L) ? 1 : 0)) : 0, photo: L && (L.photos || []).length });
  }
  const max = Math.max(1, ...vols.map(v => v.v));
  vols.forEach(v => {
    const i = document.createElement('i');
    if (v.v > 0) {
      const lv = v.v >= max * 0.75 ? 4 : v.v >= max * 0.5 ? 3 : v.v >= max * 0.25 ? 2 : 1;
      i.className = 'l' + lv;
    }
    i.title = v.k + (v.v ? ` · ${v.v.toLocaleString()}kg` : '');
    box.appendChild(i);
  });
  const active = vols.filter(v => v.v > 0).length;
  const photos = vols.filter(v => v.photo).length;
  $('heatSummary').innerHTML = `최근 ${days}일 중 <b>${active}일</b> 운동 · <b>${photos}일</b> 오운완 · 현재 연속 <b>${OW.streak()}일</b>`;
}
function renderPR() {
  const list = OW.prList(12);
  const box = $('prList'); box.innerHTML = '';
  if (!list.length) { box.innerHTML = `<div class="empty"><p>아직 개인 기록이 없습니다</p><small>세트에 무게와 횟수를 넣으면 자동으로 쌓입니다.</small></div>`; return; }
  list.forEach(p => {
    const div = document.createElement('div');
    div.className = 'prrow';
    div.innerHTML = `<span class="pn">${esc(p.nm || p.id)}</span>
      <span class="pv">${p.kg}kg×${p.reps}</span>
      <span class="pd">1RM ${p.e1rm}<br>${(p.date || '').slice(5)}</span>`;
    box.appendChild(div);
  });
}

/* ══════════════════ 설정 ══════════════════ */
function renderSettings() {
  const p = S.split === 'custom' ? { name: '커스텀' } : (D.SPLIT_PRESETS[S.split] || { name: '미설정' });
  const dows = (S.dows || []).slice().sort().map(i => OW.DOW[i]).join('·') || '매일';
  $('setSplitInfo').innerHTML = S.onboarded
    ? `<b>${p.name}</b> · 주 ${S.freq || (S.dows || []).length}회 목표<br>
       운동 요일: ${dows}<br>
       다음 부위: <b>${(OW.routineDay(S.dayIdx) || {}).label || '-'}</b>`
    : '아직 루틴이 설정되지 않았습니다.';

  const lv = { full: '상세', simple: '간단', mini: '오운완만' };
  $('setDefLevelV').innerHTML = (lv[S.prefs.defLevel] || '상세') + ' <span class="arr">›</span>';
  $('setRestV').innerHTML = S.prefs.restSec + '초 <span class="arr">›</span>';
  $('setUnitV').innerHTML = S.prefs.unit + ' <span class="arr">›</span>';

  sw('swLogo', S.prefs.logo); sw('swGrid', S.prefs.grid); sw('swMirror', S.prefs.mirror);
  sw('swTheme', S.prefs.theme === 'light'); sw('swRestAuto', S.prefs.restAuto); sw('swSound', S.prefs.sound);
  $$('#swatches button').forEach(b => b.classList.toggle('on', b.dataset.a === S.prefs.accent));
  checkStorage();
}
function sw(id, on) {
  const el = $(id);
  el.classList.toggle('on', !!on);
  el.setAttribute('aria-checked', on ? 'true' : 'false');
}
function bindSw(id, key, after) {
  $(id).onclick = () => {
    S.prefs[key] = !S.prefs[key];
    OW.save(); sw(id, S.prefs[key]);
    if (after) after();
  };
}
bindSw('swLogo', 'logo', () => { if (camOpts.fields) camOpts.fields.logo = !!S.prefs.logo; if (hasShot) { syncCamUI(); doRender(); } });
bindSw('swGrid', 'grid', applyPrefs);
bindSw('swMirror', 'mirror');
bindSw('swRestAuto', 'restAuto');
bindSw('swSound', 'sound', () => { if (S.prefs.sound) beep(1); });
$('swTheme').onclick = () => {
  S.prefs.theme = S.prefs.theme === 'light' ? 'dark' : 'light';
  OW.save(); applyPrefs(); renderSettings();
};
$$('#swatches button').forEach(b => b.onclick = () => {
  S.prefs.accent = b.dataset.a; OW.save(); applyPrefs(); renderSettings();
  if (hasShot) doRender();
});
$('setDefLevel').onclick = async () => {
  const v = await choiceBox('기본 정보량', '카메라를 열 때 처음 선택될 값입니다.', [
    { v: 'full', t: '상세', d: '종목 + 세트×횟수 + 무게 + 총 볼륨 + 시간' },
    { v: 'simple', t: '간단', d: '날짜 + 부위 + 종목명만' },
    { v: 'mini', t: '오운완만', d: '날짜 + 연속일수. 종목은 안 보임' }
  ], S.prefs.defLevel);
  if (v) { S.prefs.defLevel = v; OW.save(); renderSettings(); }
};
$('setRest').onclick = async () => {
  const v = await stepperBox('기본 휴식 시간', '10초 단위로 조절합니다. 세트를 체크하면 이 시간으로 자동 시작합니다. (60 펌핑 · 90 일반 · 120~180 고중량)',
    restDefault(), 10, 10, 600, '초');
  if (v) { S.prefs.restSec = v; OW.save(); renderSettings(); }
};
$('setUnit').onclick = async () => {
  const v = await choiceBox('무게 단위', 'lb 선택 시 입력값을 lb로 취급합니다(환산 없음).', [
    { v: 'kg', t: 'kg' }, { v: 'lb', t: 'lb' }
  ], S.prefs.unit);
  if (v) { S.prefs.unit = v; OW.save(); renderSettings(); }
};

/* ── 저장 용량 ── */
async function checkStorage() {
  const info = await OW.storageInfo();
  const tag = $('storageTag'), bar = $('storageBar'), txt = $('storageTxt');
  if (!tag) return;
  tag.textContent = `사진 ${info.photoCount}장`;
  const mb = n => (n / 1048576).toFixed(1) + 'MB';
  if (info.supported && info.quota) {
    const pct = Math.min(100, info.used / info.quota * 100);
    bar.style.width = Math.max(2, pct) + '%';
    bar.className = pct > 90 ? 'full' : pct > 70 ? 'hot' : '';
    txt.innerHTML = `사용 ${mb(info.used)} / 가용 ${mb(info.quota)} (${pct.toFixed(1)}%) · 설정·기록 ${(info.lsBytes / 1024).toFixed(0)}KB`;
    if (pct > 88) txt.innerHTML += `<br><b style="color:var(--warn)">저장 공간이 얼마 남지 않았습니다. 오래된 사진 정리를 권합니다.</b>`;
  } else {
    bar.style.width = '4%';
    txt.textContent = `사진 ${info.photoCount}장 · 설정·기록 ${(info.lsBytes / 1024).toFixed(0)}KB (이 브라우저는 용량 조회를 지원하지 않습니다)`;
  }
  if (info.photoCount > 100) {
    txt.innerHTML += `<br>사진이 100장을 넘었습니다 (PRD 비기능 요구사항 안내 기준).`;
  }
}
OW.onStorageFull = () => toast('저장 공간이 가득 찼습니다. 설정 > 데이터에서 오래된 사진을 정리하세요.', 'bad');

$('btnPurgePhotos').onclick = async () => {
  if (!await confirmBox('오래된 사진을 정리할까요?', '90일이 지난 사진의 원본을 지우고 캘린더 썸네일만 남깁니다. 달력 그림은 그대로입니다.', '정리')) return;
  const r = await OW.purgeOldPhotos(90);
  toast(r.count ? `${r.count}장 정리 · ${(r.freed / 1048576).toFixed(1)}MB 확보` : '정리할 사진이 없습니다', 'ok');
  checkStorage();
};
$('btnBackup').onclick = async () => {
  const info = await OW.storageInfo();
  const withPhotos = await confirmBox(
    '사진도 함께 백업할까요?',
    `사진 ${info.photoCount}장 · 포함하면 파일이 약 ${Math.max(1, Math.round(info.photoCount * 0.6))}MB가 됩니다.\n기록만 백업하면 수십 KB입니다.`,
    '사진 포함');
  const tag = $('storageTag');
  const oldTag = tag ? tag.textContent : '';
  try {
    /* 사진을 배열에 base64로 쌓으면 100장 수준에서 탭이 죽는다 → Blob으로 흘려 쓴다 */
    const blob = await OW.exportBackupBlob(withPhotos, (i, total) => {
      if (tag) tag.textContent = `백업 중 ${i}/${total}`;
    });
    const backupName = `오운완_백업_${OW.today()}.json`;
    if (NATIVE.on) {
      await NATIVE.saveFile(blob, backupName, 'application/json');
      toast(`다운로드 폴더에 저장했습니다: ${backupName} (${(blob.size / 1048576).toFixed(1)}MB)`, 'ok');
    } else {
      downloadBlob(blob, backupName);
      toast(`백업 파일을 저장했습니다 (${(blob.size / 1048576).toFixed(1)}MB)`, 'ok');
    }
  } catch (e) { toast('백업 실패: ' + (e.message || e), 'bad'); }
  if (tag) tag.textContent = oldTag;
  checkStorage();
};
$('btnRestore').onclick = () => $('restoreFile').click();
$('restoreFile').onchange = async e => {
  const f = e.target.files && e.target.files[0]; e.target.value = '';
  if (!f) return;
  if (!await confirmBox('백업을 복원할까요?', '현재 기기의 기록이 백업 내용으로 완전히 대체됩니다.\n파일이 손상됐으면 복원하지 않고 현재 기록을 그대로 둡니다.', '복원')) return;
  busy(true);
  try {
    const txt = await f.text();
    let payload;
    try { payload = JSON.parse(txt); }
    catch (e) { throw new Error('파일을 읽을 수 없습니다 (JSON 형식 오류)'); }
    const r = await OW.importBackup(payload);
    S = OW.S; applyPrefs();
    openEx = null; savedPhotoId = null;
    toast(`복원 완료${r && r.photos ? ` · 사진 ${r.photos}장` : ''}`, 'ok');
    go('today');
  } catch (err) { toast('복원 실패: ' + (err.message || err), 'bad'); }
  busy(false);
};
$('btnWipe').onclick = async () => {
  if (!await confirmBox('모든 기록을 삭제할까요?', '루틴·세트 기록·사진이 전부 사라집니다. 되돌릴 수 없습니다.', '전부 삭제')) return;
  if (!await confirmBox('정말 지웁니다', '백업을 먼저 받아두는 것을 권합니다.', '그래도 삭제')) return;
  await OW.Photos.clear().catch(() => {});
  localStorage.removeItem(OW.LS_KEY);
  location.reload();
};

/* ── 사양 자가진단 ── */
$('btnSpecCheck').onclick = async () => {
  const rows = [];
  const ok = (k, v, note) => rows.push({ k, v, note });
  ok('캘린더 딤', '25%', 'DEC-001 확정값 적용');
  ok('날짜 알약 배경', 'rgba(0,0,0,0.70)', '명세표 §4');
  ok('셀 비율', '1 : 1.18', '명세표 §4');
  ok('셀 내 부가 텍스트', '없음', 'DEC-002 준수 (장수는 점 표기)');
  ok('상세 시트 사진', 'object-fit: contain', '원본 비율 유지 — 잘림 수정');
  ok('오운완 하단 바', '현 스펙 유지', 'DEC-003');
  ok('EXIF 처리', OW.blurSupported() ? '감지 후 분기' : '감지 후 분기', 'DEC-004');
  ok('종목 표시', '전부 표시 · 말줄임 금지', 'CR-1 F3-3a');
  ok('7종목 이상', 'B 사이드 자동', 'CR-1 F3-3c');
  ok('텍스트 불투명도', '100%', '명세표 §0');
  ok('최소 라인 두께', '1.5px', '명세표 §0');
  ok('canvas blur 지원', OW.blurSupported() ? '지원' : '미지원 → 단색 대체', '기능 감지');
  ok('폰트 로드', (await OW.ensureFonts()) ? 'Pretendard 적용' : '대체 폰트', '합성 전 보장');
  const info = await OW.storageInfo();
  ok('저장 사진', info.photoCount + '장', 'IndexedDB');
  const html = rows.map(r => `<div class="dd-row"><span class="k">${esc(r.k)}</span><span>${esc(r.v)}<br><small style="color:var(--sub2)">${esc(r.note)}</small></span></div>`).join('');
  $('ddTitle').textContent = '사양 자가진단';
  $('ddSub').textContent = '명세표 v1.0 · 결정확정 문서 대비';
  $('ddPhotoWrap').style.display = 'none';
  $('ddDots').innerHTML = ''; $('ddEx').innerHTML = '';
  $('ddRows').innerHTML = html;
  /* ★ 이 시트는 날짜 상세와 DOM을 공유한다.
     ddKey를 비우고 파괴적 액션을 감추지 않으면 "기록 삭제"가 직전에 열었던 날짜를 지운다. */
  ddPhotos = []; ddKey = null;
  setDayActions(false);
  $('mDay').classList.add('on');
};

/* ══════════════════ 유틸 ══════════════════ */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
/** 사용자가 직접 입력한 종목명 정리 — 태그 문자 제거 + 길이 제한.
    표시할 때 esc()로 막고 있지만, 저장 단계에서 한 번 더 거른다(백업 파일로도 유통되므로). */
function cleanExName(s) {
  return String(s == null ? '' : s).replace(/[<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
}
/** 커스텀 종목의 안정적인 id — 이름이 같으면 같은 id (프리필·PR 누적을 위해) */
function customId(nm) {
  const n = cleanExName(nm).toLowerCase().replace(/\s/g, '');
  let h = 5381;
  for (let i = 0; i < n.length; i++) h = ((h * 33) ^ n.charCodeAt(i)) >>> 0;
  return 'custom-' + h.toString(36);
}

/* ══════════════════ 자정 전환 감시 (F2-7) ══════════════════ */
let lastDay = OW.today();
setInterval(() => {
  const k = OW.today();
  if (k !== lastDay) {
    lastDay = k;
    OW.pruneEmptyLogs(); advanceDayIdx(); OW.save(true);
    stopRest(false);
    if (curPage === 'today') renderToday();
    if (curPage === 'cal') renderCal();
    toast('날짜가 바뀌었습니다. 오늘 루틴을 새로 불러왔습니다.');
  }
}, 20000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const k = OW.today();
  if (k !== lastDay) { lastDay = k; OW.pruneEmptyLogs(); advanceDayIdx(); OW.save(true); }
  if (curPage === 'today') renderToday();
});

/* ══════════════════ 뒤로가기 / 앱 종료 ══════════════════
   안드로이드 하드웨어 뒤로가기: 열린 것부터 하나씩 닫고, 마지막(오늘 화면)에서만 종료를 묻는다.
   리스너가 없으면 Capacitor가 앱을 그냥 꺼버린다 — "루틴 편집에서 뒤로가기 시 앱 종료" 버그의 원인. */
function closeModalEl(m) {
  switch (m.id) {
    case 'mRoutine': closeRoutineEditor(); break;
    case 'mDay': closeDD(); break;
    case 'mConfirm': $('cfNo').click(); break;
    case 'mChoice': $('chCancel').click(); break;
    case 'mStep': $('stCancel').click(); break;
    default: m.classList.remove('on');
  }
}
let exitAsking = false;
async function onBack() {
  const m = topModal();
  const onboarding = m && m.id === 'mOnboard' && !(S.onboarded && S.routine.length);
  if (m && !onboarding) { closeModalEl(m); return; }
  if ($('celebrate').classList.contains('on')) { $('celebrate').classList.remove('on'); renderToday(); return; }
  if ($('timerPanel').classList.contains('on')) { closeTimerPanel(); return; }
  if (!onboarding && curPage === 'cam' && hasShot) { resetCam(); return; }
  if (!onboarding && curPage !== 'today') { go('today'); return; }
  if (!NATIVE.on || exitAsking) return;
  exitAsking = true;
  const yes = await confirmBox('앱을 종료할까요?', '기록은 이 기기에 저장되어 있습니다.', '종료');
  exitAsking = false;
  if (yes) NATIVE.exitApp();
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') onBack(); });

/* ══════════════════ 부팅 ══════════════════ */
function boot() {
  applyPrefs();
  document.body.dataset.pg = curPage;
  if (NATIVE.on) NATIVE.onBackButton(onBack);
  OW.pruneEmptyLogs();
  /* 지난 운동일 다음 부위로 자동 진행 — 사진 저장 횟수와 무관하게 하루 1칸만 이동 */
  advanceDayIdx();
  OW.save();
  if (!S.onboarded || !S.routine.length) openOnboard();
  else renderToday();
  OW.ensureFonts();
  $('barSub').textContent = '';
  /* PWA — 네이티브 앱에서는 자산이 이미 로컬이라 SW 캐시가 무의미하고,
     앱 업데이트 후 옛 화면을 계속 보여줄 위험만 있어 등록하지 않는다 */
  if (!NATIVE.on && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
/** 마지막 운동일의 dayIdx + 1 을 오늘의 시작 인덱스로 삼는다.
    v0.2는 사진 저장 때마다 dayIdx를 올려 하루 두 장 저장하면 분할이 두 칸 밀렸음. */
function advanceDayIdx() {
  if (!S.routine.length) return;
  const keys = Object.keys(S.logs).filter(k => OW.isWorkoutDay(S.logs[k])).sort();
  if (!keys.length) return;
  const last = keys[keys.length - 1];
  if (last >= OW.today()) { S.dayIdx = ((S.logs[last].dayIdx || 0) % S.routine.length + S.routine.length) % S.routine.length; return; }
  S.dayIdx = ((S.logs[last].dayIdx || 0) + 1) % S.routine.length;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

g.OWAPP = { go, renderToday, renderCal, renderStats, toast, S: () => S,
  /* 검증 스크립트용 훅 */
  _t: { syncTodayWithRoutine, hashtags, defaultHashtags, adjustRest, startRest, stopRest, pauseRest, resumeRest,
        restState: () => restState, restLeft, onBack, openTimerPanel, closeTimerPanel, camOpts: () => camOpts,
        setViewDate: k => { viewDate = k; }, viewDate: () => viewDate, showDay } };

})(window);
