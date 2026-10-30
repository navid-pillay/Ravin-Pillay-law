// Navigation between pages.
//
// Knobs: the chosen knob turns on (clockwise) and the current one turns off.
// Page change: Lady Justice un-draws herself, then the next page draws her
// afresh in her new place (facing the content on the inner pages). Between
// inner pages she simply stays put.
(function () {
  var root = document.documentElement;
  try {
    if (sessionStorage.getItem('knobTurned')) root.classList.add('knob-arrived');
    sessionStorage.removeItem('knobTurned');
  } catch (e) {}

  var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DURATION = 750;
  var EASE = 'cubic-bezier(.65, 0, .35, 1)';
  var isHome = root.classList.contains('is-home');

  function undrawLady(toHome) {
    var lady = isHome ? document.querySelector('.home-hero .art') : document.querySelector('.lady-side');
    if (!lady || isHome === toHome) return;  // between inner pages she stays where she is
    if (window.ladyJustice) window.ladyJustice.undraw(lady, !isHome, DURATION);
    else lady.animate([{ opacity: getComputedStyle(lady).opacity }, { opacity: 0 }], { duration: DURATION, fill: 'forwards' });
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
      undrawLady(toHome);
      setTimeout(function () { location.href = a.href; }, DURATION);
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
