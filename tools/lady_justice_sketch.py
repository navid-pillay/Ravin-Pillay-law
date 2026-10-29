"""Generates a pencil-style sketch of winged, blindfolded Lady Justice
(head turned ~45deg to the viewer's left, tilted down) as an SVG."""
import math, random, sys

random.seed(11)
X0, W, H = -140, 900, 1000
INK = "#d9b878"

# ---------------------------------------------------------------- geometry
def catmull(pts, step=5.0):
    """Centripetal-ish Catmull-Rom through pts, resampled ~every `step` px."""
    if len(pts) < 2:
        return pts
    P = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        seg = math.dist(p1, p2)
        n = max(2, int(seg / step))
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
                             for a, b, c, d in zip(p0, p1, p2, p3)))
    out.append(pts[-1])
    return out

def wobble(pts, amp):
    if amp == 0:
        return pts
    ph1, ph2 = random.uniform(0, 6.28), random.uniform(0, 6.28)
    f1, f2 = random.uniform(0.015, 0.03), random.uniform(0.05, 0.09)
    out, s = [], 0.0
    for i, p in enumerate(pts):
        if i:
            s += math.dist(p, pts[i - 1])
        j = i if i < len(pts) - 1 else i - 1
        q = pts[min(j + 1, len(pts) - 1)]
        r = pts[j] if j + 1 < len(pts) else pts[j - 1]
        dx, dy = q[0] - r[0], q[1] - r[1]
        L = math.hypot(dx, dy) or 1
        nx, ny = -dy / L, dx / L
        o = amp * (math.sin(s * f1 + ph1) * 0.7 + math.sin(s * f2 + ph2) * 0.3)
        out.append((p[0] + nx * o, p[1] + ny * o))
    return out

def ribbon(pts, w, taper=(0.18, 0.25)):
    """Tapered filled stroke polygon around a polyline."""
    n = len(pts)
    if n < 2:
        return ""
    left, right = [], []
    for i, p in enumerate(pts):
        a = pts[max(i - 1, 0)]
        b = pts[min(i + 1, n - 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy) or 1
        nx, ny = -dy / L, dx / L
        t = i / (n - 1)
        prof = min(1.0, t / taper[0] if taper[0] else 1, (1 - t) / taper[1] if taper[1] else 1)
        hw = max(0.12, w * 0.5 * (0.25 + 0.75 * max(0, prof) ** 0.8))
        left.append((p[0] + nx * hw, p[1] + ny * hw))
        right.append((p[0] - nx * hw, p[1] - ny * hw))
    poly = left + right[::-1]
    return "M" + "L".join(f"{x:.0f},{y:.0f}" if w > 1.4 else f"{x:.1f},{y:.1f}" for x, y in poly) + "Z"

# Every stroke is recorded with the body part it belongs to (drives the
# drawing order of the opening animation) and an optional rig group (parts
# that move: the raised arm and the scales).
RECS = []
CUR = {"part": "construct", "rig": None}

def part(name, rig=None):
    CUR["part"], CUR["rig"] = name, rig

def add(d, op, center=None, w=None):
    RECS.append(dict(CUR, d=d, op=round(op, 2), c=center, w=w))

def stroke(pts, w=1.6, op=1.0, passes=2, wob=0.8, taper=(0.18, 0.25)):
    base = catmull(pts)
    line = wobble(base, wob * 0.5)
    add(ribbon(line, w, taper), op, center=line if w >= 1.2 else None, w=w)
    for k in range(passes - 1):
        jit = [(x + random.uniform(-1.2, 1.2), y + random.uniform(-1.2, 1.2)) for x, y in pts]
        add(ribbon(wobble(catmull(jit), wob * 1.6), w * 0.55, (0.35, 0.35)), op * 0.45)

def ellipse_pts(cx, cy, rx, ry, a0=0, a1=360, rot=0, n=24):
    r = math.radians(rot)
    out = []
    for i in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * i / n)
        x, y = rx * math.cos(a), ry * math.sin(a)
        out.append((cx + x * math.cos(r) - y * math.sin(r), cy + x * math.sin(r) + y * math.cos(r)))
    return out

def hatch(poly, angle, spacing, w=0.8, op=0.55, jitter=1.5, inset=0.0):
    """Parallel hatch lines clipped to polygon `poly`."""
    a = math.radians(angle)
    ca, sa = math.cos(-a), math.sin(-a)
    rp = [(x * ca - y * sa, x * sa + y * ca) for x, y in poly]
    ys = [p[1] for p in rp]
    y = min(ys) + spacing * random.uniform(0.3, 0.9)
    cb, sb = math.cos(a), math.sin(a)
    while y < max(ys):
        xs = []
        for i in range(len(rp)):
            (x1, y1), (x2, y2) = rp[i], rp[(i + 1) % len(rp)]
            if (y1 <= y < y2) or (y2 <= y < y1):
                xs.append(x1 + (y - y1) * (x2 - x1) / (y2 - y1))
        xs.sort()
        for i in range(0, len(xs) - 1, 2):
            x0 = xs[i] + random.uniform(0, jitter * 2) + inset
            x1 = xs[i + 1] - random.uniform(0, jitter * 2) - inset
            if x1 - x0 < 3:
                continue
            yy = y + random.uniform(-jitter, jitter) * 0.4
            seg = [(x0, yy), (x1, yy + random.uniform(-jitter, jitter))]
            pts = [(px * cb - py * sb, px * sb + py * cb) for px, py in seg]
            n = max(2, int(math.dist(*pts) / 10))
            line = [(pts[0][0] + (pts[1][0] - pts[0][0]) * k / n, pts[0][1] + (pts[1][1] - pts[0][1]) * k / n) for k in range(n + 1)]
            add(ribbon(line, w, (0.25, 0.3)), op)
        y += spacing * random.uniform(0.85, 1.15)

def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)

def resample(pts, n):
    c = catmull(pts, 1.0)
    d = [0.0]
    for i in range(1, len(c)):
        d.append(d[-1] + math.dist(c[i], c[i - 1]))
    out, j = [], 0
    for k in range(n):
        target = d[-1] * k / (n - 1)
        while j < len(d) - 2 and d[j + 1] < target:
            j += 1
        span = (d[j + 1] - d[j]) or 1
        out.append(lerp(c[j], c[j + 1], (target - d[j]) / span))
    return out

# ---------------------------------------------------------------- wings
MASK = []  # (polygon, rig) silhouettes drawn in front of the wings

def mask_add(poly):
    MASK.append((poly, CUR["rig"]))

def wing(mirror):
    cx = 465
    mx = (lambda p: (2 * cx - p[0], p[1])) if mirror else (lambda p: p)
    edge = [(468, 520), (440, 430), (392, 320), (322, 212), (232, 132), (130, 88), (20, 86)]
    E = resample(edge, 240)
    stroke([mx(p) for p in edge], 3.0, 1.0, passes=3, wob=1.2)
    stroke([mx((p[0] + 6, p[1] + 8)) for p in edge[1:-1]], 1.2, 0.6, passes=1)
    rows = [  # (count, t0, t1, len_body, len_tip, width, op)
        (24, 0.08, 0.99, 140, 330, 32, 0.85),
        (20, 0.06, 0.95, 80, 170, 26, 0.9),
        (18, 0.05, 0.9, 40, 80, 18, 0.85),
    ]
    for n, t0, t1, l0, l1, fw, op in rows:
        for i in range(n):
            t = t1 - (t1 - t0) * i / (n - 1)
            k = int(t * (len(E) - 1))
            b = E[k]
            ex, ey = E[min(k + 1, len(E) - 1)][0] - E[max(k - 1, 0)][0], E[min(k + 1, len(E) - 1)][1] - E[max(k - 1, 0)][1]
            L = math.hypot(ex, ey) or 1
            ex, ey = ex / L, ey / L
            px, py = ey, -ex  # "below" the leading edge
            if py < 0:
                px, py = -px, -py
            a = 0.35 * t ** 1.5  # tip feathers sweep outward
            dx, dy = px * (1 - a) + ex * a, py * (1 - a) + ey * a
            dl = math.hypot(dx, dy)
            dx, dy = dx / dl, dy / dl
            ln = (l0 + (l1 - l0) * t ** 1.2) * random.uniform(0.92, 1.06)
            tip = (b[0] + dx * ln, b[1] + dy * ln)
            nx, ny = -dy, dx
            bend = random.uniform(4, 10)
            w = fw * random.uniform(0.85, 1.1)
            def at(s, side):
                c = math.sin(math.pi * min(1, s * 1.15)) ** 0.7
                return (b[0] + dx * ln * s + nx * (side * w * 0.5 * c + bend * math.sin(math.pi * s)),
                        b[1] + dy * ln * s + ny * (side * w * 0.5 * c + bend * math.sin(math.pi * s)))
            ss = [j / 8 for j in range(9)]
            outer = [at(s, 1) for s in ss]
            inner = [at(s, -1) for s in ss]
            stroke([mx(p) for p in outer], 1.5, op, passes=2, wob=0.6)
            stroke([mx(p) for p in inner[2:]], 1.0, op * 0.75, passes=1, wob=0.6)
            stroke([mx(at(s, 0)) for s in ss[:8]], 0.9, op * 0.7, passes=1, wob=0.3)
            # barbs on the shaded side
            for j in range(3, 8, 2):
                s = j / 9 + random.uniform(-0.02, 0.02)
                p0 = at(s, 0)
                p1 = at(min(1, s + 0.06), -0.9)
                stroke([mx(p0), mx(p1)], 0.6, op * 0.45, passes=1, wob=0)

# ---------------------------------------------------------------- figure
def figure():
    part("hair")
    # --- hair: strands from hairline sweeping back to a low bun
    A = [(352, 202), (372, 160), (425, 134), (492, 144), (545, 188), (566, 248), (562, 305), (548, 336)]
    B = [(489, 238), (502, 244), (516, 258), (528, 282), (536, 310), (541, 334)]
    RA, RB = resample(A, 40), resample(B, 40)
    for i in range(34):
        t = i / 33
        pts = [lerp(RA[k], RB[k], t) for k in range(0, 40, 3)]
        pts = [(x + random.uniform(-2, 2), y + random.uniform(-2, 2)) for x, y in pts]
        start = int(random.uniform(0, 2))
        stroke(pts[start:], random.uniform(0.9, 1.7), 0.55 + 0.4 * random.random(), passes=1, wob=1.0)
    stroke(A, 2.4, 1.0, passes=3, wob=1.0)
    # hair shading near back / under crown
    hatch([(500, 160), (552, 200), (566, 260), (556, 320), (528, 300), (510, 240)], 70, 5, 0.7, 0.5)
    # hair gathered at the nape, falling down her back
    for i in range(9):
        o = i * 5 - 20
        stroke([(538 + o * 0.3, 318), (556 + o * 0.6, 360), (574 + o, 410), (580 + o, 470), (596 + o * 1.2, 530), (602 + o, 580)],
               random.uniform(0.9, 1.6), 0.55 + 0.35 * random.random(), passes=1, wob=1.4)
    hatch([(545, 330), (566, 340), (590, 420), (606, 560), (590, 560), (566, 440)], 75, 5, 0.6, 0.4)
    # loose locks
    stroke([(491, 300), (500, 340), (497, 385), (508, 420), (504, 452)], 1.2, 0.7, passes=2)
    stroke([(578, 385), (590, 440), (580, 495), (596, 540), (588, 580)], 1.4, 0.8, passes=2)
    stroke([(566, 392), (572, 440), (566, 486), (574, 520)], 1.0, 0.6, passes=1)
    stroke([(358, 196), (346, 175), (350, 160)], 1.0, 0.5, passes=1)  # wisp at hairline
    mask_add([(352, 202), (372, 160), (425, 134), (492, 144), (545, 188), (566, 248), (590, 400), (612, 580), (586, 584), (540, 420)])

    part("face")
    # --- face (3/4 view, turned to viewer's left, tilted down)
    stroke([(352, 202), (343, 222), (337, 243)], 2.2, 1.0)  # forehead
    stroke([(342, 287), (347, 302), (350, 320)], 1.8, 0.95)  # far cheek below band
    # nose
    stroke([(358, 289), (348, 303), (336, 318), (326, 330)], 2.0, 1.0)
    stroke([(326, 330), (325, 337), (333, 341), (343, 340)], 2.0, 1.0, taper=(0.1, 0.3))
    stroke([(352, 331), (360, 337), (356, 344), (346, 343)], 1.4, 0.85)  # nostril wing
    stroke([(334, 341), (340, 343)], 1.2, 0.8, passes=1)
    # lips & mouth
    stroke([(343, 347), (340, 354), (343, 360)], 1.6, 0.9)  # upper lip profile
    stroke([(344, 362), (354, 361), (366, 364), (378, 366), (383, 364)], 1.5, 1.0, taper=(0.1, 0.5))  # mouth line
    stroke([(346, 356), (358, 354), (372, 358)], 0.8, 0.45, passes=1)
    stroke([(345, 366), (342, 372), (347, 378)], 1.5, 0.9)
    stroke([(356, 377), (370, 378), (384, 374)], 1.1, 0.6, passes=1)
    # chin & jaw
    stroke([(347, 380), (351, 387), (348, 399), (360, 414), (392, 422), (440, 404), (472, 378), (489, 345)], 2.2, 1.0, passes=3)
    # ear (lower half, below the band)
    stroke([(482, 301), (498, 305), (505, 323), (498, 343), (487, 349)], 1.6, 0.9)
    stroke([(489, 313), (495, 326), (489, 338)], 1.0, 0.6, passes=1)
    # shading: near cheek, under nose, under lip, temple
    hatch([(432, 296), (480, 300), (488, 340), (470, 376), (440, 400), (428, 370), (436, 330)], 52, 4.5, 0.75, 0.55)
    hatch([(450, 300), (482, 302), (486, 340), (466, 372), (452, 350)], -30, 5.5, 0.6, 0.4)
    hatch([(352, 380), (386, 376), (378, 393), (356, 394)], 40, 3.5, 0.6, 0.55)
    hatch([(346, 344), (362, 342), (358, 350), (346, 352)], 40, 3, 0.6, 0.5)
    hatch([(352, 296), (366, 294), (352, 320), (344, 318)], 60, 4, 0.5, 0.35)
    mask_add([(352, 202), (337, 243), (342, 288), (326, 330), (343, 340), (343, 360), (347, 380), (348, 399),
                 (360, 414), (392, 422), (440, 404), (489, 345), (505, 323), (500, 240)])

    # closed, downcast eyes: drawn first, hidden when the blindfold goes on
    part("eyes")
    stroke([(338, 240), (348, 236), (360, 236)], 1.4, 0.8)  # far brow
    stroke([(342, 263), (350, 267), (360, 266)], 1.4, 0.9)  # far eyelid
    stroke([(378, 238), (402, 232), (430, 234), (452, 242)], 1.8, 0.9)  # near brow
    stroke([(384, 258), (400, 268), (418, 269), (432, 262)], 1.8, 1.0)  # near eyelid
    stroke([(388, 252), (406, 254), (426, 252)], 0.9, 0.5, passes=1)  # lid crease
    for x in (392, 400, 408, 416, 424):
        stroke([(x, 267 - abs(x - 410) * 0.12), (x - 3, 274 - abs(x - 410) * 0.12)], 0.7, 0.7, passes=1, wob=0)
    hatch([(430, 246), (455, 250), (458, 280), (436, 272)], 50, 4, 0.6, 0.45)

    part("blindfold")
    # --- blindfold band wrapping the head, knot and trailing tails
    top = [(335, 243), (380, 235), (432, 238), (482, 250), (540, 268)]
    bot = [(342, 288), (386, 285), (436, 290), (480, 301), (536, 302)]
    stroke(top, 2.4, 1.0, passes=3)
    stroke(bot, 2.4, 1.0, passes=3)
    stroke([(335, 243), (338, 266), (342, 288)], 2.0, 1.0)
    for f in (0.3, 0.55, 0.78):
        stroke([lerp(a, b, f) for a, b in zip(top, bot)][:-1], 0.8, 0.5, passes=1)
    hatch(top + bot[::-1], 15, 6, 0.6, 0.35)
    hatch([(470, 249), (540, 268), (536, 302), (478, 300)], 80, 3.8, 0.7, 0.6)
    stroke(ellipse_pts(548, 285, 13, 15, 0, 360, 20), 2.0, 1.0)
    for ta, tb in (([(552, 296), (572, 328), (581, 372), (596, 420), (594, 452)], [(560, 292), (585, 322), (596, 366), (612, 410), (614, 446)]),
                   ([(542, 298), (548, 342), (546, 392), (558, 440), (552, 474)], [(550, 298), (560, 342), (560, 390), (572, 436), (568, 470)])):
        stroke(ta, 1.6, 0.95)
        stroke(tb, 1.6, 0.95)
        stroke([ta[-1], tb[-1]], 1.2, 0.8, passes=1)
        hatch(ta + tb[::-1], 30, 4.5, 0.6, 0.45)
        mask_add(ta + tb[::-1])

    part("neck")
    # --- neck
    stroke([(400, 423), (398, 470), (394, 520)], 2.0, 1.0)
    stroke([(522, 398), (526, 455), (536, 512)], 2.0, 1.0)
    hatch([(396, 422), (472, 380), (522, 398), (528, 470), (396, 470)], 35, 4, 0.75, 0.55)
    hatch([(440, 404), (500, 380), (522, 400), (526, 440), (420, 440)], -40, 5, 0.6, 0.45)
    hatch([(470, 470), (528, 470), (534, 515), (480, 515)], 35, 5, 0.6, 0.45)
    stroke([(410, 515), (440, 505), (460, 510)], 1.2, 0.7, passes=1)  # collarbones
    stroke([(475, 512), (500, 505), (530, 512)], 1.2, 0.6, passes=1)
    mask_add([(394, 420), (530, 395), (540, 520), (390, 520)])

    part("robe")
    # --- shoulders, drapery and torso
    stroke([(395, 515), (330, 535), (262, 556), (226, 574)], 2.2, 1.0, passes=3)
    stroke([(536, 512), (600, 530), (660, 556), (700, 602), (716, 690), (720, 1000)], 2.4, 1.0, passes=3)
    stroke([(286, 640), (282, 720), (290, 860), (296, 1000)], 2.2, 1.0, passes=3)
    stroke(ellipse_pts(612, 552, 11, 10, 0, 360), 2.0, 1.0)  # brooch
    stroke(ellipse_pts(612, 552, 5, 4.5, 0, 360, n=12), 1.0, 0.7, passes=1)
    stroke([(400, 545), (430, 585), (480, 610), (540, 590), (600, 560)], 1.8, 0.9)  # neckline
    fan = [((300, 760), 40), ((320, 820), 60), ((350, 880), 70), ((400, 930), 80), ((455, 960), 70), ((520, 990), 60), ((590, 1000), 40)]
    for (ex, ey), sag in fan:
        mid = lerp((612, 560), (ex, ey), 0.5)
        stroke([(605, 565), (mid[0] + sag * 0.5, mid[1] - sag * 0.3), (ex, ey)], 1.4, 0.8, passes=2, wob=1.4)
        hatch([(608, 568), (mid[0] + sag * 0.5 + 8, mid[1] - sag * 0.3 + 4), (ex + 14, ey + 4), (ex + 4, ey + 6), (mid[0] + sag * 0.5, mid[1] - sag * 0.3)], 75, 4, 0.55, 0.4)
    for x0, x1 in ((330, 320), (370, 365), (640, 650), (680, 690)):
        stroke([(x0, 850), (x0 - 4, 920), (x1, 1000)], 1.2, 0.6, passes=1, wob=1.5)
    stroke([(330, 640), (360, 690), (380, 700), (405, 680)], 1.0, 0.55, passes=1)
    hatch([(640, 580), (700, 605), (716, 700), (718, 1000), (660, 1000), (670, 800)], 60, 5, 0.7, 0.55)
    hatch([(670, 620), (712, 640), (716, 860), (690, 860)], -20, 6, 0.6, 0.4)
    hatch([(286, 640), (330, 640), (320, 760), (288, 820)], 65, 5, 0.6, 0.45)
    mask_add([(226, 574), (262, 556), (395, 515), (536, 512), (600, 530), (660, 556), (700, 602), (716, 690),
                 (720, 1000), (296, 1000), (282, 720), (286, 640)])

    part("arm", "arm")
    # --- raised arm (viewer's left) holding the scales
    outer = [(226, 574), (182, 522), (142, 472), (120, 430), (126, 380), (146, 300), (160, 248)]
    inner = [(286, 640), (242, 592), (194, 522), (162, 465), (162, 420), (172, 352), (182, 292), (188, 250)]
    stroke(outer, 2.2, 1.0, passes=3)
    stroke(inner, 2.2, 1.0, passes=3)
    hatch([(286, 640), (242, 592), (194, 522), (168, 470), (190, 470), (230, 540), (270, 590)], 30, 4, 0.7, 0.55)
    hatch([(162, 420), (172, 352), (182, 292), (186, 300), (178, 380), (170, 430)], 80, 4, 0.6, 0.5)
    stroke([(226, 574), (205, 600), (210, 640), (240, 655)], 1.6, 0.85)  # sleeve fold
    stroke([(218, 590), (222, 625), (238, 640)], 1.0, 0.55, passes=1)
    # fist around the rod
    stroke([(156, 252), (152, 232), (160, 216), (178, 210), (194, 218), (196, 240), (190, 254)], 2.0, 1.0)
    for y in (222, 232, 242):
        stroke([(160, y), (176, y - 2), (192, y + 1)], 0.9, 0.6, passes=1)
    hatch([(178, 212), (196, 222), (194, 250), (182, 252)], 70, 3.5, 0.6, 0.5)
    mask_add(outer + inner[::-1])
    mask_add([(150, 210), (200, 210), (200, 258), (150, 258)])

    # --- scales
    part("arm", "scale")
    stroke(ellipse_pts(174, 186, 9, 10, 0, 360, n=16), 1.8, 1.0)
    stroke([(174, 196), (174, 212)], 2.4, 1.0)
    stroke([(174, 254), (174, 274)], 2.8, 1.0)
    stroke(ellipse_pts(174, 278, 6, 6, 0, 360, n=14), 1.6, 1.0)
    part("arm", "beam")
    stroke([(52, 286), (110, 280), (174, 278), (238, 280), (296, 286)], 3.0, 1.0, passes=3)
    stroke([(52, 291), (110, 286), (174, 284), (238, 286), (296, 291)], 0.9, 0.5, passes=1)
    for cxp, rig in ((52, "panL"), (296, "panR")):
        part("arm", rig)
        stroke(ellipse_pts(cxp, 288, 4, 4, 0, 360, n=10), 1.4, 1.0, passes=1)
        for dx in (-38, 0, 38):
            stroke([(cxp, 292), (cxp + dx, 412)], 0.9, 0.85, passes=1, wob=0.2)
        stroke(ellipse_pts(cxp, 414, 42, 8, 0, 360), 1.8, 1.0)
        stroke([(cxp - 42, 414), (cxp - 30, 432), (cxp, 440), (cxp + 30, 432), (cxp + 42, 414)], 2.0, 1.0)
        hatch([(cxp - 30, 420), (cxp + 42, 416), (cxp + 30, 432), (cxp, 440), (cxp - 30, 432)], 60, 3.5, 0.6, 0.55)
        mask_add(ellipse_pts(cxp, 422, 46, 22, 0, 360, n=16))

    part("snake")
    # --- serpent coiled around the neck, head resting on her shoulder
    def tube(center, w0, w1, op=1.0, scales=True):
        C = resample(center, 60)
        L, R = [], []
        for i, p in enumerate(C):
            a, b = C[max(i - 1, 0)], C[min(i + 1, len(C) - 1)]
            dx, dy = b[0] - a[0], b[1] - a[1]
            l = math.hypot(dx, dy) or 1
            nx, ny = -dy / l, dx / l
            w = (w0 + (w1 - w0) * i / (len(C) - 1)) / 2
            L.append((p[0] + nx * w, p[1] + ny * w))
            R.append((p[0] - nx * w, p[1] - ny * w))
        stroke(L[::2], 1.8, op, passes=2)
        stroke(R[::2], 1.8, op, passes=2)
        mask_add(L + R[::-1])
        if scales:
            for i in range(2, len(C) - 2, 2):
                for f in (0.25, 0.75):
                    p = lerp(L[i], R[i], f)
                    q = lerp(L[i + 2], R[i + 2], f)
                    stroke([lerp(p, L[i], 0.15), lerp(p, q, 0.7), lerp(p, R[i], 0.15)], 0.6, 0.5, passes=1, wob=0)
        hatch(R[::3] + [lerp(L[i], R[i], 0.45) for i in range(len(C) - 1, -1, -3)], 70, 3.2, 0.55, 0.5)

    tube([(394, 448), (420, 462), (462, 468), (502, 462), (532, 448)], 18, 18)
    tube([(390, 484), (422, 500), (464, 507), (506, 500), (538, 486)], 20, 19)
    tube([(538, 486), (560, 505), (566, 545), (548, 585), (520, 615), (512, 650), (520, 680)], 19, 4)
    tube([(394, 448), (372, 452), (352, 466), (330, 476), (312, 476)], 18, 16)
    # head
    head = [(312, 466), (296, 462), (278, 466), (266, 474), (270, 484), (290, 489), (312, 488)]
    stroke(head, 2.0, 1.0, passes=2)
    mask_add(head)
    stroke([(300, 467), (286, 470), (276, 476)], 0.9, 0.6, passes=1)
    stroke(ellipse_pts(290, 473, 3.5, 2.6, 0, 360, n=10), 1.4, 1.0, passes=1)
    stroke([(266, 478), (248, 479), (240, 474)], 0.9, 0.9, passes=1, wob=0)
    stroke([(248, 479), (240, 484)], 0.9, 0.9, passes=1, wob=0)
    hatch([(270, 482), (312, 480), (312, 488), (290, 489)], 10, 2.5, 0.5, 0.6)

    part("construct")
    # faint construction lines, as a sketch artist would leave them
    stroke(ellipse_pts(430, 285, 115, 150, 0, 360, -18, 40), 0.6, 0.22, passes=1, wob=1.5)
    stroke([(372, 150), (345, 300), (360, 420)], 0.5, 0.2, passes=1, wob=1)

part("wings")
wing(False)
wing(True)
figure()

def pts_d(pts):
    return "M" + "L".join(f"{x:.0f},{y:.0f}" for x, y in pts)

def emit_recs(recs):
    out = []
    for r in recs:
        extra = f' data-c="{pts_d(r["c"][::2] + [r["c"][-1]])}" data-w="{r["w"]:.1f}"' if r["c"] else ""
        out.append(f'<path d="{r["d"]}" fill-opacity="{r["op"]}"{extra}/>')
    return "\n".join(out)

def part_group(name):
    recs = [r for r in RECS if r["part"] == name]
    if name != "arm":
        hidden = ' opacity="0"' if name == "eyes" else ""  # eyes only show during the animation
        return f'<g data-part="{name}"{hidden}>\n{emit_recs(recs)}\n</g>'
    by = lambda rig: emit_recs([r for r in recs if r["rig"] == rig])
    return (f'<g data-part="arm"><g data-rig="arm">\n{by("arm")}\n<g data-rig="scale">\n{by("scale")}\n'
            f'<g data-rig="beam">\n{by("beam")}\n</g>\n<g data-rig="panL">\n{by("panL")}\n</g>\n'
            f'<g data-rig="panR">\n{by("panR")}\n</g>\n</g></g></g>')

def mask_d(rig):
    return "\n".join(f'<path d="{pts_d(catmull(p, 6))}Z"/>' for p, r in MASK if r == rig)

TW = W - X0
svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="{X0} 0 {TW} {H}" fill="{INK}" id="lj" class="hero-art" aria-hidden="true">
<defs>
<mask id="front" maskUnits="userSpaceOnUse" x="{X0}" y="0" width="{TW}" height="{H}">
<rect x="{X0}" width="{TW}" height="{H}" fill="#fff"/>
<g fill="#000" stroke="#000" stroke-width="8" stroke-linejoin="round">
{mask_d(None)}
<g data-rig="arm" data-mask="1">{mask_d("arm")}<g data-rig="scale">{mask_d("scale")}<g data-rig="beam"></g><g data-rig="panL">{mask_d("panL")}</g><g data-rig="panR">{mask_d("panR")}</g></g></g>
</g>
</mask>
</defs>
<g mask="url(#front)" opacity=".55">
{part_group("wings")}
</g>
{chr(10).join(part_group(n) for n in ("construct", "hair", "face", "eyes", "neck", "robe", "snake", "arm", "blindfold"))}
</svg>"""

open(sys.argv[1], "w").write('<?xml version="1.0" encoding="UTF-8"?>\n' + svg + "\n")
print("wrote", sys.argv[1], f"{len(svg)/1024:.0f} KB")
# inline the drawing into the page between the art markers
if len(sys.argv) > 2:
    page = open(sys.argv[2]).read()
    a, b = page.index("<!--art-->") + len("<!--art-->"), page.index("<!--/art-->")
    open(sys.argv[2], "w").write(page[:a] + "\n" + svg + "\n" + page[b:])
    print("inlined into", sys.argv[2])
