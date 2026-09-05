/* ══════════════════ native.js — 네이티브(안드로이드 앱) 접점 어댑터 ══════════════════
   웹 코드가 네이티브 기능을 쓰는 유일한 통로. 이 파일 밖에서는 Capacitor를 참조하지 않는다.

   원칙:
   - 브라우저(index.html 더블클릭)에서는 NATIVE.on이 false → 기존 웹 경로 그대로.
     이 파일이 없거나 로드에 실패해도 앱은 웹 방식으로 동작해야 한다.
   - 네이티브에서 실패하면 throw → 호출부가 웹 경로로 폴백하거나 사용자에게 알린다.
     조용히 삼키지 않는다 (산출물이 소리 없이 사라지는 것이 최악).

   앱 껍데기(Capacitor) 쪽 대응물:
   - GalleryPlugin.java — MediaStore로 갤러리/다운로드 저장 (Android 10+ 권한 불필요)
   - @capacitor/share, @capacitor/filesystem, @capacitor/camera (권한 요청용)          */

/* var 사용: <script> 태그·eval 하네스 양쪽에서 전역으로 보이게 한다 */
var NATIVE = (() => {
  const cap = () => window.Capacitor;
  const on = () => { try { return !!(cap() && cap().isNativePlatform()); } catch (e) { return false; } };
  const plug = name => {
    const p = cap() && cap().Plugins && cap().Plugins[name];
    if (!p) throw new Error('네이티브 모듈이 없습니다: ' + name);
    return p;
  };

  /** Blob → base64 (data: 접두사 제거) */
  function b64(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1]);
      r.onerror = () => rej(new Error('파일을 읽지 못했습니다'));
      r.readAsDataURL(blob);
    });
  }

  /** 사진을 기기 갤러리에 저장한다 (Pictures/오운완 앨범) */
  async function saveImage(blob, name, mime) {
    const data = await b64(blob);
    await plug('Gallery').saveImage({ data, name, mime: mime || 'image/jpeg' });
    return 'gallery';
  }

  /** 백업 JSON 등 일반 파일을 다운로드 폴더에 저장한다 */
  async function saveFile(blob, name, mime) {
    const data = await b64(blob);
    await plug('Gallery').saveFile({ data, name, mime: mime || 'application/json' });
    return 'download';
  }

  /** 네이티브 공유 시트. 파일 + 텍스트(해시태그).
      반환: 'share' 완료 · 'abort' 사용자가 취소 */
  async function shareImage(blob, name, mime, text) {
    const data = await b64(blob);
    const FS = plug('Filesystem');
    const w = await FS.writeFile({ path: name, data, directory: 'CACHE' });
    try {
      await plug('Share').share({ files: [w.uri], text: text || undefined, dialogTitle: '오운완 공유' });
      return 'share';
    } catch (e) {
      const m = String((e && e.message) || e).toLowerCase();
      if (m.includes('cancel') || m.includes('abort')) return 'abort';
      throw e;
    }
  }

  /** getUserMedia 전에 안드로이드 카메라 권한을 확보한다.
      거부돼도 throw하지 않는다 — getUserMedia가 실패하며 기존 안내(앨범 유도)가 뜬다. */
  async function ensureCamPermission() {
    try {
      const Cam = plug('Camera');
      const st = await Cam.checkPermissions();
      if (st.camera !== 'granted') await Cam.requestPermissions({ permissions: ['camera'] });
    } catch (e) { console.warn('[native] 카메라 권한 요청 실패', e); }
  }

  /** 안드로이드 하드웨어 뒤로가기. 리스너를 등록하면 Capacitor가 앱을 바로 끄지 않고 fn에 맡긴다. */
  function onBackButton(fn) {
    try { plug('App').addListener('backButton', () => fn()); }
    catch (e) { console.warn('[native] backButton 등록 실패', e); }
  }
  function exitApp() {
    try { plug('App').exitApp(); } catch (e) { console.warn('[native] exitApp 실패', e); }
  }
  /** 이 앱의 시스템 설정 화면(권한 페이지). 카메라 권한을 '다시 묻지 않음'으로 거부한 뒤의 유일한 복구 경로 */
  function openSettings() {
    try { plug('Gallery').openSettings().catch(e => console.warn('[native] openSettings', e)); }
    catch (e) { console.warn('[native] openSettings', e); }
  }

  /** 휴식 타이머를 상단 알림에 띄운다(백그라운드에서도 카운트다운 + 종료 알림).
      running=false면 알림을 내린다. 실패해도 앱 동작에는 영향 없다. */
  function restTimer(st) {
    try {
      plug('RestTimer').update({ running: !!st.running, endAt: Math.round(st.endAt || 0), label: st.label || '휴식 중' })
        .catch(e => console.warn('[native] restTimer', e));
    } catch (e) { console.warn('[native] restTimer', e); }
  }

  return {
    get on() { return on(); },
    saveImage, saveFile, shareImage, ensureCamPermission, onBackButton, exitApp, openSettings, restTimer,
  };
})();
