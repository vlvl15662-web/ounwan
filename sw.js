/* sw.js — 오프라인 동작 (PRD 비기능: F1~F4 전부 네트워크 없이)
   file:// 로 열면 등록되지 않습니다. 서버(또는 스토어 래핑)에서만 활성화됩니다. */
const CACHE = 'owwan-v1.0.10';
/* 처음 설치 때 통째로 받아두는 파일 — 하나라도 빠지면 오프라인 첫 실행이 깨진다 (native.js 누락 시 앱 전체 정지) */
const ASSETS = ['./', './index.html', './styles.css', './native.js', './data.js', './store.js', './overlay.js', './app.js',
  './manifest.webmanifest', './icon.svg', './icon-192.png',
  './fonts/Pretendard-Regular.woff2', './fonts/Pretendard-SemiBold.woff2', './fonts/Pretendard-Bold.woff2',
  './fonts/Pretendard-ExtraBold.woff2', './fonts/Pretendard-Black.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      // 폰트 CDN도 한 번 받으면 캐시해 오프라인에서 살린다
      if (res && res.status === 200 && (req.url.startsWith(self.location.origin) || req.url.includes('jsdelivr'))) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
