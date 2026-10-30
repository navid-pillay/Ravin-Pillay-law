// Info pages (Practice, About, Contact): the text types itself in when the page
// opens and un-types before the visitor leaves, while the panels wipe in and
// out. Many lines type at once so it stays quick. Not used on the home page.
//
// Each run of text is split into the typed part and an invisible remainder that
// keeps its space, so the layout never shifts while typing.
(function () {
  var root = document.documentElement;
  var scopes = document.querySelectorAll('.page, .site-foot');
  if (!scopes.length) return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TYPE_IN = 700, TYPE_OUT = 450;   // ms
  var panels = Array.prototype.slice.call(document.querySelectorAll('.panel'));
  var items = [];

  function wrap() {
    if (items.length) return;
    scopes.forEach(function (el) {
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) { return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP; }
      });
      var nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(function (n) {
        var shown = document.createTextNode(''), ghost = document.createElement('span');
        ghost.className = 'type-ghost';
        ghost.textContent = n.nodeValue;
        n.parentNode.insertBefore(shown, n);
        n.parentNode.replaceChild(ghost, n);
        items.push({ shown: shown, ghost: ghost, text: ghost.textContent, k: -1 });
      });
    });
    // place each run on a shared timeline in reading order
    var total = items.reduce(function (a, it) { return a + it.text.length; }, 0) || 1, acc = 0;
    items.forEach(function (it) { it.at = acc / total; acc += it.text.length; });
  }

  function unwrap() {
    items.forEach(function (it) {
      it.ghost.parentNode.replaceChild(document.createTextNode(it.text), it.ghost);
      it.shown.remove();
    });
    items = [];
  }

  // p = 0: nothing shown, p = 1: everything shown
  function show(p) {
    items.forEach(function (it) {
      // each run types within its own window; the windows overlap so many lines type at once
      var start = it.at * .55, f = Math.max(0, Math.min(1, (p - start) / .45));
      var k = Math.round(it.text.length * f);
      if (k === it.k) return;
      it.k = k;
      it.shown.nodeValue = it.text.slice(0, k);
      it.ghost.textContent = it.text.slice(k);
    });
    var edge = p * 115 - 15;
    panels.forEach(function (el) {
      el.style.webkitMaskImage = el.style.maskImage =
        p >= 1 ? '' : 'linear-gradient(to bottom, #000 ' + edge + '%, transparent ' + (edge + 15) + '%)';
    });
  }

  function run(from, to, duration, done) {
    var t0 = null;
    (function step(now) {
      if (t0 === null) t0 = now;
      var p = Math.min(1, (now - t0) / duration);
      show(from + (to - from) * p);
      if (p < 1) requestAnimationFrame(step); else if (done) done();
    })(performance.now());
  }

  // type in on arrival
  if (!reduce) {
    wrap();
    show(0);
    root.classList.remove('typing');
    run(0, 1, TYPE_IN, unwrap);
  }
  root.classList.remove('typing');

  window.pageText = {
    duration: reduce ? 0 : TYPE_OUT,
    untype: function () {
      if (reduce) return;
      wrap();
      show(1);
      run(1, 0, TYPE_OUT);
    }
  };
})();
