/* لوحة الإدارة: متابعة المنجزين، والنِّسَب، والرسائل إلى فئات الطلاب. للمديرين فقط (يتحقق الخادم). */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var view = $('#view'), AR = '٠١٢٣٤٥٦٧٨٩';
  function ar(n) { return String(n).replace(/[0-9]/g, function (d) { return AR[d]; }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  var DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  function dObj(iso) { return new Date(iso + 'T12:00:00Z'); }
  function dateTxt(iso) { var d = dObj(iso); return DAYS[d.getUTCDay()] + ' ' + ar(d.getUTCDate()) + ' ' + MONTHS[d.getUTCMonth()]; }
  function shortDate(iso) { var d = dObj(iso); return ar(d.getUTCDate()) + ' ' + MONTHS[d.getUTCMonth()]; }
  var RATE = { excellent: 'ممتاز', good: 'جيد', weak: 'يحتاج مراجعة' };
  var TRACKS = ['إثمار ١', 'إثمار ٢', 'إثمار ٣'];

  /* الوضع الداكن */
  var root = document.documentElement, themeBtn = $('#themeBtn');
  function isDark() { var t = root.getAttribute('data-theme'); return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; }
  function themeLabel() { themeBtn.textContent = isDark() ? 'الوضع الفاتح' : 'الوضع الداكن'; }
  themeBtn.addEventListener('click', function () { var n = isDark() ? 'light' : 'dark'; root.setAttribute('data-theme', n); try { localStorage.setItem('hm.theme', n); } catch (e) {} themeLabel(); });
  themeLabel();

  var toastT;
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 2800); }
  function sheet(html) { $('#sheetBody').innerHTML = html; $('#sheet').hidden = false; var c = $('.sheet-card'); c.setAttribute('tabindex', '-1'); c.focus({ preventScroll: true }); }
  function closeSheet() { $('#sheet').hidden = true; $('#sheetBody').innerHTML = ''; }
  $('#sheet').addEventListener('click', function (e) { if (e.target.id === 'sheet') closeSheet(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });

  var A = null;   // بيانات الإدارة من الخادم
  var S = { tab: 'today', ward: null, track: '', gender: '', q: '', seg: 'not_today', mtrack: '', mgender: '', text: '' };

  /* ---------- حساب الحالات (مطابق لقواعد الخادم) ---------- */
  function wardsBefore(st) { return A.wards.filter(function (w) { return w.date < st.today; }); }
  function wardToday(st) { return A.wards.filter(function (w) { return w.date === st.today; })[0]; }
  function comp(st, n) { return st.comp && st.comp[n]; }
  function missedOf(st) { return wardsBefore(st).filter(function (w) { return !comp(st, w.n); }); }
  function doneCount(st) { return Object.keys(st.comp || {}).length; }
  var SEGS = {
    all: ['الكل', 'كل المسجّلين', function () { return true; }],
    not_today: ['لم ينجز اليوم', 'عليه ورد اليوم ولم يسجّله بعد', function (st) { var w = wardToday(st); return !!w && !comp(st, w.n); }],
    laggards: ['المقصّرون', 'فاته ورد أو أكثر لم ينجزه حتى الآن', function (st) { return missedOf(st).length > 0; }],
    distinguished: ['المتميزون', 'أنجز كل أوراده في أيامها', function (st) { var b = wardsBefore(st); return b.length > 0 && b.every(function (w) { var c = comp(st, w.n); return c && c.p === 10; }); }]
  };
  function recipients() {
    return A.students.filter(function (st) {
      return !st.blocked && SEGS[S.seg][2](st) && (!S.mtrack || st.track === S.mtrack) && (!S.mgender || st.gender === S.mgender);
    });
  }
  function filtered(list) {
    return list.filter(function (st) { return (!S.track || st.track === S.track) && (!S.gender || st.gender === S.gender); });
  }
  function chips(name, cur, opts) {
    return '<div class="seg" role="group">' + opts.map(function (o) {
      return '<button type="button" data-act="f" data-k="' + name + '" data-v="' + o[0] + '" aria-pressed="' + (cur === o[0]) + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }
  function filterBar(tk, gk) {
    return '<div class="filters">' + chips(tk, S[tk], [['', 'كل المسارات']].concat(TRACKS.map(function (t) { return [t, t]; }))) +
      chips(gk, S[gk], [['', 'الكل'], ['ذكر', 'الطلاب'], ['أنثى', 'الطالبات']]) + '</div>';
  }
  function pct(a, b) { return b ? Math.round(100 * a / b) : 0; }

  /* ---------- اليوم ---------- */
  function openedWards() { return A.wards.filter(function (w) { return w.date <= A.today; }); }
  function renderToday() {
    var ow = openedWards(), w = S.ward ? A.wards.filter(function (x) { return x.n === S.ward; })[0] : (ow.filter(function (x) { return x.date === A.today; })[0] || ow[ow.length - 1]);
    var h = '<div class="hello"><h1>' + dateTxt(A.today) + '</h1><p class="muted">' + ar(A.students.length) + ' مسجّلًا في المسابقة.</p></div>';
    if (!w) return view.innerHTML = h + '<section class="card"><p>لم يُفتح أي ورد بعد.</p></section>';
    S.ward = w.n;
    h += '<div class="wchips" role="group" aria-label="اختر الورد">' + ow.slice().reverse().map(function (x) {
      return '<button type="button" data-act="ward" data-n="' + x.n + '" aria-pressed="' + (x.n === w.n) + '"><b>الورد ' + ar(x.n) + '</b><span>' + shortDate(x.date) + '</span></button>';
    }).join('') + '</div>';
    h += filterBar('track', 'gender');
    var list = filtered(A.students), yes = list.filter(function (st) { return comp(st, w.n); }), no = list.filter(function (st) { return !comp(st, w.n); });
    var p = pct(yes.length, list.length);
    h += '<section class="card kpi"><div class="ring" style="--p:' + p + '"><b>' + ar(p) + '٪</b></div><div class="kpi-txt"><span class="muted small">الورد ' + ar(w.n) + '، ' + dateTxt(w.date) + '</span>' +
      '<p><b class="ok-t">' + ar(yes.length) + '</b> أنجز، و<b class="miss-t">' + ar(no.length) + '</b> لم ينجز</p>' +
      '<span class="muted small">' + ar(yes.filter(function (st) { return comp(st, w.n).p === 10; }).length) + ' في يومه، و' + ar(yes.filter(function (st) { return comp(st, w.n).p !== 10; }).length) + ' متأخرًا</span></div></section>';
    h += '<div class="two">' + listCard('أنجز', 'ok', yes, function (st) { var c = comp(st, w.n); return (c.p === 10 ? 'في يومه' : 'متأخر') + '، ' + (RATE[c.r] || ''); }) +
      listCard('لم ينجز', 'miss', no, function (st) { var m = missedOf(st).length; return m ? 'فاته ' + ar(m) + (m === 1 ? ' ورد' : ' أوراد') : 'لا فائت'; }) + '</div>';
    view.innerHTML = h;
  }
  function listCard(title, cls, list, sub) {
    return '<section class="card plist"><h2 class="' + cls + '-t">' + title + ' <span class="cnt">' + ar(list.length) + '</span></h2>' +
      (list.length ? '<ul>' + list.map(function (st) {
        return '<li><button type="button" data-act="student" data-id="' + esc(st.id) + '"><span class="nm">' + esc(st.name) + '</span><span class="mt">' + esc(st.track) + '، ' + (st.gender === 'أنثى' ? 'طالبة' : 'طالب') + '</span><span class="sb">' + sub(st) + '</span></button></li>';
      }).join('') + '</ul>' : '<p class="muted small">لا أحد.</p>') + '</section>';
  }

  /* ---------- الطلاب ---------- */
  function renderStudents() {
    var h = '<div class="hello"><h1>الطلاب</h1><p class="muted">اضغط أي طالب لترى أوراده كلها.</p></div>';
    h += '<input class="search" type="search" id="q" placeholder="ابحث بالاسم" value="' + esc(S.q) + '" aria-label="ابحث بالاسم">';
    h += filterBar('track', 'gender');
    var list = filtered(A.students).filter(function (st) { return !S.q || String(st.name).indexOf(S.q) >= 0; })
      .sort(function (a, b) { return b.points - a.points || String(a.name).localeCompare(String(b.name), 'ar'); });
    h += '<p class="muted small">' + ar(list.length) + ' طالبًا</p><section class="card slist"><ul>' + list.map(function (st, i) {
      var m = missedOf(st).length;
      return '<li><button type="button" data-act="student" data-id="' + esc(st.id) + '"><span class="pos">' + ar(i + 1) + '</span><span class="nm">' + esc(st.name) + '<small>' + esc(st.track) + '، ' + (st.gender === 'أنثى' ? 'طالبة' : 'طالب') + (st.seen ? '، آخر دخول ' + shortDate(String(st.seen).slice(0, 10)) : '') + '</small></span>' +
        '<span class="pts">' + ar(st.points) + '<small>نقطة</small></span>' + (m ? '<span class="chip miss">فاته ' + ar(m) + '</span>' : '<span class="chip ok">منتظم</span>') + '</button></li>';
    }).join('') + '</ul></section>';
    view.innerHTML = h;
    var q = $('#q'); if (q && S.qFocus) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  }
  function studentSheet(id) {
    var st = A.students.filter(function (x) { return String(x.id) === String(id); })[0]; if (!st) return;
    var rows = A.wards.filter(function (w) { return w.date <= st.today; }).map(function (w) {
      var c = comp(st, w.n), stt = c ? (c.p === 10 ? '<span class="chip ok">تم ١٠</span>' : '<span class="chip late">متأخر ' + ar(c.p) + '</span>') : (w.date === st.today ? '<span class="chip today">اليوم</span>' : '<span class="chip miss">فاته</span>');
      return '<li><span class="d">' + shortDate(w.date) + '</span><span class="t">الورد ' + ar(w.n) + (c ? '<small>' + (RATE[c.r] || '') + '، سجّله ' + shortDate(String(c.d).slice(0, 10)) + '</small>' : '') + '</span>' + stt + '</li>';
    }).join('');
    sheet('<h2>' + esc(st.name) + '</h2><p class="muted">' + esc(st.track) + '، ' + (st.gender === 'أنثى' ? 'طالبة' : 'طالب') + '، ' + ar(st.points) + ' نقطة' + (st.seen ? '، آخر دخول ' + shortDate(String(st.seen).slice(0, 10)) : '') + '</p><ul class="sched">' + rows + '</ul><button class="btn ghost" type="button" data-act="close">إغلاق</button>');
  }

  /* ---------- النِّسَب ---------- */
  function bar(label, a, b, sub) {
    var p = pct(a, b);
    return '<div class="hbar"><div class="hb-l"><span>' + label + '</span><b>' + ar(p) + '٪</b></div><div class="hb-t"><i style="width:' + p + '%"></i></div><span class="muted small">' + (sub || (ar(a) + ' من ' + ar(b))) + '</span></div>';
  }
  function renderRates() {
    var ow = openedWards(), h = '<div class="hello"><h1>النِّسَب</h1><p class="muted">نسبة إنجاز الأوراد التي فُتحت حتى اليوم.</p></div>';
    h += filterBar('track', 'gender');
    var list = filtered(A.students);
    var slots = 0, got = 0, ontime = 0;
    list.forEach(function (st) { wardsBefore(st).concat(wardToday(st) ? [wardToday(st)] : []).forEach(function (w) { slots++; var c = comp(st, w.n); if (c) { got++; if (c.p === 10) ontime++; } }); });
    h += '<div class="stat-grid"><div class="stat"><b>' + ar(pct(got, slots)) + '٪</b><span>نسبة الإنجاز العامة</span></div><div class="stat"><b>' + ar(pct(ontime, got)) + '٪</b><span>من المنجَز كان في يومه</span></div>' +
      '<div class="stat"><b>' + ar(list.filter(SEGS.laggards[2]).length) + '</b><span>مقصّرون</span></div><div class="stat"><b>' + ar(list.filter(SEGS.distinguished[2]).length) + '</b><span>متميزون</span></div></div>';
    h += '<section class="card"><h2>حسب المسار</h2>' + TRACKS.map(function (t) {
      var l = list.filter(function (st) { return st.track === t; }), s = 0, g = 0;
      l.forEach(function (st) { wardsBefore(st).concat(wardToday(st) ? [wardToday(st)] : []).forEach(function (w) { s++; if (comp(st, w.n)) g++; }); });
      return bar(t, g, s, ar(l.length) + ' طالبًا');
    }).join('') + '</section>';
    h += '<section class="card"><h2>حسب الورد</h2>' + ow.map(function (w) {
      var l = list, g = l.filter(function (st) { return comp(st, w.n); }).length;
      return bar('الورد ' + ar(w.n) + '، ' + shortDate(w.date), g, l.length);
    }).join('') + '</section>';
    view.innerHTML = h;
  }

  /* ---------- الرسائل ---------- */
  function renderMsg() {
    var r = recipients();
    var h = '<div class="hello"><h1>رسالة إلى فئة</h1><p class="muted">تصل من البوت إلى كل من في الفئة، ومعها زر «افتح المنصة».</p></div>';
    h += '<section class="card"><p class="lbl">الفئة</p><div class="opt-grid">' + Object.keys(SEGS).map(function (k) {
      var n = A.students.filter(function (st) { return !st.blocked && SEGS[k][2](st); }).length;
      return '<button type="button" class="opt" data-act="seg" data-k="' + k + '" aria-pressed="' + (S.seg === k) + '"><b>' + SEGS[k][0] + ' <span class="cnt">' + ar(n) + '</span></b><span>' + SEGS[k][1] + '</span></button>';
    }).join('') + '</div><p class="lbl">وتضييقها (اختياري)</p>' + filterBar('mtrack', 'mgender') + '</section>';
    h += '<section class="card"><label class="lbl" for="mtext">نص الرسالة</label><textarea id="mtext" rows="6" maxlength="3500" placeholder="اكتب رسالتك هنا…">' + esc(S.text) + '</textarea>' +
      '<div class="row small muted"><span id="mcount">' + ar(S.text.length) + ' / ٣٥٠٠</span><span>نص عادي بلا تنسيق</span></div></section>';
    h += '<section class="card recv"><div class="row"><b>ستصل إلى ' + ar(r.length) + (r.length === 1 ? ' طالب' : ' طالبًا') + '</b>' + (r.length ? '<button type="button" class="link-btn" data-act="who">من هم؟</button>' : '') + '</div>' +
      '<button class="btn wide" type="button" data-act="preview"' + (r.length && S.text.trim() ? '' : ' disabled') + '>معاينة ثم إرسال</button></section>';
    if (A.broadcasts && A.broadcasts.length) {
      h += '<section class="card"><h2>سجل الرسائل</h2><ul class="log">' + A.broadcasts.map(function (b) {
        return '<li><div class="row small"><b>' + esc(SEGS[b.segment] ? SEGS[b.segment][0] : b.segment) + (b.track ? '، ' + esc(b.track) : '') + (b.gender ? '، ' + esc(b.gender) : '') + '</b><span class="muted">' + esc(fmtTs(b.ts)) + '</span></div><p class="small">' + esc(String(b.text || '').slice(0, 140)) + '</p><p class="muted small">وصلت ' + ar(b.sent || 0) + ' من ' + ar(b.count || 0) + (Number(b.failed) ? '، وتعذّر ' + ar(b.failed) : '') + '</p></li>';
      }).join('') + '</ul></section>';
    }
    view.innerHTML = h;
  }
  function fmtTs(ts) { var d = new Date(ts); if (isNaN(d)) return String(ts || ''); return ar(d.getDate()) + ' ' + MONTHS[d.getMonth()] + '، ' + ar(String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')); }

  /* ---------- التوجيه والأحداث ---------- */
  function render() {
    document.querySelectorAll('#atabs button').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === S.tab)); });
    if (S.tab === 'today') renderToday();
    else if (S.tab === 'students') renderStudents();
    else if (S.tab === 'rates') renderRates();
    else renderMsg();
  }
  document.addEventListener('input', function (e) {
    if (e.target.id === 'q') { S.q = e.target.value.trim(); S.qFocus = true; renderStudents(); S.qFocus = false; }
    if (e.target.id === 'mtext') {
      S.text = e.target.value; $('#mcount').textContent = ar(S.text.length) + ' / ٣٥٠٠';
      var pb = $('[data-act=preview]'); if (pb) pb.disabled = !(recipients().length && S.text.trim());
    }
  });
  document.addEventListener('click', function (e) {
    var t = e.target.closest('#atabs button'); if (t) { S.tab = t.dataset.tab; render(); window.scrollTo(0, 0); return; }
    var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    var a = b.dataset.act;
    if (a === 'close') closeSheet();
    else if (a === 'f') { S[b.dataset.k] = b.dataset.v; render(); }
    else if (a === 'ward') { S.ward = +b.dataset.n; render(); }
    else if (a === 'student') studentSheet(b.dataset.id);
    else if (a === 'seg') { S.seg = b.dataset.k; render(); }
    else if (a === 'who') {
      var r = recipients();
      sheet('<h2>المستلمون (' + ar(r.length) + ')</h2><ul class="names">' + r.map(function (st) { return '<li>' + esc(st.name) + '<small>' + esc(st.track) + '</small></li>'; }).join('') + '</ul><button class="btn ghost" type="button" data-act="close">إغلاق</button>');
    }
    else if (a === 'preview') {
      var rr = recipients();
      sheet('<h2>تأكيد الإرسال</h2><p>سترسل هذه الرسالة من البوت إلى <b>' + ar(rr.length) + '</b> ' + (rr.length === 1 ? 'طالب' : 'طالبًا') + ' (' + esc(SEGS[S.seg][0]) + (S.mtrack ? '، ' + esc(S.mtrack) : '') + (S.mgender ? '، ' + (S.mgender === 'أنثى' ? 'الطالبات' : 'الطلاب') : '') + ').</p>' +
        '<div class="tgmsg"><p>' + esc(S.text.trim()).replace(/\n/g, '<br>') + '</p><span class="tgbtn">افتح المنصة</span></div>' +
        '<p class="muted small">لا يمكن سحب الرسالة بعد إرسالها.</p><div class="nav2"><button class="btn ghost" type="button" data-act="close">رجوع</button><button class="btn" type="button" data-act="send" data-n="' + rr.length + '">أرسل الآن</button></div>');
    }
    else if (a === 'send') {
      b.disabled = true; b.textContent = 'جارٍ الإرسال…';
      Api.call('admin.send', { segment: S.seg, track: S.mtrack, gender: S.mgender, text: S.text.trim(), expect: +b.dataset.n }).then(function (res) {
        sheet('<div class="ask win"><div class="fc-ring" aria-hidden="true">✓</div><h2>أُرسلت الرسالة</h2><p>وصلت إلى ' + ar(res.sent) + (res.failed ? '، وتعذّر ' + ar(res.failed) : '') + (res.blocked ? '، وحظر البوتَ ' + ar(res.blocked) : '') + '.</p></div><button class="btn wide" type="button" data-act="close">حسنًا</button>');
        S.text = ''; return load(true);
      }).catch(function (err) { b.disabled = false; b.textContent = 'أرسل الآن'; toast(err.message); });
    }
  });

  function gate(msg) { view.innerHTML = '<div class="gate"><h1>لوحة الإدارة</h1><p>' + msg + '</p></div>'; }
  function load(quiet) {
    if (!quiet) view.innerHTML = '<p class="muted" style="text-align:center;padding-top:20vh">جارٍ التحميل…</p>';
    var pre = Api.demo && !window.HM_DATA ? fetch('content.json').then(function (r) { return r.json(); }).then(function (d) { window.HM_DATA = d; }) : Promise.resolve();
    return pre.then(function () { return Api.call('admin'); }).then(function (res) { A = res; $('#atabs').hidden = false; render(); })
      .catch(function (err) { gate(esc(err && err.code === 'auth' ? err.message : 'تعذّر التحميل. تحقق من اتصالك ثم أعد فتح الصفحة.')); });
  }
  Api.Auth.init();
  try { if (window.Telegram && Telegram.WebApp && Telegram.WebApp.initData) { Telegram.WebApp.ready(); Telegram.WebApp.expand(); } } catch (e) {}
  if (!Api.Auth.has()) gate('افتح هذه الصفحة من البوت بالأمر /admin');
  else load();
})();
