/* منصة حفظ المنهاج: الواجهة. بلا مكتبات؛ كل الشاشات تُرسم من هنا. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var view = $('#view');
  var AR = '٠١٢٣٤٥٦٧٨٩';
  function ar(n) { return String(n).replace(/[0-9]/g, function (d) { return AR[d]; }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ls(k, v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem('hm.' + k) || 'null');
      localStorage.setItem('hm.' + k, JSON.stringify(v));
    } catch (e) { return null; }
  }
  var MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  var DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  function dObj(iso) { return new Date(iso + 'T12:00:00Z'); }
  function addDays(iso, n) { var d = dObj(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function dayName(iso) { return DAYS[dObj(iso).getUTCDay()]; }
  function dateTxt(iso) { var d = dObj(iso); return ar(d.getUTCDate()) + ' ' + MONTHS[d.getUTCMonth()]; }
  function pagesTxt(p) { return 'ص ' + (p.length > 1 ? ar(p[0]) + '–' + ar(p[p.length - 1]) : ar(p[0])); }

  var D = null;          // البيانات الثابتة: المحتوى والأوراد
  var ME = null;         // بيانات الطالب من الخادم
  var S = { tab: 'home', w: null, idx: 0, seg: 0, level: 'full', mode: 'item', focus: null, review: null, quiz: null, rankTrack: '' };

  /* ---------- الوضع الداكن ---------- */
  var root = document.documentElement, themeBtn = $('#themeBtn');
  function isDark() { var t = root.getAttribute('data-theme'); return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; }
  function themeLabel() { themeBtn.textContent = isDark() ? 'الوضع الفاتح' : 'الوضع الداكن'; }
  themeBtn.addEventListener('click', function () { var n = isDark() ? 'light' : 'dark'; root.setAttribute('data-theme', n); try { localStorage.setItem('hm.theme', n); } catch (e) {} themeLabel(); });
  themeLabel();

  /* ---------- أدوات عامة ---------- */
  var toastT;
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 2600); }
  function sheet(html) { $('#sheetBody').innerHTML = html; $('#sheet').hidden = false; var f = $('#sheetBody button, #sheetBody a'); if (f) f.focus(); }
  function closeSheet() { $('#sheet').hidden = true; $('#sheetBody').innerHTML = ''; }
  $('#sheet').addEventListener('click', function (e) { if (e.target.id === 'sheet') closeSheet(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });

  function today() { return (ME && ME.today) || new Date().toISOString().slice(0, 10); }
  function ward(n) { return D.wards.find(function (w) { return w.n === n; }); }
  function chapter(n) { return D.chapters.find(function (c) { return c.n === n; }); }
  function wardItems(n) { return D.items.filter(function (i) { return i.ward === n; }); }
  function done(n) { return ME && ME.completions && ME.completions[n]; }
  function opened(w) { return w.date <= today(); }
  function todayWard() { return D.wards.find(function (w) { return w.date === today(); }); }
  function memorizedItems() { return D.items.filter(function (i) { return done(i.ward); }); }

  /* ---------- نص الحفظ: الدرجات الثلاث ---------- */
  var MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/;
  var NONJOIN = 'اأإآٱدذرزوؤءةى';
  function firstOf(w) {
    var m = w.match(/^([«(\[﴿"]*)(.*?)([»)\]﴾،.:؛؟!"]*)$/);
    var pre = m[1], core = m[2], post = m[3];
    if (!core || /^[٠-٩]+$/.test(core) || core.length < 2) return w;
    var out = core[0], i = 1;
    while (i < core.length && MARKS.test(core[i])) { out += core[i]; i++; }
    if (i >= core.length) return w;
    return pre + out + (NONJOIN.indexOf(core[0]) < 0 ? 'ـ' : '') + post;
  }
  function parts(text) {
    // يفصل الآيات المقتبسة ﴿…﴾ داخل الحديث لتُعرض بخط الآيات ولونها
    var out = [], re = /﴿[^﴾]*﴾/g, last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push({ q: false, t: text.slice(last, m.index) });
      out.push({ q: true, t: m[0] });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ q: false, t: text.slice(last) });
    return out;
  }
  function fmt(text, level) {
    return parts(text).map(function (p) {
      var t = level === 'first' ? p.t.split(' ').map(firstOf).join(' ') : p.t;
      return p.q ? '<span class="q">' + esc(t) + '</span>' : esc(t);
    }).join('');
  }
  function segments(text) {
    // الحديث الطويل يُقسم مقاطع للتكرار، دون قطع آية
    if (text.length < 280) return [text];
    var out = [], cur = '', depth = 0;
    var toks = text.split(/(\s+)/);
    toks.forEach(function (t) {
      cur += t;
      if (t.indexOf('﴿') >= 0) depth++;
      if (t.indexOf('﴾') >= 0) depth = Math.max(0, depth - 1);
      if (!depth && cur.length > 150 && /[،.؟:]»?$/.test(t)) { out.push(cur.trim()); cur = ''; }
    });
    if (cur.trim()) { if (cur.trim().length < 50 && out.length) out[out.length - 1] += ' ' + cur.trim(); else out.push(cur.trim()); }
    return out;
  }
  function lineHTML(label, html, cls, level, key) {
    var hide = level === 'hide' && !(S.revealed && S.revealed[key]);
    return '<div class="line"><span class="lb">' + label + '</span><div class="tx ' + (cls || '') + (hide ? ' hide' : '') + '" data-reveal="' + key + '"' +
      (hide ? ' role="button" tabindex="0" aria-label="مخفي، المس للإظهار"' : '') + '>' + html + '</div></div>';
  }
  function itemBody(it, level, segIdx) {
    if (it.type === 'ayah') {
      var hide = level === 'hide' && !(S.revealed && S.revealed.q);
      return '<p class="quran-intro">' + esc(it.intro) + '</p>' +
        '<p class="quran' + (hide ? ' hide' : '') + '" data-reveal="q"' + (hide ? ' role="button" tabindex="0" aria-label="مخفي، المس للإظهار"' : '') + '>﴿' + fmt(it.text, level) + '﴾</p>' +
        '<p class="quran-ref">' + esc(it.ref_text) + '</p>';
    }
    if (it.type === 'note') return lineHTML('فائدة', fmt(it.text, level), '', level, 'n');
    var segs = segments(it.matn), matn = segs.length > 1 && segIdx != null ? segs[segIdx] : it.matn;
    var lead = segIdx ? '' : (it.lead ? '<span class="lead">' + esc(it.lead) + '</span> ' : '');
    return lineHTML('الراوي', fmt(it.narrator, level), '', level, 'r') +
      lineHTML('الحديث', lead + fmt(matn, level), 'matn', level, 'm') +
      lineHTML('المصدر', fmt(it.source, level), '', level, 's');
  }
  function itemLabel(it) {
    if (it.type === 'ayah') return 'آية';
    if (it.type === 'note') return 'فائدة';
    return 'الحديث ' + ar(it.no);
  }

  /* ---------- التكرار المتباعد ---------- */
  var INT = [1, 3, 7, 14, 30];
  var srs = ls('srs') || {};
  var syncT;
  function saveSrs() { ls('srs', srs); clearTimeout(syncT); syncT = setTimeout(function () { Api.call('srs', { srs: srs }).catch(function () {}); }, 2500); }
  function srsInit(n, rating) {
    wardItems(n).forEach(function (it) {
      if (srs[it.id]) return;
      var lvl = rating === 'excellent' ? 1 : 0;
      srs[it.id] = { lvl: lvl, due: addDays(today(), INT[lvl]), last: today() };
    });
    saveSrs();
  }
  function srsGrade(id, ok) {
    var r = srs[id] || { lvl: 0 };
    r.lvl = ok ? Math.min(r.lvl + 1, INT.length - 1) : 0;
    r.due = addDays(today(), ok ? INT[r.lvl] : 1);
    r.last = today();
    srs[id] = r; saveSrs();
  }
  function dueItems() {
    var mem = memorizedItems();
    if (Rules.isFriday(today())) return mem;               // الجمعة: كل المحفوظ
    var due = mem.filter(function (i) { return !srs[i.id] || srs[i.id].due <= today(); });
    due.sort(function (a, b) {                              // يتقدّم ما يُرجَّح نسيانه
      var x = srs[a.id] || { due: '', lvl: 0 }, y = srs[b.id] || { due: '', lvl: 0 };
      return (x.due < y.due ? -1 : x.due > y.due ? 1 : 0) || x.lvl - y.lvl;
    });
    return due.slice(0, 5);
  }

  /* ---------- الرئيسية ---------- */
  function statusChip(w) {
    var st = Rules.status(w, today(), done(w.n));
    return { ontime: '<span class="chip ok">تم +١٠</span>', late: '<span class="chip late">متأخر +٥</span>', missed: '<span class="chip miss">فاتك</span>', today: '<span class="chip today">اليوم</span>', upcoming: '<span class="chip">قادم</span>' }[st];
  }
  function totalPoints() { return (ME && ME.total) || 0; }
  function renderHome() {
    var t = today(), tw = todayWard(), fri = Rules.isFriday(t);
    var doneN = D.wards.filter(function (w) { return done(w.n); }).length;
    var missed = D.wards.filter(function (w) { return Rules.status(w, t, done(w.n)) === 'missed'; });
    var phrase = D.phrases.length ? D.phrases[Math.floor(dObj(t).getTime() / 864e5) % D.phrases.length] : '';
    var h = '';
    if (Api.demo) h += '<p class="demo-flag">نسخة تجريبية: البيانات هنا للتجربة فقط' + (D.unverified ? '، وفيها نص لم يُعتمد بعد' : '') + '.</p>';
    h += '<div class="hello"><h1>السلام عليكم، ' + esc(ME.student.name) + '</h1><p class="muted">' + esc(ME.student.track) + '، ' + dayName(t) + ' ' + dateTxt(t) + '</p></div>';
    if (phrase) h += '<p class="motiv">' + esc(phrase) + '</p>';
    if (fri) h += '<p class="notice">اليوم يوم الاستدراك: كل ورد فاتك تنجزه اليوم يُحسب بعشر نقاط.</p>';
    h += '<section class="card today-card"><div class="stack">';
    if (tw) {
      var c = chapter(tw.ch);
      h += '<p class="muted small">مطلوب اليوم</p><h2>الورد ' + ar(tw.n) + '، ' + pagesTxt(tw.pages) + '</h2><p class="muted">' + esc(c.name) + '</p>';
      h += done(tw.n) ? '<a class="btn wide" href="#session">أنجزت ورد اليوم، راجعه</a>' : '<a class="btn wide" href="#session">إنجاز ورد اليوم</a>';
    } else if (fri) {
      h += '<p class="muted small">مطلوب اليوم</p><h2>لا ورد جديد اليوم</h2><p class="muted">الجمعة للمراجعة والاستدراك.</p><a class="btn wide" href="#review">مراجعة كل المحفوظ</a>';
    } else {
      var next = D.wards.find(function (w) { return w.date > t; });
      h += '<p class="muted small">مطلوب اليوم</p><h2>' + (next ? 'الورد القادم ' + dayName(next.date) + ' ' + dateTxt(next.date) : 'أتممت أوراد الحزمة') + '</h2><a class="btn wide" href="#review">المراجعة</a>';
    }
    h += '<div class="progress"><div class="row small"><span>السير: ' + ar(doneN) + ' من ' + ar(D.wards.length) + ' وردًا</span><span>' + ar(totalPoints()) + ' نقطة</span></div><div class="bar"><span style="width:' + Math.round(100 * doneN / D.wards.length) + '%"></span></div></div>';
    h += '</div></section>';
    if (missed.length) {
      h += '<section class="card"><h2>أوراد فاتتك</h2><ul class="sched">' + missed.map(function (w) {
        return '<li><span class="d">' + dayName(w.date) + '<br>' + dateTxt(w.date) + '</span><span class="t">الورد ' + ar(w.n) + '، ' + pagesTxt(w.pages) + '</span><a class="btn soft" style="padding:6px 12px" href="#session-' + w.n + '">استدرك</a></li>';
      }).join('') + '</ul></section>';
    }
    h += renderRankCard();
    h += '<section class="card"><h2>جدول الحفظ</h2><ul class="sched">' + D.wards.map(function (w) {
      var c = chapter(w.ch), isT = w.date === t;
      return '<li class="' + (isT ? 'is-today' : '') + '"><span class="d">' + dayName(w.date) + '<br>' + dateTxt(w.date) + '</span><span class="t">' +
        (opened(w) ? '<a href="#session-' + w.n + '" style="color:inherit;text-decoration:none">' : '') + 'الورد ' + ar(w.n) + '، ' + pagesTxt(w.pages) + (opened(w) ? '</a>' : '') +
        '<small>' + esc(c.name) + '</small></span>' + statusChip(w) + '</li>';
    }).join('') + '</ul><p class="muted small">اختبار الحزمة: ' + dayName(D.test_date) + ' ' + dateTxt(D.test_date) + '</p></section>';
    view.innerHTML = h;
  }
  function renderRankCard() {
    var r = ME.rank, tr = S.rankTrack;
    var h = '<section class="card" id="rankCard"><div class="row"><h2>الترتيب</h2><div class="seg" role="group" aria-label="تصفية بالمسار">' +
      ['', 'إثمار ٢', 'إثمار ٣'].map(function (t) { return '<button type="button" data-act="rank" data-track="' + t + '" aria-pressed="' + (tr === t) + '">' + (t || 'الكل') + '</button>'; }).join('') + '</div></div>';
    h += '<p class="muted small">أول عشرة في قسم ' + (ME.student.gender === 'أنثى' ? 'الطالبات' : 'الطلاب') + '.</p>';
    h += '<ol class="rank">' + r.top.map(function (x, i) {
      return '<li class="' + (x.me ? 'me' : '') + '"><span class="p">' + ar(i + 1) + '</span><span>' + esc(x.name) + (x.me ? ' (أنت)' : '') + '</span><span class="pts">' + ar(x.points) + '</span></li>';
    }).join('') + '</ol>';
    h += '<div class="mypos"><span>موضعك: ' + ar(r.me.pos) + ' من ' + ar(r.me.of) + '</span><span>' + ar(r.me.points) + ' نقطة</span></div></section>';
    return h;
  }

  /* ---------- جلسة الورد ---------- */
  function visited(n) { return ls('v' + n) || []; }
  function markVisited(n, id) { var v = visited(n); if (v.indexOf(id) < 0) { v.push(id); ls('v' + n, v); } }
  var counts = ls('cnt') || {}, targets = ls('tgt') || {};
  function wardCount(n) { return wardItems(n).reduce(function (a, i) { return a + (counts[i.id] || 0); }, 0); }

  function renderSession() {
    var n = S.w || (todayWard() && todayWard().n) || (D.wards.filter(opened).slice(-1)[0] || D.wards[0]).n;
    S.w = n;
    var w = ward(n), c = chapter(w.ch), items = wardItems(n);
    if (!opened(w)) { view.innerHTML = '<section class="card"><h2>الورد ' + ar(n) + '</h2><p>يُفتح هذا الورد يوم ' + dayName(w.date) + ' ' + dateTxt(w.date) + '.</p><a class="btn" href="#home">الرئيسية</a></section>'; return; }
    if (!items.length) { view.innerHTML = '<section class="card"><h2>الورد ' + ar(n) + '</h2><p>نص هذا الورد قيد المراجعة، ويظهر هنا قريبًا بإذن الله.</p></section>'; return; }
    S.idx = Math.min(S.idx, items.length - 1);
    var h = '';
    if (S.focus) h += '<div class="focusbar"><span>جلسة تركيز</span><span class="clock" id="clock">' + clockTxt() + '</span><button type="button" data-act="focus-stop">إنهاء</button></div>';
    h += '<div class="sess-head hide-in-focus"><span class="crumb">' + esc(c.title) + '، ' + pagesTxt(w.pages) + '</span><h1>الورد ' + ar(n) + '</h1>' +
      '<div class="seg" role="group" aria-label="طريقة العرض">' + [['item', 'عنصرًا عنصرًا'], ['ward', 'الورد كاملًا'], ['chapter', 'الباب كاملًا'], ['book', 'المتن كاملًا']].map(function (m) {
        return '<button type="button" data-act="mode" data-mode="' + m[0] + '" aria-pressed="' + (S.mode === m[0]) + '">' + m[1] + '</button>';
      }).join('') + '</div></div>';
    h += '<div class="tools hide-in-focus">' + (c.video ? '<button class="btn ghost" type="button" data-act="video">مقطع الباب</button>' : '') +
      '<button class="btn ghost" type="button" data-act="focus">جلسة تركيز</button></div>';
    if (S.mode === 'item') h += renderItemMode(n, items);
    else h += renderFull(S.mode, n);
    var d = done(n), seen = visited(n), all = items.every(function (i) { return seen.indexOf(i.id) >= 0; });
    h += '<section class="card flat hide-in-focus"><div class="row"><span class="muted small">مجموع تكرارك في هذا الورد</span><b class="num">' + ar(wardCount(n)) + '</b></div>';
    if (d) {
      h += '<p class="done-box">أنجزت هذا الورد ' + (d.points === 10 ? 'في وقته (١٠ نقاط)' : '(٥ نقاط)') + '، تقييمك: ' + RATE[d.rating] + '</p>' +
        '<div class="nav2"><button class="btn soft" type="button" data-act="recite">عدّل التقييم</button><a class="btn" href="#review">المراجعة المقترحة</a></div>';
    } else {
      h += '<button class="btn wide" type="button" data-act="recite"' + (all ? '' : ' disabled') + '>سمّعت</button>' +
        (all ? '' : '<p class="muted small" style="text-align:center">يتفعّل بعد المرور على عناصر الورد كلها (' + ar(seen.filter(function (id) { return items.some(function (i) { return i.id === id; }); }).length) + ' من ' + ar(items.length) + ').</p>');
    }
    h += '</section>';
    view.innerHTML = h;
    if (S.mode === 'item') markVisited(n, items[S.idx].id);
  }
  var RATE = { excellent: 'ممتاز', good: 'جيد', weak: 'يحتاج مراجعة' };
  function renderItemMode(n, items) {
    var it = items[S.idx], segs = it.type === 'hadith' ? segments(it.matn) : [it.text];
    var segIdx = segs.length > 1 ? Math.min(S.seg, segs.length - 1) : null;
    var seen = visited(n);
    var h = '<section class="card item-card">';
    h += '<div class="item-meta"><span>' + itemLabel(it) + '</span><span>' + ar(S.idx + 1) + ' من ' + ar(items.length) + '</span></div>';
    h += '<div class="seg" role="group" aria-label="درجة البطاقة">' + [['full', 'كامل'], ['first', 'أوائل الكلمات'], ['hide', 'مخفي']].map(function (l) {
      return '<button type="button" data-act="level" data-level="' + l[0] + '" aria-pressed="' + (S.level === l[0]) + '">' + l[1] + '</button>';
    }).join('') + '</div>';
    if (segIdx != null) h += '<div class="segnav"><button type="button" data-act="seg" data-d="-1" aria-label="المقطع السابق">›</button><span>المقطع ' + ar(segIdx + 1) + ' من ' + ar(segs.length) + '</span><button type="button" data-act="seg" data-d="1" aria-label="المقطع التالي">‹</button></div>';
    h += itemBody(it, S.level, segIdx);
    if (S.level === 'hide') h += '<p class="reveal-hint">المس السطر المخفي ليظهر.</p>';
    var cnt = counts[it.id] || 0, tgt = targets[it.id] || '';
    h += '<div class="counter"><div><div class="c">التكرار: ' + ar(cnt) + (tgt ? ' من ' + ar(tgt) : '') + '</div><label class="tgt">هدفي <input type="number" min="1" max="200" inputmode="numeric" id="tgt" value="' + tgt + '" aria-label="عدد التكرار الذي تريده لهذا العنصر"></label></div><button class="tap" type="button" data-act="count">كرّرت</button></div>';
    h += '</section>';
    h += '<div class="nav2"><button class="btn soft" type="button" data-act="prev"' + (S.idx ? '' : ' disabled') + '>السابق</button><button class="btn soft" type="button" data-act="next"' + (S.idx < items.length - 1 ? '' : ' disabled') + '>التالي</button></div>';
    h += '<div class="dots hide-in-focus" aria-label="عناصر الورد">' + items.map(function (x, i) {
      return '<button type="button" data-act="goto" data-i="' + i + '" class="' + (i === S.idx ? 'cur' : seen.indexOf(x.id) >= 0 ? 'seen' : '') + '" aria-label="العنصر ' + ar(i + 1) + '"></button>';
    }).join('') + '</div>';
    return h;
  }
  function renderFull(mode, n) {
    var w = ward(n), list;
    if (mode === 'ward') list = wardItems(n);
    else if (mode === 'chapter') list = D.items.filter(function (i) { return i.ch === w.ch && opened(ward(i.ward)); });
    else list = D.items.filter(function (i) { return opened(ward(i.ward)); });
    var h = '<div class="full-list">', lastCh = 0;
    list.forEach(function (it) {
      if (it.ch !== lastCh && mode !== 'ward') { var c = chapter(it.ch); h += '<p class="ch-title">' + esc(c.title) + '<br>' + esc(c.heading || c.name) + '</p>'; lastCh = it.ch; }
      h += '<section class="card flat"><div class="item-meta"><span>' + itemLabel(it) + '</span><span>' + pagesTxt([it.page]) + '</span></div>' + itemBody(it, 'full', null) + '</section>';
    });
    if (mode === 'ward') list.forEach(function (it) { markVisited(n, it.id); });
    return h + '</div>';
  }

  /* مؤقّت التركيز */
  var focusTimer;
  function clockTxt() { if (!S.focus) return ''; var s = Math.max(0, Math.round((S.focus.end - Date.now()) / 1000)); return ar(String(Math.floor(s / 60)).padStart(2, '0')) + ':' + ar(String(s % 60).padStart(2, '0')); }
  function startFocus(min) {
    S.focus = { end: Date.now() + min * 60000 }; S.mode = 'item'; document.body.classList.add('focus'); closeSheet(); render();
    clearInterval(focusTimer);
    focusTimer = setInterval(function () {
      var el = $('#clock'); if (el) el.textContent = clockTxt();
      if (Date.now() >= S.focus.end) { stopFocus(); try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {} sheet('<h2>انتهى وقت التركيز</h2><p>أحسنت. إن أتممت حفظ الورد فاضغط «سمّعت».</p><button class="btn wide" type="button" data-act="close">حسنًا</button>'); }
    }, 1000);
  }
  function stopFocus() { clearInterval(focusTimer); S.focus = null; document.body.classList.remove('focus'); render(); }

  /* ---------- المراجعة والاختبار المستمر ---------- */
  function renderReview() {
    var mem = memorizedItems(), due = dueItems(), fri = Rules.isFriday(today());
    var h = '<div class="hello"><h1>المراجعة</h1><p class="muted">' + (fri ? 'الجمعة: مراجعة كاملة لكل ما حفظت.' : 'مراجعة يومية قليلة، يتقدّم فيها ما يُرجَّح نسيانه.') + '</p></div>';
    if (S.review) return renderReviewCard();
    if (S.quiz) return renderQuiz();
    if (!mem.length) { view.innerHTML = h + '<section class="card"><p>تبدأ المراجعة بعد أن تُنجز أول ورد.</p><a class="btn" href="#session">إنجاز ورد اليوم</a></section>'; return; }
    h += '<section class="card"><h2>مراجعة اليوم</h2><p>' + (due.length ? 'عندك ' + ar(due.length) + ' ' + (due.length > 10 ? 'عنصرًا' : 'عناصر') + ' للمراجعة.' : 'لا شيء مستحق اليوم. أحسنت.') + '</p>' +
      (due.length ? '<button class="btn wide" type="button" data-act="review-start">ابدأ المراجعة</button>' : '') + '</section>';
    h += '<section class="card"><h2>اختبار مستمر</h2><p class="muted">بطاقات عشوائية من كل ما حفظت: من الراوي؟ وما المصدر؟ وأكمل. ويتّسع مع كل حفظ جديد.</p><button class="btn soft wide" type="button" data-act="quiz-start">ابدأ الاختبار</button></section>';
    h += '<section class="card flat"><div class="row"><span class="muted small">محفوظك حتى الآن</span><b class="num">' + ar(mem.length) + ' عنصرًا</b></div></section>';
    view.innerHTML = h;
  }
  function renderReviewCard() {
    var R = S.review, it = R.list[R.i];
    var h = '<div class="row"><h1>المراجعة</h1><span class="muted num">' + ar(R.i + 1) + ' من ' + ar(R.list.length) + '</span></div>';
    h += '<section class="card item-card"><div class="item-meta"><span>' + itemLabel(it) + '</span><span>' + pagesTxt([it.page]) + '</span></div>' + itemBody(it, R.shown ? 'full' : 'hide', null) + '</section>';
    h += R.shown ? '<p class="muted small" style="text-align:center">هل تذكرته كما هو؟</p><div class="grade"><button class="btn soft" type="button" data-act="grade" data-ok="0">تعثرت</button><button class="btn" type="button" data-act="grade" data-ok="1">تذكرته</button></div>'
      : '<button class="btn wide" type="button" data-act="show">سمّعه في نفسك، ثم اضغط لإظهاره</button>';
    h += '<button class="btn ghost" type="button" data-act="review-end">إنهاء المراجعة</button>';
    view.innerHTML = h;
  }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function makeQuestion() {
    var mem = shuffle(memorizedItems()), it = mem[0], had = D.items.filter(function (i) { return i.type === 'hadith'; });
    var kinds = it.type === 'hadith' ? ['narrator', 'source', 'complete'] : ['complete'];
    var k = kinds[Math.floor(Math.random() * kinds.length)];
    function mcq(field) {
      var right = it[field], pool = shuffle(had.map(function (h) { return h[field]; }).filter(function (x, i, a) { return x !== right && a.indexOf(x) === i; })).slice(0, 3);
      return shuffle([right].concat(pool));
    }
    if (k === 'narrator') return { it: it, k: k, q: 'من الراوي؟', show: it.lead + ' ' + it.matn, opts: mcq('narrator'), right: it.narrator };
    if (k === 'source') return { it: it, k: k, q: 'ما المصدر؟', show: it.narrator + ' ' + it.matn, opts: mcq('source'), right: it.source };
    var text = it.type === 'ayah' ? it.text : it.type === 'note' ? it.text : it.matn, words = text.split(' '), cut = Math.max(3, Math.min(8, Math.floor(words.length / 3)));
    return { it: it, k: k, q: it.type === 'ayah' ? 'أكمل الآية' : 'أكمل', show: words.slice(0, cut).join(' ') + ' …', rest: text, intro: it.type === 'ayah' ? it.intro : it.type === 'hadith' ? it.narrator + ' ' + (it.lead || '') : '' };
  }
  function renderQuiz() {
    var Q = S.quiz.cur, h = '<div class="row"><h1>اختبار مستمر</h1><span class="muted num">صواب ' + ar(S.quiz.right) + ' من ' + ar(S.quiz.n) + '</span></div>';
    h += '<section class="card item-card"><p class="quiz-q">' + Q.q + '</p>';
    if (Q.opts) {
      h += '<div class="tx matn">' + fmt(Q.show, 'full') + '</div><div class="opts">' + Q.opts.map(function (o, i) {
        var cls = Q.answered ? (o === Q.right ? 'right' : (i === Q.picked ? 'wrong' : '')) : '';
        return '<button type="button" class="' + cls + '" data-act="pick" data-i="' + i + '"' + (Q.answered ? ' disabled' : '') + '>' + fmt(o, 'full') + '</button>';
      }).join('') + '</div>';
    } else {
      if (Q.intro) h += '<p class="muted small">' + esc(Q.intro) + '</p>';
      h += Q.it.type === 'ayah' ? '<p class="quran">﴿' + fmt(Q.answered ? Q.rest : Q.show, 'full') + '﴾</p>' : '<div class="tx matn">' + fmt(Q.answered ? Q.rest : Q.show, 'full') + '</div>';
      h += Q.answered ? '' : '<button class="btn wide" type="button" data-act="quiz-show">أكملتها في نفسي، أظهر النص</button>';
      if (Q.answered && Q.self == null) h += '<div class="grade"><button class="btn soft" type="button" data-act="self" data-ok="0">أخطأت</button><button class="btn" type="button" data-act="self" data-ok="1">أصبت</button></div>';
    }
    h += '</section>';
    if (Q.answered && (Q.opts || Q.self != null)) h += '<button class="btn wide" type="button" data-act="quiz-next">التالي</button>';
    h += '<button class="btn ghost" type="button" data-act="quiz-end">إنهاء الاختبار</button>';
    view.innerHTML = h;
  }
  function quizResult(ok) {
    S.quiz.n++; if (ok) S.quiz.right++;
    if (!ok) srsGrade(S.quiz.cur.it.id, false);     // الخطأ يعيد العنصر إلى المراجعة غدًا
  }

  /* ---------- الإحصاءات ---------- */
  function renderStats() {
    var comps = D.wards.map(function (w) { return done(w.n); }).filter(Boolean);
    var onTime = comps.filter(function (c) { return c.points === 10; }).length;
    var h = '<div class="hello"><h1>الإحصاءات</h1><p class="muted">سيرك ونقاطك.</p></div>';
    h += '<div class="stat-grid">' +
      '<div class="stat"><b>' + ar(totalPoints()) + '</b><span>مجموع نقاطك</span></div>' +
      '<div class="stat"><b>' + ar(ME.rank.me.pos) + '</b><span>موضعك في الترتيب</span></div>' +
      '<div class="stat"><b>' + ar(comps.length) + ' / ' + ar(D.wards.length) + '</b><span>الأوراد المنجزة</span></div>' +
      '<div class="stat"><b>' + ar(onTime) + '</b><span>في وقتها</span></div>' +
      '<div class="stat"><b>' + ar(memorizedItems().length) + '</b><span>العناصر المحفوظة</span></div>' +
      '<div class="stat"><b>' + ar(Object.keys(counts).reduce(function (a, k) { return a + counts[k]; }, 0)) + '</b><span>مجموع التكرار</span></div></div>';
    h += '<section class="card"><h2>نقاط الأوراد</h2><ul class="sched">' + D.wards.filter(function (w) { return opened(w); }).map(function (w) {
      var d = done(w.n);
      return '<li><span class="d">' + dateTxt(w.date) + '</span><span class="t">الورد ' + ar(w.n) + '، ' + pagesTxt(w.pages) + (d ? '<small>تقييمك: ' + RATE[d.rating] + '</small>' : '') + '</span>' + statusChip(w) + '</li>';
    }).join('') + '</ul><p class="muted small">النقاط: الورد في يومه ١٠، والمتأخر ٥، والاختبار الأسبوعي حتى ٥٠.</p></section>';
    h += renderRankCard();
    view.innerHTML = h;
  }

  /* ---------- التوجيه والأحداث ---------- */
  function setTab(tab) {
    S.tab = tab;
    document.querySelectorAll('.tabs a').forEach(function (a) { if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }
  function render() {
    S.revealed = {};
    if (S.tab === 'home') renderHome();
    else if (S.tab === 'session') renderSession();
    else if (S.tab === 'review') renderReview();
    else renderStats();
  }
  function route() {
    var h = (location.hash || '#home').slice(1), m = h.match(/^session-(\d+)$/);
    if (m) { if (S.w !== +m[1]) { S.w = +m[1]; S.idx = 0; S.seg = 0; } setTab('session'); }
    else if (['home', 'session', 'review', 'stats'].indexOf(h) >= 0) { if (h === 'session' && S.tab !== 'session') { S.w = null; S.idx = 0; S.seg = 0; } setTab(h); }
    else setTab('home');
    if (S.tab !== 'session' && S.focus) stopFocus();
    render(); window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  function reveal(el) { var k = el.getAttribute('data-reveal'); S.revealed[k] = true; el.classList.remove('hide'); el.removeAttribute('role'); el.removeAttribute('aria-label'); }
  document.addEventListener('click', function (e) {
    var r = e.target.closest('[data-reveal].hide'); if (r) { reveal(r); return; }
    var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    var a = b.dataset.act, items = S.w ? wardItems(S.w) : [];
    if (a === 'close') closeSheet();
    else if (a === 'level') { S.level = b.dataset.level; render(); }
    else if (a === 'mode') { S.mode = b.dataset.mode; render(); }
    else if (a === 'next' || a === 'prev' || a === 'goto') {
      S.idx = a === 'goto' ? +b.dataset.i : S.idx + (a === 'next' ? 1 : -1); S.seg = 0; render();
      var card = $('.item-card'); if (card) card.scrollIntoView({ block: 'nearest' });
    }
    else if (a === 'seg') { var segs = segments(items[S.idx].matn); S.seg = Math.max(0, Math.min(segs.length - 1, S.seg + (+b.dataset.d))); render(); }
    else if (a === 'count') { var id = items[S.idx].id; counts[id] = (counts[id] || 0) + 1; ls('cnt', counts); if (targets[id] && counts[id] === targets[id]) toast('بلغت هدفك في هذا العنصر'); render(); }
    else if (a === 'video') {
      var c = chapter(ward(S.w).ch);
      sheet('<h2>مقطع ' + esc(c.title) + '</h2><div class="video-frame"><iframe src="' + esc(c.video.embed) + '" allow="autoplay; fullscreen" allowfullscreen title="مقطع الباب"></iframe></div><a class="btn ghost" href="' + esc(c.video.view) + '" target="_blank" rel="noopener">افتحه في درايف إن لم يعمل هنا</a><button class="btn wide" type="button" data-act="close">إغلاق</button>');
    }
    else if (a === 'focus') {
      sheet('<h2>جلسة تركيز</h2><p class="muted">يختفي كل شيء إلا العنصر الذي تحفظه حتى ينتهي الوقت.</p><div class="seg" role="group" aria-label="المدة">' + [15, 25, 40].map(function (m) { return '<button type="button" data-act="focus-go" data-m="' + m + '" aria-pressed="' + (m === 25) + '">' + ar(m) + ' دقيقة</button>'; }).join('') + '</div><button class="btn ghost" type="button" data-act="close">إلغاء</button>');
    }
    else if (a === 'focus-go') startFocus(+b.dataset.m);
    else if (a === 'focus-stop') stopFocus();
    else if (a === 'recite') {
      sheet('<h2>كيف كان تسميعك؟</h2><p class="muted">قيّم نفسك بصدق، فالتقييم يحدد مراجعتك القادمة.</p><div class="stack">' +
        [['excellent', 'ممتاز'], ['good', 'جيد'], ['weak', 'يحتاج مراجعة']].map(function (r) { return '<button class="btn ' + (r[0] === 'excellent' ? '' : 'soft') + ' wide" type="button" data-act="rate" data-r="' + r[0] + '">' + r[1] + '</button>'; }).join('') +
        '</div><button class="btn ghost" type="button" data-act="close">إلغاء</button>');
    }
    else if (a === 'rate') {
      var n = S.w, wasDone = !!done(n), rating = b.dataset.r; b.disabled = true;
      Api.call('complete', { w: n, rating: rating }).then(function (res) {
        ME = res; closeSheet(); if (!wasDone) srsInit(n, rating);
        if (S.focus) stopFocus();
        toast(wasDone ? 'عُدّل التقييم' : 'تم الورد، +' + ar(done(n).points) + ' نقاط');
        render();
      }).catch(function (err) { b.disabled = false; toast(err.message); });
    }
    else if (a === 'rank') {
      S.rankTrack = b.dataset.track;
      Api.call('rank', { track: S.rankTrack }).then(function (res) { ME.rank = res.rank; var card = $('#rankCard'); if (card) card.outerHTML = renderRankCard(); }).catch(function (err) { toast(err.message); });
    }
    else if (a === 'review-start') { S.review = { list: dueItems(), i: 0, shown: false }; render(); }
    else if (a === 'show') { S.review.shown = true; render(); }
    else if (a === 'grade') {
      srsGrade(S.review.list[S.review.i].id, b.dataset.ok === '1');
      if (S.review.i < S.review.list.length - 1) { S.review.i++; S.review.shown = false; } else { S.review = null; toast('أتممت مراجعة اليوم'); }
      render();
    }
    else if (a === 'review-end') { S.review = null; render(); }
    else if (a === 'quiz-start') { S.quiz = { n: 0, right: 0, cur: makeQuestion() }; render(); }
    else if (a === 'pick') { var Q = S.quiz.cur; Q.picked = +b.dataset.i; Q.answered = true; quizResult(Q.opts[Q.picked] === Q.right); render(); }
    else if (a === 'quiz-show') { S.quiz.cur.answered = true; render(); }
    else if (a === 'self') { S.quiz.cur.self = b.dataset.ok === '1'; quizResult(S.quiz.cur.self); render(); }
    else if (a === 'quiz-next') { S.quiz.cur = makeQuestion(); render(); }
    else if (a === 'quiz-end') { toast('صواب ' + ar(S.quiz.right) + ' من ' + ar(S.quiz.n)); S.quiz = null; render(); }
  });
  document.addEventListener('keydown', function (e) {
    var r = e.target.closest && e.target.closest('[data-reveal].hide');
    if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); reveal(r); }
  });
  document.addEventListener('change', function (e) {
    if (e.target.id === 'tgt' && S.w) {
      var id = wardItems(S.w)[S.idx].id, v = parseInt(e.target.value, 10);
      if (v > 0) targets[id] = v; else delete targets[id];
      ls('tgt', targets); render();
    }
  });

  /* ---------- البدء ---------- */
  function gate(msg) {
    var bot = (window.HM_CONFIG || {}).bot;
    view.innerHTML = '<div class="gate"><h1>حفظ المنهاج</h1><p>' + msg + '</p>' + (bot ? '<a class="btn" href="https://t.me/' + esc(bot) + '">افتح البوت</a>' : '') + '</div>';
    document.querySelector('.tabs').hidden = true;
  }
  function start() {
    Api.Auth.init();
    try { if (window.Telegram && Telegram.WebApp && Telegram.WebApp.initData) { Telegram.WebApp.ready(); Telegram.WebApp.expand(); } } catch (e) {}
    if (!Api.Auth.has()) return gate('ادخل إلى المنصة من بوت المسابقة في تيليجرام، فهو يعطيك رابطك الشخصي.');
    view.innerHTML = '<p class="muted" style="text-align:center;padding-top:20vh">جارٍ التحميل…</p>';
    fetch('content.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (data) {
      D = data; window.HM_DATA = D;
      return Api.call('boot');
    }).then(function (me) {
      ME = me;
      if (me.srs && !Object.keys(srs).length) { srs = me.srs; ls('srs', srs); }
      route();
    }).catch(function (err) {
      if (err && err.code === 'auth') gate(esc(err.message || 'افتح المنصة من البوت.'));
      else gate('تعذّر التحميل. تحقق من اتصالك ثم أعد فتح الصفحة.');
    });
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () {});
  start();
})();
