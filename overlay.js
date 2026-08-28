/* ==========================================================================
   overlay.js — 오운완 합성 엔진 (F3)
   ---------------------------------------------------------------------------
   근거: 03_디자인시안/디자인_수치명세표_v1.0.md §0~§3
        01_기획문서/변경요청서 CR-1 (종목 전부 표시, 말줄임 금지)
        01_기획문서/결정확정 DEC-003 (하단 바 현 스펙 유지), DEC-004 (EXIF)

   축 2개
     · 정보량 level : full(상세) / simple(간단) / mini(오운완만)
     · 템플릿  tmpl : A 하단바 / B 사이드 / C 스탬프 / D 필름

   설계 원칙 (v0.2 감사 지적 반영)
     · 레이아웃은 측정 → 배치 → 렌더 단일 패스. 높이 산식과 그리기 좌표를
       두 벌로 관리하지 않는다.
     · 넘치면 자동 후퇴: 폰트 축소 → 열 수 조정 → 마지막 수단으로 "외 N종목".
       말줄임은 물리적으로 불가능할 때만 (CR-1 원칙).
     · 브라우저 기능은 감지하고 폴백을 준비한다 (ctx.filter는 예외를 안 던진다).
     · 인코딩 왕복 금지. 크롭 결과를 캐시해 템플릿 전환은 오버레이만 다시 그린다.
   ========================================================================== */
(function (g) {
'use strict';

const SHORT = 1080;                 // 출력 짧은 변
const BASE_UNIT = 1080;             // 명세표 px 값의 기준 해상도

/* ───────── 기능 감지 ───────── */
let _blurOK = null;
function blurSupported() {
  if (_blurOK !== null) return _blurOK;
  try {
    const c = document.createElement('canvas'); c.width = c.height = 4;
    const x = c.getContext('2d');
    x.filter = 'blur(2px)';
    _blurOK = x.filter === 'blur(2px)';     // 미지원이면 조용히 'none'으로 남는다
  } catch (e) { _blurOK = false; }
  return _blurOK;
}

/* ───────── 폰트 보장 (명세 §0 / 감사 F-10·F-11) ─────────
   캔버스는 폰트가 늦게 도착해도 스스로 다시 그리지 않는다.
   사용하는 모든 weight를 확보한 뒤에만 합성한다. */
let fontsReady = null;
function ensureFonts() {
  if (fontsReady) return fontsReady;
  fontsReady = (async () => {
    if (!document.fonts) return false;
    const weights = [600, 700, 800, 900];
    try {
      await Promise.race([
        Promise.all(weights.map(w => document.fonts.load(`${w} 40px Pretendard`, '오운완0123가나다'))),
        new Promise(r => setTimeout(r, 4000))
      ]);
      return document.fonts.check('800 40px Pretendard');
    } catch (e) { return false; }
  })();
  return fontsReady;
}

/* ───────── EXIF (DEC-004: 자동회전 감지 후 분기, 이중회전 차단) ───────── */
let autoRotates = null;
function detectAutoRotate() {
  if (autoRotates !== null) return Promise.resolve(autoRotates);
  return new Promise(res => {
    const img = new Image();
    let settled = false;
    const done = v => { if (settled) return; settled = true; autoRotates = v; res(v); };
    /* 판정 실패 시에는 "자동회전 안 함"으로 보고 직접 보정한다.
       (v0.2는 실패 시 true로 낙관해 비회전 브라우저에서 사진이 눕혔음 — 감사 F-31) */
    img.onload = () => done(img.naturalWidth === 1 && img.naturalHeight === 2);
    img.onerror = () => done(false);
    setTimeout(() => done(false), 800);
    /* 2×1 JPEG · Orientation=6 → 자동회전 브라우저에서는 1×2로 보인다 */
    img.src = 'data:image/jpeg;base64,/9j/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAYAAAAAAAD/2wCEAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==';
  });
}
function readOrientation(file) {
  return new Promise(res => {
    const rd = new FileReader();
    rd.onerror = () => res(1);
    rd.onload = e => {
      try {
        const v = new DataView(e.target.result);
        if (v.getUint16(0) !== 0xFFD8) return res(1);
        let off = 2;
        while (off + 4 <= v.byteLength) {
          const marker = v.getUint16(off);
          if (marker === 0xFFDA || marker === 0xFFD9) break;   // SOS/EOI — 이후는 엔트로피 데이터
          if ((marker & 0xFF00) !== 0xFF00) break;             // 마커 동기 상실
          off += 2;
          if (off + 2 > v.byteLength) break;
          const len = v.getUint16(off);
          if (len < 2) break;
          if (marker === 0xFFE1 && off + 8 <= v.byteLength && v.getUint32(off + 2) === 0x45786966) {
            const tiff = off + 8;
            if (tiff + 8 > v.byteLength) break;
            const little = v.getUint16(tiff) === 0x4949;
            const g16 = o => v.getUint16(o, little), g32 = o => v.getUint32(o, little);
            const ifd = tiff + g32(tiff + 4);
            if (ifd + 2 > v.byteLength) break;
            const n = g16(ifd);
            for (let i = 0; i < n; i++) {
              const ent = ifd + 2 + i * 12;
              if (ent + 12 > v.byteLength) break;
              if (g16(ent) === 0x0112) return res(g16(ent + 8) || 1);
            }
          }
          off += len;
        }
      } catch (err) { /* 파싱 실패 → 보정 없음 */ }
      res(1);
    };
    rd.readAsArrayBuffer(file.slice(0, 512 * 1024));
  });
}
/** 파일 → 방향이 바로잡힌 이미지 소스 */
async function loadOriented(file) {
  /* createImageBitmap이 EXIF를 처리하면 가장 빠르고 정확하다 */
  if (g.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) { /* 옵션 미지원 → 아래 경로 */ }
  }
  const auto = await detectAutoRotate();
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('이미지를 읽을 수 없습니다 (HEIC 등 미지원 형식일 수 있습니다)'));
      i.src = url;
    });
    if (auto) return img;                       // 이미 회전됨 — 추가 보정 금지
    const ori = await readOrientation(file);
    if (ori <= 1) return img;
    const w = img.naturalWidth, h = img.naturalHeight;
    const c = document.createElement('canvas');
    if (ori >= 5) { c.width = h; c.height = w; } else { c.width = w; c.height = h; }
    const x = c.getContext('2d');
    switch (ori) {
      case 2: x.transform(-1, 0, 0, 1, w, 0); break;
      case 3: x.transform(-1, 0, 0, -1, w, h); break;
      case 4: x.transform(1, 0, 0, -1, 0, h); break;
      case 5: x.transform(0, 1, 1, 0, 0, 0); break;
      case 6: x.transform(0, 1, -1, 0, h, 0); break;
      case 7: x.transform(0, -1, -1, 0, h, w); break;
      case 8: x.transform(0, -1, 1, 0, 0, w); break;
    }
    x.drawImage(img, 0, 0);
    return c;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

/* ───────── 톤 ───────── */
/** '#RRGGBB' → [r,g,b]. 형식이 아니면 null */
function hexRGB(h) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* light: 밝은 톤인지(글자는 검정). film/filmA: D 필름 템플릿의 바 색. */
function palette(tone, accent, custom) {
  if (tone === 'light') return {
    light: true, film: '#F7F7F7', filmA: 'rgba(247,247,247,0.94)',
    box: 'rgba(250,250,250,0.88)', border: 'rgba(0,0,0,0.16)',
    fg: '#111111', rule: 'rgba(0,0,0,0.18)',
    accent: accent || '#111111',
    shA: 0.55, shColor: '255,255,255',
    scrim: '255,255,255',
    stampBox: 'rgba(255,255,255,0.45)', stampBorder: 'rgba(0,0,0,0.75)'
  };
  if (tone === 'accent') return {
    light: false, film: '#0C0C0C', filmA: 'rgba(12,12,12,0.94)',
    box: 'rgba(12,12,12,0.70)', border: 'rgba(255,255,255,0.20)',
    fg: '#FFFFFF', rule: 'rgba(255,255,255,0.22)',
    accent: accent || '#C8FF4D',
    shA: 0.6, shColor: '0,0,0',
    scrim: '0,0,0',
    stampBox: 'rgba(0,0,0,0.28)', stampBorder: 'rgba(255,255,255,0.9)'
  };
  if (tone === 'custom') {
    /* 사용자가 고른 색이 박스/바 배경이 되고, 글자색은 밝기에 따라 흑백 자동 결정 (4.5:1 유지) */
    const c = hexRGB(custom) || [12, 12, 12];
    const light = relLum(c[0], c[1], c[2]) > 0.4;
    const rgb = c.join(',');
    return {
      light, film: `rgb(${rgb})`, filmA: `rgba(${rgb},0.94)`,
      box: `rgba(${rgb},0.82)`, border: light ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.20)',
      fg: light ? '#111111' : '#FFFFFF', rule: light ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.22)',
      accent: light ? '#111111' : '#FFFFFF',
      shA: 0.55, shColor: light ? '255,255,255' : '0,0,0',
      scrim: light ? '255,255,255' : '0,0,0',
      stampBox: `rgba(${rgb},0.45)`, stampBorder: light ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.9)'
    };
  }
  return {  /* dark — 명세표 기본값 */
    light: false, film: '#0C0C0C', filmA: 'rgba(12,12,12,0.94)',
    box: 'rgba(12,12,12,0.68)', border: 'rgba(255,255,255,0.18)',
    fg: '#FFFFFF', rule: 'rgba(255,255,255,0.2)',
    accent: accent || '#FFFFFF',
    shA: 0.6, shColor: '0,0,0',
    scrim: '0,0,0',
    stampBox: 'rgba(0,0,0,0.28)', stampBorder: 'rgba(255,255,255,0.9)'
  };
}

/* ───────── 정보량 프리셋 ───────── */
const LEVELS = {
  full:   { date: 1, label: 1, items: 1, detail: 1, vol: 1, volfun: 1, dur: 1, streak: 1, logo: 1 },
  simple: { date: 1, label: 1, items: 1, detail: 0, vol: 0, volfun: 0, dur: 0, streak: 1, logo: 1 },
  mini:   { date: 1, label: 0, items: 0, detail: 0, vol: 0, volfun: 0, dur: 0, streak: 1, logo: 1 }
};
const FIELD_LABELS = {
  date: '날짜', label: '부위', items: '종목명', detail: '세트·무게',
  vol: '총 볼륨', volfun: '볼륨 비유', dur: '운동 시간', streak: '연속일수', logo: '앱 로고'
};
function levelFields(level) { return Object.assign({}, LEVELS[level] || LEVELS.full); }

/* ───────── 유틸 ───────── */
function roundRect(c, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function fmtDur(sec) {
  if (!sec) return '';
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  return h ? `${h}시간 ${m}분` : `${m}분`;
}
function fmtVol(v) { return v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 't' : v + 'kg'; }
/** 총 볼륨을 친숙한 사물로 환산 (Hevy 공유카드 벤치마크).
    "12,340kg"보다 "코끼리 2.5마리"가 훨씬 잘 퍼진다. */
const VOL_UNITS = [
  { kg: 5000, nm: '코끼리', unit: '마리' },
  { kg: 1500, nm: '승용차', unit: '대' },
  { kg: 250,  nm: '냉장고', unit: '대' },
  { kg: 80,   nm: '쌀 한 가마니', unit: '가마니', plain: true },
  { kg: 70,   nm: '성인', unit: '명' }
];
function volFun(v) {
  if (!v || v < 70) return '';
  for (const u of VOL_UNITS) {
    const c = v / u.kg;
    if (c < 1) continue;
    const r = c >= 10 ? Math.round(c) : Math.round(c * 10) / 10;
    return u.plain ? ('쌀 ' + r + '가마니') : (u.nm + ' ' + r + u.unit);
  }
  return '';
}

function relLum(r, gg, b) {
  const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b);
}
function contrastRatio(l1, l2) {
  const a = Math.max(l1, l2), b = Math.min(l1, l2);
  return (a + 0.05) / (b + 0.05);
}
/** 캔버스 특정 영역의 평균 휘도 — 4.5:1 게이트 실측 */
function regionLum(ctx, x, y, w, h) {
  x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y));
  w = Math.max(1, Math.min(Math.round(w), ctx.canvas.width - x));
  h = Math.max(1, Math.min(Math.round(h), ctx.canvas.height - y));
  let d;
  try { d = ctx.getImageData(x, y, w, h).data; } catch (e) { return 0.5; }
  let sum = 0, n = 0;
  const step = Math.max(4, Math.floor((w * h) / 4000)) * 4;
  for (let i = 0; i < d.length; i += step) { sum += relLum(d[i], d[i + 1], d[i + 2]); n++; }
  return n ? sum / n : 0.5;
}
function measureContrast(ctx, x, y, w, h, P, fast) {
  if (fast) return {};
  if (P.__transparent) return { contrast: null, note: '투명 배경 — 대비는 얹을 사진에 따라 달라집니다' };                        // 드래그 중에는 getImageData 리드백을 생략
  const lum = regionLum(ctx, x, y, w, h);
  const textLum = P.fg === '#FFFFFF' ? 1 : relLum(17, 17, 17);
  return { contrast: Math.round(contrastRatio(textLum, lum) * 100) / 100, bgLum: Math.round(lum * 1000) / 1000 };
}

/** 문자 단위 줄바꿈 — 한 항목이 폭보다 길면 잘라내지 않고 다음 줄로 넘긴다 (명세 §1) */
function breakLong(ctx, text, maxW) {
  const out = [];
  let cur = '';
  for (const ch of text) {
    const t = cur + ch;
    if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = ch; }
    else cur = t;
  }
  if (cur) out.push(cur);
  return out.length ? out : [text];
}

/* ───────── 종목 텍스트 ───────── */
function itemText(it, F) {
  if (!F.detail) return it.nm;
  let t = it.nm;
  if (it.unit === 'min' || it.unit === 'sec') {
    if (it.reps) t += ' ' + it.reps + (it.unit === 'min' ? '분' : '초');
  } else {
    if (it.setCnt) t += ' ' + it.setCnt + '×' + (it.reps || 0);
    if (it.kg) t += ' ' + it.kg + 'kg';
  }
  return t;
}

/* ══════════════════════════════════════════════════════════
   엔진
   ══════════════════════════════════════════════════════════ */
const Engine = {
  src: null, srcW: 0, srcH: 0,
  _baseKey: null, _base: null,
  _blurKey: null, _blur: null,
  lastBox: null, lastMetrics: null,

  setSource(src) {
    this.src = src;
    this.srcW = src.naturalWidth || src.width;
    this.srcH = src.naturalHeight || src.height;
    this._baseKey = null; this._base = null;
    this._blurKey = null; this._blur = null;
    return this;
  },
  clear() {
    if (this.src && this.src.close) { try { this.src.close(); } catch (e) {} }
    this.src = null; this._base = null; this._baseKey = null;
    this._blur = null; this._blurKey = null; this.lastBox = null;
  },

  /** 블러된 배경을 캐시한다.
      드래그 중 매 프레임 1080×1920 전체를 가우시안 블러하면 프레임 예산을 통째로 먹는다. */
  blurred(base, px) {
    const r = Math.max(1, Math.round(px));
    const key = this._baseKey + '|b' + r;
    if (this._blurKey === key && this._blur) return this._blur;
    const c = document.createElement('canvas');
    c.width = base.width; c.height = base.height;
    const x = c.getContext('2d');
    try { x.filter = `blur(${r}px)`; x.drawImage(base, 0, 0); x.filter = 'none'; }
    catch (e) { return null; }
    this._blur = c; this._blurKey = key;
    return c;
  },

  /** 비율 크롭 → 짧은 변 1080 베이스 (캐시)
      photoPos {x,y} ∈ [-1,1]: 크롭 창을 여유(잘리는 부분) 안에서 어디에 둘지. 0 = 가운데.
      photoSlack에는 각 축의 여유를 결과 캔버스 px로 남겨, 드래그 픽셀을 photoPos로 환산할 수 있게 한다. */
  photoSlack: { x: 0, y: 0 },
  base(ratio, mirror, photoPos) {
    const cl = v => Math.max(-1, Math.min(1, +v || 0));
    const px = photoPos ? cl(photoPos.x) : 0, py = photoPos ? cl(photoPos.y) : 0;
    const key = ratio + '|' + (mirror ? 1 : 0) + '|' + px.toFixed(3) + ',' + py.toFixed(3);
    if (this._baseKey === key && this._base) return this._base;
    let sw = this.srcW, sh = this.srcH, sx = 0, sy = 0;
    let slackX = 0, slackY = 0;
    if (ratio && ratio !== 'orig') {
      const [rw, rh] = ratio.split(':').map(Number);
      const t = rw / rh;
      if (sw / sh > t) { const nw = sh * t; slackX = sw - nw; sx = slackX * (0.5 + px * 0.5); sw = nw; }
      else { const nh = sw / t; slackY = sh - nh; sy = slackY * (0.5 + py * 0.5); sh = nh; }
    }
    const scale = SHORT / Math.min(sw, sh);
    this.photoSlack = { x: slackX * scale, y: slackY * scale };
    const W = Math.max(1, Math.round(sw * scale)), H = Math.max(1, Math.round(sh * scale));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    if (mirror) { x.translate(W, 0); x.scale(-1, 1); }
    x.drawImage(this.src, sx, sy, sw, sh, 0, 0, W, H);
    this._base = c; this._baseKey = key;
    return c;
  },

  render(canvas, opts) {
    const t0 = performance.now();
    const o = Object.assign({
      level: 'full', tmpl: 'A', ratio: 'orig', tone: 'dark', accent: '#FFFFFF',
      fields: null, scale: 1, pos: { x: 0, y: 0 }, photoPos: { x: 0, y: 0 }, customColor: '',
      mirror: false, data: {}, fast: false, transparent: false
    }, opts);
    const F = o.fields || levelFields(o.level);
    const base = this.base(o.ratio, o.mirror, o.photoPos);
    const W = base.width, H = base.height;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.textBaseline = 'alphabetic';
    ctx.clearRect(0, 0, W, H);
    if (!o.transparent) ctx.drawImage(base, 0, 0);

    const K = makeK(ctx, W, H, o, F, base);
    let box;
    if (o.tmpl === 'B') box = drawB(K);
    else if (o.tmpl === 'C') box = drawC(K);
    else if (o.tmpl === 'D') box = drawD(K);
    else box = drawA(K);

    this.lastBox = box || null;
    this.lastMetrics = Object.assign({ ms: Math.round(performance.now() - t0), W, H },
      (box && box.metrics) || {});
    return this.lastMetrics;
  }
};

/** 렌더 컨텍스트 헬퍼.
    u(명세 px → 실제 px 배율)는 프로퍼티다 — 레이아웃이 넘칠 때 템플릿이 직접 줄인다. */
function makeK(ctx, W, H, o, F, base) {
  const SS = Math.min(W, H), LS = Math.max(W, H);
  const P = palette(o.tone, o.accent, o.customColor);
  P.__transparent = !!o.transparent;
  return {
    ctx, W, H, SS, LS, P, F, o, base, data: o.data,
    u: (SS / BASE_UNIT) * (o.scale || 1),
    font(px, wt) { ctx.font = `${wt} ${Math.max(8, px * this.u)}px Pretendard, -apple-system, sans-serif`; },
    w(t) { return ctx.measureText(t).width; },
    /** maxW 안에 들어갈 때까지 폰트를 줄이고, 최종 적용된 명세 px를 돌려준다 */
    fitFont(text, basePx, wt, maxW, minPx) {
      let px = basePx, floor = minPx || 18, guard = 0;
      this.font(px, wt);
      while (px > floor && ctx.measureText(text).width > maxW && guard++ < 200) {
        px -= 1; this.font(px, wt);
      }
      return px;
    },
    sh(blur, alpha, oy) {
      ctx.shadowColor = `rgba(${P.shColor},${alpha != null ? alpha : P.shA})`;
      ctx.shadowBlur = blur * this.u; ctx.shadowOffsetY = (oy == null ? 1 : oy) * this.u; ctx.shadowOffsetX = 0;
    },
    nosh() { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; },
    tracked(text, x, y, track) {
      let cx = x;
      for (const ch of text) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + track * this.u; }
      return cx - x - track * this.u;
    },
    trackedW(text, track) {
      let w = 0;
      for (const ch of text) w += ctx.measureText(ch).width + track * this.u;
      return Math.max(0, w - track * this.u);
    }
  };
}

/* ══════════════════ A · 하단 바 (명세표 §1) ══════════════════
   측정 → 배치 → 렌더 단일 패스. 넘치면 폰트 축소 → "외 N종목"으로 후퇴.  */
function drawA(K) {
  const { ctx, W, H, SS, P, F, data, o, base } = K;
  const allItems = F.items ? (data.items || []) : [];

  const mx = SS * 0.03, mb = SS * 0.035, r = SS * 0.04;
  const barW = W - mx * 2;
  const maxBarH = H * 0.52;                       // 사진을 절반 넘게 덮지 않는다
  const u0 = K.u;

  /* ── 측정: ① 종목 폰트 축소 → ② 항목 수 축소(외 N종목) → ③ 전체 배율 축소 ── */
  let plan = null, PT, PLR, PB, innerW, exFs, shrink = 1, fitted = false;
  for (let pass = 0; pass < 14 && !fitted; pass++) {
    K.u = u0 * shrink;
    PT = 12 * 2.77 * K.u; PLR = 14 * 2.77 * K.u; PB = 10 * 2.77 * K.u;   // 390 기준 → 1080 환산
    innerW = barW - PLR * 2;
    exFs = allItems.length >= 10 ? 32 : (allItems.length >= 7 ? 34 : 36);

    for (let a = 0; a < 8; a++) {
      plan = layoutA(K, allItems, innerW, exFs, PT, PB, null);
      if (plan.barH <= maxBarH) { fitted = true; break; }
      if (exFs > 28) { exFs -= 2; continue; }
      /* 폰트 하한 도달 — 들어가는 최대 항목 수를 이분 탐색해서 나머지는 "외 N종목" (CR-1) */
      if (allItems.length > 1) {
        let lo = 1, hi = allItems.length, best = 0;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          const p2 = layoutA(K, allItems, innerW, exFs, PT, PB, mid);
          if (p2.barH <= maxBarH) { best = mid; lo = mid + 1; } else hi = mid - 1;
        }
        if (best > 0) { plan = layoutA(K, allItems, innerW, exFs, PT, PB, best); fitted = true; }
      }
      break;
    }
    if (!fitted) shrink *= 0.88;                  // 날짜·로고·패딩까지 줄여야 하는 경우
    if (shrink < 0.35) { K.u = u0 * shrink; break; }
  }
  if (!plan) plan = layoutA(K, allItems, innerW, exFs, PT, PB, null);

  /* ── 배치 ── */
  /* 드래그해도 바 전체가 캔버스 안에 머문다 — 오버레이가 잘리면 이 앱의 존재 이유가 사라진다 */
  let bx = mx + (o.pos.x || 0) * W;
  let by = H - mb - plan.barH + (o.pos.y || 0) * H;
  bx = Math.max(0, Math.min(bx, Math.max(0, W - barW)));
  by = Math.max(0, Math.min(by, Math.max(0, H - plan.barH)));

  /* ── 배경 (명세 §1: blur 8px + 박스 + 1.5px 테두리) ── */
  ctx.save();
  roundRect(ctx, bx, by, barW, plan.barH, r); ctx.clip();
  const bl = (!o.transparent && blurSupported()) ? Engine.blurred(base, 8 * K.u) : null;
  if (bl) {
    ctx.drawImage(bl, 0, 0);
    ctx.fillStyle = P.box;
  } else {
    /* 블러 미지원 폴백 — 불투명도를 올려 가독성 확보 */
    ctx.fillStyle = P.box.replace(/[\d.]+\)$/, o.transparent ? '0.90)' : '0.84)');
  }
  ctx.fillRect(bx, by, barW, plan.barH);
  ctx.restore();
  ctx.lineWidth = Math.max(1.5, 1.5 * K.u);
  ctx.strokeStyle = P.border;
  roundRect(ctx, bx, by, barW, plan.barH, r); ctx.stroke();

  /* ── 렌더 (측정과 같은 산식으로 y를 누적) ── */
  const x = bx + PLR;
  let y = by + PT;
  K.sh(4, 0.6);

  if (plan.head) {
    y += plan.headAsc;
    ctx.fillStyle = o.tone === 'accent' ? P.accent : P.fg;
    if (F.date && data.date) {
      K.font(42, 800);
      const dw = K.trackedW(data.date, 0.8);          // 명세 §1: 자간 0.8px
      K.tracked(data.date, x, y, 0.8);
      if (F.label && data.label) {
        ctx.fillStyle = P.fg; K.font(35, 700);
        const lbl = fitOne(K, data.label, innerW - dw - 24 * K.u);
        ctx.fillText(lbl, x + dw + 24 * K.u, y);
      }
    } else if (F.label && data.label) {
      K.font(42, 800); ctx.fillText(fitOne(K, data.label, innerW), x, y);
    }
    y += plan.headH - plan.headAsc;
  }

  if (plan.lines.length) {
    if (plan.head) {
      K.nosh();
      ctx.fillStyle = P.rule;
      ctx.fillRect(x, y + plan.ruleGap, innerW, Math.max(1.5, 1.5 * K.u));
      K.sh(4, 0.6);
      y += plan.ruleH;
    }
    y += plan.exAsc;
    plan.lines.forEach(ln => {
      let lx = x;
      ln.forEach(seg => {
        if (seg.mark) {
          ctx.fillStyle = o.tone === 'accent' ? P.accent : P.fg;
          K.font(Math.round(exFs * 0.82), 900);       // 명세 §1: ✓ 900굵기 82%
          ctx.fillText(seg.mark, lx, y);
          lx += K.w(seg.mark + ' ');
        }
        ctx.fillStyle = P.fg;
        K.font(exFs, 600);
        ctx.fillText(seg.t, lx, y);
        lx += K.w(seg.t) + plan.gapX;
      });
      y += plan.lineH * K.u;
    });
    y += (plan.exH - plan.exAsc - plan.lines.length * plan.lineH * K.u);
  }

  if (plan.foot) {
    if (plan.head || plan.lines.length) {
      K.nosh();
      ctx.fillStyle = P.rule;
      ctx.fillRect(x, y + plan.ruleGap, innerW, Math.max(1.5, 1.5 * K.u));
      K.sh(4, 0.6);
      y += plan.ruleH;
    }
    const fy = by + plan.barH - PB - 4 * K.u;
    const right = bx + barW - PLR;
    ctx.fillStyle = P.fg;
    /* 우측 D+n 자리를 먼저 확보하고, 남는 폭 안에서 로고·볼륨을 배치한다 */
    let streakW = 0, streakTxt = '';
    if (F.streak) {
      streakTxt = 'D+' + (data.streak || 0);
      K.fitFont(streakTxt, 31, 800, innerW * 0.4, 18);
      streakW = K.w(streakTxt) + 18 * K.u;
    }
    let lx = x;
    const leftMax = right - streakW;
    if (F.logo) {
      const logo = data.logo || '오운완';
      K.fitFont(logo, 30, 800, Math.max(20, leftMax - lx), 18);
      lx += K.tracked(logo, lx, fy, 2) + 22 * K.u;
    }
    const mids = [];
    if (F.vol && data.vol) mids.push(fmtVol(data.vol));
    if (F.volfun && data.vol) { const vf = volFun(data.vol); if (vf) mids.push(vf); }
    if (F.dur && data.dur) mids.push(fmtDur(data.dur));
    if (mids.length && lx < leftMax - 10 * K.u) {
      let mt = mids.join('  ·  ');
      K.fitFont(mt, 29, 600, leftMax - lx, 16);
      if (K.w(mt) > leftMax - lx) mt = fitOne(K, mt, leftMax - lx);
      ctx.fillStyle = P.fg; ctx.fillText(mt, lx, fy);
    }
    if (F.streak) {
      K.fitFont(streakTxt, 31, 800, innerW * 0.4, 18);
      ctx.fillStyle = o.tone === 'accent' ? P.accent : P.fg;
      ctx.fillText(streakTxt, right - K.w(streakTxt), fy);
    }
  }
  K.nosh();

  return { x: bx, y: by, w: barW, h: plan.barH,
           appliedPos: { x: (bx - mx) / W, y: (by - (H - mb - plan.barH)) / H },
           metrics: Object.assign(measureContrast(ctx, bx, by, barW, plan.barH, P, o.fast),
                                  { items: allItems.length, shown: plan.shown, fontPx: exFs }) };
}

/** A 템플릿 레이아웃 계산 — 렌더와 동일한 산식 (이중 관리 금지) */
function layoutA(K, items, innerW, exFs, PT, PB, limit) {
  const { ctx, F, data } = K;
  const u = K.u;
  const gapX = 33 * u;
  const lineH = exFs + 11;                       // 명세 §1: 항목 세로 간격 4(390) ≈ 11px(1080)
  const use = limit != null ? items.slice(0, limit) : items;
  const rest = items.length - use.length;

  K.font(exFs, 600);
  const lines = [];
  if (use.length) {
    let cur = [], curW = 0;
    const push = () => { if (cur.length) { lines.push(cur); cur = []; curW = 0; } };
    use.forEach(it => {
      const mark = F.detail ? '✓' : '·';
      const body = itemText(it, F);
      const full = mark + ' ' + body;
      const w = ctx.measureText(full).width;
      if (w > innerW) {
        /* 한 줄에도 안 들어가는 긴 이름 — 문자 단위로 쪼갠다 (말줄임 금지) */
        push();
        const parts = breakLong(ctx, body, innerW - ctx.measureText(mark + ' ').width);
        parts.forEach((p, i) => lines.push([{ mark: i === 0 ? mark : '', t: p }]));
        return;
      }
      if (curW + w > innerW && cur.length) push();
      cur.push({ mark, t: body });
      curW += w + gapX;
    });
    push();
    if (rest > 0) lines.push([{ mark: '', t: `외 ${rest}종목` }]);
  }

  const head = !!(F.date || F.label);
  const headAsc = 42 * u * 0.78;
  const headH = 42 * u * 1.12;
  const ruleGap = 14 * u;
  const ruleH = 14 * u + Math.max(1.5, 1.5 * u) + 16 * u;
  const exAsc = exFs * u * 0.8;
  const exH = lines.length ? (exAsc + lines.length * lineH * u - exFs * u * 0.2) : 0;
  const footFields = F.logo || (F.vol && data.vol) || (F.volfun && data.vol) || (F.dur && data.dur) || F.streak;
  const footH = footFields ? 31 * u * 1.4 : 0;

  let barH = PT + PB;
  if (head) barH += headH;
  if (lines.length) barH += (head ? ruleH : 0) + exH;
  if (footFields) barH += ((head || lines.length) ? ruleH : 0) + footH;
  barH = Math.max(barH, 62 * u);

  return { barH, lines, lineH, gapX, head, headH, headAsc, ruleGap, ruleH,
           exH, exAsc, foot: footFields, footH, shown: use.length, rest };
}
/** 한 줄 안에 넣기 위한 최소 축약 (라벨 등 짧은 보조 텍스트에만) */
function fitOne(K, t, maxW) {
  if (maxW <= 0) return '';
  if (K.w(t) <= maxW) return t;
  let s = t;
  while (s.length > 1 && K.w(s + '…') > maxW) s = s.slice(0, -1);
  return s + '…';
}

/* ══════════════════ B · 사이드 리스트 (명세표 §2) ══════════════════ */
function drawB(K) {
  const { ctx, W, H, SS, LS, u, P, F, data, o } = K;
  const allItems = F.items ? (data.items || []) : [];
  /* 드래그로 화면 밖까지 밀어낼 수 없게 클램프 */
  const x0 = Math.max(SS * 0.02, Math.min(SS * 0.043 + (o.pos.x || 0) * W, W * 0.52));
  const y0 = Math.max(SS * 0.02, Math.min(LS * 0.039 + (o.pos.y || 0) * H, H * 0.55));

  const n = allItems.length;
  let twoCol = n >= 10;
  let fs = twoCol ? 32 : (n >= 7 ? 35 : 36);          // 명세 §2: 32px 하한
  const rightMargin = SS * 0.04;
  const availW = W - x0 - rightMargin;

  /* 열 폭에 맞을 때까지 축소 → 그래도 안 되면 1열로 후퇴 (감사 F-14).
     확대(scale) 상태에서도 반드시 수렴하도록 넉넉한 가드를 둔다. */
  let colW, texts = allItems.map(it => itemText(it, F));
  let guard = 0;
  while (guard++ < 60) {
    colW = twoCol ? availW / 2 : availW;
    K.font(fs, 600);
    if (!texts.some(t => ctx.measureText(t).width + 22 * u > colW)) break;
    if (fs > 32) { fs -= 1; continue; }
    if (twoCol) { twoCol = false; fs = 35; continue; }
    /* 1열 32px에도 안 들어감 — 개별 항목만 축약 (마지막 수단) */
    texts = texts.map(t => fitOne(K, t, colW - 22 * u));
    break;
  }

  const lineH = (fs + 26) * u;
  const headH = (F.date ? 70 * u + (F.label && data.label ? 40 * u : 0) + 46 * u : 0);
  /* 하단 요약도 캔버스 안에 머물러야 한다 (드래그 클램프) */
  const footY = Math.max(H * 0.34,
                Math.min(H - LS * 0.039 + (o.pos.y || 0) * H, H - 18 * u));
  const availH = Math.max(lineH, footY - (y0 + headH) - 40 * u);
  let maxRows = Math.max(1, Math.floor(availH / lineH));
  let rows = twoCol ? Math.ceil(n / 2) : n;
  let shown = n, rest = 0;
  if (rows > maxRows) {
    shown = twoCol ? (maxRows - 1) * 2 : maxRows - 1;
    shown = Math.max(1, Math.min(shown, n));
    rest = n - shown;
    rows = twoCol ? Math.ceil(shown / 2) + 1 : shown + 1;
  }

  /* 밝은 사진 생존 보강 — 명세는 박스 없음이 원칙이므로 필요할 때만 최소 강도로 */
  const blockH = headH + rows * lineH + 60 * u;
  let needScrim;
  if (o.transparent) needScrim = false;
  else if (o.fast && Engine._lastScrim != null) needScrim = Engine._lastScrim;
  else {
    const lum = regionLum(ctx, x0 - 12 * u, Math.max(0, y0 - 12 * u), Math.min(availW + 24 * u, W), blockH);
    needScrim = P.light ? lum < 0.34 : lum > 0.42;
    Engine._lastScrim = needScrim;
  }
  if (needScrim) {
    /* 사진 전체가 아니라 글자 블록 뒤에만, 톤과 무관한 중성색(검정/흰색)으로 —
       "색상을 바꾸면 사진이 변한다"는 피드백의 원인이 전체 스크림이었다 */
    const sc = P.light ? '255,255,255' : '0,0,0';
    const sx = Math.max(0, x0 - 28 * u), sy = Math.max(0, y0 - 28 * u);
    const sw = Math.min(W - sx, availW + 56 * u), sh = Math.min(H - sy, blockH + 20 * u);
    const gd = ctx.createLinearGradient(0, sy, 0, sy + sh);
    gd.addColorStop(0, `rgba(${sc},0.34)`);
    gd.addColorStop(0.7, `rgba(${sc},0.22)`);
    gd.addColorStop(1, `rgba(${sc},0)`);
    ctx.fillStyle = gd; ctx.fillRect(sx, sy, sw, sh);
  }

  let y = y0;
  if (F.date) {
    ctx.fillStyle = o.tone === 'accent' ? P.accent : P.fg;
    K.fitFont(data.date || '', 72, 900, availW, 34);   // 확대·이동해도 폭 안에 유지
    y += 70 * u;
    K.sh(12, 0.85, 2); ctx.fillText(data.date || '', x0, y);     // 명세 §2: 이중 그림자
    K.sh(2, 0.6, 0); ctx.fillText(data.date || '', x0, y);
    if (F.label && data.label) {
      ctx.fillStyle = P.fg; K.font(34, 700);
      K.sh(8, 0.85, 1); ctx.fillText(fitOne(K, data.label, availW), x0, y + 40 * u);
      y += 40 * u;
    }
    y += 46 * u;
  } else if (F.label && data.label) {
    y += 52 * u; ctx.fillStyle = P.fg; K.font(48, 800);
    K.sh(10, 0.85, 2); ctx.fillText(fitOne(K, data.label, availW), x0, y);
    y += 40 * u;
  }
  K.nosh();

  const drawRow = (t, col, row, accentDash) => {
    const ix = x0 + col * colW, iy = y + row * lineH;
    ctx.fillStyle = accentDash && o.tone === 'accent' ? P.accent : P.fg;
    K.sh(8, 0.9, 1);
    ctx.fillRect(ix, iy - fs * 0.32 * u, 10 * u, Math.max(2, 2 * u));   // 대시 10×2 (명세 §2)
    ctx.fillStyle = P.fg;
    K.font(fs, 600);
    K.sh(8, 0.9, 1); ctx.fillText(t, ix + 22 * u, iy);
    K.sh(3, 0.7, 0); ctx.fillText(t, ix + 22 * u, iy);
    K.nosh();
  };
  texts.slice(0, shown).forEach((t, i) => {
    drawRow(t, twoCol ? i % 2 : 0, twoCol ? Math.floor(i / 2) : i, true);
  });
  if (rest > 0) {
    const i = shown;
    drawRow(`외 ${rest}종목`, 0, twoCol ? Math.ceil(shown / 2) : i, false);
  }
  y += rows * lineH;

  const foot = [];
  if (F.logo) foot.push(data.logo || '오운완');
  if (F.vol && data.vol) foot.push(fmtVol(data.vol));
  if (F.volfun && data.vol) { const vf = volFun(data.vol); if (vf) foot.push(vf); }
  if (F.dur && data.dur) foot.push(fmtDur(data.dur));
  if (F.streak) foot.push('D+' + (data.streak || 0));
  if (foot.length) {
    /* 요약 줄은 캔버스 바닥이 아니라 종목 목록 바로 아래에 붙인다 — 글자를 줄여도 한 덩어리로 보이게.
       (footY는 위에서 "몇 줄까지 들어가나"를 계산하는 상한으로만 쓴다) */
    const fy = Math.min(y + 28 * u, footY);
    ctx.fillStyle = P.fg;
    let ft = foot.join('   ');
    K.fitFont(ft, 30, 800, availW, 18);
    if (K.w(ft) > availW) ft = fitOne(K, ft, availW);
    K.sh(8, 0.9, 1); ctx.fillText(ft, x0, fy);
    K.nosh();
    y = fy;
  }

  return { x: x0 - 14 * u, y: y0 - 20 * u, w: availW, h: Math.max(80 * u, y - y0 + 30 * u),
           appliedPos: { x: (x0 - SS * 0.043) / W, y: (y0 - LS * 0.039) / H },
           metrics: Object.assign(measureContrast(ctx, x0, y0, availW, Math.max(80 * u, y - y0), P, o.fast),
                                  { items: n, shown, fontPx: fs, cols: twoCol ? 2 : 1, scrim: needScrim }) };
}

/* ══════════════════ C · 미니멀 스탬프 (명세표 §3) ══════════════════ */
function drawC(K) {
  const { ctx, W, H, SS, u, P, F, data, o, base } = K;
  const m = SS * 0.043;
  const padX = 12 * 2.77 * u, padY = 7 * 2.77 * u;

  K.font(43, 900);
  const mainTxt = (F.date && data.date) ? data.date : (data.logo || '오운완');
  const dw = K.trackedW(mainTxt, 1.5);

  const subParts = [];
  if (F.label && data.label) subParts.push(data.label);
  if (F.items && (data.items || []).length) subParts.push(data.items.length + '종목');
  if (F.vol && data.vol) subParts.push(fmtVol(data.vol));
  if (F.volfun && data.vol) { const vf = volFun(data.vol); if (vf) subParts.push(vf); }
  if (F.dur && data.dur) subParts.push(fmtDur(data.dur));
  if (F.streak) subParts.push('D+' + (data.streak || 0));
  let sub = subParts.join(' · ');
  K.font(31, 600);
  const maxW = W - m * 2 - padX * 2;
  if (sub) sub = fitOne(K, sub, maxW);
  const sw = sub ? K.w(sub) : 0;

  const bw = Math.min(W - m * 2, Math.max(dw, sw) + padX * 2);
  const bh = padY * 2 + 43 * u + (sub ? 14 * u + 31 * u : 0);
  let bx = W - m - bw + (o.pos.x || 0) * W;
  let by = H - m - bh + (o.pos.y || 0) * H;
  bx = Math.max(0, Math.min(bx, W - bw));
  by = Math.max(0, Math.min(by, H - bh));

  ctx.save();
  roundRect(ctx, bx, by, bw, bh, 10 * u); ctx.clip();
  const blC = (!o.transparent && blurSupported()) ? Engine.blurred(base, 3 * u) : null;
  if (blC) {
    ctx.drawImage(blC, 0, 0);
    ctx.fillStyle = P.stampBox;
  } else {
    ctx.fillStyle = P.stampBox.replace(/[\d.]+\)$/, o.transparent ? '0.80)' : '0.5)');
  }
  ctx.fillRect(bx, by, bw, bh);
  ctx.restore();
  ctx.lineWidth = Math.max(1.5, 1.5 * u);
  ctx.strokeStyle = P.stampBorder;
  roundRect(ctx, bx, by, bw, bh, 10 * u); ctx.stroke();

  K.sh(4, 0.6);
  ctx.fillStyle = o.tone === 'accent' ? P.accent : P.fg;
  K.font(43, 900);
  K.tracked(mainTxt, bx + padX, by + padY + 40 * u, 1.5);
  if (sub) {
    ctx.fillStyle = P.fg;                         /* 명세 §3: 100% 불투명 (85% 폐기) */
    K.font(31, 600);
    ctx.fillText(sub, bx + padX, by + bh - padY - 6 * u);
  }
  K.nosh();

  return { x: bx, y: by, w: bw, h: bh,
           appliedPos: { x: (bx - (W - m - bw)) / W, y: (by - (H - m - bh)) / H },
           metrics: measureContrast(ctx, bx, by, bw, bh, P, o.fast) };
}

/* ══════════════════ D · 필름 (신규) ══════════════════
   종목이 많아도 사진을 가리지 않는다. 단색 바 위 텍스트라 대비가 항상 확보된다. */
function drawD(K) {
  const { ctx, W, H, SS, u, P, F, data, o, base } = K;
  const items = F.items ? (data.items || []) : [];
  const n = items.length;

  const barTop = SS * 0.115;
  let cols = n >= 9 ? 3 : (n >= 5 ? 2 : 1);
  let exFs = cols === 3 ? 27 : (cols === 2 ? 30 : 33);
  const pad = SS * 0.045;
  const availW = W - pad * 2;

  /* 열 폭 맞춤 — 확대 상태에서도 수렴하도록 가드 기반 루프 */
  let texts = items.map(it => itemText(it, F));
  let guard = 0;
  while (guard++ < 60) {
    K.font(exFs, 600);
    const colW = availW / cols;
    if (!texts.some(t => K.w(t) > colW - 16 * u)) break;
    if (exFs > 22) { exFs -= 1; continue; }
    if (cols > 1) { cols--; exFs = cols === 2 ? 30 : 33; continue; }
    texts = texts.map(t => fitOne(K, t, colW - 16 * u));
    break;
  }
  const lineH = (exFs + 13) * u;
  const labelH = (F.label && data.label) ? 30 * u : 0;
  const topPad = SS * 0.052;
  const bottomReserve = SS * 0.038 + 34 * u;      // 로고 줄 자리
  const capBot = H * 0.45;                        // 사진을 절반 가까이 잡아먹지 않는다

  let rows = Math.ceil(n / cols), shown = n, rest = 0;
  let barBot = Math.max(SS * 0.16, topPad + labelH + rows * lineH + bottomReserve);
  if (barBot > capBot) {
    barBot = capBot;
    const maxRows = Math.max(1, Math.floor((capBot - topPad - labelH - bottomReserve) / lineH));
    if (rows > maxRows) {
      shown = Math.max(1, (maxRows - 1) * cols);
      if (shown >= n) { shown = n; rows = Math.ceil(n / cols); }
      else { rest = n - shown; rows = Math.ceil(shown / cols) + 1; }   // 마지막 줄 = 외 N종목
    }
  }

  const photoY = barTop, photoH = H - barTop - barBot;
  if (o.transparent) {
    ctx.fillStyle = P.filmA;
    ctx.fillRect(0, 0, W, barTop);
    ctx.fillRect(0, H - barBot, W, barBot);
  } else {
  ctx.fillStyle = P.film;
  ctx.fillRect(0, 0, W, H);
  if (photoH > 10) {
    const s = Math.max(W / base.width, photoH / base.height);
    const dw = base.width * s, dh = base.height * s;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, photoY, W, photoH); ctx.clip();
    ctx.drawImage(base, (W - dw) / 2, photoY + (photoH - dh) / 2, dw, dh);
    ctx.restore();
  }
  }

  const fg = P.light ? '#111111' : '#FFFFFF';
  /* 명세 §0: 반투명 텍스트 금지. 톤 차이는 불투명한 회색으로 표현한다. */
  const dim = P.light ? '#5A5A5A' : '#B4B4B4';
  const rule = P.light ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.55)';

  /* 상단 바 */
  ctx.fillStyle = fg;
  K.font(38, 800);
  const ty = barTop * 0.66;
  if (F.date && data.date) K.tracked(data.date, pad, ty, 1.2);
  if (F.streak) {
    K.font(34, 800);
    ctx.fillStyle = o.tone === 'accent' ? P.accent : fg;
    const t = 'D+' + (data.streak || 0);
    ctx.fillText(t, W - pad - K.w(t), ty);
  }
  ctx.fillStyle = rule;
  ctx.fillRect(pad, barTop - Math.max(1.5, 1.5 * u) - SS * 0.012, availW, Math.max(1.5, 1.5 * u));

  /* 하단 바 */
  let by = H - barBot + topPad;
  if (labelH) {
    ctx.fillStyle = o.tone === 'accent' ? P.accent : fg;
    K.font(36, 800); ctx.fillText(data.label, pad, by);
    const lw = K.w(data.label);
    const meta = [];
    if (F.vol && data.vol) meta.push(fmtVol(data.vol));
    if (F.volfun && data.vol) { const vf = volFun(data.vol); if (vf) meta.push(vf); }
    if (F.dur && data.dur) meta.push(fmtDur(data.dur));
    if (meta.length) {
      ctx.fillStyle = dim;
      const mx2 = pad + lw + 18 * u;
      const room = W - pad - mx2;
      let mt = meta.join('  ·  ');
      K.fitFont(mt, 28, 600, room, 16);
      if (K.w(mt) > room) mt = fitOne(K, mt, room);
      ctx.fillText(mt, mx2, by);
    }
    by += labelH;
  }
  if (n) {
    const colW = availW / cols;
    ctx.fillStyle = fg;
    K.font(exFs, 600);
    texts.slice(0, shown).forEach((t, i) => {
      const c = i % cols, r2 = Math.floor(i / cols);
      ctx.fillText(t, pad + c * colW, by + (r2 + 1) * lineH - lineH * 0.25);
    });
    if (rest > 0) {                                   /* CR-1: 잘라내는 건 마지막 수단 */
      ctx.fillStyle = dim;
      ctx.fillText(`외 ${rest}종목`, pad, by + rows * lineH - lineH * 0.25);
    }
  }
  if (F.logo) {
    ctx.fillStyle = dim; K.font(26, 800);
    K.tracked(data.logo || '오운완', pad, H - SS * 0.038, 2);
  }

  return { x: 0, y: H - barBot, w: W, h: barBot, fixed: true,
           metrics: { contrast: 21, items: n, shown: n, fontPx: exFs, cols,
                      note: '단색 바 위 텍스트 — 대비 항상 통과' } };
}

/* ───────── 내보내기 ───────── */
function toBlob(canvas, quality, type) {
  const mime = type || 'image/jpeg';
  return new Promise(res => {
    if (canvas.toBlob) canvas.toBlob(b => res(b), mime, quality || 0.92);
    else {
      try {
        const u = canvas.toDataURL(mime, quality || 0.92);
        const bin = atob(u.split(',')[1]);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        res(new Blob([arr], { type: mime }));
      } catch (e) { res(null); }
    }
  });
}
/** 캘린더 셀 썸네일 — 셀 비율 1:1.18 center-crop, 짧은 변 300px (CR F4-4a) */
function makeThumb(canvas, shortPx) {
  const target = shortPx || 300;
  const cellRatio = 1 / 1.18;                       // w/h
  const sw = canvas.width, sh = canvas.height;
  let cw = sw, ch = sh, sx = 0, sy = 0;
  if (sw / sh > cellRatio) { cw = sh * cellRatio; sx = (sw - cw) / 2; }
  else { ch = sw / cellRatio; sy = (sh - ch) / 2; }
  const c = document.createElement('canvas');
  c.width = target; c.height = Math.round(target / cellRatio);
  const x = c.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.drawImage(canvas, sx, sy, cw, ch, 0, 0, c.width, c.height);
  return c;
}

g.OW = g.OW || {};
Object.assign(g.OW, {
  Overlay: Engine,
  ensureFonts, loadOriented, detectAutoRotate, readOrientation,
  LEVELS, FIELD_LABELS, levelFields, palette, blurSupported,
  overlayToBlob: toBlob, makeThumb, fmtVol, fmtDur, volFun,
  contrastRatio, relLum, regionLum
});

})(window);
