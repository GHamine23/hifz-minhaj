/* الاتصال بالخادم. في وضع التجربة (بلا رابط خادم أو مع ?demo) يعمل خادم وهمي داخل الجهاز. */
var Api = (function () {
  var cfg = window.HM_CONFIG || {};
  var qs = new URLSearchParams(location.search);
  var demo = !cfg.api || qs.has('demo');

  function store(k, v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null');
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) { return null; }
  }

  /* الهوية: داخل تيليجرام نرسل بيانات التطبيق المصغّر الموقّعة، وخارجه الرمز الشخصي من الرابط */
  var Auth = {
    init: function () {
      var m = location.hash.match(/(?:^#|&)t=([A-Za-z0-9._-]+)/);
      if (m) {
        store('hm.token', m[1]);
        history.replaceState(null, '', location.pathname + location.search + '#home');
      }
    },
    get: function () {
      var tg = window.Telegram && Telegram.WebApp && Telegram.WebApp.initData;
      if (tg) return { tg: tg };
      var t = store('hm.token');
      return t ? { token: t } : null;
    },
    has: function () { return demo || !!Auth.get(); }
  };

  function tz() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; }
  }

  function real(a, body) {
    var payload = Object.assign({ a: a, auth: Auth.get(), tz: tz() }, body || {});
    return fetch(cfg.api, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.ok) { var e = new Error(j.error || 'تعذر الاتصال'); e.code = j.code; throw e; }
      return j;
    });
  }

  /* ---------- خادم التجربة ---------- */
  function localToday() {
    if (qs.get('today')) return qs.get('today');
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  var FAKE = [
    ['متسابق أ', 'إثمار ٢', 50], ['متسابق ب', 'إثمار ٣', 45], ['متسابق ج', 'إثمار ٢', 40], ['متسابق د', 'إثمار ٣', 40],
    ['متسابق هـ', 'إثمار ٢', 35], ['متسابق و', 'إثمار ٣', 30], ['متسابق ز', 'إثمار ٢', 25], ['متسابق ح', 'إثمار ٣', 20],
    ['متسابق ط', 'إثمار ٢', 20], ['متسابق ي', 'إثمار ٣', 15], ['متسابق ك', 'إثمار ١', 10], ['متسابق ل', 'إثمار ١', 5]
  ];
  /* بيانات إدارة وهمية ثابتة للتجربة: أسماء مصطنعة لا تخص أحدًا */
  function demoAdmin() {
    var D = window.HM_DATA || { wards: [] }, today = localToday() || new Date().toISOString().slice(0, 10);
    var names = ['متسابق أ', 'متسابق ب', 'متسابق ج', 'متسابق د', 'متسابق هـ', 'متسابق و', 'متسابق ز', 'متسابق ح', 'متسابق ط', 'متسابق ي', 'متسابق ك', 'متسابق ل',
      'متسابقة أ', 'متسابقة ب', 'متسابقة ج', 'متسابقة د', 'متسابقة هـ', 'متسابقة و', 'متسابقة ز', 'متسابقة ح', 'متسابقة ط', 'متسابقة ي'];
    var seed = 7; function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    var students = names.map(function (n, i) {
      var comp = {}, pts = 0, skill = rnd();
      D.wards.filter(function (w) { return w.date <= today; }).forEach(function (w) {
        var r = rnd(); if (r > skill + 0.25) return;
        var late = rnd() < 0.2 && w.date < today, p = late ? 5 : 10;
        comp[w.n] = { p: p, r: ['excellent', 'good', 'weak'][Math.floor(rnd() * 3)], d: late ? today : w.date }; pts += p;
      });
      return { id: String(1001 + i), name: n, track: ['إثمار ١', 'إثمار ٢', 'إثمار ٣'][i % 3], gender: n.indexOf('متسابقة') === 0 ? 'أنثى' : 'ذكر', tz: 'Asia/Riyadh', seen: today, today: today, points: pts, comp: comp, blocked: false };
    });
    return { ok: true, today: today, wards: D.wards, chapters: D.chapters, test_date: D.test_date, students: students, broadcasts: store('hm.demolog') || [] };
  }
  function demoState() {
    var s = store('hm.demo');
    if (!s) {
      s = { student: { name: 'طالب تجريبي', track: 'إثمار ٢', gender: 'ذكر' }, completions: {}, srs: {} };
      store('hm.demo', s);
    }
    return s;
  }
  function rankOf(s, track) {
    var total = Object.keys(s.completions).reduce(function (a, k) { return a + s.completions[k].points; }, 0);
    var all = FAKE.map(function (f) { return { name: f[0], track: f[1], points: f[2] }; });
    all.push({ name: s.student.name, track: s.student.track, points: total, me: true });
    if (track) all = all.filter(function (x) { return x.track === track; });
    all.sort(function (a, b) { return b.points - a.points || (a.me ? -1 : 1); });
    var pos = all.findIndex(function (x) { return x.me; });
    return { top: all.slice(0, 10), me: { pos: pos + 1, points: total, of: all.length } };
  }
  function boot(s) {
    var total = Object.keys(s.completions).reduce(function (a, k) { return a + s.completions[k].points; }, 0);
    return { ok: true, demo: true, student: s.student, today: localToday(), completions: s.completions, total: total, rank: rankOf(s), srs: s.srs, admin: false };
  }
  function mock(a, body) {
    var s = demoState();
    return new Promise(function (res, rej) {
      setTimeout(function () {
        if (a === 'boot') return res(boot(s));
        if (a === 'complete') {
          var w = (window.HM_DATA.wards || []).find(function (x) { return x.n === body.w; });
          var today = localToday();
          var prev = s.completions[body.w];
          if (prev) { prev.rating = body.rating; store('hm.demo', s); return res(boot(s)); }
          var p = Rules.points(w, today);
          if (p === null) return rej(new Error('هذا الورد لم يُفتح بعد'));
          s.completions[body.w] = { date: today, points: p, rating: body.rating };
          store('hm.demo', s);
          return res(boot(s));
        }
        if (a === 'srs') { s.srs = body.srs; store('hm.demo', s); return res({ ok: true }); }
        if (a === 'rank') return res({ ok: true, rank: rankOf(s, body.track) });
        if (a === 'admin') return res(demoAdmin());
        if (a === 'admin.send') {
          var log = store('hm.demolog') || [];
          log.unshift({ ts: new Date().toISOString(), by: 'تجربة', segment: body.segment, track: body.track, gender: body.gender, count: body.expect, sent: body.expect, failed: 0, text: body.text });
          store('hm.demolog', log.slice(0, 20));
          return res({ ok: true, sent: body.expect, failed: 0, blocked: 0 });
        }
        rej(new Error('أمر غير معروف'));
      }, 150);
    });
  }

  return {
    demo: demo,
    Auth: Auth,
    call: function (a, body) { return demo ? mock(a, body) : real(a, body); },
    resetDemo: function () { try { localStorage.removeItem('hm.demo'); } catch (e) {} }
  };
})();
