// Opening animation for the home page: Lady Justice is sketched part by part
// on a canvas, lifts the scales into place, and the blindfold is the final
// stroke. Stroke data comes from assets/lady-justice-data.js (generated).
//
// Finished strokes are painted once onto offscreen layers, so each frame only
// draws the handful of strokes still in progress. That keeps it smooth on
// phones and tablets.
(function () {
  var D = window.LADY_JUSTICE;
  var host = document.querySelector('[data-lady-justice]');
  if (!D || !host || !window.Path2D) return;

  // Timeline in seconds: [start, duration] for each part of the drawing.
  var T = {
    construct: [0, .35], face: [.15, .75], eyes: [.55, .3], hair: [.6, .75], neck: [1, .3],
    robe: [1.1, .65], wings: [1.3, .95], snake: [1.85, .45], arm: [2.15, .5], blindfold: [3.2, .6]
  };
  var RAISE = [2.65, .65];                  // arm lifts the scales
  var EYES_OUT = [3.35, .35];               // eyes disappear under the blindfold
  var END = 4.6;                            // last moment the pans are still settling
  var LOWERED = -22;                        // arm angle (deg) before it lifts
  var SHOULDER = [250, 605], HAND = [174, 232], FULCRUM = [174, 280];
  var HOOK_L = [-122, 8], HOOK_R = [122, 8]; // pan hooks relative to the fulcrum
  var WING_ALPHA = .55;
  var GOLD_RIGS = { scale: 1, beam: 1, panL: 1, panR: 1 };
  var RIG_ORDER = ['arm', 'scale', 'beam', 'panL', 'panR'];

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var box = D.box;

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

  function polyline(pts) {
    var p = new Path2D(), len = 0;
    p.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) {
      p.lineTo(pts[i][0], pts[i][1]);
      len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    return { path: p, len: len };
  }

  // ---- strokes and their schedule
  // Parts below the opening view are drawn as the visitor scrolls instead.
  var LOWER_PARTS = { skirt: 1, feet: 1, pedestal: 1, serpent: 1 };
  var strokes = [], lowerStrokes = [], perPart = {};
  D.strokes.forEach(function (r) {
    var part = D.parts[r[0]];
    (perPart[part] = perPart[part] || []).push(r);
  });
  Object.keys(perPart).forEach(function (part) {
    var rows = perPart[part], win = T[part];
    rows.forEach(function (r, i) {
      var s = makeStroke(r, part);
      if (LOWER_PARTS[part]) {
        // the serpent at her feet is the last thing drawn, once the visitor reaches the bottom
        s.y = part === 'serpent' ? D.lower[1] + 1 : s.ymin;
        lowerStrokes.push(s);
      } else {
        s.t0 = win[0] + win[1] * .85 * i / rows.length;
        strokes.push(s);
      }
    });
  });

  function makeStroke(r, part) {
    var rig = D.rigs[r[1]] || null, pts = decode(r[7]), w = r[3] / 10;
    var s = {
      part: part, rig: rig, op: r[2] / 100, w: w, trace: !!r[6],
      fill: ribbon(pts, w, r[4] / 100, r[5] / 100),
      color: part === 'blindfold' || GOLD_RIGS[rig] ? D.gold : D.ink,
      dur: .14, state: 0,
      ymin: pts.reduce(function (m, p) { return Math.min(m, p[1]); }, Infinity)
    };
    if (s.trace) {
      var pl = polyline(pts);
      s.line = pl.path;
      s.len = pl.len;
      s.dur = Math.min(.28, Math.max(.08, .06 + pl.len / 3000));
    }
    return s;
  }

  var masks = D.masks.map(function (m) {
    var pts = decode(m[1]), p = new Path2D();
    p.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
    p.closePath();
    return { rig: D.rigs[m[0]] || null, path: p };
  });

  // ---- canvases
  var canvas = document.createElement('canvas');
  canvas.className = 'art-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Sketch of winged, blindfolded Lady Justice holding the scales, a serpent around her neck');
  host.appendChild(canvas);
  var ctx = canvas.getContext('2d');
  var layers = {}, V, Vinv;
  var LAYER_NAMES = ['wings', 'wingMask', 'figure', 'eyes'].concat(RIG_ORDER);

  function layerFor(s) {
    if (s.part === 'wings') return 'wings';
    if (s.part === 'eyes') return 'eyes';
    return s.rig || 'figure';
  }

  function resize() {
    var r = host.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    canvas.width = W;
    canvas.height = H;
    var k = Math.min(W / box[2], H / box[3]);
    var ox = (W - box[2] * k) / 2 - box[0] * k, oy = (H - box[3] * k) / 2 - box[1] * k;
    V = new DOMMatrix([k, 0, 0, k, ox, oy]);
    Vinv = V.inverse();
    LAYER_NAMES.forEach(function (n) {
      var c = layers[n] || (layers[n] = document.createElement('canvas'));
      c.width = W;
      c.height = H;
    });
    // repaint everything already finished
    strokes.forEach(function (s) { if (s.state === 2) commit(s); });
  }

  function apply(c, m) { c.setTransform(m.a, m.b, m.c, m.d, m.e, m.f); }

  function commit(s) {
    var c = layers[layerFor(s)].getContext('2d');
    apply(c, V);
    c.globalAlpha = s.op;
    c.fillStyle = s.color;
    c.fill(s.fill);
  }

  function drawLive(c, s, p) {
    if (s.trace) {
      c.globalAlpha = s.op;
      c.strokeStyle = s.color;
      c.lineWidth = s.w * .8;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.setLineDash([s.len * p, s.len + 1]);
      c.stroke(s.line);
      c.setLineDash([]);
    } else {
      c.globalAlpha = s.op * p;
      c.fillStyle = s.color;
      c.fill(s.fill);
    }
  }

  // ---- pose of the arm and scales at time t
  var ease = function (p) { return p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; };
  var clamp = function (p) { return Math.max(0, Math.min(1, p)); };
  var rot = function (deg, c) { return new DOMMatrix().translate(c[0], c[1]).rotate(deg).translate(-c[0], -c[1]); };

  function pose(t) {
    t = Math.min(t, END + 10);              // 'finished' is passed as Infinity
    var p = ease(clamp((t - RAISE[0]) / RAISE[1]));
    var theta = LOWERED * (1 - p);
    var s = t - RAISE[0] - RAISE[1];
    // the pans swing as the arm lifts, then settle level
    var phi = s < 0 ? -7 * Math.sin(p * Math.PI) : 6 * Math.sin(s * 5.5) * Math.exp(-s * 1.8);
    var r = phi * Math.PI / 180;
    var hook = function (d) {
      return new DOMMatrix().translate(d[0] * Math.cos(r) - d[1] * Math.sin(r) - d[0], d[0] * Math.sin(r) + d[1] * Math.cos(r) - d[1]);
    };
    var arm = rot(theta, SHOULDER);
    var scale = arm.multiply(rot(-theta, HAND));
    return {
      rigs: { arm: arm, scale: scale, beam: scale.multiply(rot(phi, FULCRUM)), panL: scale.multiply(hook(HOOK_L)), panR: scale.multiply(hook(HOOK_R)) },
      armMask: t >= T.arm[0],
      eyes: 1 - clamp((t - EYES_OUT[0]) / EYES_OUT[1])
    };
  }

  // ---- the drawing front
  // Everything below `frontR` (in drawing units) is not drawn yet. The front is
  // ragged, so lines end at staggered heights instead of a straight cut, and it
  // moves down as the visitor scrolls.
  var frontR = Infinity;
  var hash = function (i) { var x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };
  function frontPath(R) {
    var p = new Path2D(), x0 = box[0] - 20, x1 = box[0] + box[2] + 20, step = 9;
    p.moveTo(x0, -1e5);
    p.lineTo(x1, -1e5);
    for (var i = 0, x = x1; x > x0; i++, x -= step) {
      var off = 34 * Math.sin(x * .021 + 1.3) + 22 * Math.sin(x * .067 + 4.1) + (hash(i) - .5) * 70;
      p.lineTo(x, R + off);
      p.lineTo(x - step, R + off);
    }
    p.closePath();
    return p;
  }

  // ---- one frame
  function render(t, live) {
    var P = pose(t);
    var W = canvas.width, H = canvas.height;

    // wings, with the figure cut out of them
    var wm = layers.wingMask.getContext('2d');
    wm.setTransform(1, 0, 0, 1, 0, 0);
    wm.globalCompositeOperation = 'source-over';
    wm.globalAlpha = 1;
    wm.clearRect(0, 0, W, H);
    wm.drawImage(layers.wings, 0, 0);
    apply(wm, V);
    live.forEach(function (l) { if (l.s.part === 'wings') drawLive(wm, l.s, l.p); });
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

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (frontR < Infinity) {
      apply(ctx, V);
      ctx.clip(frontPath(frontR));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.globalAlpha = WING_ALPHA;
    ctx.drawImage(layers.wingMask, 0, 0);

    // eyes (fade out as the blindfold goes on)
    if (P.eyes > 0) {
      ctx.globalAlpha = P.eyes;
      ctx.drawImage(layers.eyes, 0, 0);
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(layers.figure, 0, 0);

    // arm and scales, each drawn at its current pose
    RIG_ORDER.forEach(function (rig) {
      apply(ctx, V.multiply(P.rigs[rig]).multiply(Vinv));
      ctx.globalAlpha = 1;
      ctx.drawImage(layers[rig], 0, 0);
    });

    // strokes still being drawn
    live.forEach(function (l) {
      var s = l.s;
      if (s.part === 'wings') return;
      apply(ctx, s.rig ? V.multiply(P.rigs[s.rig]) : V);
      drawLive(ctx, s, l.p);
    });
    ctx.restore();
  }

  resize();

  if (reduce) {
    strokes.forEach(function (s) { s.state = 2; commit(s); });
    render(Infinity, []);
  } else {
    var start = null, openingDone = false;
    var frame = function (now) {
      if (start === null) start = now;
      var t = (now - start) / 1000, live = [];
      for (var i = 0; i < strokes.length; i++) {
        var s = strokes[i];
        if (s.state === 2 || t < s.t0) continue;
        var p = (t - s.t0) / s.dur;
        if (p >= 1) { s.state = 2; commit(s); } else { s.state = 1; live.push({ s: s, p: s.trace ? ease(p) : p }); }
      }
      render(t, live);
      if (t < END || live.length) requestAnimationFrame(frame);
      else { openingDone = true; render(Infinity, []); }
    };
    requestAnimationFrame(frame);
  }

  // ---- the rest of the statue, revealed as the visitor scrolls down
  var section = document.querySelector('[data-lady-justice-lower]');
  var layoutLower = function () {};
  if (section && lowerStrokes.length) {
    var done = document.createElement('canvas'), liveCanvas = document.createElement('canvas');
    var full = document.createElement('canvas'), serpLayer = document.createElement('canvas');
    done.className = liveCanvas.className = 'art-canvas';
    done.setAttribute('aria-hidden', 'true');
    liveCanvas.setAttribute('aria-hidden', 'true');
    section.insertBefore(liveCanvas, section.firstChild);
    section.insertBefore(done, liveCanvas);
    var inscription = section.querySelector('[data-inscription]');
    var dctx = done.getContext('2d'), lctx = liveCanvas.getContext('2d');
    var body = lowerStrokes.filter(function (s) { return s.part !== 'serpent'; });
    var serpent = lowerStrokes.filter(function (s) { return s.part === 'serpent'; });
    var kk = 1, LV, goal = -Infinity, running = false, serpentStart = null, serpentLeft = serpent.length;

    var paint = function (c, s) { c.globalAlpha = s.op; c.fillStyle = s.color; c.fill(s.fill); };

    layoutLower = function () {
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
      });
      [done, liveCanvas, full, serpLayer].forEach(function (c) {
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
      // the whole lower robe and pedestal are painted once, then uncovered by the front
      var fctx = full.getContext('2d'), sctx = serpLayer.getContext('2d');
      apply(fctx, LV);
      body.forEach(function (s) { paint(fctx, s); });
      apply(sctx, LV);
      serpent.forEach(function (s) { if (s.state === 2) paint(sctx, s); });
      drawLower();
    };

    var drawLower = function () {
      apply(dctx, new DOMMatrix());
      dctx.globalAlpha = 1;
      dctx.clearRect(0, 0, done.width, done.height);
      dctx.save();
      if (frontR < Infinity) {
        apply(dctx, LV);
        dctx.clip(frontPath(frontR));
        apply(dctx, new DOMMatrix());
      }
      dctx.drawImage(full, 0, 0);
      dctx.restore();
      dctx.drawImage(serpLayer, 0, 0);
    };

    // where the front should be: a little ahead of the bottom of the screen
    var target = function () {
      var doc = document.documentElement;
      if (window.innerHeight + window.scrollY >= doc.scrollHeight - 4) return Infinity;
      return D.lower[0] + (window.innerHeight * .85 - section.getBoundingClientRect().top) / kk;
    };
    var END_R = D.lower[1] + 160;   // far enough below the pedestal that nothing is clipped

    var tick = function (now) {
      var t = now / 1000;
      goal = Math.max(goal, target());
      var g = Math.min(goal, END_R);
      // glide towards the goal so lines grow smoothly rather than jumping with the scroll
      if (frontR < g) frontR = Math.min(g, frontR + Math.max(1.5, (g - frontR) * .12));
      if (frontR >= END_R) frontR = Infinity;
      if (openingDone && frontR < D.lower[0] + 200) render(Infinity, []);
      else if (openingDone && frontR === Infinity) render(Infinity, []);

      // the serpent at her feet is drawn last, once the visitor reaches the bottom
      if (serpentStart === null && frontR >= D.lower[1] - 30) {
        serpentStart = t;
        serpent.forEach(function (s, i) { s.t0 = t + 1.1 * i / serpent.length; });
      }
      apply(lctx, new DOMMatrix());
      lctx.clearRect(0, 0, liveCanvas.width, liveCanvas.height);
      var serpentBusy = false;
      if (serpentStart !== null && serpentLeft) {
        var sctx = serpLayer.getContext('2d');
        apply(sctx, LV);
        apply(lctx, LV);
        serpent.forEach(function (s) {
          if (s.state === 2 || t < s.t0) { if (s.state !== 2) serpentBusy = true; return; }
          var p = (t - s.t0) / s.dur;
          if (p >= 1) {
            s.state = 2;
            paint(sctx, s);
            if (--serpentLeft === 0 && inscription) inscription.classList.add('shown');
          } else {
            serpentBusy = true;
            drawLive(lctx, s, s.trace ? ease(p) : p);
          }
        });
      }
      drawLower();
      if (frontR < g || serpentBusy) requestAnimationFrame(tick); else running = false;
    };
    var wake = function () { if (!running) { running = true; requestAnimationFrame(tick); } };

    if (reduce) {
      serpent.forEach(function (s) { s.state = 2; });
      serpentLeft = 0;
      layoutLower();
      if (inscription) inscription.classList.add('shown');
    } else {
      layoutLower();
      frontR = target();
      goal = frontR;
      drawLower();
      window.addEventListener('scroll', wake, { passive: true });
      wake();
    }
  }

  var timer;
  window.addEventListener('resize', function () {
    clearTimeout(timer);
    timer = setTimeout(function () { resize(); render(Infinity, []); layoutLower(); }, 120);
  });
})();
