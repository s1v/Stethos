// Stethos Service Worker
// アプリを更新したら VERSION を変更してください（「更新があります」表示のきっかけになります）
// BUILD は自動更新（Issue → known-uuids の追加）で 1 ずつ増やされます
const APP_VERSION = '0.0.29';
const BUILD = 0;
const VERSION = `stethos-v${APP_VERSION}-${BUILD}`;
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/style.css', './css/themes/retro.css', './css/themes/terminal.css', './js/config/themes.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
  './js/app.js', './js/i18n.js', './js/i18n/en.js', './js/report.js', './js/version.js', './js/ble.js', './js/elm327.js', './js/obd.js', './js/storage.js', './js/ui.js', './js/connection.js', './js/vehicle.js', './js/poller.js',
  './js/screens/top.js', './js/screens/uuid-input.js', './js/screens/uuid-manage.js',
  './js/screens/home.js', './js/screens/status.js', './js/screens/dtc.js', './js/screens/mypage.js', './js/screens/settings.js', './js/screens/parts/presets.js', './js/screens/parts/pid-card.js', './js/screens/parts/widgets.js',
  './js/config/known-uuids.js', './js/config/units.js', './js/screens/parts/icons.js', './js/config/pids.js', './js/config/dtc-codes.js', './js/config/menu.js', './js/config/wmi.js',
  './js/debug/mock-adapter.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) =>
    // 1 件ずつ追加（debug フォルダを削除してもインストールが失敗しないように）
    Promise.all(ASSETS.map((a) => c.add(a).catch(() => {})))
  ));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
