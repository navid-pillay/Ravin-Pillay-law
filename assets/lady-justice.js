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
  var strokes = [], perPart = {};
  D.strokes.forEach(function (r) {
    var part = D.parts[r[0]];
    (perPart[part] = perPart[part] || []).push(r);
  });
  Object.keys(perPart).forEach(function (part) {
    var rows = perPart[part], win = T[part];
    rows.forEach(function (r, i) {
      var rig = D.rigs[r[1]] || null, pts = decode(r[7]), w = r[3] / 10;
      var s = {
        part: part, rig: rig, op: r[2] / 100, w: w, trace: !!r[6],
        fill: ribbon(pts, w, r[4] / 100, r[5] / 100),
        color: part === 'blindfold' || GOLD_RIGS[rig] ? D.gold : D.ink,
        t0: win[0] + win[1] * .85 * i / rows.length, dur: .14, state: 0
      };
      if (s.trace) {
        var pl = polyline(pts);
        s.line = pl.path;
        s.len = pl.len;
        s.dur = Math.min(.28, Math.max(.08, .06 + pl.len / 3000));
      }
      strokes.push(s);
    });
  });

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
  }

  resize();

  if (reduce) {
    strokes.forEach(function (s) { s.state = 2; commit(s); });
    render(Infinity, []);
  } else {
    var start = null;
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
      else render(Infinity, []);
    };
    requestAnimationFrame(frame);
  }

  var timer;
  window.addEventListener('resize', function () {
    clearTimeout(timer);
    timer = setTimeout(function () { resize(); render(Infinity, []); }, 120);
  });
})();
