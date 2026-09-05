/* sw.js — 오프라인 동작 (PRD 비기능: F1~F4 전부 네트워크 없이)
   file:// 로 열면 등록되지 않습니다. 서버(또는 스토어 래핑)에서만 활성화됩니다. */
const CACHE = 'owwan-v1.0.19';
/* 처음 설치 때 통째로 받아두는 파일 — 하나라도 빠지면 오프라인 첫 실행이 깨진다 (native.js 누락 시 앱 전체 정지) */
const ASSETS = ['./', './index.html', './styles.css', './themes2.css', './v2.css', './native.js', './data.js', './demo.js', './store.js', './overlay.js', './app.js',
  './manifest.webmanifest', './icon.svg', './icon-192.png',
  './fonts/Pretendard-Regular.woff2', './fonts/Pretendard-SemiBold.woff2', './fonts/Pretendard-Bold.woff2',
  './fonts/Pretendard-ExtraBold.woff2', './fonts/Pretendard-Black.woff2',
  './demo/01_어두운헬스장_기본.jpg', './demo/02_밝은창가_흰벽.jpg', './demo/03_야외_주간.jpg', './demo/04_어두운밤_홈트.jpg', './demo/05_네온조명_짐.jpg'];

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
      if (res && res.status === 200 && req.url.startsWith(self.location.origin)) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    /* 오프라인 폴백은 화면 이동에만 — 이미지 요청에 HTML을 돌려주면 깨진 그림이 된다 */
    }).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
