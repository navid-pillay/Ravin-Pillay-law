// Navigation between pages.
//
// Knobs: the chosen knob turns on (clockwise) and the current one turns off.
// Page change: the content swings away in 3D while Lady Justice turns round
// and glides to where she stands on the next page (facing the content on the
// inner pages); the next page opens with her there and its content swinging
// in. Between inner pages she simply stays put.
(function () {
  var root = document.documentElement;
  try {
    if (sessionStorage.getItem('knobTurned')) root.classList.add('knob-arrived');
    sessionStorage.removeItem('knobTurned');
  } catch (e) {}
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var DURATION = 900;
  var EASE = 'cubic-bezier(.65, 0, .35, 1)';
  var isHome = root.classList.contains('is-home');

  // Where (and how faint) Lady Justice is on the other kind of page: measured
  // from an invisible copy laid out with the real stylesheet.
  function probe(toHome) {
    var holder = document.createElement('div'), el;
    if (toHome) {
      holder.className = 'home-hero';
      holder.style.cssText = 'position:fixed;top:0;left:0;width:100%;visibility:hidden;pointer-events:none';
      el = document.createElement('div');
      el.className = 'art';
      holder.appendChild(el);
    } else {
      el = holder;
      holder.className = 'lady-side';
      holder.style.visibility = 'hidden';
    }
    document.body.appendChild(holder);
    var r = el.getBoundingClientRect(), op = parseFloat(getComputedStyle(el).opacity);
    holder.remove();
    return { rect: r, opacity: op };
  }

  function moveLady(toHome) {
    var lady = isHome ? document.querySelector('.home-hero .art') : document.querySelector('.lady-side');
    if (!lady || isHome === toHome) return;  // between inner pages she stays where she is
    var to = probe(toHome);
    if (window.ladyJustice) {
      // she turns round in 3D as she glides into place (0 = facing left as on the home page,
      // 180 degrees = her mirror image, facing the content on the inner pages)
      window.ladyJustice.turn(lady, to.rect, to.opacity, isHome ? 0 : Math.PI, isHome ? Math.PI : 0, DURATION);
      return;
    }
    var from = lady.getBoundingClientRect();
    var dx = (to.rect.left + to.rect.width / 2) - (from.left + from.width / 2);
    var dy = (to.rect.top + to.rect.height / 2) - (from.top + from.height / 2);
    var base = getComputedStyle(lady).transform;
    base = base === 'none' ? '' : base + ' ';
    lady.animate([
      { transform: 'translate(0px, 0px) ' + base + 'scale(1)' },
      { transform: 'translate(' + dx + 'px, ' + dy + 'px) ' + base + 'scale(' + to.rect.height / from.height + ')' }
    ], { duration: DURATION, easing: EASE, fill: 'forwards' });
  }

  var links = document.querySelectorAll('.knob, .brand');
  links.forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
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
      moveLady(toHome);
      setTimeout(function () { location.href = a.href; }, DURATION);
    });
  });

  // coming Back to a page restored from the back/forward cache: put everything back
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    root.classList.remove('leaving');
    links.forEach(function (a) { a.classList.remove('turning', 'releasing'); });
    document.querySelectorAll('.art, .lady-side').forEach(function (el) {
      el.getAnimations().forEach(function (an) { an.cancel(); });
      el.style.visibility = '';
    });
    document.querySelectorAll('.turn-canvas').forEach(function (c) { c.remove(); });
  });
})();
