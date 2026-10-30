// Navigation between pages.
//
// Knobs: the chosen knob turns on (clockwise) and the current one turns off.
// Page change: Lady Justice un-draws herself (and on the info pages the text
// un-types), then the next page draws her afresh in her new place (facing the
// content on the inner pages). Between inner pages she simply stays put.
(function () {
  var root = document.documentElement;
  try {
    if (sessionStorage.getItem('knobTurned')) root.classList.add('knob-arrived');
    sessionStorage.removeItem('knobTurned');
  } catch (e) {}

  // The pedestal inscription: tap it and the words glow gold, fade over to the
  // other language, then the glow settles back to the usual steel.
  document.querySelectorAll('.inscription-toggle').forEach(function (btn) {
    var box = btn.closest('.inscription');
    var latin = btn.querySelector('.latin'), english = btn.querySelector('.english');
    var busy = false;
    var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    btn.addEventListener('click', function () {
      if (busy) return;
      busy = true;
      var toEnglish = !box.classList.contains('translated');
      var swap = function () {
        box.classList.toggle('translated', toEnglish);
        btn.setAttribute('aria-pressed', toEnglish ? 'true' : 'false');
        btn.title = toEnglish ? 'Tap for the original Latin' : 'Tap for the English translation';
        latin.setAttribute('aria-hidden', toEnglish ? 'true' : 'false');
        english.setAttribute('aria-hidden', toEnglish ? 'false' : 'true');
      };
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) { swap(); busy = false; return; }
      box.classList.add('glow');
      wait(450)
        .then(function () { swap(); return wait(750); })
        .then(function () { box.classList.remove('glow'); return wait(450); })
        .then(function () { busy = false; });
    });
  });

  var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DURATION = 750;
  var EASE = 'cubic-bezier(.65, 0, .35, 1)';
  var isHome = root.classList.contains('is-home');

  // returns true if she is un-drawn (not when moving between inner pages, where she stays)
  function undrawLady(toHome) {
    var lady = isHome ? document.querySelector('.home-hero .art') : document.querySelector('.lady-side');
    if (!lady || isHome === toHome) return false;
    if (window.ladyJustice) window.ladyJustice.undraw(lady, !isHome, DURATION);
    else lady.animate([{ opacity: getComputedStyle(lady).opacity }, { opacity: 0 }], { duration: DURATION, fill: 'forwards' });
    return true;
  }

  var links = document.querySelectorAll('.knob, .brand');
  links.forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (reduceMotion || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      if (a.getAttribute('aria-current') === 'page' || root.classList.contains('leaving')) return;
      var current = document.querySelector('.knob[aria-current="page"]');
      if (current) current.classList.add('releasing');
      var isKnob = a.classList.contains('knob');
      if (isKnob) a.classList.add('turning');
      var toHome = /(^|\/)(index\.html)?$/.test(new URL(a.href).pathname);
      try {
        if (isKnob) sessionStorage.setItem('knobTurned', '1');
        sessionStorage.setItem('navFrom', isHome ? 'home' : 'inner');
      } catch (err) {}
      root.classList.remove('from-home', 'from-inner');
      root.classList.add('leaving');
      // on the info pages the text un-types too (assets/type.js)
      var text = window.pageText;
      if (text) text.untype();
      var wait = undrawLady(toHome) ? DURATION : text ? text.duration + 30 : DURATION;
      setTimeout(function () { location.href = a.href; }, wait);
    });
  });

  // A page restored by the Back button comes back frozen mid-transition: load it
  // afresh instead, so Lady Justice is drawn again (see the reload check in <head>).
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    try {
      sessionStorage.setItem('bfReload', '1');
      sessionStorage.setItem('navFrom', isHome ? 'inner' : 'home');
    } catch (err) {}
    location.reload();
  });
})();
