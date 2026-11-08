HEAD = '''<!doctype html>
<html lang="en"{html_class}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <meta name="description" content="{desc}">
  <meta name="theme-color" content="#07080a">
  <link rel="icon" href="assets/logo.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400;6..96,500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/styles.css?v={version}">
  <script>
    try {{
      // Refreshing the browser always brings the visitor back to the home page
      // (a reload we trigger ourselves after the Back button is the exception).
      var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      var reloaded = nav ? nav.type === 'reload' : performance.navigation && performance.navigation.type === 1;
      var ours = sessionStorage.getItem('bfReload');
      sessionStorage.removeItem('bfReload');
      if (reloaded && !ours && !/(^|\\/)(index\\.html)?$/.test(location.pathname)) location.replace('index.html?v={version}');
    }} catch (e) {{}}
    // Info pages: keep the text hidden until assets/type.js types it in.
    if (!/is-home/.test(document.documentElement.className) && !matchMedia('(prefers-reduced-motion: reduce)').matches)
      document.documentElement.classList.add('typing');
    // Which kind of page we came from, so Lady Justice knows whether to be re-drawn.
    try {{
      var from = sessionStorage.getItem('navFrom');
      if (from) document.documentElement.classList.add('from-' + from);
      sessionStorage.removeItem('navFrom');
    }} catch (e) {{}}
  </script>
</head>
<body>

  <header class="site-header">
    <div class="wrap">
      <a class="brand" href="index.html?v={version}" aria-label="Ravin Pillay Law, home">
        <img src="assets/logo.svg" alt="" width="190" height="157">
        <span class="brand-text"><b>Ravin Pillay</b><small>Barrister &amp; Solicitor</small></span>
      </a>
      <nav class="knobs" aria-label="Main">
{knobs}
      </nav>
    </div>
  </header>
'''
FOOT = '''
  <footer class="site-foot">
    <div class="wrap">
      <p>&copy; 2026 Ravin Pillay, Barrister &amp; Solicitor &middot; 920-130 Queens Quay E., Toronto</p>
      <p>The information on this website is general information, not legal advice. Contacting the firm does not create a lawyer–client relationship.</p>
    </div>
  </footer>
'''
# Bump on every release so browsers fetch fresh CSS/JS instead of cached copies.
VERSION = "2026-11-08a"

def sketch_knob(seed):
    """A machined knob as a pencil sketch, in the same hand as Lady Justice: a
    knurled rim, the dark band, the face with its cut groove, a little shading.
    Each line is a separate path so assets/site.js can draw it in on page load.
    `seed` makes each knob's wobble its own."""
    import math, random
    rnd = random.Random(seed)
    def circle(r, w, op, wob=.45, over=None):
        a0 = rnd.uniform(0, 360)
        sweep = 360 + (rnd.uniform(14, 34) if over is None else over)   # loose overshoot, like a hand-drawn circle
        f1, f2, p1, p2 = rnd.uniform(2, 3), rnd.uniform(5, 7), rnd.uniform(0, 6.3), rnd.uniform(0, 6.3)
        pts = []
        for i in range(49):
            a = math.radians(a0 + sweep * i / 48)
            rr = r + wob * (math.sin(a * f1 + p1) * .7 + math.sin(a * f2 + p2) * .3) + (i / 48) * rnd.uniform(-.5, .5)
            pts.append((rr * math.cos(a), rr * math.sin(a)))
        return line(pts, w, op)
    def line(pts, w, op):
        d = "M" + " L".join(f"{x:.2f},{y:.2f}" for x, y in pts)
        return f'<path d="{d}" stroke-width="{w}" stroke-opacity="{op}"/>'
    paths = [circle(22, 1.3, .95), circle(22.4, .6, .45, wob=.8)]
    # knurling: short radial ticks round the rim, drawn as one sweep
    ticks = []
    for i in range(44):
        a = math.radians(i * 360 / 44 + rnd.uniform(-1.5, 1.5))
        r0, r1 = 18.6 + rnd.uniform(-.3, .3), 21.4 + rnd.uniform(-.3, .3)
        ticks.append(f"M{r0 * math.cos(a):.2f},{r0 * math.sin(a):.2f} L{r1 * math.cos(a):.2f},{r1 * math.sin(a):.2f}")
    paths.append(f'<path d="{" ".join(ticks)}" stroke-width=".55" stroke-opacity=".7"/>')
    paths += [circle(17.6, 1, .85), circle(13.4, 1.15, .95), circle(13, .5, .4, wob=.7)]
    # the cut groove across the face (this is what shows the knob turning)
    for x in (-1.3, 1.3):
        paths.append(line([(x + rnd.uniform(-.2, .2), -11.6), (x + rnd.uniform(-.3, .3), 0), (x + rnd.uniform(-.2, .2), 11.6)], .95, .9))
    # shading on the lower right of the face, inside the circle
    hatch = []
    for k in range(7):
        c = 4 + k * 2.4                      # lines x + y = c, kept inside r = 12
        h = math.sqrt(max(0, 2 * 144 - c * c)) / 2
        if h < 1.5:
            continue
        x0, y0 = c / 2 - h * .7, c / 2 + h * .7
        x1, y1 = c / 2 + h * .7, c / 2 - h * .7
        hatch.append(f"M{x0 + rnd.uniform(-.4, .4):.2f},{y0:.2f} L{x1:.2f},{y1 + rnd.uniform(-.4, .4):.2f}")
    paths.append(f'<path d="{" ".join(hatch)}" stroke-width=".45" stroke-opacity=".55"/>')
    return ('<svg class="knob-sketch" viewBox="-25 -25 50 50" fill="none" stroke="currentColor" '
            'stroke-linecap="round" stroke-linejoin="round">' + "".join(paths) + '</svg>')

NAV = [("practice.html", "Practice"), ("about.html", "About"), ("contact.html", "Contact")]

def page(fname, title, desc, body, foot=True, tail=""):
    knobs = "\n".join(
        f'        <a class="knob" href="{h}?v={VERSION}"{" aria-current=\"page\"" if h == fname else ""}><span class="dial" aria-hidden="true">{sketch_knob(h)}</span><span class="knob-label">{l}</span></a>'
        for h, l in NAV)
    home = fname == "index.html"
    # inner pages keep Lady Justice on the left, turned to face the content
    side = "" if home else ('\n  <div class="lady-side" data-lady-justice="side" aria-hidden="true">'
                            '<img src="assets/lady-side.webp" alt="" width="1650" height="1500"></div>\n')
    if not home:  # the re-sketch when arriving from the home page
        tail = (f'  <script src="assets/type.js?v={VERSION}"></script>\n'
                f'  <script src="assets/lady-justice-data.js?v={VERSION}"></script>\n'
                f'  <script src="assets/lady-justice.js?v={VERSION}"></script>\n')
    html = (HEAD.format(title=title, desc=desc, knobs=knobs, version=VERSION, html_class=' class="is-home"' if home else "")
            + side + body + (FOOT if foot else "")
            + f'\n  <script src="assets/site.js?v={VERSION}"></script>\n' + tail + "</body>\n</html>\n")
    open(fname, "w").write(html)

page("index.html", "Ravin Pillay Law | Toronto Criminal Defence Lawyer",
     "Ravin Pillay, Barrister & Solicitor, is a Toronto criminal defence lawyer on Queens Quay East.", '''
  <main>
    <section class="home-hero">
      <!-- Drawn by assets/lady-justice.js from data generated by tools/lady_justice_sketch.py -->
      <div class="art" data-lady-justice>
        <noscript><img src="assets/lady-justice.svg" alt="Sketch of winged, blindfolded Lady Justice holding the scales"></noscript>
      </div>
      <div class="home-foot">
        <div class="wrap">
          <p class="label">Criminal Defence Lawyer &middot; Toronto</p>
          <a href="tel:+14163041158">416-304-1158</a>
        </div>
      </div>
    </section>
    <!-- The rest of the statue is drawn here as the visitor scrolls; the inscription sits on the pedestal. -->
    <section class="statue-lower" data-lady-justice-lower>
      <blockquote class="inscription" data-inscription>
        <button type="button" class="inscription-toggle" aria-pressed="false" title="Tap for the English translation">
          <span class="words latin" lang="la"><span class="steel-ink">&ldquo;Actus non facit reum nisi mens sit rea.&rdquo;</span><span class="gold-ink" aria-hidden="true">&ldquo;Actus non facit reum nisi mens sit rea.&rdquo;</span></span>
          <span class="words english" lang="en" aria-hidden="true"><span class="steel-ink">&ldquo;The act does not make a person guilty unless the mind is also guilty.&rdquo;</span><span class="gold-ink" aria-hidden="true">&ldquo;The act does not make a person guilty unless the mind is also guilty.&rdquo;</span></span>
        </button>
      </blockquote>
    </section>
  </main>
''', tail='''  <script src="assets/lady-justice-data.js?v=''' + VERSION + '''"></script>
  <script src="assets/lady-justice.js?v=''' + VERSION + '''"></script>
''')

page("practice.html", "Practice | Ravin Pillay Law",
     "Criminal charges defended by Toronto lawyer Ravin Pillay.", '''
  <main class="page">
    <div class="wrap">
      <div class="page-head">
        <p class="label">Practice</p>
        <h1 class="steel">Criminal defence</h1>
        <p class="lead">A charge is not a conviction. Every case gets a careful, independent defence, from the bail hearing to the final verdict.</p>
      </div>
      <!-- Edit this list to match the charges Ravin takes on. -->
      <section class="panel" aria-label="Charges defended">
        <ul class="charges">
          <li><span class="facet"></span>Assault</li>
          <li><span class="facet"></span>Domestic Assault</li>
          <li><span class="facet"></span>Impaired Driving</li>
          <li><span class="facet"></span>Drug Offences</li>
          <li><span class="facet"></span>Theft &amp; Fraud</li>
          <li><span class="facet"></span>Weapons Offences</li>
          <li><span class="facet"></span>Bail Hearings</li>
          <li><span class="facet"></span>Youth Charges</li>
        </ul>
      </section>
    </div>
  </main>
''')

page("about.html", "About | Ravin Pillay Law",
     "Ravin Pillay is a Toronto criminal defence lawyer, called to the Ontario bar in 1999.", '''
  <main class="page">
    <div class="wrap">
      <div class="page-head">
        <p class="label">About</p>
        <h1 class="steel">Ravin Pillay</h1>
        <p class="lead">Barrister &amp; Solicitor</p>
      </div>
      <section class="panel">
        <div class="split">
          <p class="label" style="margin-top: 6px;">Criminal defence lawyer</p>
          <div>
            <p class="lead">Ravin Pillay is a Toronto criminal defence lawyer and a graduate of Osgoode Hall Law School. He was called to the Ontario bar in 1999 and practises from his office on Queens Quay East, on Toronto's waterfront.</p>
            <p class="lead">He examines the evidence, holds the Crown to its burden of proof and makes sure your Charter rights are respected. You deal with him directly, from your first call to the end of your case.</p>
          </div>
        </div>
        <div class="facts">
          <div><b>1999</b><span>Called to the Ontario bar</span></div>
          <div><b>Osgoode Hall</b><span>Law School</span></div>
          <div><b>Queens Quay</b><span>Toronto waterfront office</span></div>
        </div>
      </section>
    </div>
  </main>
''')

page("contact.html", "Contact | Ravin Pillay Law",
     "Contact Toronto criminal defence lawyer Ravin Pillay: 416-304-1158, 920-130 Queens Quay E.", '''
  <main class="page">
    <div class="wrap">
      <div class="page-head">
        <p class="label">Contact</p>
        <h1 class="steel">Talk to a defence lawyer</h1>
        <p class="lead">If you've been arrested or charged, don't discuss the case with anyone before speaking with a lawyer.</p>
      </div>
      <section class="panel">
        <div class="contact-grid">
          <div><small>Phone</small><a class="big" href="tel:+14163041158">416-304-1158</a></div>
          <div><small>Email</small><a class="big" href="mailto:ravinpillay@ravinpillay.com">ravinpillay@ravinpillay.com</a></div>
          <div><small>Office</small>920-130 Queens Quay E.<br>Toronto, ON M5A 0P6<br><a href="https://www.google.com/maps/search/?api=1&amp;query=130+Queens+Quay+E,+Toronto,+ON+M5A+0P6" target="_blank" rel="noopener" style="border-bottom: 1px solid var(--clay);">Directions</a></div>
          <div><small>Fax</small>416-368-3018</div>
        </div>
        <p class="note">Consultations are confidential.</p>
      </section>
    </div>
  </main>
''')
print("pages written")
