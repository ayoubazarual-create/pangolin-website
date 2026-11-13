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

  /* ---------- Oranje vak: animatie van schubben naar vakken opnieuw afspelen ---------- */
  var replay = document.getElementById('replayPockets');
  if (replay) {
    replay.addEventListener('click', function () {
      var grid = replay.parentElement;
      grid.classList.remove('in');           // terug naar schubben
      setTimeout(function () { grid.classList.add('in'); }, reduce ? 0 : 1100);
    });
  }

  /* ---------- De pangolin die zich oprolt ---------- */
  var canvas = document.getElementById('pangolin');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var stage = canvas.parentElement;

  var L = 520, N = 170;           // lengte van de ruggengraat, aantal meetpunten
  var TH0 = 0.62, TH1 = 8.0;      // totale kromming: wandelend en opgerold
  var COLS = 15, ROWS = 4;

  function sm(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
  function easeIO(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3); }

  // halve dikte van het lichaam: u = 0 snuit, u = 1 staartpunt
  function hw(u) {
    if (u < 0.12) return 7 + 23 * Math.pow(u / 0.12, 0.8);
    if (u < 0.34) return 30 + 36 * sm((u - 0.12) / 0.22);
    if (u < 0.52) return 66 - 20 * sm((u - 0.34) / 0.18);
    return 46 - 39 * Math.pow((u - 0.52) / 0.48, 0.9);
  }

  function build(c, roll) {
    var pts = [], x = 0, y = 0, phi = 0, ds = L / N, i, u;
    for (i = 0; i <= N; i++) {
      u = i / N;
      var lead = sm(c * 1.5 - 0.5 * (1 - Math.abs(2 * u - 1)));   // kop en staart krullen eerst
      var kap = (TH0 + (TH1 - TH0) * lead) / L;
      pts.push({ x: x, y: y, phi: phi, kap: kap });
      x += Math.cos(phi + kap * ds / 2) * ds;
      y += Math.sin(phi + kap * ds / 2) * ds;
      phi += kap * ds;
    }
    // schouders horizontaal zetten, daarna de rol toepassen
    var rot = roll - pts[Math.round(N * 0.36)].phi;
    var cs = Math.cos(rot), sn = Math.sin(rot);
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (i = 0; i <= N; i++) {
      var p = pts[i], px = p.x * cs - p.y * sn, py = p.x * sn + p.y * cs;
      p.x = px; p.y = py; p.phi += rot;
      p.nx = Math.sin(p.phi); p.ny = -Math.cos(p.phi);
      var h = hw(i / N), reach = 0.97 / p.kap, b = Math.min(reach, h * 0.7 + (reach - h * 0.7) * sm((c - 0.45) / 0.5));
      p.h = h; p.b = b;
      var ax = px + p.nx * h, ay = py + p.ny * h, bx = px - p.nx * b, by = py - p.ny * b;
      minX = Math.min(minX, ax, bx); maxX = Math.max(maxX, ax, bx);
      minY = Math.min(minY, ay, by); maxY = Math.max(maxY, ay, by);
    }
    return { pts: pts, minX: minX, maxX: maxX, minY: minY, maxY: maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
  }

  // punt op het lichaam: v = 1 rug, v = -1 buik
  function at(sp, u, v) {
    u = Math.max(0, Math.min(1, u));
    var f = u * N, i = Math.min(N - 1, Math.floor(f)), t = f - i, a = sp.pts[i], b = sp.pts[i + 1];
    var off = v >= 0 ? v * (a.h + (b.h - a.h) * t) : v * (a.b + (b.b - a.b) * t);
    return { x: a.x + (b.x - a.x) * t + (a.nx + (b.nx - a.nx) * t) * off, y: a.y + (b.y - a.y) * t + (a.ny + (b.ny - a.ny) * t) * off };
  }

  var curlNow = 0;
  function scale(sp, c, r) {
    var du = 0.9 / COLS, uA = 0.095 + c * du + (r % 2 ? du / 2 : 0), uB = Math.min(1, uA + du * 1.95);
    if (uA > 0.965) return;
    var vmin = -0.34 - 0.62 * sm(curlNow), step = (1.0 - vmin) / ROWS;
    var v0 = vmin + r * step, v1 = Math.min(1.04, v0 + step * 1.55), vm = (v0 + v1) / 2, um = uA + (uB - uA) * 0.7;
    var p0 = at(sp, uA, v0), p1 = at(sp, uA, v1), tip = at(sp, uB, vm);
    var c1 = at(sp, um, v1 + 0.1), c0 = at(sp, um, v0 - 0.1), base = at(sp, uA, vm);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
    ctx.quadraticCurveTo(c1.x, c1.y, tip.x, tip.y);
    ctx.quadraticCurveTo(c0.x, c0.y, p0.x, p0.y);
    ctx.closePath();
    var g = ctx.createLinearGradient(base.x, base.y, tip.x, tip.y);
    g.addColorStop(0, '#111111'); g.addColorStop(0.5, '#222222'); g.addColorStop(1, r === ROWS - 1 ? '#565656' : '#444444');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(242,239,233,.3)'; ctx.lineWidth = 1.1; ctx.stroke();
    // nerf in het midden van de schub
    ctx.beginPath(); ctx.moveTo(base.x + (tip.x - base.x) * 0.35, base.y + (tip.y - base.y) * 0.35); ctx.lineTo(tip.x, tip.y);
    ctx.strokeStyle = 'rgba(242,239,233,.07)'; ctx.stroke();
  }

  function outline(sp, uFrom, uTo, v, steps) {
    for (var i = 0; i <= steps; i++) { var q = at(sp, uFrom + (uTo - uFrom) * i / steps, v); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }
  }

  function leg(sp, u, phase, far, walk, hide, groundY) {
    if (hide >= 1) return;
    var hip = at(sp, u, -0.55);
    var len = Math.max(18, Math.min(130, groundY - hip.y)) * (1 - hide);
    var sw = Math.sin(phase) * 0.42 * walk, lift = Math.max(0, Math.cos(phase)) * 7 * walk;
    ctx.save(); ctx.translate(hip.x, hip.y); ctx.rotate(sw);
    ctx.beginPath();
    ctx.moveTo(-19, -10); ctx.lineTo(19, -10); ctx.lineTo(11, len - 9 - lift); ctx.lineTo(-22, len - lift);
    ctx.lineTo(-25, len - 9 - lift); ctx.lineTo(-13, len - 13 - lift); ctx.closePath();
    ctx.fillStyle = far ? '#121212' : '#1f1f1f'; ctx.fill();
    ctx.strokeStyle = 'rgba(242,239,233,' + (far ? 0.1 : 0.22) + ')'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
  }

  function draw(c, roll, opt) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var size = canvas.clientWidth;
    if (!size) return;
    if (canvas.width !== Math.round(size * dpr)) { canvas.width = canvas.height = Math.round(size * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    curlNow = c;
    var sp = build(c, roll);
    var k = size / 570 * (1 + 0.42 * c);
    var groundY = size * 0.76;
    var legShow = 1 - sm(c * 3.2);
    var lift = 30 * legShow;
    var ox = size / 2 + (opt.x || 0) * size, oy = groundY - (sp.maxY - sp.cy) * k - lift * k - (opt.bounce || 0) * k;

    // schaduw
    var shW = Math.max(60, (sp.maxX - sp.minX) / 2 * k * 0.95);
    var sh = ctx.createRadialGradient(ox, groundY, 0, ox, groundY, shW);
    sh.addColorStop(0, 'rgba(0,0,0,.6)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.translate(0, groundY); ctx.scale(1, 0.14); ctx.translate(0, -groundY);
    ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(ox, groundY, shW, 0, Math.PI * 2); ctx.fill(); ctx.restore();

    // schild: zachte oranje ringen zodra hij opgerold is
    if (opt.shield > 0) {
      var R = (sp.maxX - sp.minX) / 2 * k;
      for (var s = 0; s < 2; s++) {
        var ph = ((opt.time / 3.2) + s * 0.5) % 1;
        ctx.beginPath(); ctx.arc(ox, oy, R * (1.04 + 0.42 * ph), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(252,76,2,' + ((1 - ph) * 0.32 * opt.shield).toFixed(3) + ')'; ctx.lineWidth = 2; ctx.stroke();
      }
    }

    ctx.save();
    ctx.translate(ox, oy); ctx.scale(k, k); ctx.translate(-sp.cx, -sp.cy);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    var gY = sp.cy + (groundY - oy) / k;     // grondlijn in lichaamscoördinaten
    var wp = opt.walkPhase || 0, wk = opt.walk || 0;

    // verste poten
    if (legShow > 0) { ctx.globalAlpha = legShow; leg(sp, 0.215, wp + Math.PI, true, wk, 1 - legShow, gY); leg(sp, 0.465, wp, true, wk, 1 - legShow, gY); ctx.globalAlpha = 1; }

    // lichaam: donkere basis (buik en huid)
    ctx.beginPath(); outline(sp, 0, 1, 1, 70);
    for (var i = 70; i >= 0; i--) { var q = at(sp, i / 70, -1); ctx.lineTo(q.x, q.y); }
    ctx.closePath(); ctx.fillStyle = '#161616'; ctx.fill();
    ctx.strokeStyle = 'rgba(242,239,233,.14)'; ctx.lineWidth = 1.2; ctx.stroke();
    // opgerold: het midden sluit zich
    var hole = sm((c - 0.5) / 0.4);
    if (hole > 0) { ctx.globalAlpha = hole; ctx.beginPath(); outline(sp, 0.05, 0.9, -1, 60); ctx.closePath(); ctx.fillStyle = '#161616'; ctx.fill(); ctx.globalAlpha = 1; }

    // dichtste poten
    if (legShow > 0) { ctx.globalAlpha = legShow; leg(sp, 0.2, wp, false, wk, 1 - legShow, gY); leg(sp, 0.45, wp + Math.PI, false, wk, 1 - legShow, gY); ctx.globalAlpha = 1; }

    // schubben, van staart naar kop
    for (var col = COLS; col >= 0; col--) for (var r = 0; r < ROWS; r++) scale(sp, col, r);

    // kop: glad, met oog en oor
    ctx.beginPath(); outline(sp, 0, 0.135, 1, 14);
    for (i = 14; i >= 0; i--) { q = at(sp, 0.135 * i / 14, -1); ctx.lineTo(q.x, q.y); }
    ctx.closePath();
    var nose = at(sp, 0, 0), neck = at(sp, 0.135, 0.4);
    var hg = ctx.createLinearGradient(nose.x, nose.y, neck.x, neck.y);
    hg.addColorStop(0, '#3a3a3a'); hg.addColorStop(1, '#1e1e1e');
    ctx.fillStyle = hg; ctx.fill(); ctx.strokeStyle = 'rgba(242,239,233,.3)'; ctx.lineWidth = 1.3; ctx.stroke();
    var ear = at(sp, 0.118, 0.5); ctx.beginPath(); ctx.ellipse(ear.x, ear.y, 6, 4, sp.pts[20].phi, 0, Math.PI * 2); ctx.fillStyle = '#101010'; ctx.fill();
    var eye = at(sp, 0.062, 0.42); ctx.beginPath(); ctx.arc(eye.x, eye.y, 3.4, 0, Math.PI * 2); ctx.fillStyle = CHALK; ctx.fill();
    ctx.beginPath(); ctx.arc(eye.x + 0.8, eye.y, 1.6, 0, Math.PI * 2); ctx.fillStyle = '#111'; ctx.fill();
    ctx.beginPath(); ctx.arc(nose.x, nose.y, 3, 0, Math.PI * 2); ctx.fillStyle = '#0c0c0c'; ctx.fill();

    // opgerold: de staart ligt over de kop
    if (c > 0.5) { ctx.globalAlpha = sm((c - 0.5) / 0.25); for (col = COLS; col >= 10; col--) for (r = 0; r < ROWS; r++) scale(sp, col, r); ctx.globalAlpha = 1; }

    // oranje randlicht langs de rug
    ctx.beginPath(); outline(sp, 0.13, 0.995, 1.02, 80);
    ctx.shadowColor = ORANGE; ctx.shadowBlur = 14 * k; ctx.strokeStyle = ORANGE; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  // ---- verloop van de animatie ----
  var ROLL_END = 2.5;
  var st = { c: 0, from: 0, to: 0, t0: 0, dur: 1.3, start: null, settled: -1, auto: false };

  function frame(now) {
    now /= 1000;
    if (st.start === null) st.start = now;
    var t = now - st.start;
    var enter = easeOut(t / 1.15);                       // wandelt binnen van rechts
    if (!st.auto && t > 1.5) { st.auto = true; st.from = 0; st.to = 1; st.t0 = now; }   // daarna rolt hij zich op
    var kk = st.auto ? Math.min(1, (now - st.t0) / st.dur) : 0;
    st.c = st.from + (st.to - st.from) * easeIO(kk);
    if (kk >= 1 && st.settled < 0) st.settled = now;
    var tau = st.settled < 0 ? 0 : now - st.settled;
    var c = st.c;
    var wobble = (st.to === 1 && st.settled >= 0) ? Math.exp(-3.2 * tau) * Math.sin(tau * 8.5) : 0;   // uitrollen en tot rust komen
    var roll = c * ROLL_END + wobble * 0.22 + Math.sin(now * 0.9) * 0.015 * c;
    var bounce = (st.to === 1 && st.settled >= 0) ? Math.abs(Math.sin(tau * 7)) * Math.exp(-4.5 * tau) * 12 : 0;
    var walking = (1 - enter) > 0.02 ? 1 : 0;
    draw(c, roll, {
      x: (1 - enter) * 0.62,
      walkPhase: now * 9, walk: walking * (1 - c),
      bounce: bounce + Math.sin(now * 2) * 1.2 * (1 - c),
      shield: (st.to === 1 && st.settled >= 0) ? Math.min(1, tau / 0.8) : 0,
      time: now
    });
    if (st.settled >= 0) stage.classList.add('done');
    requestAnimationFrame(frame);
  }

  function toggle() {
    var now = performance.now() / 1000;
    if (st.start === null) return;
    st.auto = true; st.from = st.c; st.to = st.to === 1 ? 0 : 1; st.t0 = now; st.settled = -1;
    st.dur = 1.1;
    var hint = stage.querySelector('.hint');
    if (hint) hint.textContent = st.to === 1 ? 'Klik om te ontrollen' : 'Klik om op te rollen';
    canvas.setAttribute('aria-label', st.to === 1
      ? 'Animatie: een pangolin rolt zich op tot een beschermde bal.'
      : 'Animatie: de pangolin rolt zich weer open.');
  }
  canvas.addEventListener('click', toggle);
  canvas.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });

  if (reduce) {
    var still = function () { draw(1, ROLL_END, { shield: 0, time: 0 }); };
    still(); stage.classList.add('done');
    window.addEventListener('resize', still);
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
    var k = kOf(pos);
    cover.style.transform = 'rotateY(' + (-112 * k).toFixed(2) + 'deg)';
    binder.style.transform = 'translateX(' + (13 * k).toFixed(2) + '%) scale(' + (1 - 0.16 * k).toFixed(3) + ')';
    var isOpen = pos > 0.98;
    btn.textContent = isOpen ? 'Rits dicht' : 'Rits open';
    btn.setAttribute('aria-pressed', isOpen ? 'true' : 'false');
  }

  function animateTo(to, done) {
    if (reduce) { pos = to; render(); busy = false; if (done) done(); return; }
    busy = true;
    var from = pos, t0 = null, dur = 350 + 1300 * Math.abs(to - from);
    function step(now) {
      if (t0 === null) t0 = now;
      var k = Math.min(1, (now - t0) / dur);
      var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      pos = from + (to - from) * e; render();
      if (k < 1) requestAnimationFrame(step); else { busy = false; if (done) done(); }
    }
    requestAnimationFrame(step);
  }

  function toggle() { if (!busy) animateTo(pos > 0.5 ? 0 : 1); }

  // Waar staat de trekker op het scherm voor elke stand van de rits?
  // De binder schuift en krimpt terwijl hij opengaat; dat rekenen we hier mee,
  // zodat de trekker exact onder de muis blijft en niet gaat trillen.
  var art = binder.parentElement;
  function kOf(t) { var k = Math.max(0, Math.min(1, (t - OPEN_FROM) / (1 - OPEN_FROM))); return k * k * (3 - 2 * k); }
  var shown = [];
  for (i = 0; i <= N; i++) {
    var kk = kOf(i / N), sc = 1 - 0.16 * kk;
    shown.push({ x: 210 + (samples[i].x - 210) * sc + 0.13 * 420 * kk, y: 250 + (samples[i].y - 250) * sc });
  }

  function nearest(clientX, clientY) {
    var r = art.getBoundingClientRect();
    var w = binder.offsetWidth, h = binder.offsetHeight;
    if (!w || !h) return pos;
    var lx = (clientX - r.left - art.clientLeft - binder.offsetLeft) / w * 420;
    var ly = (clientY - r.top - art.clientTop - binder.offsetTop) / h * 500;
    var cur = Math.round(target * N), best = cur, bd = 1e12;
    var lo = Math.max(0, cur - 36), hi = Math.min(N, cur + 36);   // geen sprongen over de binder heen
    for (var j = lo; j <= hi; j++) {
      var dx = shown[j].x - lx, dy = shown[j].y - ly, d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = j; }
    }
    // verfijnen tussen twee meetpunten, zodat de beweging traploos is
    var f = best;
    [[best - 1, best], [best, best + 1]].forEach(function (seg) {
      if (seg[0] < 0 || seg[1] > N) return;
      var A = shown[seg[0]], B = shown[seg[1]];
      var vx = B.x - A.x, vy = B.y - A.y, L2 = vx * vx + vy * vy;
      if (!L2) return;
      var u = Math.max(0, Math.min(1, ((lx - A.x) * vx + (ly - A.y) * vy) / L2));
      var px = A.x + vx * u - lx, py = A.y + vy * u - ly, d2 = px * px + py * py;
      if (d2 < bd) { bd = d2; f = seg[0] + u; }
    });
    return f / N;
  }

  var target = 0, raf = 0;
  function follow() {                      // zacht naar de muis toe bewegen
    raf = 0;
    var d = target - pos;
    if (Math.abs(d) < 0.0004) { pos = target; render(); if (dragging) raf = requestAnimationFrame(follow); return; }
    pos += d * 0.38; render();
    raf = requestAnimationFrame(follow);
  }

  pull.addEventListener('pointerdown', function (e) {
    if (busy) return;
    dragging = true; moved = false; startX = e.clientX; startY = e.clientY; target = pos;
    binder.classList.add('dragging');
    try { pull.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });
  pull.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    if (!moved && Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) < 4) return;
    moved = true;
    target = reduce ? (pos = nearest(e.clientX, e.clientY)) : nearest(e.clientX, e.clientY);
    if (reduce) render(); else if (!raf) raf = requestAnimationFrame(follow);
  });
  function end() {
    if (!dragging) return;
    dragging = false; binder.classList.remove('dragging');
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (!moved) { toggle(); return; }
    animateTo(pos > 0.5 ? 1 : 0);          // loslaten: klikt vast in open of dicht
  }
  pull.addEventListener('pointerup', end);
  pull.addEventListener('pointercancel', end);

  btn.addEventListener('click', toggle);
  render();
})();
