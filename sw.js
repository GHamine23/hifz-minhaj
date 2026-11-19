/* يحفظ ملفات المنصة في الجهاز لتفتح بسرعة. المحتوى يُحدَّث من الشبكة أولًا. */
var V = 'hm-v2';
var CORE = ['./', 'index.html', 'app.css', 'app.js', 'api.js', 'rules.js', 'config.js', 'content.json',
  'fonts/UthmanicHafs_V22.ttf', 'fonts/LotusLotfi-Regular.ttf', 'fonts/LotusLotfi-Bold.ttf',
  'fonts/thmanyahsans-Medium.otf', 'fonts/thmanyahsans-Bold.otf', 'fonts/thmanyahserifdisplay-Bold.otf', 'icons/icon-192.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(V).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // الشبكة أولًا، والنسخة المحفوظة عند انقطاع الاتصال
  e.respondWith(fetch(e.request).then(function (r) { var c = r.clone(); caches.open(V).then(function (ca) { ca.put(e.request, c); }); return r; })
    .catch(function () { return caches.match(e.request).then(function (m) { return m || caches.match('index.html'); }); }));
});
