/*!
 * <orb-avatar>: chibi teammate orbs with faces mapped onto a sphere.
 * Framework-free Web Component. Include this file once, then use <orb-avatar> anywhere.
 * Docs: https://github.com/sundenlast/orb · Demo: https://sundenlast.github.io/orb/
 * MIT License © 2026 Enzo Vasconcelos
 */
(() => {
'use strict';
if (typeof window === 'undefined' || !window.customElements || customElements.get('orb-avatar')) return;

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, p) => a + (b - a) * p;
const f4 = n => n.toFixed(4);
const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const backOut = x => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const RMQ = matchMedia('(prefers-reduced-motion: reduce)');
const num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };

/* ---------- flat shapes in face space: a = right, b = up, units = sphere radii ---------- */
const superE = (cx, cy, w, h, n = 2.6, N = 56) => { const p = []; for (let i = 0; i < N; i++) { const t = i / N * TAU, c = Math.cos(t), s = Math.sin(t);
  p.push([cx + w / 2 * Math.sign(c) * Math.abs(c) ** (2 / n), cy + h / 2 * Math.sign(s) * Math.abs(s) ** (2 / n)]); } return p; };
const ell = (cx, cy, rx, ry, N = 44) => superE(cx, cy, rx * 2, ry * 2, 2, N);
const qb = (a, b, c, N = 24) => { const p = []; for (let i = 0; i <= N; i++) { const t = i / N, u = 1 - t;
  p.push([u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]]); } return p; };
const polyline = (pts, N = 12) => { const p = []; for (let i = 0; i < pts.length - 1; i++) { const A = pts[i], B = pts[i + 1];
  for (let k = 0; k < N; k++) { const t = k / N; p.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]); } } p.push(pts[pts.length - 1]); return p; };
function stroke(pts, w) {           // thick, round-capped outline so line weight also follows the sphere
  const h = w / 2, n = pts.length, L = [], R = [];
  const tan = i => { const A = pts[Math.max(0, i - 1)], B = pts[Math.min(n - 1, i + 1)]; const dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
  for (let i = 0; i < n; i++) { const [tx, ty] = tan(i); L.push([pts[i][0] - ty * h, pts[i][1] + tx * h]); R.push([pts[i][0] + ty * h, pts[i][1] - tx * h]); }
  const out = L.slice(), tE = tan(n - 1), tS = tan(0), PE = pts[n - 1], PS = pts[0];
  for (let k = 1; k < 12; k++) { const a = Math.PI * k / 12, c = Math.cos(a), s = Math.sin(a); out.push([PE[0] + (-tE[1] * c + tE[0] * s) * h, PE[1] + (tE[0] * c + tE[1] * s) * h]); }
  for (let i = n - 1; i >= 0; i--) out.push(R[i]);
  for (let k = 1; k < 12; k++) { const a = Math.PI * k / 12, c = Math.cos(a), s = Math.sin(a); out.push([PS[0] + (tS[1] * c - tS[0] * s) * h, PS[1] + (-tS[0] * c - tS[1] * s) * h]); }
  return out;
}
function densify(P, m = .012) { const o = []; for (let i = 0; i < P.length; i++) { const A = P[i], B = P[(i + 1) % P.length]; o.push(A);
  const k = Math.floor(Math.hypot(B[0] - A[0], B[1] - A[1]) / m); for (let j = 1; j < k; j++) o.push([A[0] + (B[0] - A[0]) * j / k, A[1] + (B[1] - A[1]) * j / k]); } return o; }
function clipBelow(P, p, q) {       // keep the part of a shape under the line p→q (eyelid cuts)
  const dx = q[0] - p[0], dy = q[1] - p[1], f = v => dx * (v[1] - p[1]) - dy * (v[0] - p[0]), o = [];
  for (let i = 0; i < P.length; i++) { const A = P[i], B = P[(i + 1) % P.length], fa = f(A), fb = f(B);
    if (fa <= 0) o.push(A);
    if ((fa <= 0) !== (fb <= 0)) { const t = fa / (fa - fb); o.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]); } }
  return densify(o);
}
const heart = (cx, cy, s, N = 72) => { const p = []; for (let i = 0; i < N; i++) { const t = i / N * TAU, x = 16 * Math.sin(t) ** 3,
  y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); p.push([cx + x * s / 32, cy + (y + 2.5) * s / 32]); } return p; };
const drop = (cx, cy, r, N = 40) => { const p = []; for (let i = 0; i < N; i++) { const t = i / N * TAU; p.push([cx + r * Math.sin(t) * Math.abs(Math.sin(t / 2)), cy + r * Math.cos(t)]); } return p; };

/* ---------- reactions ----------
   Every feature sits in a named slot (L/R eyes, hL/hR + h2L/h2R highlights, bL/bR blush, tear),
   so one reaction can morph into another slot by slot. Fills name palette entries. */
const X = .125, Y = .15;
const F = (key, pts, c, fill = 'eye', o = {}) => ({ key, pts, c, fill, ...o });
const side = s => s < 0 ? 'L' : 'R';
const capEye = (s, h = .25, w = .125, y = Y) => F(side(s), superE(s * X, y, w, h, 2.4), [s * X, y]);
const lidEye = (s, h, y, p, q) => F(side(s), clipBelow(superE(s * X, y, .125, h, 2.4), p, q), [s * X, y]);
const arcEye = s => { const cx = s * X; return F(side(s), stroke(qb([cx - .08, Y - .035], [cx, Y + .09], [cx + .08, Y - .035]), .06), [cx, Y]); };
const blush = () => [-1, 1].map(s => F('b' + side(s), ell(s * .3, -.03, .075, .038), [s * .3, -.03], 'blush', { op: .55, fixed: true }));
const hop = (t, period, dur, amp) => { const p = (t % period) / dur; return p > 1 ? {} : { dy: -amp * Math.sin(p * Math.PI) }; };

const EX = {
  idle: { label: 'Idle', blink: true,
    feats: () => [capEye(-1), capEye(1)],
    motion: null },
  happy: { label: 'Happy',
    feats: () => [arcEye(-1), arcEye(1), ...blush()],
    motion: t => ({ dy: -.13 * Math.abs(Math.sin(t * 1.7 * Math.PI)) }) },
  thinking: { label: 'Thinking', blink: true, extra: 'dots',
    feats: () => [capEye(-1, .23, .125, Y + .02), lidEye(1, .23, Y + .02, [X - .1, Y + .035], [X + .1, Y + .05])],
    motion: t => ({ yaw: -.5, pitch: .55, w: .8, roll: -.12 + .03 * Math.sin(t * 1.3) }) },
  working: { label: 'Working', blink: true,
    feats: () => [lidEye(-1, .25, Y, [-X - .09, Y + .13], [-X + .09, Y + .035]), lidEye(1, .25, Y, [X - .09, Y + .035], [X + .09, Y + .13])],
    motion: t => ({ yaw: .4 * Math.sin(t * 1.25), pitch: -.22, w: .85 }) },
  done: { label: 'Done', extra: 'sparkle',
    feats: () => [arcEye(-1), arcEye(1), ...blush()],
    motion: t => ({ ...hop(t, 2.2, .45, .14), pitch: .42, w: .4 }) },
  needs: { label: 'Needs you', blink: true, extra: 'ring',
    feats: () => [-1, 1].flatMap(s => { const cx = s * X, k = side(s); return [F(k, ell(cx, Y, .08, .115), [cx, Y]),
      F('h' + k, ell(cx + .03, Y + .045, .03, .03), [cx + .03, Y + .045], 'hi', { bc: Y }),
      F('h2' + k, ell(cx - .028, Y - .042, .014, .014), [cx - .028, Y - .042], 'hi', { bc: Y })]; }),
    motion: t => ({ ...hop(t, 1.8, .4, .08), yaw: 0, pitch: .08, w: .55 }) },
  sleeping: { label: 'Sleeping', extra: 'zzz',
    feats: () => [-1, 1].map(s => { const cx = s * X, y = .09; return F(side(s), stroke(qb([cx - .08, y + .015], [cx, y - .08], [cx + .08, y + .015]), .05), [cx, y]); }),
    motion: t => ({ pitch: -.42, roll: .2, yaw: .1, w: .92, dy: -.015 * (1 + Math.sin(t * 1.4)) }) },
  error: { label: 'Error', extra: 'sweat',
    feats: () => [-1, 1].map(s => { const cx = s * X, k = -s;
      return F(side(s), stroke(polyline([[cx - k * .06, Y + .075], [cx + k * .055, Y], [cx - k * .06, Y - .075]], 10), .056), [cx, Y]); }),
    motion: t => { const b = Math.max(0, Math.sin(t * 2.4)) ** 8; return { pitch: .05, w: .5, rollAdd: .1 * Math.sin(t * 46) * b, yawAdd: .1 * Math.sin(t * 46) * b }; } },
  love: { label: 'Love', extra: 'heart',
    feats: () => [...[-1, 1].flatMap(s => { const cx = s * X, k = side(s); return [F(k, heart(cx, Y, .17), [cx, Y]), F('h' + k, ell(cx + .035, Y + .04, .02, .02), [cx + .035, Y + .04], 'hi', { bc: Y })]; }), ...blush()],
    motion: t => ({ pitch: .3, w: .35, rollAdd: .12 * Math.sin(t * 2.4), s: 1 + .025 * Math.sin(t * 6) }) },
  sad: { label: 'Sad', blink: true,
    feats: t => { const o = [lidEye(-1, .22, Y - .01, [-X - .09, Y + .02], [-X + .09, Y + .11]), lidEye(1, .22, Y - .01, [X - .09, Y + .11], [X + .09, Y + .02])];
      const p = (t * .45) % 1, ty = Y - .15 - p * .32; o.push(F('tear', drop(-X - .02, ty, .034), [-X - .02, ty], 'tear', { op: Math.min(1, (1 - p) * 2.2), fixed: true })); return o; },
    motion: t => ({ pitch: -.32, yaw: -.12, w: .7 }) },
  surprised: { label: 'Surprised', hidden: true,
    feats: () => [-1, 1].flatMap(s => { const cx = s * X, k = side(s); return [F(k, ell(cx, Y + .01, .085, .11), [cx, Y + .01]),
      F('h' + k, ell(cx + .032, Y + .05, .03, .03), [cx + .032, Y + .05], 'hi', { bc: Y }),
      F('h2' + k, ell(cx - .03, Y - .04, .014, .014), [cx - .03, Y - .04], 'hi', { bc: Y })]; }),
    motion: (t, since) => ({ dy: since < .36 ? -.12 * Math.sin(since / .36 * Math.PI) : 0, yaw: 0, pitch: .14, w: .7 }) },
  giggle: { label: 'Giggle', hidden: true,
    feats: () => [arcEye(-1), arcEye(1), ...blush()],
    motion: (t, since) => ({ dy: -.05 * Math.abs(Math.sin(since * 11)) * Math.exp(-since * 2.2), rollAdd: .13 * Math.sin(since * 16) * Math.exp(-since * 2.5), yaw: 0, pitch: .2, w: .5 }) },
  dizzy: { label: 'Dizzy', extra: 'stars',
    feats: t => { const spin = -t * 5;          // each spiral turns around its own center
      return [-1, 1].map(s => { const cx = s * X, pts = [];
        for (let i = 0; i <= 90; i++) { const u = i / 90, a = spin + u * TAU * 2.25, r = .008 + .095 * u; pts.push([cx + Math.cos(a) * r, Y + Math.sin(a) * r]); }
        return F(side(s), stroke(pts, .022), [cx, Y]); }); },
    motion: t => ({ rollAdd: .14 * Math.sin(t * 2.6), yawAdd: .1 * Math.sin(t * 2.1 + 1), yaw: 0, pitch: .05, w: .6 }) },
  wink: { label: 'Wink',
    feats: () => [capEye(-1), arcEye(1), ...blush()],
    motion: t => ({ roll: .14, yaw: .25, pitch: .22, w: .45 }) },
};

/* ---------- floating extras (screen space, y down, unit ball at origin) ---------- */
const star = (x, y, r, fill) => { let d = ''; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 - Math.PI / 2, rr = k % 2 ? r * .3 : r;
  d += (k ? 'L' : 'M') + (x + Math.cos(a) * rr).toFixed(3) + ' ' + (y + Math.sin(a) * rr).toFixed(3); } return `<path d="${d}Z" style="fill:${fill}"/>`; };
const pathOf = pts => 'M' + pts.map(p => p[0].toFixed(3) + ' ' + p[1].toFixed(3)).join('L') + 'Z';
const EXTRA = {
  dots: t => [0, 1, 2].map(i => `<circle cx="${.62 + i * .24}" cy="${-1 - i * .1}" r="${.055 + i * .02}" fill="currentColor" opacity="${(.2 + .8 * Math.max(0, Math.sin(t * 3 - i * .8))).toFixed(2)}"/>`).join(''),
  zzz: t => [0, 1, 2].map(i => { const p = (t * .35 + i / 3) % 1; return `<text x="${(.68 + p * .4).toFixed(3)}" y="${(-.68 - p * .55).toFixed(3)}" font-size="${(.22 + p * .16).toFixed(3)}" fill="currentColor" opacity="${Math.sin(p * Math.PI).toFixed(2)}" font-family="system-ui, sans-serif" font-weight="700">z</text>`; }).join(''),
  sparkle: (t, pal) => [[.95, -.85, .17, 0], [-.98, -.55, .11, 1.7], [.7, -1.18, .08, 3.1]].map(([x, y, r, ph]) => star(x, y, r * (.35 + .65 * Math.abs(Math.sin(t * 2.2 + ph))), pal.spark)).join(''),
  heart: (t, pal) => { const p = (t * .5) % 1; const pts = heart(0, 0, .28).map(([a, b]) => [.85 + .06 * Math.sin(t * 3) + a, -.62 - p * .6 - b]);
    return `<path d="${pathOf(pts)}" style="fill:${pal.blush}" opacity="${Math.sin(p * Math.PI).toFixed(2)}"/>`; },
  stars: (t, pal) => [0, 1, 2].map(i => { const a = t * 2.4 + i * TAU / 3, x = Math.cos(a) * .62, y = -1.02 + Math.sin(a) * .14;
    return Math.sin(a) > -.2 ? star(x, y, .1 + .03 * Math.sin(a), pal.spark) : ''; }).join(''),
  sweat: (t, pal) => { const p = (t * .6) % 1; const pts = drop(0, 0, .09).map(([a, b]) => [-.93 + a, -.6 + p * .12 - b]);
    return `<path d="${pathOf(pts)}" style="fill:${pal.tear}" opacity="${(1 - p * .6).toFixed(2)}"/>`; },
};
const BACK = { ring: (t, pal) => { const p = (t * .8) % 1; return `<circle r="${(1 + .34 * p).toFixed(3)}" fill="none" style="stroke:${pal.color}" stroke-width=".05" opacity="${((1 - p) * .7).toFixed(2)}"/>`; } };

/* ---------- morphing: resample every shape to the same point count, then blend slot by slot ---------- */
const NPTS = 96;
function resample(P) {
  let A = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; A += a[0] * b[1] - b[0] * a[1]; }
  if (A < 0) P = P.slice().reverse();
  let cx = 0, cy = 0; for (const p of P) { cx += p[0]; cy += p[1]; } cx /= P.length; cy /= P.length;
  let s = 0, best = 1e9; P.forEach((p, i) => { const a = Math.abs(Math.atan2(p[1] - cy, p[0] - cx)); if (a < best) { best = a; s = i; } });
  const Q = P.slice(s).concat(P.slice(0, s)), n = Q.length, L = [0];
  for (let i = 1; i <= n; i++) { const a = Q[i - 1], b = Q[i % n]; L.push(L[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const tot = L[n], out = []; let j = 0;
  for (let k = 0; k < NPTS; k++) { const d = tot * k / NPTS; while (j < n - 1 && L[j + 1] < d) j++;
    const a = Q[j], b = Q[(j + 1) % n], t = (d - L[j]) / ((L[j + 1] - L[j]) || 1); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  return out;
}
const prepCache = {};
function prepOf(k, t) {
  const ex = EX[k] || EX.idle, make = () => { const m = {}; for (const f of ex.feats(t)) m[f.key] = { ...f, pts: resample(f.pts) }; return m; };
  return ex.feats.length === 0 ? (prepCache[k] ||= make()) : make();
}
function mixFeats(A, B, p) {
  const out = {};
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
    const a = A[k], b = B[k];
    if (a && b) {
      out[k] = { ...b, pts: a.pts.map((q, i) => [lerp(q[0], b.pts[i][0], p), lerp(q[1], b.pts[i][1], p)]),
        c: [lerp(a.c[0], b.c[0], p), lerp(a.c[1], b.c[1], p)], op: lerp(a.op ?? 1, b.op ?? 1, p) };
    } else {
      const f = a || b, s = a ? Math.max(0, 1 - p * 1.4) : backOut(Math.min(1, p * 1.1)), o = (f.op ?? 1) * (a ? Math.max(0, 1 - p * 1.6) : Math.min(1, p * 1.8));
      out[k] = { ...f, pts: f.pts.map(q => [f.c[0] + (q[0] - f.c[0]) * s, f.c[1] + (q[1] - f.c[1]) * s]), op: o };
    }
  }
  return out;
}
const MKEYS = { dy: 0, sx: 1, sy: 1, s: 1, roll: 0, rollAdd: 0, yawAdd: 0, w: 0 };
function mixMotion(a, b, p) {
  const o = {}; for (const [k, d] of Object.entries(MKEYS)) o[k] = lerp(a[k] ?? d, b[k] ?? d, p);
  for (const k of ['yaw', 'pitch']) if (a[k] != null || b[k] != null) o[k] = lerp(a[k] ?? b[k], b[k] ?? a[k], p);
  return o;
}

/* ---------- sphere math ---------- */
function frame(yaw, pitch, roll) {
  const cp = Math.cos(pitch), f = [Math.sin(yaw) * cp, -Math.sin(pitch), Math.cos(yaw) * cp];
  const rl = Math.hypot(f[2], f[0]) || 1, r = [f[2] / rl, 0, -f[0] / rl];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const c = Math.cos(roll), s = Math.sin(roll);
  return { f, r: [r[0] * c + u[0] * s, r[1] * c + u[1] * s, r[2] * c + u[2] * s], u: [u[0] * c - r[0] * s, u[1] * c - r[1] * s, u[2] * c - r[2] * s] };
}
function proj(a, b, Fr) {
  const rho = Math.hypot(a, b); let x, y, z;
  if (rho < 1e-6) { [x, y, z] = Fr.f; }
  else { const s = Math.sin(rho) / rho, c = Math.cos(rho);
    x = Fr.f[0] * c + (a * Fr.r[0] + b * Fr.u[0]) * s; y = Fr.f[1] * c + (a * Fr.r[1] + b * Fr.u[1]) * s; z = Fr.f[2] * c + (a * Fr.r[2] + b * Fr.u[2]) * s; }
  if (z < 0) { const k = Math.hypot(x, y) || 1; x /= k; y /= k; }
  return [x, y, z];
}
function faceSVG(Fr, feats, sq, pal, face, warp) {
  let out = '';
  for (const ft of Object.values(feats)) {
    if ((ft.op ?? 1) <= .01) continue;
    const c = proj(ft.c[0] * face, ft.c[1] * face, Fr);
    const vis = clamp((c[2] + .12) / .22, 0, 1); if (vis <= 0) continue;
    const k = ft.fixed ? 1 : sq, cy = ft.bc ?? ft.c[1]; let d = '';
    for (let i = 0; i < ft.pts.length; i++) {
      const [a, b] = ft.pts[i], p = proj(a * face, (cy + (b - cy) * k) * face, Fr), w = warp ? warp(p[0], p[1]) : p;
      d += (i ? 'L' : 'M') + f4(w[0]) + ' ' + f4(w[1]);
    }
    const op = (ft.op ?? 1) * vis;
    out += `<path d="${d}Z" style="fill:${pal[ft.fill] || ft.fill}"${op < .999 ? ` opacity="${op.toFixed(2)}"` : ''}/>`;
  }
  return out;
}

/* ---------- soft body: radius = 1 + sum of wobble modes (k = 2, 3, 4), each on its own spring ---------- */
const BODY_N = 72, BANG = Array.from({ length: BODY_N }, (_, i) => i / BODY_N * TAU);
const radius = (x, th) => 1 + x[0] * Math.cos(2 * th) + x[1] * Math.sin(2 * th) + x[2] * Math.cos(3 * th) + x[3] * Math.sin(3 * th) + x[4] * Math.cos(4 * th) + x[5] * Math.sin(4 * th);

/* ---------- shared pointer + animation loop ---------- */
const pointer = { x: 0, y: 0, active: false, t: 0 };
let listening = false;
function listen() {
  if (listening) return; listening = true;
  addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; pointer.t = performance.now(); }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { pointer.active = false; });
  addEventListener('blur', () => { pointer.active = false; });
}
const live = new Set(); let raf = 0, last = 0;
function loop(ms) {
  const dt = Math.min(1 / 30, Math.max(0, (ms - last) / 1000)); last = ms; const t = ms / 1000;
  if (pointer.active && ms - pointer.t > 6000) pointer.active = false;
  const act = []; for (const o of live) if (o._visible && !o._static) act.push(o);
  for (const o of act) o._rect = (o._target || ((o._follow || o._mode === 'follow') && pointer.active)) ? o.getBoundingClientRect() : null;  // read all, then write all
  for (const o of act) o._update(dt, t);
  raf = live.size ? requestAnimationFrame(loop) : 0;
}
const wake = () => { if (!raf && live.size) { last = performance.now(); raf = requestAnimationFrame(loop); } };
const io = new IntersectionObserver(es => { for (const e of es) e.target._visible = e.isIntersecting; }, { rootMargin: '120px' });
const parseGaze = v => { if (!v) return null; const p = v.split(/[\s,]+/).map(Number); return p.length >= 2 && p.every(Number.isFinite) ? [p[0] * Math.PI / 180, p[1] * Math.PI / 180] : null; };
const on = v => v !== null && v !== 'false' && v !== 'off';

const ATTRS = ['reaction', 'mode', 'color', 'eye-color', 'size', 'follow', 'shadow', 'extras', 'face-scale', 'morph', 'jelly', 'gaze', 'static', 'label'];

class OrbAvatar extends HTMLElement {
  static get observedAttributes() { return ATTRS; }
  static get reactions() { return Object.keys(EX).filter(k => !EX[k].hidden); }
  static reactionLabel(name) { return (EX[name] || {}).label || name; }
  static defineReaction(name, def) { EX[name] = { label: name, ...def }; delete prepCache[name]; }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>:host{display:inline-block;width:64px;aspect-ratio:1;flex:none;vertical-align:middle;line-height:0;-webkit-tap-highlight-color:transparent}svg{width:100%;height:100%;display:block;overflow:visible}</style>`
      + `<svg viewBox="-1.04 -1.04 2.08 2.08" role="img" part="svg"><ellipse class="sh" cx="0" cy="1.16" rx=".62" ry=".06" display="none"/><g class="xb"></g><path class="bd" part="body"/><g class="fc"></g><g class="xf"></g></svg>`;
    const q = s => root.querySelector(s);
    this._svg = q('svg'); this._sh = q('.sh'); this._xb = q('.xb'); this._bd = q('.bd'); this._fc = q('.fc'); this._xf = q('.xf');
    this._expr = 'idle'; this._base = 'idle'; this._override = null; this._overrideUntil = 0; this._pokeAt = -9; this._pokes = []; this._mode = 'drift'; this._wTarget = null; this._wNext = 0; this._ph = Math.random() * 20;
    this._pal = { color: '#f1efe9', eye: '#141418', hi: '#ffffff', blush: '#ff6f91', tear: '#a8dcff', spark: '#ffe08a' };
    this._face = 1.6; this._morph = .42; this._jelly = .6; this._gaze = null;
    this._follow = false; this._shadow = false; this._extras = true; this._static = false; this._visible = true; this._target = null;
    this._yaw = .32; this._pitch = .26; this._roll = 0; this._vy = 0; this._vp = 0; this._vr = 0; this._init = false;
    this._tp = 1; this._fromExpr = 'idle'; this._fromSnap = null; this._fromM = {}; this._cur = null; this._m = {};
    this._jx = [0, 0, 0, 0, 0, 0]; this._jv = [0, 0, 0, 0, 0, 0];
    this._t = performance.now() / 1000; this._nextBlink = this._t + 1 + Math.random() * 3; this._blinkAt = -9; this._spinAt = -9;
  }
  connectedCallback() { listen(); live.add(this); io.observe(this); this._aria(); this._update(0, performance.now() / 1000); wake(); }
  disconnectedCallback() { live.delete(this); io.unobserve(this); }
  attributeChangedCallback(n, _, v) {
    switch (n) {
      case 'reaction': { const e = v && EX[v] && !EX[v].hidden ? v : 'idle', from = this._base; this._base = e; this._override = null; this._show(e);
        if (from !== e) this.dispatchEvent(new CustomEvent('reactionchange', { detail: { from, to: e }, bubbles: true })); break; }
      case 'mode': this._mode = ['follow', 'wander', 'fixed', 'drift'].includes(v) ? v : 'drift'; break;
      case 'color': this._pal.color = v || '#f1efe9'; break;
      case 'eye-color': this._pal.eye = v || '#141418'; break;
      case 'size': this.style.width = v == null ? '' : (/^\d+(\.\d+)?$/.test(v) ? v + 'px' : v); break;
      case 'follow': this._follow = on(v); break;   // legacy alias for mode="follow"
      case 'shadow': this._shadow = on(v); this._sh.setAttribute('display', this._shadow ? 'inline' : 'none'); break;
      case 'extras': this._extras = v === null || on(v); break;
      case 'face-scale': this._face = num(v, 1.6); break;
      case 'morph': this._morph = Math.max(0, num(v, .42)); break;
      case 'jelly': this._jelly = clamp(num(v, .6), 0, 1); break;
      case 'gaze': this._gaze = parseGaze(v); break;
      case 'static': this._static = on(v); break;
    }
    this._aria();
    if (this.isConnected && (this._static || !raf)) this._update(0, performance.now() / 1000);
  }

  /* public API */
  get reaction() { return this._base; }
  get mode() { return this._mode; }
  set mode(v) { this.setAttribute('mode', v); }
  set reaction(v) { this.setAttribute('reaction', v); }
  react(name) { this.reaction = name; return this; }
  poke(force = 1, { react = true } = {}) {
    const j = this._jelly * force, now = performance.now() / 1000;
    this._jv[0] += 3.4 * j; this._jv[2] += (Math.random() - .5) * 2.4 * j; this._jv[3] += (Math.random() - .5) * 2.4 * j;
    if (react && !this._static) {          // escalate with rapid pokes: surprised, giggle, then dizzy
      this._pokes = this._pokes.filter(p => now - p < 1.3); this._pokes.push(now);
      const n = this._pokes.length, e = n >= 3 ? 'dizzy' : n === 2 ? 'giggle' : 'surprised';
      this._pokeAt = now; this._override = e; this._overrideUntil = now + (e === 'dizzy' ? 1.9 : e === 'giggle' ? 1.2 : .95);
      this._show(e, false);
      this.dispatchEvent(new CustomEvent('poke', { detail: { count: n, reaction: e }, bubbles: true }));
    }
    wake(); return this;
  }
  spin() { this._spinAt = performance.now() / 1000; this.poke(.5, { react: false }); return this; }
  blink() { this._blinkAt = performance.now() / 1000; return this; }
  lookAt(x, y) { this._target = (x == null || y == null) ? null : { x, y }; wake(); return this; }
  toSVG({ size = 512 } = {}) {
    const Fr = this._Fr || frame(.32, .26, 0);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1.02 -1.02 2.04 2.04" width="${size}" height="${size}"><circle r="1" style="fill:${this._pal.color}"/>${faceSVG(Fr, prepOf(this._expr, this._t + this._ph), 1, this._pal, this._face, null)}</svg>`;
  }

  /* internals */
  _aria() { this._svg.setAttribute('aria-label', this.getAttribute('label') || OrbAvatar.reactionLabel(this._base)); }
  _show(e, kick = true) {               // morph the displayed face to e (a base reaction or a poke reaction)
    if (e === this._expr) return;
    const from = this._expr;
    if (this._cur && !this._static && this._morph > 0) { this._fromSnap = this._cur; this._fromM = this._m || {}; this._fromExpr = from; this._tp = 0; }
    else this._tp = 1;
    this._expr = e;
    if (kick && from !== e && this._init && !this._static) { const j = this._jelly; this._jv[0] += 2.2 * j; this._jv[2] += (Math.random() - .5) * 1.8 * j; this._jv[5] += (Math.random() - .5) * 1.4 * j; }
    wake();
  }
  _wander(t) {                          // glance at random spots, hold, glance again
    if (!this._wTarget || t > this._wNext) {
      const center = Math.random() < .2, g = this._gaze || [.32, .26];
      this._wTarget = center ? [g[0], g[1]] : [(Math.random() * 2 - 1) * .7, -.35 + Math.random() * .85];
      this._wNext = t + (Math.random() < .25 ? .35 + Math.random() * .3 : .9 + Math.random() * 2.2);
    }
    return this._wTarget;
  }
  _update(dt, t) {
    this._t = t;
    const st = this._static, calm = RMQ.matches || st, dur = RMQ.matches ? .18 : this._morph;
    this._tp = (st || dur <= 0) ? 1 : Math.min(1, this._tp + dt / dur);
    if (!st && t > this._nextBlink) { this._blinkAt = t; this._nextBlink = t + (Math.random() < .2 ? .32 : 2.2 + Math.random() * 4); }
    if (this._override && t > this._overrideUntil) { this._override = null; this._show(this._base, false); }
    const mode = this._follow && this._mode === 'drift' ? 'follow' : this._mode, fixed = mode === 'fixed' && !this._override;
    const ex = EX[this._expr] || EX.idle, lt = calm ? 0 : t + this._ph, p = ease(this._tp), since = t - this._pokeAt;
    const mTo = (ex.motion && !fixed) ? ex.motion(lt, since) : {}, m = this._tp < 1 ? mixMotion(fixed ? {} : this._fromM, mTo, p) : mTo; this._m = m;

    let ly, lp; const g = this._gaze || [.32, .26];
    const look = this._target || (mode === 'follow' && pointer.active ? pointer : null);
    if (look && this._rect) {
      const b = this._rect, cx = b.left + b.width / 2, cy = b.top + b.height / 2, D = Math.max(340, b.width * 2.2);
      ly = clamp(Math.atan((look.x - cx) / D), -.75, .75); lp = clamp(Math.atan((cy - look.y) / D), -.6, .6);
    } else if (mode === 'wander' && !st) { [ly, lp] = this._wander(t); }
    else { const a = (st || mode === 'fixed') ? 0 : 1, ph = this._ph;   // drift: slow, layered sway around gaze
      ly = g[0] + a * (.3 * Math.sin(t * .55 + ph) + .08 * Math.sin(t * 1.4 + ph * 2));
      lp = g[1] + a * (.16 * Math.sin(t * .72 + ph * 1.7) + .05 * Math.sin(t * 1.9 + ph * .6)); }
    const tgt = q => { const w = q.w ?? 0; return [ly + ((q.yaw ?? ly) - ly) * w, lp + ((q.pitch ?? lp) - lp) * w, q.roll ?? 0]; };
    let T = tgt(mTo); if (this._tp < 1) { const A = tgt(this._fromM); T = T.map((v, i) => lerp(A[i], v, p)); }
    if (st || !this._init) { [this._yaw, this._pitch, this._roll] = T; this._init = true; }
    else { const K = 95, Dm = 11, step = (x, v, g) => { v += (g - x) * K * dt; v *= Math.exp(-Dm * dt); return [x + v * dt, v]; };
      [this._yaw, this._vy] = step(this._yaw, this._vy, T[0]); [this._pitch, this._vp] = step(this._pitch, this._vp, T[1]); [this._roll, this._vr] = step(this._roll, this._vr, T[2]); }

    this._jellyStep(dt, t, m, calm);
    const target = prepOf(this._expr, lt);
    this._cur = (this._tp < 1 && this._fromSnap) ? mixFeats(this._fromSnap, target, p) : target;
    this._render(this._tp < 1 ? p : 1, m, calm);
  }
  _jellyStep(dt, t, m, calm) {
    const j = this._jelly, x = this._jx, v = this._jv;   // only pokes and reaction changes kick these; at rest it is a perfect circle
    if (this._static) { for (let i = 0; i < 6; i++) { x[i] = 0; v[i] = 0; } return; }
    const w = lerp(26, 15, j), D = lerp(11, 3.6, j);
    for (let i = 0; i < 6; i++) { const k = i > 1 ? w * 1.35 : w; v[i] += (-k * k * x[i] - D * v[i]) * dt; x[i] = clamp(x[i] + v[i] * dt, -.3, .3); }
  }
  _render(p, m, calm) {
    const t = this._t, ex = EX[this._expr] || EX.idle, pal = this._pal, x = this._jx;
    const sp = (t - this._spinAt) / 1.5, spin = (sp >= 0 && sp < 1) ? TAU * ease(sp) : 0;
    const Fr = frame(this._yaw + spin + (m.yawAdd || 0), clamp(this._pitch, -1.25, 1.25), this._roll + (m.rollAdd || 0));
    const bl = (t - this._blinkAt) / .15, blink = (ex.blink && this._tp >= 1 && bl >= 0 && bl < 1) ? 1 - Math.sin(bl * Math.PI) * .94 : 1;
    const s = m.s ?? 1, dy = calm ? 0 : (m.dy || 0);

    const pts = []; let maxY = -9;
    for (let i = 0; i < BODY_N; i++) { const th = BANG[i], r = radius(x, th) * s, py = Math.sin(th) * r; pts.push([Math.cos(th) * r, py]); if (py > maxY) maxY = py; }
    const shift = 1 - maxY, flat = dy > -.01 ? clamp(x[0], 0, .25) * .9 : 0, fy = 1 - flat;   // bottom stays on the floor and flattens when squashed
    let d = '';
    for (let i = 0; i < BODY_N; i++) { let py = pts[i][1] + shift; if (flat > 0 && py > fy) py = fy + (py - fy) * .25; d += (i ? 'L' : 'M') + f4(pts[i][0]) + ' ' + f4(py + dy); }
    this._bd.setAttribute('d', d + 'Z'); this._bd.style.fill = pal.color;

    const warp = (px, py) => { const r = radius(x, Math.atan2(py, px)) * s; return [px * r, py * r + shift + dy]; };
    this._fc.innerHTML = faceSVG(Fr, this._cur, Math.max(.05, blink), pal, this._face, warp);

    const et = t + this._ph, fx = this._tp < 1 ? EX[this._fromExpr] : null;
    const layer = (tbl, e, op) => (this._extras && e && e.extra && tbl[e.extra] && op > .01) ? `<g opacity="${op.toFixed(2)}">${tbl[e.extra](et, pal)}</g>` : '';
    this._xf.innerHTML = `<g transform="translate(0 ${f4(dy)})">${layer(EXTRA, fx, 1 - p)}${layer(EXTRA, ex, p)}</g>`;
    this._xb.innerHTML = layer(BACK, fx, 1 - p) + layer(BACK, ex, p);
    if (this._shadow) { this._sh.setAttribute('rx', f4(.62 * (1 + dy * .9) * (1 + x[0] * .6))); this._sh.setAttribute('opacity', (.22 * (1 + dy * 1.5)).toFixed(3)); this._sh.style.fill = pal.color; }
    this._Fr = Fr;
  }
}

OrbAvatar.shapes = { F, X, Y, capEye, lidEye, arcEye, blush, superE, ell, qb, polyline, stroke, clipBelow, heart, drop, hop };
window.OrbAvatar = OrbAvatar;
customElements.define('orb-avatar', OrbAvatar);
})();
