// Knob navigation: the chosen knob turns on (clockwise) and the current one
// turns off before the next page loads, so the change reads as one smooth turn.
(function () {
  var root = document.documentElement;
  try {
    if (sessionStorage.getItem('knobTurned')) root.classList.add('knob-arrived');
    sessionStorage.removeItem('knobTurned');
  } catch (e) {}
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var links = document.querySelectorAll('.knob, .brand');
  links.forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      if (a.getAttribute('aria-current') === 'page') return;
      var current = document.querySelector('.knob[aria-current="page"]');
      if (current) current.classList.add('releasing');
      var isKnob = a.classList.contains('knob');
      if (isKnob) a.classList.add('turning');
      try { if (isKnob) sessionStorage.setItem('knobTurned', '1'); } catch (err) {}
      setTimeout(function () { location.href = a.href; }, 480);
    });
  });

  // coming Back to a page restored from the back/forward cache: reset the knobs
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    links.forEach(function (a) { a.classList.remove('turning', 'releasing'); });
  });
})();
