/* يحفظ ملفات المنصة في الجهاز لتفتح بسرعة.
   ما لا يتغير (الخطوط، وصور الصفحات، والملفات ذات رقم النسخة) يُقرأ من الجهاز مباشرة،
   وما يتغير (الصفحة والمحتوى) يُطلب من الشبكة أولًا، والنسخة المحفوظة عند انقطاع الاتصال. */
var V = 'hm-v3';
var CORE = ['./', 'index.html', 'content.json',
  'fonts/UthmanicHafs_V22.ttf', 'fonts/LotusLotfi-Regular.ttf', 'fonts/LotusLotfi-Bold.ttf',
  'fonts/thmanyahsans-Medium.otf', 'fonts/thmanyahsans-Bold.otf', 'fonts/thmanyahserifdisplay-Bold.otf', 'icons/icon-192.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(V).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
function keep(req, r) { if (r && r.status === 200) { var c = r.clone(); caches.open(V).then(function (ca) { ca.put(req, c); }); } return r; }
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || e.request.headers.has('range')) return;
  var still = /\/(fonts|pages|icons)\//.test(u.pathname) || u.searchParams.has('v');
  if (still) {
    e.respondWith(caches.match(e.request).then(function (m) { return m || fetch(e.request).then(function (r) { return keep(e.request, r); }); }));
    return;
  }
  e.respondWith(fetch(e.request).then(function (r) { return keep(e.request, r); })
    .catch(function () { return caches.match(e.request).then(function (m) { return m || caches.match('index.html'); }); }));
});
