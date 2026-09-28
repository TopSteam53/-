/* Мурмерж — stand-in cat merge game (Suika-style) for gameplay footage.
 *
 * URL params:
 *   auto=1       AI plays (bug/over imply auto)
 *   seed=N       deterministic seed
 *   speed=1      AI tempo multiplier
 *   preset=...   chain | dense | bug | over | none   (initial jar contents)
 *   bug=1        comedic "AI code broke" mode
 *   over=1       fills up fast -> "Игра окончена" panel
 *   zoom=1.4     camera zoom on the lower jar (close-up)
 *   record=1     no realtime loop; drive with window.__step(ms) / window.__grab()
 */
'use strict';
(function () {
  const Q = new URLSearchParams(location.search);
  const on = (k) => Q.get(k) === '1' || Q.get(k) === 'true';
  const BUG = on('bug');
  const OVER = on('over');
  const AUTO = on('auto') || ((BUG || OVER) && Q.get('auto') !== '0');
  const RECORD = on('record');
  const SEED = parseInt(Q.get('seed') || '7', 10);
  const SPEED = parseFloat(Q.get('speed') || '1');
  const ZOOM = parseFloat(Q.get('zoom') || '1');
  const PRESET = Q.get('preset') || (OVER ? 'over' : BUG ? 'bug' : AUTO ? 'chain' : 'none');
  const WARM = Q.has('warm') ? parseFloat(Q.get('warm')) : 1.6;

  const W = 1080, H = 1920;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // ---------- geometry ----------
  const JL = 96, JR = 984, JT = 610, JB = 1752, CR = 96; // jar interior
  const DY = 488;                // dropper centre
  const DANGER_Y = JT + 46;      // game over line
  const G = 3000;                // gravity px/s^2
  const STEP = 1 / 120, SUB = 4, DT = STEP / SUB;

  // ---------- rng ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(SEED * 9973 + 17);
  const rfx = mulberry32(SEED * 31337 + 5);

  // ---------- cat tiers ----------
  const TIERS = [
    { name: 'Снежок',    r: 47,  body: '#FFFFFF', light: '#FFFFFF', shade: '#E4DDF0', dark: '#BFAED6', inner: '#FFB3CB', line: '#6B4A68', blush: 'rgba(255,120,160,0.45)' },
    { name: 'Рыжик',     r: 61,  body: '#FFA850', light: '#FFD7A3', shade: '#F07E24', dark: '#C35E17', inner: '#FFC2B0', line: '#6B3A22', stripe: '#E86F17', muzzle: '#FFF4E6', blush: 'rgba(255,90,110,0.40)' },
    { name: 'Серый',     r: 77,  body: '#AFB9CA', light: '#E1E7F1', shade: '#8591A6', dark: '#5B667D', inner: '#FFC0D0', line: '#3E4558', stripe: '#77839A', muzzle: '#F6F8FC', blush: 'rgba(255,120,160,0.40)' },
    { name: 'Уголёк',    r: 94,  body: '#3F3758', light: '#6F6493', shade: '#252036', dark: '#15111F', inner: '#FF9DBE', line: '#FFB3CF', iris: '#C8F45C', whisk: 'rgba(255,255,255,0.55)', blush: 'rgba(255,110,160,0.45)' },
    { name: 'Мурка',     r: 114, body: '#FFFDF8', light: '#FFFFFF', shade: '#EDE3D4', dark: '#B09580', inner: '#FFB9C8', line: '#5E3C33', earL: '#FFA24A', earR: '#3F3758', calico: true, blush: 'rgba(255,110,140,0.40)' },
    { name: 'Сиамка',    r: 137, body: '#F8E9D2', light: '#FFF9EE', shade: '#E2C7A0', dark: '#98714F', inner: '#E8A6A0', line: '#4A2E22', earL: '#7A5540', earR: '#7A5540', tail: '#7A5540', mask: 'rgba(128,88,64,', iris: '#63C6FF', blush: 'rgba(255,120,140,0.35)' },
    { name: 'Зефирка',   r: 161, body: '#FFB2D0', light: '#FFE3EF', shade: '#F488B4', dark: '#CF568C', inner: '#FF8DB9', line: '#7A2A52', muzzle: '#FFFFFF', heart: '#FF4F93', blush: 'rgba(255,70,130,0.35)' },
    { name: 'Лаванда',   r: 188, body: '#BA9CF6', light: '#E4D8FF', shade: '#9270E4', dark: '#6344BC', inner: '#FFB6D8', line: '#3C2470', muzzle: '#F1EAFF', stars: '#FFF09A', blush: 'rgba(255,110,170,0.40)' },
    { name: 'Облачко',   r: 217, body: '#8AD8FB', light: '#DDF5FF', shade: '#58BAEB', dark: '#2A86C0', inner: '#FFB8D2', line: '#1F4F75', muzzle: '#FFFFFF', fluffy: true, blush: 'rgba(255,110,160,0.45)' },
    { name: 'Кот-Король', r: 248, body: '#FFD23F', light: '#FFF3AE', shade: '#F3A51A', dark: '#B06E08', inner: '#FFB0A0', line: '#6B3A08', muzzle: '#FFF6D2', crown: true, blush: 'rgba(255,100,90,0.40)' },
  ];
  const PTS = [0, 2, 6, 12, 20, 30, 42, 56, 72, 90];

  // ---------- helpers ----------
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

  function rrect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function heartPath(g, x, y, s) {
    g.beginPath();
    g.moveTo(x, y + s * 0.35);
    g.bezierCurveTo(x, y - s * 0.1, x - s * 0.55, y - s * 0.25, x - s * 0.55, y + s * 0.12);
    g.bezierCurveTo(x - s * 0.55, y + s * 0.45, x - s * 0.1, y + s * 0.62, x, y + s * 0.85);
    g.bezierCurveTo(x + s * 0.1, y + s * 0.62, x + s * 0.55, y + s * 0.45, x + s * 0.55, y + s * 0.12);
    g.bezierCurveTo(x + s * 0.55, y - s * 0.25, x, y - s * 0.1, x, y + s * 0.35);
    g.closePath();
  }
  function starPath(g, x, y, R, r, n = 5, rot = -Math.PI / 2) {
    g.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = rot + (i * Math.PI) / n;
      const rr = i % 2 ? r : R;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
  }
  function sparkle(g, x, y, s, color) {
    g.beginPath();
    g.moveTo(x, y - s);
    g.quadraticCurveTo(x, y, x + s, y);
    g.quadraticCurveTo(x, y, x, y + s);
    g.quadraticCurveTo(x, y, x - s, y);
    g.quadraticCurveTo(x, y, x, y - s);
    g.fillStyle = color; g.fill();
  }

  // ---------- cat drawing (unit space: radius 100) ----------
  function bodyPath(g, T) {
    g.beginPath();
    if (T.fluffy) {
      const n = 22;
      for (let i = 0; i <= n; i++) {
        const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
        const a1 = ((i + 0.5) / n) * Math.PI * 2 - Math.PI / 2;
        const a2 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
        if (i === 0) g.moveTo(Math.cos(a0) * 96, Math.sin(a0) * 96);
        if (i < n) g.quadraticCurveTo(Math.cos(a1) * 109, Math.sin(a1) * 109, Math.cos(a2) * 96, Math.sin(a2) * 96);
      }
      g.closePath();
    } else {
      g.arc(0, 0, 100, 0, Math.PI * 2);
    }
  }
  const EAR_L = [[-93, -38], [-78, -124], [-36, -93]];
  const EAR_R = EAR_L.map(([x, y]) => [-x, y]);
  const IN_L = [[-80, -52], [-73, -108], [-48, -84]];
  const IN_R = IN_L.map(([x, y]) => [-x, y]);
  function poly(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); }
  function ell(g, x, y, rx, ry, rot = 0) { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); }

  function drawCat(g, tier, x, y, r, ang, o = {}) {
    const T = TIERS[tier];
    const s = r / 100;
    const t = o.t || 0;
    const seed = o.seed || 0;
    g.save();
    g.translate(x, y);
    g.rotate(ang || 0);
    g.scale(s, s);
    if (o.alpha !== undefined) g.globalAlpha *= o.alpha;
    const ow = clamp(r * 0.055, 3.2, 10) / s;
    g.lineJoin = 'round'; g.lineCap = 'round';
    const sil = o.silhouette;
    const DARK = sil ? 'rgba(125,95,160,0.28)' : T.dark;
    const wag = o.noTail ? 0 : Math.sin(t * 2.6 + seed * 1.7) * 10;
    const tailPath = () => { g.beginPath(); g.moveTo(40, 74); g.quadraticCurveTo(124, 86, 112 + wag * 0.3, 16 + wag); };
    const earsPath = () => { poly(g, EAR_L); poly(g, EAR_R); };
    // --- outline pass
    g.strokeStyle = DARK;
    if (!o.noTail) { tailPath(); g.lineWidth = 22 + ow * 2; g.stroke(); }
    earsPath(); g.lineWidth = 16 + ow * 2; g.stroke();
    bodyPath(g, T); g.lineWidth = ow * 2; g.stroke();
    if (T.crown && !sil) drawCrown(g, ow, t, true);
    if (sil) {
      g.fillStyle = 'rgba(125,95,160,0.28)';
      if (!o.noTail) { tailPath(); g.lineWidth = 22; g.strokeStyle = g.fillStyle; g.stroke(); }
      earsPath(); g.lineWidth = 16; g.strokeStyle = g.fillStyle; g.stroke(); g.fill();
      bodyPath(g, T); g.fill();
      g.restore();
      return;
    }
    // --- fill pass
    if (!o.noTail) { tailPath(); g.lineWidth = 22; g.strokeStyle = T.tail || T.body; g.stroke(); }
    poly(g, EAR_L); g.fillStyle = T.earL || T.body; g.strokeStyle = g.fillStyle; g.lineWidth = 16; g.fill(); g.stroke();
    poly(g, EAR_R); g.fillStyle = T.earR || T.body; g.strokeStyle = g.fillStyle; g.fill(); g.stroke();
    // inner ears
    g.fillStyle = T.inner; g.strokeStyle = T.inner; g.lineWidth = 6;
    poly(g, IN_L); g.fill(); g.stroke(); poly(g, IN_R); g.fill(); g.stroke();
    // body
    const grd = g.createRadialGradient(-34, -44, 8, -6, -4, 118);
    grd.addColorStop(0, T.light); grd.addColorStop(0.5, T.body); grd.addColorStop(1, T.shade);
    bodyPath(g, T); g.fillStyle = grd; g.fill();
    // patterns (clipped)
    g.save();
    bodyPath(g, T); g.clip();
    if (T.stripe) {
      g.strokeStyle = T.stripe; g.lineWidth = 10;
      const seg = (a, b, c, d) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); };
      seg(0, -104, 0, -74); seg(-22, -100, -17, -77); seg(22, -100, 17, -77);
      g.lineWidth = 9;
      seg(-104, -12, -82, -8); seg(-104, 14, -84, 14); seg(104, -12, 82, -8); seg(104, 14, 84, 14);
      seg(-60, 88, -48, 70); seg(60, 88, 48, 70);
    }
    if (T.calico) {
      g.fillStyle = '#FFA24A'; ell(g, -62, -52, 60, 46, -0.4); g.fill();
      g.fillStyle = '#3F3758'; ell(g, 78, -22, 40, 58, 0.25); g.fill();
      g.fillStyle = '#FFA24A'; ell(g, 44, 86, 42, 26, 0.2); g.fill();
      g.fillStyle = '#3F3758'; ell(g, -70, 72, 22, 16, 0.4); g.fill();
    }
    if (T.mask) {
      const m = g.createRadialGradient(0, 22, 4, 0, 22, 60);
      m.addColorStop(0, T.mask + '0.95)'); m.addColorStop(0.7, T.mask + '0.88)'); m.addColorStop(1, T.mask + '0)');
      g.fillStyle = m; g.fillRect(-100, -60, 200, 170);
    }
    if (T.muzzle) {
      g.fillStyle = T.muzzle;
      ell(g, -17, 34, 27, 22); g.fill(); ell(g, 17, 34, 27, 22); g.fill(); ell(g, 0, 50, 22, 16); g.fill();
    }
    if (T.heart) { g.fillStyle = T.heart; heartPath(g, 0, -80, 30); g.fill(); }
    if (T.stars) {
      g.fillStyle = T.stars;
      starPath(g, -56, -46, 13, 6); g.fill(); starPath(g, 60, -40, 10, 4.5); g.fill();
      starPath(g, -66, 56, 8, 3.5); g.fill(); starPath(g, 64, 58, 12, 5.5); g.fill(); starPath(g, 8, -80, 7, 3); g.fill();
    }
    // soft bottom shade + glossy highlight
    const sh = g.createLinearGradient(0, 30, 0, 104);
    sh.addColorStop(0, 'rgba(60,20,80,0)'); sh.addColorStop(1, 'rgba(60,20,80,0.13)');
    g.fillStyle = sh; g.fillRect(-110, 30, 220, 80);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    ell(g, -44, -60, 24, 12, -0.62); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    ell(g, -70, -30, 7, 5, -1.0); g.fill();
    g.restore();

    drawFace(g, T, o.expr || 'normal', t, seed);
    if (T.crown) drawCrown(g, ow, t, false);
    g.restore();
  }

  function drawCrown(g, ow, t, outline) {
    const pts = [[-50, -84], [-56, -142], [-26, -110], [0, -156], [26, -110], [56, -142], [50, -84]];
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.quadraticCurveTo(0, -74, -50, -84);
    g.closePath();
    if (outline) { g.strokeStyle = '#9A5A00'; g.lineWidth = 6 + ow * 2; g.stroke(); return; }
    const cg = g.createLinearGradient(0, -156, 0, -80);
    cg.addColorStop(0, '#FFF6B0'); cg.addColorStop(0.5, '#FFD230'); cg.addColorStop(1, '#F29A00');
    g.fillStyle = cg; g.strokeStyle = '#FFE070'; g.lineWidth = 6; g.fill(); g.stroke();
    // band
    g.fillStyle = '#E88A00'; rrect(g, -50, -98, 100, 12, 6); g.fill();
    const gems = [[-56, -142, '#FF4F7B'], [0, -156, '#4FC3FF'], [56, -142, '#7BE36A']];
    for (const [x, y, c] of gems) { g.fillStyle = c; g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(x - 2.5, y - 2.5, 2.6, 0, 7); g.fill(); }
    g.fillStyle = '#FF4F7B'; g.beginPath(); g.arc(0, -92, 7, 0, 7); g.fill();
    // twinkle
    const tw = 0.5 + 0.5 * Math.sin(t * 5);
    sparkle(g, -30, -128, 6 + tw * 8, 'rgba(255,255,255,0.95)');
    sparkle(g, 118, -60, 6 + (1 - tw) * 12, 'rgba(255,245,180,0.95)');
    sparkle(g, -120, 10, 5 + tw * 9, 'rgba(255,245,180,0.9)');
  }

  function drawFace(g, T, expr, t, seed) {
    const ink = T.line;
    // blush
    g.fillStyle = T.blush;
    ell(g, -60, 30, 17, 10); g.fill(); ell(g, 60, 30, 17, 10); g.fill();
    // whiskers
    g.strokeStyle = T.whisk || 'rgba(70,40,70,0.38)'; g.lineWidth = 3.2; g.lineCap = 'round';
    const wh = (a, b, c, d) => { g.beginPath(); g.moveTo(a, b); g.quadraticCurveTo((a + c) / 2, (b + d) / 2 - 3, c, d); g.stroke(); };
    wh(-48, 26, -96, 14); wh(-48, 36, -98, 38); wh(48, 26, 96, 14); wh(48, 36, 98, 38);
    // eyes
    let e = expr;
    if (e === 'normal') { const ph = (t * 1 + seed * 0.731) % 4.1; if (ph < 0.13) e = 'blink'; }
    const EX = 36, EY = 2;
    g.lineWidth = 6; g.strokeStyle = ink === '#FFB3CF' ? '#15111F' : ink;
    for (const sx of [-1, 1]) {
      const ex = sx * EX;
      if (e === 'happy') {
        g.strokeStyle = T.iris ? '#15111F' : ink; if (T.body === '#3F3758') g.strokeStyle = '#FFE8F2';
        g.beginPath(); g.moveTo(ex - 14, EY + 6); g.quadraticCurveTo(ex, EY - 16, ex + 14, EY + 6); g.lineWidth = 7; g.stroke();
      } else if (e === 'blink') {
        g.strokeStyle = T.body === '#3F3758' ? '#FFE8F2' : ink;
        g.beginPath(); g.moveTo(ex - 14, EY + 2); g.quadraticCurveTo(ex, EY + 12, ex + 14, EY + 2); g.lineWidth = 6; g.stroke();
      } else if (e === 'dizzy') {
        g.strokeStyle = T.body === '#3F3758' ? '#FFE8F2' : ink; g.lineWidth = 6;
        g.beginPath(); g.moveTo(ex - 11, EY - 11); g.lineTo(ex + 11, EY + 11); g.moveTo(ex + 11, EY - 11); g.lineTo(ex - 11, EY + 11); g.stroke();
      } else if (e === 'scared') {
        g.fillStyle = '#FFFFFF'; ell(g, ex, EY - 2, 20, 23); g.fill();
        g.strokeStyle = '#2A2138'; g.lineWidth = 4; g.stroke();
        g.fillStyle = '#2A2138'; ell(g, ex + sx * 2, EY - 4, 6, 7); g.fill();
      } else {
        // big shiny eye
        if (T.iris) {
          g.fillStyle = T.iris; ell(g, ex, EY, 16, 20); g.fill();
          g.fillStyle = '#1A1422'; ell(g, ex, EY + 1, 9, 14); g.fill();
        } else {
          const eg = g.createLinearGradient(0, EY - 20, 0, EY + 20);
          eg.addColorStop(0, '#2A2138'); eg.addColorStop(1, '#4A3470');
          g.fillStyle = eg; ell(g, ex, EY, 16, 20); g.fill();
          g.fillStyle = 'rgba(160,130,255,0.35)'; ell(g, ex, EY + 10, 10, 6); g.fill();
        }
        g.fillStyle = '#FFFFFF';
        g.beginPath(); g.arc(ex + 5, EY - 8, 7, 0, 7); g.fill();
        g.beginPath(); g.arc(ex - 6, EY + 8, 3.2, 0, 7); g.fill();
        if (e === 'sad') {
          g.fillStyle = 'rgba(120,200,255,0.9)';
          g.beginPath(); g.moveTo(ex - sx * 4, EY + 18); g.quadraticCurveTo(ex - sx * 12, EY + 34, ex - sx * 4, EY + 38); g.quadraticCurveTo(ex + sx * 4, EY + 34, ex - sx * 4, EY + 18); g.fill();
        }
      }
    }
    // nose
    g.fillStyle = '#FF7FA6'; g.strokeStyle = '#FF7FA6'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(-8, 17); g.lineTo(8, 17); g.lineTo(0, 25); g.closePath(); g.fill(); g.stroke();
    // mouth
    g.strokeStyle = ink; g.lineWidth = 4.2;
    if (e === 'happy') {
      g.fillStyle = '#E4476E';
      g.beginPath(); g.moveTo(-12, 29); g.quadraticCurveTo(0, 52, 12, 29); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#FF9DB6'; ell(g, 0, 40, 6, 4); g.fill();
    } else if (e === 'scared') {
      g.fillStyle = '#4A2233'; ell(g, 0, 42, 10, 13); g.fill();
    } else if (e === 'sad' || e === 'dizzy') {
      g.beginPath(); g.moveTo(-12, 40); g.quadraticCurveTo(0, 28, 12, 40); g.stroke();
    } else {
      g.beginPath(); g.moveTo(0, 25); g.lineTo(0, 29);
      g.moveTo(-14, 29); g.quadraticCurveTo(-7, 38, 0, 29); g.quadraticCurveTo(7, 38, 14, 29); g.stroke();
    }
  }

  // ---------- background (static, pre-rendered) ----------
  const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
  function buildBackground() {
    const g = bg.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#FFD9E8'); gr.addColorStop(0.45, '#FCE7F3'); gr.addColorStop(0.75, '#E9E4FF'); gr.addColorStop(1, '#D8EEFF');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // soft glow blobs
    const blob = (x, y, r, c) => { const b = g.createRadialGradient(x, y, 0, x, y, r); b.addColorStop(0, c); b.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = b; g.fillRect(x - r, y - r, r * 2, r * 2); };
    blob(540, 150, 520, 'rgba(255,255,255,0.75)');
    blob(80, 900, 420, 'rgba(255,200,230,0.55)');
    blob(1000, 1300, 460, 'rgba(200,215,255,0.6)');
    // pattern: paws, dots, little hearts on a diagonal grid
    const R = mulberry32(99);
    for (let row = 0; row < 18; row++) {
      for (let col = 0; col < 8; col++) {
        const x = col * 150 + (row % 2) * 75 + 20;
        const y = row * 115 + 20;
        const k = (row * 3 + col) % 3;
        g.save(); g.translate(x, y); g.rotate(-0.35 + R() * 0.3);
        if (k === 0) {
          g.fillStyle = 'rgba(255,255,255,0.55)';
          ell(g, 0, 8, 14, 11); g.fill();
          for (const [dx, dy] of [[-14, -8], [-5, -15], [5, -15], [14, -8]]) { ell(g, dx, dy, 5, 6); g.fill(); }
        } else if (k === 1) {
          g.fillStyle = 'rgba(255,150,200,0.22)'; heartPath(g, 0, -8, 22); g.fill();
        } else {
          g.fillStyle = 'rgba(170,150,255,0.22)'; g.beginPath(); g.arc(0, 0, 6, 0, 7); g.fill();
        }
        g.restore();
      }
    }
  }

  // ---------- state ----------
  let bodies = [], ghosts = [], parts = [], rings = [], floats = [];
  let nextId = 1;
  let T = 0;                 // game time since start of footage
  let score = 0, shownScore = 0, scoreBump = 0;
  let combo = 0, lastMergeT = -10, comboText = null;
  let shake = 0;
  let maxTier = 0;
  let mergeEnabled = true;
  let nextMergeOk = -1;
  const MERGE_GAP = PRESET === 'dense' ? 0.075 : 0;
  let gameOver = false, overT = 0;
  let dropX = W / 2, current = 0, next = 0, currentReadyT = 0;
  const queue = [];
  const events = [];
  let flash = 0;
  const cam = { x: W / 2, y: H / 2, z: ZOOM, tx: W / 2 };
  if (ZOOM > 1) { cam.y = JB + 50 - H / (2 * ZOOM); cam.x = W / 2; }

  // bug-mode state
  const BUG_T = parseFloat(Q.get('bugAt') || '2.3');
  let bugPhase = 0, errCount = 0, glitchUntil = -1, errLines = 0;

  function makeBody(tier, x, y) {
    const b = { id: nextId++, tier, x, y, px: x, py: y, r: TIERS[tier].r, rT: TIERS[tier].r, angle: 0, born: T, pop: -10, happyUntil: -1, dead: false, dangerT: 0, noWalls: false, noCollide: false, glitch: false, spin: 0, scared: false };
    bodies.push(b);
    if (tier > maxTier) maxTier = tier;
    return b;
  }

  function pickTier() {
    if (queue.length) return queue.shift();
    let w;
    if (OVER) w = [0, 6, 30, 34, 30];
    else w = [30, 28, 22, 13, 7];
    const tot = w.reduce((a, b) => a + b, 0);
    let x = rng() * tot;
    for (let i = 0; i < w.length; i++) { x -= w[i]; if (x < 0) return i; }
    return 0;
  }

  // ---------- presets ----------
  function fillRows(fromY, toY, tierFn) {
    let y = fromY;
    while (y > toY) {
      let x = JL + 4, rowH = 0;
      while (true) {
        const t = tierFn();
        const r = TIERS[t].r;
        if (x + 2 * r > JR - 4) break;
        makeBody(t, x + r, y - r);
        x += 2 * r + 2;
        rowH = Math.max(rowH, 2 * r);
      }
      y -= rowH * 0.85;
    }
  }
  function setupPreset() {
    if (PRESET === 'chain') {
      // a tower in the left corner: dropping a 3 on top cascades 3+3 -> 4 -> 5 -> 6 -> 7 downwards
      const R = (t) => TIERS[t].r;
      makeBody(6, JL + R(6), JB - R(6));
      makeBody(5, JL + R(5), JB - 2 * R(6) - R(5) + 20);
      makeBody(4, JL + R(4), JB - 2 * R(6) - 2 * R(5) - R(4) + 40);
      makeBody(3, JL + R(3), JB - 2 * R(6) - 2 * R(5) - 2 * R(4) - R(3) + 60);
      let x = JL + 2 * R(6) + 2;
      for (const t of [2, 0]) { makeBody(t, x + R(t), JB - R(t)); x += 2 * R(t); }
      makeBody(6, JR - R(6), JB - R(6)); // second pink one waiting on the right
      makeBody(1, JL + 400, JB - 330);
      makeBody(4, JL + 590, JB - 460);
      makeBody(0, JL + 770, JB - 400);
      makeBody(1, JR - 70, JB - 420);
      makeBody(2, JL + 700, JB - 700);
      makeBody(1, JL + 470, JB - 600);
      makeBody(2, JR - 90, JB - 600);
      queue.push(3, 0, 1, 2, 0, 1, 2);
    } else if (PRESET === 'dense') {
      const R = mulberry32(SEED + 5);
      fillRows(JB, JB - 900, () => { const x = R(); return x < 0.3 ? 0 : x < 0.58 ? 1 : x < 0.82 ? 2 : 3; });
      queue.push(1, 0, 2, 1, 0, 3, 1, 2, 0);
    } else if (PRESET === 'bug') {
      makeBody(5, JL + 130, JB - 122);
      makeBody(4, JL + 360, JB - 102);
      makeBody(3, JL + 560, JB - 84);
      makeBody(2, JL + 720, JB - 68);
      makeBody(2, JR - 70, JB - 68);
      makeBody(1, JL + 300, JB - 300);
      makeBody(0, JL + 460, JB - 260);
      makeBody(1, JL + 640, JB - 250);
      makeBody(3, JR - 120, JB - 240);
      queue.push(2, 1, 0, 1, 2);
    } else if (PRESET === 'over') {
      const R = mulberry32(SEED + 11);
      let k = 0;
      const seq = [4, 3, 5, 2, 4, 3, 2, 5, 3, 4, 2, 3, 5, 4, 2, 3];
      fillRows(JB, JT + 250, () => seq[(k++ + Math.floor(R() * 3)) % seq.length]);
      queue.push(4, 3, 4, 3, 2, 4, 3, 4);
    }
  }

  // ---------- physics ----------
  function stepPhysics(dt) {
    const n = bodies.length;
    const bugOn = BUG && bugPhase >= 1;
    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      let vx = (b.x - b.px) * 0.9992, vy = (b.y - b.py) * 0.9992;
      if (!b.noWalls) {
        const sp = Math.hypot(vx, vy), mx = 12;
        if (sp > mx) { vx *= mx / sp; vy *= mx / sp; }
        if (vy < -2.2) vy = -2.2; // squeezed cats never get catapulted
      }
      b.px = b.x; b.py = b.y;
      b.x += vx; b.y += vy + G * dt * dt;
      if (bugOn && b.glitch && !b.noWalls) {
        b.x += (rng() - 0.5) * 7; b.y += (rng() - 0.5) * 7;
      }
      if (b.r < b.rT) b.r = Math.min(b.rT, b.r + (b.rT * 0.4 * dt) / 0.22);
      if (b.spin) b.angle += b.spin * dt;
      else {
        b.angle += (vx / b.r) * 0.9;
        b.angle *= 0.9986;
      }
    }
    const cands = [];
    for (let it = 0; it < 2; it++) {
      for (let i = 0; i < n; i++) {
        const a = bodies[i];
        if (a.noCollide) continue;
        for (let j = i + 1; j < n; j++) {
          const b = bodies[j];
          if (b.noCollide) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const rr = a.r + b.r;
          const d2 = dx * dx + dy * dy;
          if (d2 >= (rr + 30) * (rr + 30) || d2 < 1e-6) continue;
          const d = Math.sqrt(d2);
          const same = a.tier === b.tier;
          if (d < rr) {
            let stiff = 0.75;
            if (bugOn && (a.glitch || b.glitch)) stiff = 0.08;
            const ov = Math.min((rr - d) * stiff, 2.2);
            const nx = dx / d, ny = dy / d;
            const ma = a.r * a.r, mb = b.r * b.r, s = ma + mb;
            a.x -= nx * ov * mb / s; a.y -= ny * ov * mb / s;
            b.x += nx * ov * ma / s; b.y += ny * ov * ma / s;
            // light tangential friction between touching cats
            const rvx = (b.x - b.px) - (a.x - a.px), rvy = (b.y - b.py) - (a.y - a.py);
            const tv = rvx * -ny + rvy * nx;
            const f = tv * 0.02;
            a.px -= -ny * f * mb / s; a.py -= nx * f * mb / s;
            b.px += -ny * f * ma / s; b.py += nx * f * ma / s;
            if (it === 1 && same && mergeEnabled && !a.dead && !b.dead && !(OVER && (a.pre || b.pre))) cands.push([a, b]);
          } else if (same && mergeEnabled && it === 0 && !bugOn) {
            // gentle "magnet" so same cats find each other (keeps chains flowing)
            const gap = d - rr;
            if (gap < a.r * (a.tier >= 5 ? 1.0 : 0.35) && T - a.born > 0.15 && T - b.born > 0.15) {
              const pull = Math.min(gap, 0.5) * (a.tier >= 5 ? 0.9 : 0.5);
              const nx = dx / d, ny = dy / d;
              a.x += nx * pull; a.y += ny * pull; b.x -= nx * pull; b.y -= ny * pull;
            }
          }
        }
      }
      for (let i = 0; i < n; i++) walls(bodies[i]);
    }
    for (const [a, b] of cands) {
      if (a.dead || b.dead) continue;
      if (T < nextMergeOk) break; // popcorn pacing: pops ripple one after another instead of all at once
      nextMergeOk = T + MERGE_GAP;
      if (bugOn) { if (!a.mf && !b.mf && bodies.length < 60) misfire(a, b); continue; }
      merge(a, b);
    }
    if (cands.length) bodies = bodies.filter((b) => !b.dead);
  }

  function walls(b) {
    if (b.noWalls) return;
    const r = b.r;
    if (b.x < JL + r) { b.x = JL + r; }
    if (b.x > JR - r) { b.x = JR - r; }
    if (b.y > JB - r) {
      b.y = JB - r;
      b.px += (b.x - b.px) * 0.06; // floor friction
    }
    if (b.y > JB - CR) {
      let cx = 0;
      if (b.x < JL + CR) cx = JL + CR; else if (b.x > JR - CR) cx = JR - CR;
      if (cx) {
        const cy = JB - CR, dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy), lim = CR - r;
        if (lim > 0 && d > lim) { b.x = cx + (dx / d) * lim; b.y = cy + (dy / d) * lim; }
      }
    }
  }

  // ---------- merging & fx ----------
  function merge(a, b) {
    a.dead = b.dead = true;
    const nt = a.tier + 1;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    ghosts.push({ tier: a.tier, x: a.x, y: a.y, tx: mx, ty: my, r: a.r, ang: a.angle, t0: T });
    ghosts.push({ tier: b.tier, x: b.x, y: b.y, tx: mx, ty: my, r: b.r, ang: b.angle, t0: T });
    if (T - lastMergeT < 1.0) combo++; else combo = 1;
    lastMergeT = T;
    let pts;
    if (nt >= TIERS.length) {
      pts = 250;
      burst(mx, my, 9, 80);
      shake = Math.max(shake, 40); flash = 1;
    } else {
      const vx = ((a.x - a.px) + (b.x - b.px)) / 2, vy = ((a.y - a.py) + (b.y - b.py)) / 2;
      const c = makeBody(nt, mx, my);
      c.r = TIERS[nt].r * 0.6; c.px = mx - vx * 0.5; c.py = my - vy * 0.5;
      c.pop = T; c.happyUntil = T + 1.0; c.angle = 0;
      pts = PTS[nt];
      burst(mx, my, nt, 12 + nt * 4);
      if (nt >= 5) { shake = Math.max(shake, 6 + (nt - 4) * 5); }
      if (nt >= 7) flash = Math.max(flash, 0.35);
    }
    const mult = combo >= 2 ? combo : 1;
    pts *= mult;
    score += pts; scoreBump = 1;
    floats.push({ x: mx, y: my - Math.min(TIERS[Math.min(nt, 9)].r, 120) * 0.6, text: '+' + pts, t0: T, dur: 1.0, size: 58 + Math.min(nt, 9) * 7, tier: Math.min(nt, 9) });
    if (combo >= 2) comboText = { n: combo, t0: T };
    events.push({ t: +T.toFixed(3), type: 'merge', tier: nt, combo });
    if (ZOOM > 1) cam.tx = mx;
  }

  function burst(x, y, tier, count) {
    const TT = TIERS[Math.min(tier, 9)];
    const cols = [TT.body, TT.light, '#FF6FA8', '#FFD84D', '#FFFFFF', '#8FD8FF'];
    const big = Math.min(tier, 9);
    for (let i = 0; i < count; i++) {
      const a = rfx() * Math.PI * 2;
      const sp = (260 + rfx() * 520) * (1 + big * 0.08);
      const k = rfx();
      parts.push({
        x: x + Math.cos(a) * TT.r * 0.3, y: y + Math.sin(a) * TT.r * 0.3,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 220,
        life: 0, max: 0.55 + rfx() * 0.55,
        type: k < 0.4 ? 'heart' : k < 0.75 ? 'star' : 'dot',
        color: cols[Math.floor(rfx() * cols.length)],
        size: (14 + rfx() * 16) * (1 + big * 0.07),
        rot: rfx() * 6, vr: (rfx() - 0.5) * 10,
      });
    }
    rings.push({ x, y, r0: TT.r * 0.5, r1: TT.r * 1.8 + 40, t0: T, dur: 0.45, color: TT.light });
  }

  function updateFx(dt) {
    for (const p of parts) {
      p.life += dt; p.vy += 1300 * dt; p.vx *= 1 - 1.8 * dt; p.vy *= 1 - 1.2 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
    parts = parts.filter((p) => p.life < p.max);
    rings = rings.filter((r) => T - r.t0 < r.dur);
    floats = floats.filter((f) => T - f.t0 < f.dur);
    ghosts = ghosts.filter((g) => T - g.t0 < 0.1);
    shake *= Math.exp(-dt * 9);
    flash *= Math.exp(-dt * 6);
    scoreBump *= Math.exp(-dt * 7);
    shownScore += (score - shownScore) * (1 - Math.exp(-dt * 10));
    if (Math.abs(score - shownScore) < 0.5) shownScore = score;
    if (ZOOM > 1) {
      const half = W / (2 * cam.z);
      cam.x += (clamp(cam.tx, JL - 40 + half, JR + 40 - half) - cam.x) * (1 - Math.exp(-dt * 2.2));
    }
  }

  // ---------- bug mode ----------
  function misfire(a, b) {
    // "merges" without removing the originals: duplicates pile up and overlap
    const nt = Math.min(a.tier + 1, 9);
    const c = makeBody(nt, (a.x + b.x) / 2, (a.y + b.y) / 2 - 10);
    c.r = TIERS[nt].r * 0.6; c.glitch = true; c.pop = T;
    a.glitch = b.glitch = true; a.mf = b.mf = c.mf = true;
    a.x += (rng() - 0.5) * 30; b.x += (rng() - 0.5) * 30;
    errCount += 7;
    burst(c.x, c.y, nt, 10);
  }
  function updateBug(dt) {
    if (!BUG) return;
    if (bugPhase === 0 && T >= BUG_T) {
      bugPhase = 1; errLines = 1; glitchUntil = T + 0.25; shake = 14;
      // everything becomes glitchy
      for (const b of bodies) if (rng() < 0.7) b.glitch = true;
      errCount = 1;
    }
    if (bugPhase >= 1) {
      errCount += dt * 38;
      for (const b of bodies) if (b.glitch && !b.noWalls && rng() < dt * 3) b.angle += (rng() - 0.5) * 0.8;
    }
    if (bugPhase === 1 && T >= BUG_T + 1.25) {
      bugPhase = 2; errLines = 2;
      // launch the biggest cat to the sky
      let big = null;
      for (const b of bodies) if (!big || b.tier > big.tier) big = b;
      if (big) {
        big.noWalls = true; big.noCollide = true; big.scared = true; big.glitch = false;
        big.spin = 9;
        rocket = big;
      }
      shake = 34; glitchUntil = T + 0.3; flash = 0.6;
      burst(big ? big.x : W / 2, big ? big.y : 1400, 6, 40);
    }
    if (rocket && !rocket.dead) {
      // constant climb (ignores gravity) so it visibly shoots up through the HUD
      rocket.px = rocket.x - 0.45; rocket.py = rocket.y + 4.6;
      if (rocket.y < -600) rocket.dead = true;
    }
    if (bugPhase === 2 && T >= BUG_T + 2.1) {
      bugPhase = 3; errLines = 3;
      // a cat phases through the right wall
      let pick = null;
      for (const b of bodies) if (!b.noWalls && b.x > W / 2 && b.y > JT + 200 && (!pick || b.tier > pick.tier)) pick = b;
      if (pick) { pick.noWalls = true; pick.noCollide = true; pick.scared = true; pick.spin = 1.2; ghostWall = pick; }
      glitchUntil = T + 0.2; shake = 16;
    }
    if (bugPhase === 3 && T >= BUG_T + 3.1) {
      bugPhase = 4; errLines = 4;
      // a freshly dropped cat falls straight through the floor
      fallThrough = true;
      glitchUntil = T + 0.15;
    }
    if (ghostWall && !ghostWall.dead) { ghostWall.px = ghostWall.x - 0.8; ghostWall.py = ghostWall.y + 0.45; }
    bodies = bodies.filter((b) => !(b.y > H + 400 || b.y < -700 || b.x > W + 400));
  }
  let rocket = null, ghostWall = null, fallThrough = false;

  // ---------- dropper / AI ----------
  const ai = { state: 'cool', t: 0.45 / SPEED, from: W / 2, to: W / 2, at: 0, dur: 0.4 };
  function landing(x, r) {
    let y = JB - r, hit = null;
    for (const b of bodies) {
      if (b.dead || b.noWalls) continue;
      const dx = Math.abs(b.x - x), rr = r + b.r;
      if (dx < rr) {
        const cy = b.y - Math.sqrt(rr * rr - dx * dx);
        if (cy < y) { y = cy; hit = b; }
      }
    }
    return { y, hit };
  }
  function chooseX(tier) {
    const r = TIERS[tier].r;
    let best = null, bestS = -1e9;
    for (let x = JL + r + 2; x <= JR - r - 2; x += 8) {
      const { y, hit } = landing(x, r);
      let s;
      if (OVER) {
        s = -Math.abs(x - (W / 2 + Math.sin(T * 3) * 160)) * 0.05 + rng() * 6;
        if (hit && hit.tier === tier) s -= 40;
      } else {
        s = y * 0.02 + rng() * 5;
        if (hit && hit.tier === tier) s += 100 + tier * 6;
        else if (hit && hit.tier < tier) s -= 12 * (tier - hit.tier);
        for (const b of bodies) {
          if (b === hit || b.tier !== tier || b.noWalls) continue;
          const d = Math.hypot(b.x - x, b.y - y) - (r + b.r);
          if (d < r * 0.6) s += 55;
        }
        if (y - r < DANGER_Y + 120) s -= 300;
      }
      if (s > bestS) { bestS = s; best = x; }
    }
    return best;
  }
  function doDrop() {
    const b = makeBody(current, dropX, DY);
    b.born = T;
    b.angle = 0;
    if (BUG && fallThrough) { b.noCollide = true; b.noWalls = true; b.scared = true; }
    current = next; next = pickTier();
    currentReadyT = T + 0.28 / Math.max(SPEED, 0.5);
  }
  function updateAI(dt) {
    if (gameOver) return;
    ai.t -= dt;
    if (ai.state === 'cool') {
      if (ai.t <= 0 && T >= currentReadyT) {
        ai.state = 'aim'; ai.from = dropX; ai.to = chooseX(current); ai.at = 0;
        ai.dur = clamp(Math.abs(ai.to - ai.from) / 1400, 0.18, 0.45) / SPEED;
        if (OVER) ai.dur *= 0.6;
      }
    } else if (ai.state === 'aim') {
      ai.at += dt;
      const k = clamp(ai.at / ai.dur, 0, 1);
      dropX = lerp(ai.from, ai.to, easeInOut(k));
      if (k >= 1) {
        ai.state = 'hold'; ai.t = 0.08 / SPEED;
      }
    } else if (ai.state === 'hold') {
      if (ai.t <= 0) {
        doDrop(); ai.state = 'cool';
        ai.t = (OVER ? 0.3 : 0.42) / SPEED;
      }
    }
  }

  // ---------- game over ----------
  function checkOver(dt) {
    if (gameOver || BUG || (AUTO && !OVER)) return;
    let danger = false;
    for (const b of bodies) {
      if (b.noWalls) continue;
      const still = Math.abs(b.y - b.py) < 1.5;
      if (T - b.born > 0.9 && still && b.y - b.r < DANGER_Y) { b.dangerT += dt; danger = true; if (b.dangerT > (OVER ? 0.5 : 1.0)) { gameOver = true; overT = T; } }
      else b.dangerT = 0;
    }
  }

  // ---------- main step ----------
  function tick(dt) {
    for (let i = 0; i < SUB; i++) stepPhysics(dt / SUB);
    if (AUTO && T >= 0) updateAI(dt);
    updateBug(dt);
    checkOver(dt);
    updateFx(dt);
    T += dt;
  }

  // ---------- rendering ----------
  function drawJarBack(g) {
    // shadow under jar
    g.fillStyle = 'rgba(120,70,150,0.16)';
    ell(g, W / 2, JB + 34, 470, 26); g.fill();
    // glass interior
    const ig = g.createLinearGradient(0, JT, 0, JB);
    ig.addColorStop(0, 'rgba(255,255,255,0.18)'); ig.addColorStop(1, 'rgba(255,255,255,0.5)');
    g.beginPath();
    g.moveTo(JL, JT - 10); g.lineTo(JL, JB - CR); g.arcTo(JL, JB, JL + CR, JB, CR); g.lineTo(JR - CR, JB); g.arcTo(JR, JB, JR, JB - CR, CR); g.lineTo(JR, JT - 10); g.closePath();
    g.fillStyle = ig; g.fill();
    // cushion at bottom
    g.save(); g.clip();
    const cg = g.createLinearGradient(0, JB - 80, 0, JB);
    cg.addColorStop(0, 'rgba(255,190,220,0)'); cg.addColorStop(1, 'rgba(255,170,210,0.45)');
    g.fillStyle = cg; g.fillRect(JL, JB - 80, JR - JL, 80);
    g.restore();
    // danger line
    const anyDanger = bodies.some((b) => b.dangerT > 0);
    const blink = anyDanger ? 0.45 + 0.45 * Math.abs(Math.sin(T * 10)) : 0.35;
    g.save();
    g.setLineDash([22, 16]); g.lineWidth = 6; g.lineCap = 'round';
    g.strokeStyle = `rgba(255,90,130,${blink})`;
    g.beginPath(); g.moveTo(JL + 16, DANGER_Y); g.lineTo(JR - 16, DANGER_Y); g.stroke();
    g.restore();
  }
  function jarPath(g, inset) {
    const l = JL - inset, r = JR + inset, b = JB + inset, c = CR + inset;
    g.beginPath();
    g.moveTo(l, JT - 18); g.lineTo(l, b - c); g.arcTo(l, b, l + c, b, c); g.lineTo(r - c, b); g.arcTo(r, b, r, b - c, c); g.lineTo(r, JT - 18);
  }
  function drawJarFront(g) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    jarPath(g, 13); g.strokeStyle = 'rgba(150,110,200,0.45)'; g.lineWidth = 34; g.stroke();
    jarPath(g, 13); g.strokeStyle = '#FFFFFF'; g.lineWidth = 22; g.stroke();
    jarPath(g, 13); g.strokeStyle = 'rgba(255,200,230,0.9)'; g.lineWidth = 6; g.stroke();
    // rim knobs
    for (const x of [JL - 13, JR + 13]) {
      g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(x, JT - 20, 22, 0, 7); g.fill();
      g.strokeStyle = 'rgba(150,110,200,0.45)'; g.lineWidth = 6; g.stroke();
      g.fillStyle = 'rgba(255,170,210,0.9)'; g.beginPath(); g.arc(x, JT - 20, 9, 0, 7); g.fill();
    }
    // glass highlights
    g.fillStyle = 'rgba(255,255,255,0.35)';
    rrect(g, JL + 18, JT + 60, 14, 520, 7); g.fill();
    rrect(g, JL + 18, JT + 600, 14, 60, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.22)';
    rrect(g, JR - 34, JT + 120, 10, 300, 5); g.fill();
  }

  function expressionOf(b) {
    if (b.scared) return 'scared';
    if (BUG && bugPhase >= 1 && b.glitch) return 'dizzy';
    if (T < b.happyUntil) return 'happy';
    if (b.dangerT > 0.2) return 'sad';
    return 'normal';
  }
  function drawBody(g, b) {
    let s = 1;
    const k = T - b.pop;
    if (k >= 0 && k < 0.7) s = 1 + 0.2 * Math.exp(-k * 7) * Math.sin(k * 26);
    let x = b.x, y = b.y;
    if (BUG && b.glitch && bugPhase >= 1) { x += (rfx() - 0.5) * 6; y += (rfx() - 0.5) * 6; }
    drawCat(g, b.tier, x, y, b.r * s, b.angle, { t: T, seed: b.id, expr: expressionOf(b) });
  }

  function drawDropper(g) {
    if (gameOver) return;
    const ready = T >= currentReadyT;
    const tier = current;
    const r = TIERS[tier].r;
    const x = clamp(dropX, JL + r, JR - r);
    // guide line
    const { y: ly } = landing(x, r);
    g.save();
    g.setLineDash([4, 18]); g.lineCap = 'round'; g.lineWidth = 7;
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.beginPath(); g.moveTo(x, DY + r + 16); g.lineTo(x, Math.max(DY + r + 20, ly)); g.stroke();
    g.restore();
    if (!ready) {
      const k = clamp(1 - (currentReadyT - T) / 0.28, 0, 1);
      if (k <= 0) return;
      drawCat(g, tier, x, DY, r * easeOutBack(k), 0, { t: T, seed: 3 });
      return;
    }
    const sway = Math.sin(T * 3) * 0.06;
    drawCat(g, tier, x, DY + Math.sin(T * 4) * 3, r, sway, { t: T, seed: 3 });
  }

  function drawParticles(g) {
    for (const r of rings) {
      const k = (T - r.t0) / r.dur;
      g.strokeStyle = r.color; g.globalAlpha = (1 - k) * 0.9; g.lineWidth = 14 * (1 - k) + 2;
      g.beginPath(); g.arc(r.x, r.y, lerp(r.r0, r.r1, easeOutCubic(k)), 0, 7); g.stroke();
      g.globalAlpha = 1;
    }
    for (const p of parts) {
      const k = p.life / p.max;
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
      g.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      const sz = p.size * (k < 0.15 ? k / 0.15 : 1);
      g.fillStyle = p.color;
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3;
      if (p.type === 'heart') { heartPath(g, 0, -sz * 0.4, sz); g.fill(); }
      else if (p.type === 'star') { starPath(g, 0, 0, sz * 0.6, sz * 0.26); g.fill(); g.stroke(); }
      else { g.beginPath(); g.arc(0, 0, sz * 0.28, 0, 7); g.fill(); }
      g.restore();
    }
  }
  function outlinedText(g, text, x, y, size, fill, stroke, sw, weight = 900) {
    g.font = `${weight} ${size}px Nunito`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.strokeStyle = stroke; g.lineWidth = sw; g.strokeText(text, x, y);
    g.fillStyle = fill; g.fillText(text, x, y);
  }
  function drawFloats(g) {
    for (const f of floats) {
      const k = (T - f.t0) / f.dur;
      const y = f.y - easeOutCubic(k) * 130;
      const sc = k < 0.15 ? easeOutBack(k / 0.15) : 1;
      g.save(); g.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      g.translate(f.x, y); g.scale(sc, sc);
      outlinedText(g, f.text, 0, 0, f.size, f.tier >= 5 ? '#FFE14D' : '#FFFFFF', TIERS[f.tier].dark, 16);
      g.restore();
    }
  }

  function drawHUD(g) {
    // title
    g.save();
    g.font = '900 118px Nunito';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if ('letterSpacing' in g) g.letterSpacing = '4px';
    const ty = 118;
    g.lineJoin = 'round';
    g.fillStyle = 'rgba(190,80,150,0.35)'; g.fillText('МУРМЕРЖ', W / 2, ty + 10);
    g.strokeStyle = '#8E3B9E'; g.lineWidth = 26; g.strokeText('МУРМЕРЖ', W / 2, ty);
    g.strokeStyle = '#FFFFFF'; g.lineWidth = 14; g.strokeText('МУРМЕРЖ', W / 2, ty);
    const tg = g.createLinearGradient(0, ty - 50, 0, ty + 50);
    tg.addColorStop(0, '#FFB347'); tg.addColorStop(0.5, '#FF7A7A'); tg.addColorStop(1, '#FF4FA3');
    g.fillStyle = tg; g.fillText('МУРМЕРЖ', W / 2, ty);
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.restore();
    // little cats beside title
    drawCat(g, 1, 110, 128, 40, -0.25, { t: T, seed: 11, noTail: true });
    drawCat(g, 0, 970, 128, 38, 0.25, { t: T, seed: 5, noTail: true, expr: 'happy' });

    // score pill
    const py = 214, ph = 96;
    g.save();
    g.shadowColor = 'rgba(140,60,150,0.22)'; g.shadowBlur = 18; g.shadowOffsetY = 6;
    g.fillStyle = 'rgba(255,255,255,0.92)';
    rrect(g, 44, py, 440, ph, 48); g.fill();
    rrect(g, 514, py, 522, ph, 48); g.fill();
    g.restore();
    g.lineWidth = 5; g.strokeStyle = '#FFC4DE';
    rrect(g, 44, py, 440, ph, 48); g.stroke();
    rrect(g, 514, py, 522, ph, 48); g.stroke();
    // score icon (paw in a circle)
    g.fillStyle = '#FF7FB0'; g.beginPath(); g.arc(98, py + ph / 2, 32, 0, 7); g.fill();
    g.fillStyle = '#FFFFFF';
    ell(g, 98, py + ph / 2 + 7, 11, 9); g.fill();
    for (const [dx, dy] of [[-12, -6], [-4, -13], [4, -13], [12, -6]]) { ell(g, 98 + dx, py + ph / 2 + dy, 4.5, 5.5); g.fill(); }
    const bugged = BUG && bugPhase >= 1;
    const sText = bugged ? 'NaN' : String(Math.round(shownScore));
    g.save();
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.font = '800 50px Nunito'; g.fillStyle = '#9A6BB5';
    g.fillText('Счёт:', 146, py + ph / 2 + 2);
    const lw = g.measureText('Счёт: ').width;
    const sb = 1 + scoreBump * 0.25;
    g.translate(146 + lw, py + ph / 2 + 2); g.scale(sb, sb);
    g.font = '900 60px Nunito'; g.fillStyle = bugged ? '#E0203A' : '#7A2F95';
    if (bugged) g.font = '900 60px "DejaVu Sans Mono", monospace';
    g.fillText(sText, 0, 0);
    g.restore();
    // next preview
    g.save();
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.font = '800 48px Nunito'; g.fillStyle = '#9A6BB5';
    g.fillText('Следующий:', 552, py + ph / 2 + 2);
    g.restore();
    g.fillStyle = '#FFE6F1'; g.beginPath(); g.arc(968, py + ph / 2, 42, 0, 7); g.fill();
    if (bugged) {
      g.save(); g.font = '700 26px "DejaVu Sans Mono", monospace'; g.fillStyle = '#E0203A'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('undef', 968, py + ph / 2 - 12); g.fillText('ined', 968, py + ph / 2 + 16); g.restore();
    } else {
      drawCat(g, next, 968, py + ph / 2 + 6, 30, 0, { t: T, seed: 9, noTail: true });
    }

    // evolution strip at bottom
    const sy = 1852;
    g.save();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    rrect(g, 40, sy - 52, W - 80, 104, 52); g.fill();
    g.restore();
    for (let i = 0; i < 10; i++) {
      const x = 96 + i * 98;
      const reached = i <= maxTier;
      drawCat(g, i, x, sy + 8, 30, 0, { t: 0, seed: i, noTail: true, silhouette: !reached });
      if (i < 9) { g.fillStyle = 'rgba(160,110,200,0.45)'; g.beginPath(); g.moveTo(x + 42, sy + 2); g.lineTo(x + 52, sy + 8); g.lineTo(x + 42, sy + 14); g.fill(); }
    }

    // combo text
    if (comboText && T - comboText.t0 < 1.1) {
      const k = (T - comboText.t0) / 1.1;
      const sc = k < 0.18 ? easeOutBack(k / 0.18) * 1.1 : 1.1 - (k - 0.18) * 0.1;
      g.save();
      g.globalAlpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      g.translate(W / 2, 400); g.scale(sc, sc); g.rotate(-0.06);
      outlinedText(g, `Комбо ×${comboText.n}!`, 0, 0, 104, '#FFE14D', '#E2407E', 22);
      g.restore();
    }
  }

  function drawOverPanel(g) {
    const k = clamp((T - overT - 0.35) / 0.45, 0, 1);
    if (k <= 0) return;
    g.fillStyle = `rgba(70,30,90,${0.5 * k})`; g.fillRect(0, 0, W, H);
    const sc = easeOutBack(k);
    g.save();
    g.translate(W / 2, 980); g.scale(sc, sc);
    const pw = 820, ph = 900;
    g.save(); g.shadowColor = 'rgba(80,20,90,0.4)'; g.shadowBlur = 50; g.shadowOffsetY = 20;
    g.fillStyle = '#FFFFFF'; rrect(g, -pw / 2, -ph / 2, pw, ph, 64); g.fill(); g.restore();
    g.lineWidth = 12; g.strokeStyle = '#FFC4DE'; rrect(g, -pw / 2, -ph / 2, pw, ph, 64); g.stroke();
    // header ribbon
    const hg = g.createLinearGradient(0, -ph / 2 - 40, 0, -ph / 2 + 80);
    hg.addColorStop(0, '#FF8FB8'); hg.addColorStop(1, '#FF4F8B');
    g.fillStyle = hg; rrect(g, -350, -ph / 2 - 44, 700, 124, 62); g.fill();
    outlinedText(g, 'Игра окончена', 0, -ph / 2 + 18, 82, '#FFFFFF', '#C2285F', 12);
    drawCat(g, 1, 0, -150, 118, 0, { t: T, seed: 2, expr: 'sad' });
    g.font = '800 50px Nunito'; g.fillStyle = '#9A6BB5'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('Твой счёт', 0, 40);
    outlinedText(g, String(score), 0, 128, 120, '#7A2F95', '#F3E3FF', 10);
    // button
    const pulse = 1 + 0.035 * Math.sin((T - overT) * 6);
    g.save(); g.translate(0, 300); g.scale(pulse, pulse);
    g.fillStyle = '#2E9F46'; rrect(g, -260, -58, 520, 128, 64); g.fill();
    const bgd = g.createLinearGradient(0, -64, 0, 60);
    bgd.addColorStop(0, '#8BEA7E'); bgd.addColorStop(1, '#3CC45A');
    g.fillStyle = bgd; rrect(g, -260, -68, 520, 124, 62); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)'; rrect(g, -220, -58, 440, 30, 15); g.fill();
    outlinedText(g, 'Ещё раз', 0, -4, 70, '#FFFFFF', '#23873A', 12);
    g.restore();
    g.restore();
  }

  function drawBugOverlay(g) {
    if (!BUG || bugPhase < 1) return;
    const lines = [
      ['#FF6B6B', '✖ Uncaught TypeError: Cannot read'],
      ['#FF6B6B', '  properties of undefined (reading \'radius\')'],
      ['#E8A5A5', '    at mergeCats (game.js:214:31)'],
      ['#E8A5A5', '    at World.step (physics.js:88:9)'],
    ];
    if (errLines >= 2) lines.push(['#FF6B6B', '✖ RangeError: velocity is Infinity']);
    if (errLines >= 3) lines.push(['#FF6B6B', '✖ Warning: cat left the jar (id: 17)']);
    if (errLines >= 4) lines.push(['#FFB86B', '⚠ floor is not defined']);
    const lh = 36, pad = 18;
    const h = pad * 2 + lines.length * lh;
    const y0 = H - h - 24;
    g.save();
    g.fillStyle = 'rgba(28,6,12,0.9)'; rrect(g, 20, y0, W - 40, h, 18); g.fill();
    g.strokeStyle = '#FF4D4D'; g.lineWidth = 4; rrect(g, 20, y0, W - 40, h, 18); g.stroke();
    g.fillStyle = 'rgba(255,60,60,0.12)'; g.fillRect(24, y0 + 4, W - 48, lh + pad - 6);
    g.font = '700 29px "DejaVu Sans Mono", monospace';
    g.textAlign = 'left'; g.textBaseline = 'middle';
    lines.forEach(([c, s], i) => { g.fillStyle = c; g.fillText(s, 44, y0 + pad + lh * i + lh / 2); });
    // repeat counter badge
    const n = Math.floor(errCount);
    const bt = String(n);
    g.font = '900 34px Nunito';
    const bw = g.measureText(bt).width + 40;
    g.fillStyle = '#FF3B3B'; rrect(g, W - 40 - bw - 10, y0 - 26, bw, 52, 26); g.fill();
    g.fillStyle = '#FFFFFF'; g.textAlign = 'center'; g.fillText(bt, W - 40 - bw / 2 - 10, y0 + 1);
    g.restore();
  }

  function glitchPost(g) {
    if (T > glitchUntil) return;
    for (let i = 0; i < 9; i++) {
      const y = Math.floor(rfx() * H), h = 20 + Math.floor(rfx() * 90), dx = Math.floor((rfx() - 0.5) * 90);
      g.drawImage(canvas, 0, y, W, h, dx, y, W, h);
      if (rfx() < 0.5) { g.fillStyle = rfx() < 0.5 ? 'rgba(255,0,90,0.18)' : 'rgba(0,220,255,0.18)'; g.fillRect(0, y, W, h); }
    }
  }

  function render() {
    const g = ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(bg, 0, 0);
    const sx = (rfx() - 0.5) * 2 * shake, sy = (rfx() - 0.5) * 2 * shake;
    // world
    g.save();
    g.translate(sx, sy);
    if (ZOOM > 1) { g.translate(W / 2, H / 2); g.scale(cam.z, cam.z); g.translate(-cam.x, -cam.y); }
    drawJarBack(g);
    if (ZOOM <= 1) drawDropper(g);
    const late = [];
    for (const b of bodies) { if (b.noWalls) late.push(b); else drawBody(g, b); }
    for (const gh of ghosts) {
      const k = (T - gh.t0) / 0.1;
      drawCat(g, gh.tier, lerp(gh.x, gh.tx, k), lerp(gh.y, gh.ty, k), gh.r * (1 - 0.35 * k), gh.ang, { t: T, alpha: 1 - k, expr: 'happy' });
    }
    drawJarFront(g);
    // cats outside the jar walls should appear in front of the glass
    for (const b of late) if (b !== rocket) drawBody(g, b);
    drawParticles(g);
    drawFloats(g);
    g.restore();
    // HUD
    g.save(); g.translate(sx * 0.4, sy * 0.4); drawHUD(g); g.restore();
    // the launched cat flies across the HUD
    if (rocket && !rocket.dead) {
      g.save(); g.translate(sx, sy);
      if (ZOOM > 1) { g.translate(W / 2, H / 2); g.scale(cam.z, cam.z); g.translate(-cam.x, -cam.y); }
      // speed lines
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 8; g.lineCap = 'round';
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(rocket.x + i * 40, rocket.y + rocket.r + 20); g.lineTo(rocket.x + i * 40, rocket.y + rocket.r + 140 + Math.abs(i) * -30); g.stroke(); }
      drawBody(g, rocket);
      g.restore();
    }
    if (flash > 0.01) { g.fillStyle = `rgba(255,255,255,${flash * 0.6})`; g.fillRect(0, 0, W, H); }
    drawBugOverlay(g);
    if (gameOver) drawOverPanel(g);
    glitchPost(g);
  }

  // ---------- boot ----------
  function init() {
    buildBackground();
    setupPreset();
    current = pickTier(); next = pickTier();
    currentReadyT = 0;
    // settle initial jar contents off-camera
    mergeEnabled = false;
    const warmSteps = Math.round(WARM / STEP);
    T = -WARM;
    for (let i = 0; i < warmSteps; i++) { for (let s = 0; s < SUB; s++) stepPhysics(DT); T += STEP; }
    T = 0;
    for (const b of bodies) { b.born = -5; b.px = b.x; b.py = b.y; b.pre = true; }
    mergeEnabled = true;
    parts = []; rings = []; floats = []; ghosts = []; events.length = 0;
    score = OVER ? 1287 : 0; shownScore = score; combo = 0;
    currentReadyT = 0;
  }

  let acc = 0;
  function advance(ms) {
    acc += ms / 1000;
    while (acc >= STEP - 1e-9) { tick(STEP); acc -= STEP; }
  }

  const fontsReady = Promise.all([
    document.fonts.load('900 60px Nunito', 'МУРМЕРЖ Счёт 0123'),
    document.fonts.load('800 60px Nunito', 'Следующий Счёт 0123'),
    document.fonts.load('700 60px Nunito', 'Ещё раз'),
  ]).catch(() => {});

  window.__ready = fontsReady.then(() => { init(); render(); return true; });
  window.__step = (ms) => { advance(ms); render(); return T; };
  window.__grab = (type = 'image/jpeg', q = 0.94) => canvas.toDataURL(type, q);
  window.__state = () => ({ t: T, score, maxTier, cats: bodies.length, gameOver, bugPhase, events: events.slice() });

  // ---------- realtime + manual play ----------
  if (!RECORD) {
    window.__ready.then(() => {
      let last = performance.now();
      const loop = (now) => {
        const dt = Math.min(100, now - last); last = now;
        advance(dt); render();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    if (!AUTO) {
      const toX = (e) => {
        const rect = canvas.getBoundingClientRect();
        const s = Math.min(rect.width / W, rect.height / H);
        const ox = rect.left + (rect.width - W * s) / 2;
        return (e.clientX - ox) / s;
      };
      canvas.addEventListener('pointermove', (e) => { const r = TIERS[current].r; dropX = clamp(toX(e), JL + r, JR - r); });
      canvas.addEventListener('pointerup', (e) => {
        if (gameOver) { location.reload(); return; }
        if (T < currentReadyT) return;
        const r = TIERS[current].r; dropX = clamp(toX(e), JL + r, JR - r); doDrop();
      });
    }
  }
})();
