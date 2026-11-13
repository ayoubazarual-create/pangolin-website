/* Pangolin — hero-animatie en kleine interacties. Geen tracking, geen cookies. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ORANGE = '#FC4C02', CHALK = '#F2EFE9';

  /* ---------- Schubben-gloed volgt de muis ---------- */
  var hero = document.querySelector('.hero');
  if (hero && !reduce) {
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      hero.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      hero.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  }

  /* ---------- Scroll-reveal ---------- */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.25 }) : null;
  document.querySelectorAll('.reveal, .pockets').forEach(function (el) {
    if (io) io.observe(el); else el.classList.add('in');
  });

  /* ---------- De pangolin die zich oprolt ---------- */
  var canvas = document.getElementById('pangolin');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var stage = canvas.parentElement;

  var L = 440;          // lengte van de ruggengraat
  var W = 118;          // maximale dikte van het lichaam
  var COLS = 19, ROWS = 5;
  var TH_OPEN = 0.8;    // lichte boog: wandelhouding
  var TH_BALL = 7.6;    // meer dan een volledige cirkel: opgerold

  // vaste "willekeur" zodat dezelfde schubben oranje zijn
  var hot = {};
  [[3, 4], [5, 2], [7, 4], [8, 3], [10, 1], [11, 4], [13, 3], [15, 4], [16, 2], [6, 0]].forEach(function (p) { hot[p[0] + '_' + p[1]] = 1; });

  function widthAt(u) {            // u: 0 = kop, 1 = staartpunt
    if (u < 0.14) return W * (0.42 + 0.58 * Math.sin((u / 0.14) * Math.PI / 2));
    if (u < 0.55) return W;
    var k = (u - 0.55) / 0.45;
    return W * (1 - 0.86 * Math.pow(k, 1.15));
  }

  function buildSpine(theta) {
    var n = 240, pts = [], x = 0, y = 0, ds = L / n, kappa = theta / L;
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (var i = 0; i <= n; i++) {
      var s = i * ds, phi = -theta / 2 + kappa * s;
      var w = widthAt(i / n);
      var nx = Math.sin(phi), ny = -Math.cos(phi);
      pts.push({ x: x, y: y, nx: nx, ny: ny, tx: Math.cos(phi), ty: Math.sin(phi) });
      var ox = x + nx * w, oy = y + ny * w;
      minX = Math.min(minX, x, ox); maxX = Math.max(maxX, x, ox);
      minY = Math.min(minY, y, oy); maxY = Math.max(maxY, y, oy);
      x += Math.cos(phi + kappa * ds / 2) * ds;
      y += Math.sin(phi + kappa * ds / 2) * ds;
    }
    return { pts: pts, n: n, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, maxY: maxY };
  }

  function at(sp, u, r) {          // punt op u langs de rug, r naar buiten
    u = Math.max(0, Math.min(1, u));
    var f = u * sp.n, i = Math.floor(f), t = f - i;
    var a = sp.pts[i], b = sp.pts[Math.min(sp.n, i + 1)];
    return {
      x: a.x + (b.x - a.x) * t + (a.nx + (b.nx - a.nx) * t) * r,
      y: a.y + (b.y - a.y) * t + (a.ny + (b.ny - a.ny) * t) * r
    };
  }

  function plate(sp, c, r) {
    var u0 = c / COLS, half = 0.5 / COLS;
    var off = (r % 2) ? half : 0;                 // rijen verspringen, zoals dakpannen
    var uA = u0 + off, uB = uA + 1.85 / COLS;
    if (uA > 0.985) return;
    var wA = widthAt(Math.min(1, uA)), wB = widthAt(Math.min(1, uB));
    var r0 = r / ROWS, r1 = (r + 1.45) / ROWS, rm = (r0 + Math.min(1, r1)) / 2;
    r1 = Math.min(1.04, r1);
    var p = [
      at(sp, uA, wA * r0),
      at(sp, uA, wA * r1 * 0.96),
      at(sp, uA + (uB - uA) * 0.62, wA * r1),
      at(sp, uB, wB * rm),                        // punt wijst naar de staart
      at(sp, uA + (uB - uA) * 0.62, wA * r0)
    ];
    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    for (var i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
    ctx.closePath();
    var isHot = hot[c + '_' + r];
    ctx.fillStyle = isHot ? ORANGE : (r === ROWS - 1 ? '#232323' : '#1a1a1a');
    ctx.fill();
    ctx.strokeStyle = isHot ? '#ff7a3d' : 'rgba(242,239,233,' + (0.16 + 0.1 * r) + ')';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  function draw(curl, roll, bob) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var size = canvas.clientWidth;
    if (canvas.width !== Math.round(size * dpr)) { canvas.width = canvas.height = Math.round(size * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    var theta = TH_OPEN + (TH_BALL - TH_OPEN) * curl;
    var sp = buildSpine(theta);
    var scale = size / 640;
    var groundY = size * 0.74;

    // schaduw op de grond
    var shW = (250 - 110 * curl) * scale;
    var g = ctx.createRadialGradient(size / 2, groundY, 0, size / 2, groundY, shW);
    g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.translate(0, groundY); ctx.scale(1, 0.16); ctx.translate(0, -groundY);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(size / 2, groundY, shW, 0, Math.PI * 2); ctx.fill(); ctx.restore();

    ctx.save();
    // lichaam staat met zijn laagste punt op de grond
    ctx.translate(size / 2, groundY - (sp.maxY - sp.cy) * scale - 6 * scale + bob * scale);
    ctx.rotate(roll);
    ctx.scale(scale, scale);
    ctx.translate(-sp.cx, -sp.cy);
    ctx.lineJoin = 'round';

    // pootjes (verdwijnen bij het oprollen)
    var legA = Math.max(0, 1 - curl * 2.2);
    if (legA > 0) {
      ctx.globalAlpha = legA;
      [0.2, 0.29, 0.5, 0.59].forEach(function (u, i) {
        var a = at(sp, u, 6), sw = Math.sin(bob * 1.4 + i * 1.7) * 5;
        ctx.beginPath(); ctx.moveTo(a.x - 13, a.y - 6); ctx.lineTo(a.x + 13, a.y - 6);
        ctx.lineTo(a.x + 7 + sw, a.y + 46); ctx.lineTo(a.x - 13 + sw, a.y + 46); ctx.closePath();
        ctx.fillStyle = '#1a1a1a'; ctx.fill();
        ctx.strokeStyle = 'rgba(242,239,233,.22)'; ctx.lineWidth = 1.4; ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }

    // buik: donkere basis onder de schubben
    ctx.beginPath();
    for (var i = 0; i <= 60; i++) { var q = at(sp, i / 60, 0); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }
    for (i = 60; i >= 0; i--) { q = at(sp, i / 60, widthAt(i / 60) * 0.9); ctx.lineTo(q.x, q.y); }
    ctx.closePath(); ctx.fillStyle = '#141414'; ctx.fill();

    // opgerold: de buik sluit zich in het midden
    var holeA = Math.max(0, Math.min(1, (curl - 0.55) / 0.35));
    if (holeA > 0) {
      ctx.globalAlpha = holeA; ctx.beginPath();
      for (i = 0; i <= 60; i++) { q = at(sp, i / 60, 2); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }
      ctx.closePath(); ctx.fillStyle = '#1b1b1b'; ctx.fill(); ctx.globalAlpha = 1;
    }

    // schubben: van staart naar kop, binnenste rij eerst
    for (var c = COLS - 1; c >= 1; c--) for (var r = 0; r < ROWS; r++) plate(sp, c, r);

    // kop met snuit en oog
    var h0 = sp.pts[0], hw = widthAt(0);
    // richting van de snuit: vooruit bij het wandelen, naar binnen gedraaid in de bal
    var dx = -h0.tx * (1 - curl * 0.55) - h0.nx * curl * 0.75, dy = -h0.ty * (1 - curl * 0.55) - h0.ny * curl * 0.75;
    var dl = Math.sqrt(dx * dx + dy * dy); dx /= dl; dy /= dl;
    var base0 = at(sp, 0.06, 0), base1 = at(sp, 0.06, hw * 1.02);
    var mid = { x: h0.x + h0.nx * hw * 0.42, y: h0.y + h0.ny * hw * 0.42 };
    var tip = { x: mid.x + dx * 78, y: mid.y + dy * 78 };
    var brow = { x: h0.x + h0.nx * hw * 0.98 + dx * 16, y: h0.y + h0.ny * hw * 0.98 + dy * 16 };
    var jaw = { x: h0.x + h0.nx * hw * 0.04 + dx * 26, y: h0.y + h0.ny * hw * 0.04 + dy * 26 };
    ctx.beginPath(); ctx.moveTo(base0.x, base0.y); ctx.lineTo(jaw.x, jaw.y); ctx.lineTo(tip.x, tip.y);
    ctx.lineTo(brow.x, brow.y); ctx.lineTo(base1.x, base1.y); ctx.closePath();
    ctx.fillStyle = '#202020'; ctx.fill();
    ctx.strokeStyle = 'rgba(242,239,233,.4)'; ctx.lineWidth = 1.6; ctx.stroke();
    var eye = { x: h0.x + h0.nx * hw * 0.66 + dx * 24, y: h0.y + h0.ny * hw * 0.66 + dy * 24 };
    ctx.beginPath(); ctx.arc(eye.x, eye.y, 4.2, 0, Math.PI * 2); ctx.fillStyle = curl > 0.9 ? ORANGE : CHALK; ctx.fill();

    ctx.restore();
  }

  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  var state = { curl: 0, target: 1, t0: null, from: 0, started: false };

  function frame(now) {
    if (state.t0 === null) state.t0 = now;
    var el = (now - state.t0) / 1000;
    var delay = state.started ? 0 : 0.9, dur = 1.7;
    var k = Math.max(0, Math.min(1, (el - delay) / dur));
    state.curl = state.from + (state.target - state.from) * ease(k);
    var walking = 1 - state.curl;
    var bob = Math.sin(now / 170) * 2.6 * walking + Math.sin(now / 900) * 1.2 * state.curl;
    var roll = state.curl * 0.55 + Math.sin(now / 1400) * 0.035 * state.curl;
    draw(state.curl, roll, bob);
    if (k >= 1) { state.started = true; stage.classList.add('done'); }
    requestAnimationFrame(frame);
  }

  function toggle() {
    state.from = state.curl;
    state.target = state.target === 1 && state.curl > 0.5 ? 0 : 1;
    state.t0 = null; state.started = true;
    canvas.setAttribute('aria-label', state.target === 1
      ? 'Animatie: een pangolin rolt zich op tot een beschermde bal.'
      : 'Animatie: de pangolin rolt zich weer open.');
  }
  canvas.addEventListener('click', toggle);
  canvas.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });

  if (reduce) {
    draw(1, 0.55, 0); stage.classList.add('done');
    window.addEventListener('resize', function () { draw(1, 0.55, 0); });
  } else {
    requestAnimationFrame(frame);
  }
})();

/* ---------- De binder: sleep de rits open, de kaft volgt ---------- */
(function () {
  'use strict';
  var binder = document.getElementById('binder3d');
  var cover = binder && binder.querySelector('.b-cover');
  var svg = binder && binder.querySelector('.b-zip');
  var path = document.getElementById('zipPath');
  var pull = document.getElementById('zipPull');
  var btn = document.getElementById('zipBtn');
  if (!binder || !cover || !svg || !path || !pull || !btn) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var len = path.getTotalLength();
  var N = 240, samples = [];
  for (var i = 0; i <= N; i++) samples.push(path.getPointAtLength(len * i / N));

  var pos = 0;              // 0 = rits dicht, 1 = rits open
  var busy = false, dragging = false, moved = false, startX = 0, startY = 0;
  var OPEN_FROM = 0.55;     // vanaf hier begint de kaft open te draaien

  function render() {
    var d = pos * len;
    var p = path.getPointAtLength(d);
    var q = path.getPointAtLength(Math.min(len, d + 1)), o = path.getPointAtLength(Math.max(0, d - 1));
    var ang = Math.atan2(q.y - o.y, q.x - o.x) * 180 / Math.PI;
    pull.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ') rotate(' + ang.toFixed(1) + ')');
    var k = Math.max(0, Math.min(1, (pos - OPEN_FROM) / (1 - OPEN_FROM)));
    k = k * k * (3 - 2 * k);
    cover.style.transform = 'rotateY(' + (-112 * k).toFixed(2) + 'deg)';
    binder.style.transform = 'translateX(' + (13 * k).toFixed(2) + '%) scale(' + (1 - 0.16 * k).toFixed(3) + ')';
    var isOpen = pos > 0.98;
    btn.textContent = isOpen ? 'Rits dicht' : 'Rits open';
    btn.setAttribute('aria-pressed', isOpen ? 'true' : 'false');
  }

  function animateTo(to, done) {
    if (reduce) { pos = to; render(); busy = false; if (done) done(); return; }
    busy = true;
    var from = pos, t0 = null, dur = 300 + 1400 * Math.abs(to - from);
    function step(now) {
      if (t0 === null) t0 = now;
      var k = Math.min(1, (now - t0) / dur);
      var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      pos = from + (to - from) * e; render();
      if (k < 1) requestAnimationFrame(step); else { busy = false; if (done) done(); }
    }
    requestAnimationFrame(step);
  }

  function toggle() { if (!busy) animateTo(pos > 0.5 ? 0 : 1); }

  // muis of vinger naar de dichtstbijzijnde plek op de rits
  function nearest(clientX, clientY) {
    var m = svg.getScreenCTM();
    if (!m) return pos;
    var pt = svg.createSVGPoint(); pt.x = clientX; pt.y = clientY;
    var loc = pt.matrixTransform(m.inverse());
    var cur = Math.round(pos * N), best = cur, bd = 1e12;
    var lo = Math.max(0, cur - 40), hi = Math.min(N, cur + 40);   // geen sprongen over de binder heen
    for (var j = lo; j <= hi; j++) {
      var dx = samples[j].x - loc.x, dy = samples[j].y - loc.y, d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = j; }
    }
    return best / N;
  }

  pull.addEventListener('pointerdown', function (e) {
    if (busy) return;
    dragging = true; moved = false; startX = e.clientX; startY = e.clientY;
    binder.classList.add('dragging');
    try { pull.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });
  pull.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    if (!moved && Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) < 5) return;
    moved = true;
    pos = nearest(e.clientX, e.clientY); render();
  });
  function end() {
    if (!dragging) return;
    dragging = false; binder.classList.remove('dragging');
    if (!moved) { toggle(); return; }
    animateTo(pos > 0.5 ? 1 : 0);          // loslaten: klikt vast in open of dicht
  }
  pull.addEventListener('pointerup', end);
  pull.addEventListener('pointercancel', end);

  btn.addEventListener('click', toggle);
  render();
})();
