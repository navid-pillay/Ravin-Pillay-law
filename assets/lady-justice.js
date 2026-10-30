// Lady Justice on the home page.
//
// Opening: she is sketched part by part, lifts the scales into place, and the
// blindfold is the final stroke. Scrolling: the rest of the statue is drawn
// out below her. Every line traces itself only as far as a "drawing front"
// that follows the scroll, and each line has its own offset from that front,
// so the unfinished edge is staggered rather than a straight cut. A serpent at
// her feet is drawn last, then the inscription appears on the pedestal.
//
// Stroke data comes from assets/lady-justice-data.js (generated). Finished
// strokes are painted once onto offscreen layers, so each frame only draws
// the strokes still in progress.
(function () {
  var D = window.LADY_JUSTICE;
  var host = document.querySelector('[data-lady-justice]');
  if (!D || !host || !window.Path2D) return;

  // Opening timeline in seconds: [start, duration] for each part.
  var T = {
    construct: [0, .35], face: [.15, .75], eyes: [.55, .3], hair: [.6, .75], neck: [1, .3],
    robe: [1.1, .65], wings: [1.3, .95], snake: [1.85, .45], arm: [2.15, .5], blindfold: [3.2, .6]
  };
  var RAISE = [2.65, .65];                  // arm lifts the scales
  var EYES_OUT = [3.35, .35];               // eyes disappear under the blindfold
  var END = 4.6;                            // the pans have settled
  var LOWERED = -22;                        // arm angle (deg) before it lifts
  var SHOULDER = [250, 605], HAND = [174, 232], FULCRUM = [174, 280];
  var HOOK_L = [-122, 8], HOOK_R = [122, 8]; // pan hooks relative to the fulcrum
  var WING_ALPHA = .55;
  var GOLD_RIGS = { scale: 1, beam: 1, panL: 1, panR: 1 };
  var RIG_ORDER = ['arm', 'scale', 'beam', 'panL', 'panR'];
  // Parts below the opening view live on the lower canvas.
  var LOWER_PARTS = { skirt: 1, feet: 1, pedestal: 1, serpent: 1 };
  var STAGGER = 70;                         // how far (units) line ends wander around the front
  var FRONT_AHEAD = .85;                    // the front sits this far down the screen

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var box = D.box;

  var ease = function (p) { return p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; };
  var clamp = function (p) { return Math.max(0, Math.min(1, p)); };
  var hash = function (i) { var x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
  var apply = function (c, m) { c.setTransform(m.a, m.b, m.c, m.d, m.e, m.f); };
  var IDENTITY = new DOMMatrix();

  function decode(s) {
    var v = s.split(','), pts = [], x = 0, y = 0;
    for (var i = 0; i < v.length; i += 2) {
      x += +v[i]; y += +v[i + 1];
      pts.push([x / 2, y / 2]);
    }
    return pts;
  }

  // Same tapered-ribbon outline the generator uses for the static SVG.
  function ribbon(pts, w, ta, tb) {
    var n = pts.length, left = [], right = [];
    for (var i = 0; i < n; i++) {
      var a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, n - 1)];
      var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      var nx = -dy / L, ny = dx / L, t = n > 1 ? i / (n - 1) : 0;
      var prof = Math.min(1, t / ta, (1 - t) / tb);
      var hw = Math.max(.12, w * .5 * (.25 + .75 * Math.pow(Math.max(0, prof), .8)));
      left.push([pts[i][0] + nx * hw, pts[i][1] + ny * hw]);
      right.push([pts[i][0] - nx * hw, pts[i][1] - ny * hw]);
    }
    var p = new Path2D(), all = left.concat(right.reverse());
    p.moveTo(all[0][0], all[0][1]);
    for (var j = 1; j < all.length; j++) p.lineTo(all[j][0], all[j][1]);
    p.closePath();
    return p;
  }

  // ---- strokes
  var strokes = [], perPart = {};
  D.strokes.forEach(function (r) {
    var part = D.parts[r[0]];
    (perPart[part] = perPart[part] || []).push(r);
  });
  var n = 0;
  Object.keys(perPart).forEach(function (part) {
    var rows = perPart[part], win = T[part];
    rows.forEach(function (r, i) {
      var rig = D.rigs[r[1]] || null, pts = decode(r[7]), w = r[3] / 10;
      var ys = pts.map(function (p) { return p[1]; });
      var s = {
        part: part, rig: rig, op: r[2] / 100, w: w, trace: !!r[6],
        lower: !!LOWER_PARTS[part], serpent: part === 'serpent',
        fill: ribbon(pts, w, r[4] / 100, r[5] / 100),
        color: part === 'blindfold' || GOLD_RIGS[rig] ? D.gold : D.ink,
        pts: pts, ymin: Math.min.apply(null, ys), ymax: Math.max.apply(null, ys),
        jit: (hash(n) - .5) * 2 * STAGGER, delay: hash(n + .5) * .15,
        t0: win ? win[0] + win[1] * .85 * i / rows.length : null,
        dur: .14, state: 0
      };
      n++;
      var line = new Path2D(), cum = [0];
      line.moveTo(pts[0][0], pts[0][1]);
      for (var k = 1; k < pts.length; k++) {
        line.lineTo(pts[k][0], pts[k][1]);
        cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
      }
      // anything longer than a short tick is traced like a pencil line, so no line
      // ever appears in one piece past the front
      if (cum[cum.length - 1] > 30) s.trace = true;
      if (s.trace) {
        // draw downwards: if the stroke was recorded bottom-up, trace it from its far end
        s.rev = pts[0][1] > pts[pts.length - 1][1];
        s.line = line;
        s.cum = cum;
        s.len = cum[cum.length - 1];
        s.dur = s.lower ? Math.min(.9, .15 + s.len / 1500) : Math.min(.28, Math.max(.08, .06 + s.len / 3000));
      }
      strokes.push(s);
    });
  });
  var serpent = strokes.filter(function (s) { return s.serpent; });

  var masks = D.masks.map(function (m) {
    var pts = decode(m[1]), p = new Path2D();
    p.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
    p.closePath();
    return { rig: D.rigs[m[0]] || null, path: p };
  });

  // ---- the drawing front
  var frontR = Infinity, goal = -Infinity;

  // How much of a stroke the front allows: a length along the line for traced
  // strokes, or 1/0 for short strokes that fade in whole.
  function allowed(s) {
    if (frontR === Infinity) return s.trace ? s.len : 1;
    var lim = frontR + s.jit;
    if (!s.trace) return (s.ymin + s.ymax) / 2 <= lim ? 1 : 0;
    if (s.ymax <= lim) return s.len;
    var pts = s.pts, last = pts.length - 1, i;
    if (s.rev) {
      for (i = last; i >= 0 && pts[i][1] <= lim; i--);
      return s.len - s.cum[i + 1 > last ? last : i + 1];
    }
    for (i = 0; i <= last && pts[i][1] <= lim; i++);
    return i ? s.cum[i - 1] : 0;
  }

  function drawLive(c, s, v) {
    if (s.trace) {
      c.globalAlpha = s.op;
      c.strokeStyle = s.color;
      c.lineWidth = s.w * .8;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.setLineDash([v, s.len + 1]);
      c.lineDashOffset = s.rev ? -(s.len - v) : 0;
      c.stroke(s.line);
      c.setLineDash([]);
      c.lineDashOffset = 0;
    } else {
      c.globalAlpha = s.op * v;
      c.fillStyle = s.color;
      c.fill(s.fill);
    }
  }

  // ---- hero canvas (the opening view)
  var canvas = document.createElement('canvas');
  canvas.className = 'art-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Sketch of winged, blindfolded Lady Justice holding the scales, a serpent around her neck');
  host.appendChild(canvas);
  var ctx = canvas.getContext('2d');
  var layers = {}, V, Vinv;
  var LAYER_NAMES = ['wings', 'wingMask', 'figure', 'eyes'].concat(RIG_ORDER);
  var layerFor = function (s) { return s.part === 'wings' ? 'wings' : s.part === 'eyes' ? 'eyes' : s.rig || 'figure'; };

  function layoutHero() {
    var r = host.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    canvas.width = W;
    canvas.height = H;
    var k = Math.min(W / box[2], H / box[3]);
    V = new DOMMatrix([k, 0, 0, k, (W - box[2] * k) / 2 - box[0] * k, (H - box[3] * k) / 2 - box[1] * k]);
    Vinv = V.inverse();
    LAYER_NAMES.forEach(function (name) {
      var c = layers[name] || (layers[name] = document.createElement('canvas'));
      c.width = W;
      c.height = H;
    });
  }

  var rot = function (deg, c) { return new DOMMatrix().translate(c[0], c[1]).rotate(deg).translate(-c[0], -c[1]); };
  function pose(t) {
    t = Math.min(t, END + 10);
    var p = ease(clamp((t - RAISE[0]) / RAISE[1]));
    var theta = LOWERED * (1 - p);
    var s = t - RAISE[0] - RAISE[1];
    // the pans swing as the arm lifts, then settle level
    var phi = s < 0 ? -7 * Math.sin(p * Math.PI) : 6 * Math.sin(s * 5.5) * Math.exp(-s * 1.8);
    var r = phi * Math.PI / 180;
    var hook = function (d) {
      return new DOMMatrix().translate(d[0] * Math.cos(r) - d[1] * Math.sin(r) - d[0], d[0] * Math.sin(r) + d[1] * Math.cos(r) - d[1]);
    };
    var arm = rot(theta, SHOULDER), scale = arm.multiply(rot(-theta, HAND));
    return {
      rigs: { arm: arm, scale: scale, beam: scale.multiply(rot(phi, FULCRUM)), panL: scale.multiply(hook(HOOK_L)), panR: scale.multiply(hook(HOOK_R)) },
      armMask: t >= T.arm[0],
      eyes: 1 - clamp((t - EYES_OUT[0]) / EYES_OUT[1])
    };
  }

  function renderHero(t, live) {
    var P = pose(t), W = canvas.width, H = canvas.height;

    // wings, with the figure cut out of them
    var wm = layers.wingMask.getContext('2d');
    apply(wm, IDENTITY);
    wm.globalCompositeOperation = 'source-over';
    wm.globalAlpha = 1;
    wm.clearRect(0, 0, W, H);
    wm.drawImage(layers.wings, 0, 0);
    apply(wm, V);
    live.forEach(function (l) { if (l.s.part === 'wings') drawLive(wm, l.s, l.v); });
    wm.globalCompositeOperation = 'destination-out';
    wm.globalAlpha = 1;
    wm.fillStyle = wm.strokeStyle = '#000';
    wm.lineWidth = 8;
    wm.lineJoin = 'round';
    masks.forEach(function (m) {
      if (m.rig && !P.armMask) return;
      apply(wm, m.rig ? V.multiply(P.rigs[m.rig]) : V);
      wm.fill(m.path);
      wm.stroke(m.path);
    });

    apply(ctx, IDENTITY);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = WING_ALPHA;
    ctx.drawImage(layers.wingMask, 0, 0);
    if (P.eyes > 0) {
      ctx.globalAlpha = P.eyes;
      ctx.drawImage(layers.eyes, 0, 0);
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(layers.figure, 0, 0);
    // arm and scales, each at its current pose
    RIG_ORDER.forEach(function (rig) {
      apply(ctx, V.multiply(P.rigs[rig]).multiply(Vinv));
      ctx.globalAlpha = 1;
      ctx.drawImage(layers[rig], 0, 0);
    });
    live.forEach(function (l) {
      if (l.s.part === 'wings') return;
      apply(ctx, l.s.rig ? V.multiply(P.rigs[l.s.rig]) : V);
      drawLive(ctx, l.s, l.v);
    });
  }

  // ---- lower canvas (the rest of the statue, below the opening view)
  var section = document.querySelector('[data-lady-justice-lower]');
  var inscription = section && section.querySelector('[data-inscription]');
  var done, liveCanvas, dctx, lctx, LV, kk = 1;
  if (section) {
    done = document.createElement('canvas');
    liveCanvas = document.createElement('canvas');
    done.className = liveCanvas.className = 'art-canvas';
    done.setAttribute('aria-hidden', 'true');
    liveCanvas.setAttribute('aria-hidden', 'true');
    section.insertBefore(liveCanvas, section.firstChild);
    section.insertBefore(done, liveCanvas);
    dctx = done.getContext('2d');
    lctx = liveCanvas.getContext('2d');
  }

  function layoutLower() {
    if (!section) return;
    // line up exactly with the opening drawing: same scale, same left edge
    var art = host.getBoundingClientRect(), sec = section.getBoundingClientRect();
    kk = art.height / box[3];
    var w = art.width, h = (D.lower[1] - D.lower[0]) * kk;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    section.style.height = Math.ceil(h) + 'px';
    [done, liveCanvas].forEach(function (c) {
      c.style.left = (art.left - sec.left) + 'px';
      c.style.width = w + 'px';
      c.style.height = h + 'px';
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    });
    var u = kk * dpr;
    LV = new DOMMatrix([u, 0, 0, u, -box[0] * u, -D.lower[0] * u]);
    if (inscription) {
      var P = D.panel;
      inscription.classList.add('placed');
      inscription.style.left = (art.left - sec.left + (P[0] - box[0]) * kk) + 'px';
      inscription.style.top = (P[1] - D.lower[0]) * kk + 'px';
      inscription.style.width = (P[2] - P[0]) * kk + 'px';
      inscription.style.height = (P[3] - P[1]) * kk + 'px';
      inscription.style.fontSize = Math.max(11, Math.min(21, kk * 19)) + 'px';
    }
  }

  // ---- committing finished strokes
  function commit(s) {
    s.state = 2;
    var c;
    if (s.lower) {
      if (!section) return;
      c = dctx;
      apply(c, LV);
    } else {
      c = layers[layerFor(s)].getContext('2d');
      apply(c, V);
    }
    c.globalAlpha = s.op;
    c.fillStyle = s.color;
    c.fill(s.fill);
  }

  function relayout() {
    layoutHero();
    layoutLower();
    strokes.forEach(function (s) { if (s.state === 2) commit(s); });
  }

  // where the front should be: a little above the bottom of the screen
  function target() {
    if (!section) return Infinity;
    var doc = document.documentElement;
    if (window.innerHeight + window.scrollY >= doc.scrollHeight - 4) return Infinity;
    return D.lower[0] + (window.innerHeight * FRONT_AHEAD - section.getBoundingClientRect().top) / kk;
  }
  var END_R = D.lower[1] + STAGGER + 40;    // nothing is held back beyond this

  // ---- main loop
  var start = null, running = false, serpentStart = null, serpentLeft = serpent.length, heroSettled = false;

  function frame(now) {
    if (start === null) start = now;
    var t = (now - start) / 1000;

    // move the front towards the scroll position, gliding rather than jumping
    goal = Math.max(goal, target());
    var g = Math.min(goal, END_R);
    if (frontR < g) frontR = Math.min(g, frontR + Math.max(1.5, (g - frontR) * .12));
    if (frontR >= END_R) frontR = Infinity;
    var frontMoving = frontR !== Infinity && frontR < g;

    // the serpent at her feet comes last, once the visitor reaches the bottom
    if (serpentStart === null && frontR >= D.lower[1] - 30) {
      serpentStart = t;
      serpent.forEach(function (s, i) { s.t0 = t + 1.1 * i / serpent.length; });
    }

    var heroLive = [], lowerLive = [];
    for (var i = 0; i < strokes.length; i++) {
      var s = strokes[i];
      if (s.state === 2) continue;
      var a = s.serpent ? (serpentStart === null ? 0 : (s.trace ? s.len : 1)) : allowed(s);
      if (s.t0 === null) {
        if (!a || s.serpent) continue;
        s.t0 = t + s.delay;                 // a lower stroke the front has just reached
      }
      if (t < s.t0) continue;
      var p = clamp((t - s.t0) / s.dur), v;
      if (s.trace) {
        v = Math.min(s.len * ease(p), a);
        if (v >= s.len - .5) { commit(s); if (s.serpent) serpentLeft--; continue; }
      } else {
        v = a ? p : 0;
        if (v >= 1) { commit(s); if (s.serpent) serpentLeft--; continue; }
      }
      if (v > 0) (s.lower ? lowerLive : heroLive).push({ s: s, v: v });
    }

    var opening = t < END;
    if (opening || heroLive.length || !heroSettled) renderHero(t, heroLive);
    heroSettled = !opening && !heroLive.length;
    if (section) {
      apply(lctx, IDENTITY);
      lctx.clearRect(0, 0, liveCanvas.width, liveCanvas.height);
      apply(lctx, LV);
      lowerLive.forEach(function (l) { drawLive(lctx, l.s, l.v); });
    }
    if (serpentStart !== null && serpentLeft <= 0 && inscription) inscription.classList.add('shown');

    // keep going while anything is still animating; otherwise sleep until the next scroll
    // (strokes held back by the front stay on screen as drawn and resume on scroll)
    var busy = opening || frontMoving ||
      strokes.some(function (s) { return s.state !== 2 && s.t0 !== null && t < s.t0 + s.dur; });
    if (busy) requestAnimationFrame(frame); else running = false;
  }
  function wake() { if (!running) { running = true; requestAnimationFrame(frame); } }

  relayout();
  if (reduce) {
    frontR = Infinity;
    strokes.forEach(commit);
    renderHero(Infinity, []);
    if (inscription) inscription.classList.add('shown');
  } else {
    frontR = goal = target();
    window.addEventListener('scroll', wake, { passive: true });
    wake();
  }

  var timer;
  window.addEventListener('resize', function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      relayout();
      heroSettled = false;
      renderHero(start === null ? 0 : Infinity, []);
      wake();
    }, 120);
  });
})();
