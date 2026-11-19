/* قواعد النقاط: ملف واحد يستعمله الخادم (أبس سكريبت) والواجهة (للعرض والتجربة).
   القرارات في docs/decisions.md. */
var Rules = (function () {
  // استثناء الورد الأول: يُحسب ١٠ لمن أنجزه حتى نهاية الجمعة ٢٠ نوفمبر
  var GRACE = { 1: '2026-11-20' };

  function isFriday(iso) {
    var d = new Date(iso + 'T12:00:00Z');
    return d.getUTCDay() === 5;
  }

  /* ward: {n, date}، localDate: تاريخ يوم الطالب بتوقيت بلده (yyyy-mm-dd).
     يعيد null إن لم يُفتح الورد بعد. */
  function points(ward, localDate) {
    if (localDate < ward.date) return null;
    if (localDate === ward.date) return 10;
    if (GRACE[ward.n] && localDate <= GRACE[ward.n]) return 10;
    if (isFriday(localDate)) return 10;   // الاستدراك يوم الجمعة
    return 5;
  }

  function status(ward, localDate, done) {
    if (done) return done.points === 10 ? 'ontime' : 'late';
    if (localDate < ward.date) return 'upcoming';
    if (localDate === ward.date) return 'today';
    return 'missed';
  }

  return { points: points, status: status, isFriday: isFriday, GRACE: GRACE };
})();
if (typeof module !== 'undefined') module.exports = Rules;
