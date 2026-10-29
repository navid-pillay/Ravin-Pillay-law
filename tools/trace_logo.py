"""Redraws the office's fractured-letter wall piece as a clean vector logo.

The photo is only used as a tracing reference: piece outlines are traced,
simplified to crisp straight edges, and refilled with mirror-steel and
gold-leaf gradients (no photo pixels end up in the logo).
Usage: python3 tools/trace_logo.py <photo> assets/logo.svg
"""
import sys
import cv2
import numpy as np

src, out = sys.argv[1], sys.argv[2]
img = cv2.imread(src)
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
h, s, v = hsv[..., 0].astype(int), hsv[..., 1].astype(int), hsv[..., 2].astype(int)

# pieces: darker or more saturated than the white wall and its soft shadows
pieces = ((v < 178) | (s > 26)).astype(np.uint8) * 255
pieces = cv2.morphologyEx(pieces, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
pieces = cv2.morphologyEx(pieces, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
pieces = cv2.medianBlur(pieces, 7)
# gold leaf: warm hue, saturated
gold = ((h >= 14) & (h <= 32) & (s > 60) & (v > 110)).astype(np.uint8) * 255
gold = cv2.morphologyEx(gold, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
gold = cv2.morphologyEx(gold, cv2.MORPH_CLOSE, np.ones((11, 11), np.uint8))
gold = cv2.medianBlur(gold, 7)

def polys(mask, min_area, eps):
    cs, hier = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    out = []
    if hier is None:
        return out
    for i, c in enumerate(cs):
        if hier[0][i][3] != -1:  # holes are emitted with their parent
            continue
        if cv2.contourArea(c) < min_area:
            continue
        rings = [c]
        j = hier[0][i][2]
        while j != -1:
            if cv2.contourArea(cs[j]) > min_area / 2:
                rings.append(cs[j])
            j = hier[0][j][0]
        d = "".join("M" + "L".join(f"{p[0][0]},{p[0][1]}" for p in cv2.approxPolyDP(r, eps, True)) + "Z" for r in rings)
        m = np.zeros(mask.shape, np.uint8)
        cv2.drawContours(m, [c], -1, 255, -1)
        out.append((d, cv2.mean(v.astype(np.uint8), m)[0], cv2.mean(h.astype(np.uint8), m)[0], cv2.mean(s.astype(np.uint8), m)[0]))
    return out

silver = cv2.bitwise_and(pieces, cv2.bitwise_not(gold))
S = polys(silver, 120, 2.6)
G = polys(gold, 120, 2.6)

gray = cv2.GaussianBlur(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), (3, 3), 0)
edges = cv2.Canny(gray, 60, 160)
edges = cv2.bitwise_and(edges, cv2.erode(pieces, np.ones((7, 7), np.uint8)))
segs = cv2.HoughLinesP(edges, 1, np.pi / 180, 40, minLineLength=38, maxLineGap=4)
seams = []
for x1, y1, x2, y2 in (segs.reshape(-1, 4) if segs is not None else []):
    seams.append(f"M{x1},{y1}L{x2},{y2}")

x, y, w, hh = cv2.boundingRect(cv2.findNonZero(pieces))
pad = 6
vb = f"{x - pad} {y - pad} {w + 2 * pad} {hh + 2 * pad}"

def steel_for(val, hue, sat):
    if sat > 30 and 70 <= hue <= 100:
        return "url(#mint)"          # mirror pieces reflecting green glass
    return "url(#steelD)" if val < 120 else "url(#steelM)" if val < 170 else "url(#steelL)"

paths = [f'<path d="{d}" fill="{steel_for(val, hue, sat)}"/>' for d, val, hue, sat in S]
paths += [f'<path d="{d}" fill="url(#gold)"/>' for d, *_ in G]
paths.append(f'<path d="{"".join(seams)}" fill="none" stroke="rgba(10,11,13,.55)" stroke-width="2.2" stroke-linecap="square"/>')
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" fill-rule="evenodd">
<title>Ravin Pillay Law</title>
<defs>
<linearGradient id="steelL" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7f8f9"/><stop offset=".45" stop-color="#b9bec4"/><stop offset=".55" stop-color="#e9ecee"/><stop offset="1" stop-color="#9aa0a7"/></linearGradient>
<linearGradient id="steelM" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9dde1"/><stop offset=".5" stop-color="#7f868e"/><stop offset=".62" stop-color="#c9ced3"/><stop offset="1" stop-color="#6d737a"/></linearGradient>
<linearGradient id="steelD" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9aa1a8"/><stop offset=".5" stop-color="#3f454b"/><stop offset=".7" stop-color="#8c939a"/><stop offset="1" stop-color="#2f3439"/></linearGradient>
<linearGradient id="mint" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d8ece6"/><stop offset=".5" stop-color="#7fa89e"/><stop offset="1" stop-color="#c3ddd6"/></linearGradient>
<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4e2a8"/><stop offset=".45" stop-color="#cfa955"/><stop offset=".6" stop-color="#ecd48f"/><stop offset="1" stop-color="#a8843d"/></linearGradient>
</defs>
<g stroke="rgba(255,255,255,.35)" stroke-width="1.2" stroke-linejoin="miter">
{chr(10).join(paths)}
</g>
</svg>
'''
open(out, "w").write(svg)
print(f"wrote {out}: {len(S)} steel pieces, {len(G)} gold pieces, {len(seams)} seams, {len(svg) // 1024} KB")
