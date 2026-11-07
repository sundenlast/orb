/*!
 * <orb-avatar>: chibi teammate orbs with faces mapped onto a sphere.
 * Framework-free Web Component, rendered on <canvas>. Include this file once, then use <orb-avatar> anywhere.
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
    motion: (t, e) => ({ dy: e < .36 ? -.12 * Math.sin(e / .36 * Math.PI) : 0, yaw: 0, pitch: .14, w: .7 }) },
  giggle: { label: 'Giggle', hidden: true,
    feats: () => [arcEye(-1), arcEye(1), ...blush()],
    motion: (t, e) => ({ dy: -.05 * Math.abs(Math.sin(e * 11)) * Math.exp(-e * 2.2), rollAdd: .13 * Math.sin(e * 16) * Math.exp(-e * 2.5), yaw: 0, pitch: .2, w: .5 }) },
  dizzy: { label: 'Dizzy', extra: 'stars',
    feats: t => [-1, 1].map(s => { const cx = s * (X + .015), pts = [], spin = t * 5;   // mirrored spirals, each spinning on its own center
      for (let i = 0; i <= 80; i++) { const u = i / 80, a = -s * (spin + u * TAU * 1.6), r = .012 + .092 * u; pts.push([cx + Math.cos(a) * r, Y + Math.sin(a) * r]); }
      return F(side(s), stroke(pts, .034), [cx, Y]); }),
    motion: t => ({ rollAdd: .14 * Math.sin(t * 2.6), yawAdd: .1 * Math.sin(t * 2.1 + 1), yaw: 0, pitch: .05, w: .6 }) },
  wink: { label: 'Wink',
    feats: () => [capEye(-1), arcEye(1), ...blush()],
    motion: t => ({ roll: .14, yaw: .25, pitch: .22, w: .45 }) },
};

/* ---------- emotes: little moments an alive orb plays on its own while idle ----------
   Defined like reactions, plus a duration. feats(t, e) and motion(t, e) get e = seconds since the emote started. */
const PREP = new WeakMap();
const prepList = list => { let m = PREP.get(list); if (!m) { m = {}; for (const f of list) m[f.key] = { ...f, pts: resample(f.pts) }; PREP.set(list, m); } return m; };
/* Step through faces over time, morphing briefly at each step: seq(e, [[0, FACE_A], [1.2, FACE_B], ...]) */
function seq(e, steps, blend = .14) {
  let i = 0; while (i + 1 < steps.length && e >= steps[i + 1][0]) i++;
  const cur = prepList(steps[i][1]), d = e - steps[i][0];
  return Object.values(i > 0 && d < blend ? mixFeats(prepList(steps[i - 1][1]), cur, ease(d / blend)) : cur);
}
const env = (e, a, b, c, d) => e < a ? 0 : e < b ? ease((e - a) / (b - a)) : e < c ? 1 : e < d ? 1 - ease((e - c) / (d - c)) : 0;   // rise a→b, hold, fall c→d
const pulse = (e, at, dur) => { const q = (e - at) / dur; return q > 0 && q < 1 ? Math.sin(q * Math.PI) : 0; };
const lidAt = (s, L, h = .25) => { const cx = s * X, l = clamp(L, Y - h / 2 + .03, Y + h / 2 + .05); return F(side(s), clipBelow(superE(cx, Y, .125, h, 2.4), [cx - .1, l], [cx + .1, l]), [cx, Y]); };
const restEye = s => { const cx = s * X, y = Y - .01; return F(side(s), stroke(qb([cx - .08, y + .015], [cx, y - .07], [cx + .08, y + .015]), .05), [cx, y]); };
const squint = s => { const cx = s * X; return F(side(s), stroke(qb([cx - .085, Y - .01], [cx, Y + .035], [cx + .085, Y - .01]), .052), [cx, Y]); };
const chevron = s => { const cx = s * X, k = -s; return F(side(s), stroke(polyline([[cx - k * .06, Y + .075], [cx + k * .055, Y], [cx - k * .06, Y - .075]], 10), .056), [cx, Y]); };
const shiny = s => { const cx = s * X, k = side(s); return [F(k, ell(cx, Y, .085, .115), [cx, Y]),
  F('h' + k, ell(cx + .032, Y + .048, .03, .03), [cx + .032, Y + .048], 'hi', { bc: Y }), F('h2' + k, ell(cx - .03, Y - .04, .014, .014), [cx - .03, Y - .04], 'hi', { bc: Y })]; };
const OPEN = [capEye(-1), capEye(1)], SQUINT = [squint(-1), squint(1)], REST = [restEye(-1), restEye(1)], SQUEEZE = [chevron(-1), chevron(1)];
const HAPPY = [arcEye(-1), arcEye(1), ...blush()], SHINY = [...shiny(-1), ...shiny(1)], SUSPECT = [lidAt(-1, Y + .015), lidAt(1, Y + .015)];
const DERP = [F('L', ell(-.13, Y - .035, .04, .05), [-.13, Y - .035]), F('R', superE(.14, Y + .04, .17, .3, 2.4), [.14, Y + .04])];
const CROSSUP = [F('L', superE(-.075, Y + .045, .11, .23, 2.4), [-.075, Y + .045]), F('R', superE(.075, Y + .045, .11, .23, 2.4), [.075, Y + .045])];
const CROSSDOWN = [F('L', superE(-.08, Y - .04, .115, .22, 2.4), [-.08, Y - .04]), F('R', superE(.08, Y - .04, .115, .22, 2.4), [.08, Y - .04])];
const WINKL = [arcEye(-1), capEye(1), ...blush()], WINKR = [capEye(-1), arcEye(1), ...blush()];
/* where the fly is, in ball units: buzzing loops, landing on the head, then zooming off */
function flyAt(e) {
  const buzz = u => [.95 * Math.sin(u * 3.1), -.55 + .45 * Math.sin(u * 5.3)], head = [.05 + .01 * Math.sin(e * 40), -1.06];
  if (e < 2) return buzz(e);
  if (e < 2.4) { const a = buzz(2), q = ease((e - 2) / .4); return [lerp(a[0], head[0], q), lerp(a[1], head[1], q) - .25 * Math.sin(q * Math.PI)]; }
  if (e < 2.9) return head;
  const q = ease(Math.min(1, (e - 2.9) / .6)); return [lerp(head[0], 1.9, q), lerp(head[1], -1.5, q)];
}
const THINK = [capEye(-1, .23, .125, Y + .02), lidEye(1, .23, Y + .02, [X - .1, Y + .035], [X + .1, Y + .05])];
const SLEEPY = [-1, 1].map(s => { const cx = s * X, y = .09; return F(side(s), stroke(qb([cx - .08, y + .015], [cx, y - .08], [cx + .08, y + .015]), .05), [cx, y]); });
const HICS = [.3, 1.3, 2.2];
const dozeLids = q => [lidAt(-1, Y + .14 - .17 * q), lidAt(1, Y + .14 - .17 * q)];
const em = (label, dur, weight, def) => ({ label, hidden: true, emote: { dur, weight, kicks: def.kicks || [] }, ...def });

Object.assign(EX, {
  yawn: em('Yawn', 2.9, 3, {
    feats: (t, e) => { const f = seq(e, [[0, OPEN], [.35, SQUINT], [2.35, OPEN]]);
      if (e > 2) { const q = (e - 2) / .9; f.push(F('tear', drop(X + .1, Y - .02 - q * .06, .026), [X + .1, Y - .02], 'tear', { op: Math.max(0, 1 - q), fixed: true })); }
      return f; },
    motion: (t, e) => { const m = env(e, .3, 1.2, 1.9, 2.4); return { pitch: .55 * m, yaw: 0, w: .85 * m + .1, s: 1 + .05 * m, rollAdd: .05 * Math.sin(e * 2.2) * m + .025 * Math.sin(e * 30) * env(e, 1.3, 1.5, 1.8, 1.9) }; } }),
  shifty: em('Shifty eyes', 3, 3, {
    feats: (t, e) => seq(e, [[0, OPEN], [.15, SUSPECT], [2.5, OPEN]]),
    motion: (t, e) => ({ yaw: e < .8 ? -.6 : e < 1.5 ? .6 : e < 2.1 ? -.6 : 0, pitch: -.05, w: e < 2.5 ? 1 : .3 }) }),
  sneeze: em('Sneeze', 2.6, 2, { kicks: [[1.12, 1.7]], extra: 'spray',
    feats: (t, e) => { if (e < 1.1) return dozeLids(e / 1.1);
      return seq(e, [[1.1, SQUEEZE], [1.55, OPEN]]); },
    motion: (t, e) => e < 1.1 ? { pitch: .1 + .45 * e / 1.1, yaw: 0, w: .9, dy: -.05 * e / 1.1, rollAdd: .035 * Math.sin(e * 24) * e / 1.1 }
      : e < 1.45 ? { pitch: -.5, yaw: 0, w: 1 } : { pitch: .05, w: .6, rollAdd: .1 * Math.sin((e - 1.45) * 13) * Math.exp(-(e - 1.45) * 3) } }),
  hiccup: em('Hiccups', 3, 2, { kicks: HICS.map(h => [h, .7]), extra: 'hic',
    feats: (t, e) => seq(e, [[0, OPEN], ...HICS.flatMap(h => [[h, SHINY], [h + .2, OPEN]])], .06),
    motion: (t, e) => ({ dy: -HICS.reduce((a, h) => a + .1 * pulse(e, h, .22), 0), pitch: .08, w: .4 }) }),
  whistle: em('Whistle', 3.4, 3, { extra: 'notes',
    feats: (t, e) => seq(e, [[0, OPEN], [.25, REST], [3.1, OPEN]]),
    motion: (t, e) => ({ rollAdd: .12 * Math.sin(e * 2.2), yaw: .15 + .12 * Math.sin(e * 1.1), pitch: .22, w: .6 }) }),
  cheeky: em('Cheeky winks', 2.7, 3, { kicks: [[.2, .35], [.75, .35], [1.3, .35]],
    feats: (t, e) => seq(e, [[0, OPEN], [.2, WINKL], [.75, WINKR], [1.3, WINKL], [1.85, HAPPY], [2.45, OPEN]], .1),
    motion: (t, e) => ({ roll: e < .2 ? 0 : e < .75 ? .2 : e < 1.3 ? -.2 : e < 1.85 ? .2 : 0, pitch: .15, yaw: 0, w: .55, dy: -.05 * pulse(e, 1.85, .3) }) }),
  vibe: em('Vibing', 3.6, 2, { extra: 'notes',
    feats: (t, e) => seq(e, [[0, OPEN], [.2, HAPPY], [3.35, OPEN]]),
    motion: (t, e) => { const b = e * Math.PI * 2.2; return { dy: -.06 * Math.abs(Math.sin(b)), rollAdd: .15 * Math.sin(b), yawAdd: .08 * Math.sin(b / 2), pitch: .15, w: .4 }; } }),
  peekaboo: em('Peekaboo', 4, 2, { kicks: [[2.85, 1.2]], extra: 'boo',
    feats: (t, e) => seq(e, [[0, OPEN], [2.75, HAPPY]]),
    motion: (t, e) => ({ yaw: e < 1.8 ? 3.1 : e < 2.4 ? 1.3 : e < 2.7 ? 3.1 : 0, pitch: .05, w: 1, dy: -.08 * pulse(e, 2.8, .35) }) }),
  boop: em('Boop the screen', 3.2, 2, { kicks: [[1.2, .9], [1.55, .9]], extra: 'knock',
    feats: (t, e) => seq(e, [[0, OPEN], [.2, SHINY], [2.2, HAPPY], [3, OPEN]]),
    motion: (t, e) => ({ s: 1 + .22 * env(e, .1, .8, 2.1, 2.9) - .03 * (pulse(e, 1.2, .12) + pulse(e, 1.55, .12)), yaw: 0, pitch: 0, w: .95 }) }),
  derp: em('Derp', 2.6, 2, { kicks: [[1.65, .6]], extra: 'huh',
    feats: (t, e) => seq(e, [[0, OPEN], [.2, DERP], [1.75, OPEN]]),
    motion: (t, e) => ({ roll: e < 1.6 ? .28 : 0, pitch: -.05, yaw: 0, w: .6, rollAdd: e > 1.6 ? .22 * Math.sin((e - 1.6) * 30) * Math.exp(-(e - 1.6) * 6) : 0 }) }),
  idea: em('Idea!', 2.9, 2, { kicks: [[1.2, 1]], extra: 'bulb',
    feats: (t, e) => seq(e, [[0, OPEN], [.15, THINK], [1.2, SHINY], [2.6, OPEN]], .1),
    motion: (t, e) => e < 1.2 ? { pitch: .5, yaw: -.35, w: .85, roll: -.1 } : { pitch: .15, yaw: 0, w: .6, dy: -.1 * pulse(e, 1.2, .35) } }),
  fly: em('Fly', 3.6, 2, { kicks: [[2.9, 1]], extra: 'fly',
    feats: (t, e) => seq(e, [[0, OPEN], [2.2, CROSSUP], [2.9, SQUEEZE], [3.25, OPEN]], .1),
    motion: (t, e) => { const [x, y] = flyAt(e);
      if (e > 2.2 && e < 2.9) return { yaw: 0, pitch: .9, w: 1 };
      return { yaw: clamp(x * .75, -.8, .8), pitch: clamp(-(y + .2) * .7, -.5, .9), w: e < 2.9 ? .95 : .6,
        rollAdd: e > 2.9 ? .25 * Math.sin((e - 2.9) * 34) * Math.exp(-(e - 2.9) * 5) : 0 }; } }),
  bubble: em('Bubble gum', 3.2, 2, { kicks: [[1.75, 1.1]], extra: 'bubble',
    feats: (t, e) => { const f = seq(e, [[0, OPEN], [.2, CROSSDOWN], [1.75, SHINY], [2.5, OPEN]], .08);
      if (e > 1.75) { const o = clamp((3.1 - e) / .7, 0, 1);   // gum splats stuck on the face after the pop
        for (const [k, x, y, r] of [['g1', -.2, -.05, .045], ['g2', .17, -.11, .035], ['g3', .02, .3, .03]]) f.push(F(k, ell(x, y, r, r * .85), [x, y], 'gum', { op: o, fixed: true })); }
      return f; },
    motion: (t, e) => e < 1.75 ? { pitch: -.15, yaw: 0, w: .75, rollAdd: .03 * Math.sin(e * 3) } : { pitch: .12, yaw: 0, w: .6, dy: -.1 * pulse(e, 1.75, .3) } }),
  doze: em('Dozing off', 5, 0, { kicks: [[2.02, .8]],
    feats: (t, e) => e < 2 ? dozeLids(e / 2) : e < 2.35 ? Object.values(prepList(OPEN)) : e < 4.2 ? dozeLids((e - 2.35) / 1.85) : Object.values(prepList(SLEEPY)),
    motion: (t, e) => e < 2 ? { pitch: -.45 * e / 2, roll: .15 * e / 2, w: .9 } : e < 2.35 ? { pitch: .2, w: .9, dy: -.05 } : { pitch: -.42 * Math.min(1, (e - 2.35) / 1.85), roll: .2, yaw: .1, w: .92 } }),
  wake: em('Waking up', 1.6, 0, { kicks: [[0, 1.2]], extra: 'bang',
    feats: (t, e) => seq(e, [[0, SHINY], [1.1, OPEN]], .1),
    motion: (t, e) => ({ dy: -.12 * pulse(e, 0, .35), yaw: e < .5 ? 0 : e < .8 ? -.5 : e < 1.1 ? .5 : 0, pitch: .1, w: .9 }) }),
});

/* ---------- floating extras: drawn on the canvas in ball units (y down, unit ball at origin) ----------
   Each takes (R, t, pal): R = { c: context, k: px per unit, W: canvas px, a: layer opacity, dy, ink: text color }. */
const tracePts = (c, pts) => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); };
const starPts = (x, y, r) => { const p = []; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 - Math.PI / 2, rr = k % 2 ? r * .3 : r; p.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); } return p; };
const HEART = heart(0, 0, .28), DROP = drop(0, 0, .09);
const EXTRA = {
  dots: (R, t) => { const c = R.c; c.fillStyle = R.ink;
    for (let i = 0; i < 3; i++) { c.globalAlpha = R.a * (.2 + .8 * Math.max(0, Math.sin(t * 3 - i * .8))); c.beginPath(); c.arc(.62 + i * .24, -1 - i * .1, .055 + i * .02, 0, TAU); c.fill(); } },
  zzz: (R, t) => { const c = R.c; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = R.ink;
    for (let i = 0; i < 3; i++) { const p = (t * .35 + i / 3) % 1; c.globalAlpha = R.a * Math.sin(p * Math.PI);
      c.font = `700 ${((.22 + p * .16) * R.k).toFixed(1)}px system-ui, sans-serif`;
      c.fillText('z', (.68 + p * .4) * R.k + R.W / 2, (-.68 - p * .55 + R.dy) * R.k + R.W / 2); }
    c.restore(); },
  sparkle: (R, t, pal) => { const c = R.c; c.fillStyle = pal.spark; c.globalAlpha = R.a;
    for (const [x, y, r, ph] of [[.95, -.85, .17, 0], [-.98, -.55, .11, 1.7], [.7, -1.18, .08, 3.1]]) { tracePts(c, starPts(x, y, r * (.35 + .65 * Math.abs(Math.sin(t * 2.2 + ph))))); c.fill(); } },
  heart: (R, t, pal) => { const c = R.c, p = (t * .5) % 1, ox = .85 + .06 * Math.sin(t * 3), oy = -.62 - p * .6;
    c.globalAlpha = R.a * Math.sin(p * Math.PI); c.fillStyle = pal.blush; c.beginPath();
    HEART.forEach(([a, b], i) => i ? c.lineTo(ox + a, oy - b) : c.moveTo(ox + a, oy - b)); c.closePath(); c.fill(); },
  stars: (R, t, pal) => { const c = R.c; c.fillStyle = pal.spark; c.globalAlpha = R.a;
    for (let i = 0; i < 3; i++) { const a = t * 2.4 + i * TAU / 3; if (Math.sin(a) > -.2) { tracePts(c, starPts(Math.cos(a) * .62, -1.02 + Math.sin(a) * .14, .1 + .03 * Math.sin(a))); c.fill(); } } },
  sweat: (R, t, pal) => { const c = R.c, p = (t * .6) % 1, oy = -.6 + p * .12;
    c.globalAlpha = R.a * (1 - p * .6); c.fillStyle = pal.tear; c.beginPath();
    DROP.forEach(([a, b], i) => i ? c.lineTo(-.93 + a, oy - b) : c.moveTo(-.93 + a, oy - b)); c.closePath(); c.fill(); },
};
const BACK = {
  ring: (R, t, pal) => { const c = R.c, p = (t * .8) % 1; c.globalAlpha = R.a * (1 - p) * .7; c.strokeStyle = pal.color; c.lineWidth = .05;
    c.beginPath(); c.arc(0, 0, 1 + .34 * p, 0, TAU); c.stroke(); },
};

/* Emote extras. R also carries e (emote time), s and cy (ball scale and center). */
const say = (R, str, x, y, size, alpha, color) => { if (alpha <= .01 || size <= 0) return; const c = R.c; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = R.a * alpha; c.fillStyle = color || R.ink;
  c.font = `700 ${(size * R.k).toFixed(1)}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(str, x * R.k + R.W / 2, (y + R.dy) * R.k + R.W / 2); c.restore(); };
const dot = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
Object.assign(EXTRA, {
  notes: R => { for (let i = 0; i < 3; i++) { const p = (R.e * .55 + i / 3) % 1; say(R, i % 2 ? '♫' : '♪', .5 + p * .7 + .07 * Math.sin(p * 9 + i), -.35 - p, .3 + .08 * i, Math.sin(p * Math.PI)); } },
  spray: (R, t, pal) => { say(R, 'achoo!', 0, -1.3, .3, env(R.e, 1.1, 1.2, 1.7, 1.95));
    const q = (R.e - 1.1) / .7; if (q <= 0 || q >= 1) return; const c = R.c; c.fillStyle = pal.tear; c.globalAlpha = R.a * (1 - q);
    for (let i = 0; i < 9; i++) { const a = Math.PI * (.1 + .8 * i / 8), d = .35 + q * (.7 + .2 * (i % 3)); dot(c, Math.cos(a) * d * 1.3, .15 + Math.sin(a) * d * .7, .03 + .012 * (i % 2)); } },
  hic: R => { for (const h of HICS) { const d = R.e - h; if (d > 0 && d < .6) say(R, 'hic!', .78, -.95 - d * .35, .24, 1 - d / .6); } },
  boo: (R, t, pal) => { if (R.e < 2.75) return; const a = R.a; R.a = a * Math.min(1, (R.e - 2.75) / .2) * clamp((4 - R.e) / .4, 0, 1); EXTRA.sparkle(R, t, pal); say(R, 'boo!', 0, -1.3, .3, 1); R.a = a; },
  knock: R => { const c = R.c; c.strokeStyle = R.ink; c.lineWidth = .04; c.lineCap = 'round';
    for (const k of [1.2, 1.55]) { const d = (R.e - k) / .3; if (d <= 0 || d >= 1) continue; c.globalAlpha = R.a * (1 - d);
      for (const a of [-2.3, -1.57, -.84]) { const r0 = R.s * 1.06 + d * .08, r1 = r0 + .14; c.beginPath(); c.moveTo(Math.cos(a) * r0, R.cy + Math.sin(a) * r0); c.lineTo(Math.cos(a) * r1, R.cy + Math.sin(a) * r1); c.stroke(); } } },
  huh: R => say(R, '?', .78, -.95 + .04 * Math.sin(R.e * 6), .42, env(R.e, .25, .45, 1.5, 1.75)),
  bulb: (R, t, pal) => { if (R.e < 1.2) return; const q = backOut(Math.min(1, (R.e - 1.2) / .3)), c = R.c, y = -1.28;
    c.globalAlpha = R.a * clamp((2.9 - R.e) / .4, 0, 1); c.strokeStyle = pal.spark; c.lineWidth = .035; c.lineCap = 'round';
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * .55; c.beginPath(); c.moveTo(Math.cos(a) * .22 * q, y + Math.sin(a) * .22 * q); c.lineTo(Math.cos(a) * .29 * q, y + Math.sin(a) * .29 * q); c.stroke(); }
    c.fillStyle = pal.spark; dot(c, 0, y, .14 * q); c.fillStyle = R.ink; c.fillRect(-.055 * q, y + .11 * q, .11 * q, .065 * q); },
  fly: (R, t, pal) => { const [x, y] = flyAt(R.e), c = R.c, flap = .5 + .5 * Math.sin(R.e * 70); if (x > 1.75) return;
    c.globalAlpha = R.a * .65; c.fillStyle = '#ffffff';
    c.beginPath(); c.ellipse(x - .035, y - .04, .035, .05 * (.4 + .6 * flap), -.5, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(x + .035, y - .04, .035, .05 * (.4 + .6 * flap), .5, 0, TAU); c.fill();
    c.globalAlpha = R.a; c.fillStyle = R.ink; dot(c, x, y, .038);
    if (R.e > 2.95 && R.e < 3.5) say(R, 'shoo!', -.75, -1.1, .26, 1 - (R.e - 2.95) / .55); },
  bubble: (R, t, pal) => { const c = R.c, e = R.e, ax = R.anchor[0], ay = R.anchor[1];
    if (e > .2 && e < 1.75) { const r = .04 + .36 * ease(Math.min(1, (e - .2) / 1.5)), w = .05 * Math.sin(e * 9);
      c.globalAlpha = R.a * .85; c.fillStyle = pal.gum; c.beginPath(); c.ellipse(ax, ay + r * .8, r * (1 + w), r * (1 - w), 0, 0, TAU); c.fill();
      c.globalAlpha = R.a * .75; c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(ax - r * .35, ay + r * .45, r * .18, r * .1, -.6, 0, TAU); c.fill(); }
    const q = (e - 1.75) / .35; if (q > 0 && q < 1) { c.globalAlpha = R.a * (1 - q); c.fillStyle = pal.gum;
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, d = .25 + q * .4; dot(c, ax + Math.cos(a) * d, ay + .3 + Math.sin(a) * d, .032); }
      say(R, 'pop!', ax + .62, ay - .1, .26, 1 - q); } },
  bang: R => say(R, '!', 0, -1.3, .5 * backOut(Math.min(1, R.e / .2)), env(R.e, 0, .08, .7, .9)),
});

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
const isStatic = ex => ex.feats.length === 0;
function prepOf(k, t, e = 0) {
  const ex = EX[k] || EX.idle, make = () => { const m = {}; for (const f of ex.feats(t, e)) m[f.key] = { ...f, pts: resample(f.pts) }; return m; };
  return isStatic(ex) ? (prepCache[k] ||= make()) : make();
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
const MKEYS = { dy: 0, s: 1, roll: 0, rollAdd: 0, yawAdd: 0, w: 0 };
function mixMotion(a, b, p) {
  const o = {}; for (const [k, d] of Object.entries(MKEYS)) o[k] = lerp(a[k] ?? d, b[k] ?? d, p);
  for (const k of ['yaw', 'pitch']) if (a[k] != null || b[k] != null) o[k] = lerp(a[k] ?? b[k], b[k] ?? a[k], p);
  return o;
}

/* ---------- sphere math (allocation-free: results land in P3) ---------- */
function frame(yaw, pitch, roll) {
  const cp = Math.cos(pitch), f = [Math.sin(yaw) * cp, -Math.sin(pitch), Math.cos(yaw) * cp];
  const rl = Math.hypot(f[2], f[0]) || 1, r = [f[2] / rl, 0, -f[0] / rl];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const c = Math.cos(roll), s = Math.sin(roll);
  return { f, r: [r[0] * c + u[0] * s, r[1] * c + u[1] * s, r[2] * c + u[2] * s], u: [u[0] * c - r[0] * s, u[1] * c - r[1] * s, u[2] * c - r[2] * s] };
}
const P3 = [0, 0, 0];
function proj(a, b, Fr) {
  const rho = Math.sqrt(a * a + b * b), f = Fr.f, r = Fr.r, u = Fr.u; let x, y, z;
  if (rho < 1e-6) { x = f[0]; y = f[1]; z = f[2]; }
  else { const s = Math.sin(rho) / rho, c = Math.cos(rho), ra = a * s, rb = b * s;
    x = f[0] * c + r[0] * ra + u[0] * rb; y = f[1] * c + r[1] * ra + u[1] * rb; z = f[2] * c + r[2] * ra + u[2] * rb; }
  if (z < 0) { const k = Math.sqrt(x * x + y * y) || 1; x /= k; y /= k; }
  P3[0] = x; P3[1] = y; P3[2] = z; return P3;
}

/* ---------- soft body: radius = 1 + sum of wobble modes (k = 2, 3, 4), each on a spring resting at 0 ---------- */
const BODY_N = 72, BCOS = [], BSIN = [];
for (let i = 0; i < BODY_N; i++) { BCOS.push(Math.cos(i / BODY_N * TAU)); BSIN.push(Math.sin(i / BODY_N * TAU)); }
const radius = (x, th) => 1 + x[0] * Math.cos(2 * th) + x[1] * Math.sin(2 * th) + x[2] * Math.cos(3 * th) + x[3] * Math.sin(3 * th) + x[4] * Math.cos(4 * th) + x[5] * Math.sin(4 * th);

/* Face drawing. W = warp: { s, sh } for a round body, or { s, sh, x } while jiggling. */
function drawFace(c, Fr, feats, sq, pal, face, W, stride) {
  for (const k in feats) {
    const ft = feats[k], op0 = ft.op ?? 1; if (op0 <= .01) continue;
    const vis = clamp((proj(ft.c[0] * face, ft.c[1] * face, Fr)[2] + .12) / .22, 0, 1); if (vis <= 0) continue;
    const kk = ft.fixed ? 1 : sq, cy = ft.bc ?? ft.c[1], P = ft.pts, n = P.length;
    c.beginPath();
    for (let i = 0; i < n; i += stride) {
      const p = proj(P[i][0] * face, (cy + (P[i][1] - cy) * kk) * face, Fr);
      let X, Y;
      if (W.x) { const r = radius(W.x, Math.atan2(p[1], p[0])) * W.s; X = p[0] * r; Y = p[1] * r + W.sh; }
      else { X = p[0] * W.s; Y = p[1] * W.s + W.sh; }
      i ? c.lineTo(X, Y) : c.moveTo(X, Y);
    }
    c.closePath(); c.globalAlpha = op0 * vis; c.fillStyle = pal[ft.fill] || ft.fill; c.fill();
  }
  c.globalAlpha = 1;
}
/* SVG markup of a face, used only by toSVG(). */
function faceSVG(Fr, feats, pal, face) {
  let out = '';
  for (const k in feats) {
    const ft = feats[k], op0 = ft.op ?? 1; if (op0 <= .01) continue;
    const vis = clamp((proj(ft.c[0] * face, ft.c[1] * face, Fr)[2] + .12) / .22, 0, 1); if (vis <= 0) continue;
    let d = ''; ft.pts.forEach(([a, b], i) => { const p = proj(a * face, b * face, Fr); d += (i ? 'L' : 'M') + f4(p[0]) + ' ' + f4(p[1]); });
    const op = op0 * vis;
    out += `<path d="${d}Z" fill="${pal[ft.fill] || ft.fill}"${op < .999 ? ` opacity="${op.toFixed(2)}"` : ''}/>`;
  }
  return out;
}

/* ---------- shared pointer, layout tracking, quality governor and animation loop ---------- */
const pointer = { x: 0, y: 0, active: false, t: 0 };
let listening = false, layoutVer = 0, frameNo = 0;
function listen() {
  if (listening) return; listening = true;
  addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; pointer.t = performance.now(); }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { pointer.active = false; });
  addEventListener('blur', () => { pointer.active = false; });
  const bump = () => { layoutVer++; };
  addEventListener('scroll', bump, { capture: true, passive: true });
  addEventListener('resize', bump, { passive: true });
}
// Quality levels: outline detail (stride) and canvas resolution cap. Level 2 also animates at half rate.
const LEVELS = [{ stride: 1, dpr: 2 }, { stride: 2, dpr: 1.5 }, { stride: 3, dpr: 1 }];
const Q = { level: 0, auto: true, ema: 1, iv: 16.7, bad: 0, good: 0 };
function setLevel(l) { Q.level = clamp(l, 0, 2); Q.bad = Q.good = 0; for (const o of live) { o._fit(); o._sig = null; } }
function govern(cost, iv) {
  if (!Q.auto || iv > 120) return;            // a long gap means the tab was hidden, not that we were slow
  Q.ema += (cost - Q.ema) * .08; Q.iv += (iv - Q.iv) * .08;
  const slow = Q.ema > 6 || Q.iv > 24, fast = Q.ema < 2.5 && Q.iv < 19;
  Q.bad = slow ? Q.bad + 1 : 0; Q.good = fast ? Q.good + 1 : 0;
  if (Q.bad > 40 && Q.level < 2) setLevel(Q.level + 1);
  else if (Q.good > 360 && Q.level > 0) setLevel(Q.level - 1);
}
const live = new Set(); let raf = 0, last = 0;
function loop(ms) {
  const iv = ms - last, dtRaw = Math.min(.1, Math.max(0, iv / 1000)), t = ms / 1000; last = ms; frameNo++;
  if (pointer.active && ms - pointer.t > 6000) pointer.active = false;
  const t0 = performance.now(), half = Q.level >= 2, act = [];
  for (const o of live) if (o._visible && !o._static && o._cw) act.push(o);
  for (const o of act) {                       // read layout first (only when it may have changed), then draw
    if ((o._target || (o._followMode() || o._alive) && pointer.active) && (o._rectVer !== layoutVer || frameNo % 30 === 0)) { o._rect = o.getBoundingClientRect(); o._rectVer = layoutVer; }
  }
  for (const o of act) {
    if (half && (frameNo + o._slot) & 1) { o._acc += dtRaw; continue; }
    const dt = Math.min(.1, dtRaw + o._acc); o._acc = 0; o._update(dt, t);
  }
  govern(performance.now() - t0, iv);
  raf = live.size ? requestAnimationFrame(loop) : 0;
}
const wake = () => { if (!raf && live.size) { last = performance.now(); raf = requestAnimationFrame(loop); } };
const io = new IntersectionObserver(es => { for (const e of es) { const o = e.target; o._visible = e.isIntersecting; if (o._visible) o._sig = null; } }, { rootMargin: '120px' });
const ro = new ResizeObserver(es => { for (const e of es) e.target._resized(e.contentRect.width); });
const parseGaze = v => { if (!v) return null; const p = v.split(/[\s,]+/).map(Number); return p.length >= 2 && p.every(Number.isFinite) ? [p[0] * Math.PI / 180, p[1] * Math.PI / 180] : null; };
const on = v => v !== null && v !== 'false' && v !== 'off';
const CANVAS_SCALE = 3.2 / 2.08;               // canvas spans ±1.6 ball radii; the element box spans ±1.04
let slots = 0;

const ATTRS = ['reaction', 'mode', 'color', 'eye-color', 'size', 'follow', 'shadow', 'extras', 'face-scale', 'morph', 'jelly', 'gaze', 'static', 'label', 'alive', 'idle-time', 'sleep-after', 'emotes'];

class OrbAvatar extends HTMLElement {
  static get observedAttributes() { return ATTRS; }
  static get reactions() { return Object.keys(EX).filter(k => !EX[k].hidden); }
  static reactionLabel(name) { return (EX[name] || {}).label || name; }
  static defineReaction(name, def) { EX[name] = { label: name, ...def }; delete prepCache[name]; }
  /** 'auto' (default) adapts to the device; 0 = full, 1 = lighter, 2 = lightest. */
  static get quality() { return Q.auto ? 'auto' : Q.level; }
  static set quality(v) { if (v === 'auto') { Q.auto = true; setLevel(0); } else { Q.auto = false; setLevel(+v || 0); } }
  static get qualityLevel() { return Q.level; }
  static get emotes() { return Object.keys(EX).filter(k => EX[k].emote && EX[k].emote.weight > 0); }
  /** Register an emote: a reaction definition plus { duration, weight (how often it is picked), kicks: [[time, strength]] }. */
  static defineEmote(name, { duration = 2, weight = 1, kicks = [], ...def }) { EX[name] = { label: name, ...def, hidden: true, emote: { dur: duration, weight, kicks } }; delete prepCache[name]; }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>:host{display:inline-block;position:relative;width:64px;aspect-ratio:1;flex:none;vertical-align:middle;line-height:0;-webkit-tap-highlight-color:transparent}'
      + `canvas{position:absolute;left:50%;top:50%;width:${(CANVAS_SCALE * 100).toFixed(2)}%;height:${(CANVAS_SCALE * 100).toFixed(2)}%;transform:translate(-50%,-50%);pointer-events:none}i{display:none}</style>`
      + '<canvas part="canvas"></canvas><i></i>';
    this._canvas = root.querySelector('canvas'); this._probe = root.querySelector('i'); this._ctx = this._canvas.getContext('2d');
    this._cw = 0; this._cssW = 0; this._sig = null; this._slot = slots++; this._acc = 0; this._rectVer = -1; this._inkAt = 0; this._colorVer = 0;
    this._expr = 'idle'; this._base = 'idle'; this._override = null; this._overrideUntil = 0; this._pokeAt = -9; this._pokes = []; this._overrideAt = 0; this._kickIdx = 0;
    this._alive = false; this._idleTime = 8; this._sleepAfter = 60; this._emoteList = null; this._lastAttn = this._t0 = performance.now() / 1000; this._nextEmote = 0; this._asleep = false; this._lastEmote = null; this._ptrSeen = 0;
    this._mode = 'drift'; this._wTarget = null; this._wNext = 0; this._ph = Math.random() * 20;
    this._raw = { color: '#f1efe9', eye: '#141418' };
    this._pal = { color: '#f1efe9', eye: '#141418', hi: '#ffffff', blush: '#ff6f91', tear: '#a8dcff', spark: '#ffe08a', gum: '#ff8fb8' };
    this._ink = '#888';
    this._face = 1.6; this._morph = .42; this._jelly = .6; this._gaze = null;
    this._follow = false; this._shadow = false; this._extras = true; this._static = false; this._visible = true; this._target = null;
    this._yaw = .32; this._pitch = .26; this._roll = 0; this._vy = 0; this._vp = 0; this._vr = 0; this._init = false;
    this._tp = 1; this._fromExpr = 'idle'; this._fromSnap = null; this._fromM = {}; this._cur = null; this._m = {};
    this._jx = [0, 0, 0, 0, 0, 0]; this._jv = [0, 0, 0, 0, 0, 0];
    this._t = performance.now() / 1000; this._nextBlink = this._t + 1 + Math.random() * 3; this._blinkAt = -9; this._spinAt = -9;
  }
  connectedCallback() {
    listen(); live.add(this); io.observe(this); ro.observe(this);
    if (!this.hasAttribute('role')) this.setAttribute('role', 'img');
    this._colors(); this._aria(); this._update(0, performance.now() / 1000); wake();
  }
  disconnectedCallback() { live.delete(this); io.unobserve(this); ro.unobserve(this); }
  attributeChangedCallback(n, _, v) {
    switch (n) {
      case 'reaction': { const e = v && EX[v] && !EX[v].hidden ? v : 'idle', from = this._base; this._base = e; this._override = null; this._asleep = false; this._lastAttn = performance.now() / 1000; this._show(e);
        if (from !== e) this.dispatchEvent(new CustomEvent('reactionchange', { detail: { from, to: e }, bubbles: true })); break; }
      case 'mode': this._mode = ['follow', 'wander', 'fixed', 'drift'].includes(v) ? v : 'drift'; break;
      case 'color': this._raw.color = v || '#f1efe9'; this._colors(); break;
      case 'eye-color': this._raw.eye = v || '#141418'; this._colors(); break;
      case 'size': this.style.width = v == null ? '' : (/^\d+(\.\d+)?$/.test(v) ? v + 'px' : v); break;
      case 'follow': this._follow = on(v); break;   // legacy alias for mode="follow"
      case 'shadow': this._shadow = on(v); break;
      case 'extras': this._extras = v === null || on(v); break;
      case 'face-scale': this._face = num(v, 1.6); break;
      case 'morph': this._morph = Math.max(0, num(v, .42)); break;
      case 'jelly': this._jelly = clamp(num(v, .6), 0, 1); break;
      case 'gaze': this._gaze = parseGaze(v); break;
      case 'static': this._static = on(v); break;
      case 'alive': this._alive = on(v); this._nextEmote = performance.now() / 1000 + this._idleTime * (.5 + Math.random() * .6); this._lastAttn = performance.now() / 1000; break;
      case 'idle-time': this._idleTime = Math.max(.5, num(v, 8)); break;
      case 'sleep-after': this._sleepAfter = Math.max(0, num(v, 60)); break;
      case 'emotes': this._emoteList = v ? v.split(/[\s,]+/).filter(Boolean) : null; break;
    }
    this._sig = null; this._aria();
    if (this.isConnected && (this._static || !raf)) this._update(0, performance.now() / 1000);
  }

  /* public API */
  get reaction() { return this._base; }
  set reaction(v) { this.setAttribute('reaction', v); }
  get mode() { return this._mode; }
  set mode(v) { this.setAttribute('mode', v); }
  react(name) { this.reaction = name; return this; }
  poke(force = 1, { react = true } = {}) {
    const j = this._jelly * force, now = performance.now() / 1000;
    this._jv[0] += 3.4 * j; this._jv[2] += (Math.random() - .5) * 2.4 * j; this._jv[3] += (Math.random() - .5) * 2.4 * j;
    this._lastAttn = now;
    if (react && !this._static) {
      if (this._asleep) { this._asleep = false; this._play('wake', now); }
      else {                               // escalate with rapid pokes: surprised, giggle, then dizzy
        this._pokes = this._pokes.filter(p => now - p < 1.3); this._pokes.push(now);
        const n = this._pokes.length, e = n >= 3 ? 'dizzy' : n === 2 ? 'giggle' : 'surprised';
        this._pokeAt = now; this._override = e; this._overrideAt = now; this._kickIdx = 0; this._overrideUntil = now + (e === 'dizzy' ? 1.9 : e === 'giggle' ? 1.2 : .95);
        this._show(e, false);
        this.dispatchEvent(new CustomEvent('poke', { detail: { count: n, reaction: e }, bubbles: true }));
      }
    }
    wake(); return this;
  }
  spin() { this._spinAt = performance.now() / 1000; this.poke(.5, { react: false }); return this; }
  blink() { this._blinkAt = performance.now() / 1000; wake(); return this; }
  /** Play an emote now, such as 'sneeze' or 'peekaboo'. Works in any reaction. */
  emote(name) { if (EX[name] && EX[name].emote && !this._static) { this._asleep = false; this._play(name, performance.now() / 1000); } return this; }
  /** Doze off and fall asleep until poked, approached or given a new reaction. */
  sleep() { return this.emote('doze'); }
  wakeUp() { if (this._asleep) { this._asleep = false; this._play('wake', performance.now() / 1000); } this._lastAttn = performance.now() / 1000; return this; }
  get asleep() { return this._asleep; }
  lookAt(x, y) { this._target = (x == null || y == null) ? null : { x, y }; this._rectVer = -1; wake(); return this; }
  toSVG({ size = 512 } = {}) {
    const Fr = this._Fr || frame(.32, .26, 0);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1.02 -1.02 2.04 2.04" width="${size}" height="${size}"><circle r="1" fill="${this._pal.color}"/>${faceSVG(Fr, prepOf(this._expr, this._t + this._ph), this._pal, this._face)}</svg>`;
  }

  /* internals */
  _play(name, t) {
    const em = EX[name].emote || {};
    this._override = name; this._overrideAt = t; this._overrideUntil = t + (em.dur ?? 1); this._kickIdx = 0; this._lastEmote = name;
    this._show(name, true); wake();
    this.dispatchEvent(new CustomEvent('emote', { detail: { name }, bubbles: true }));
  }
  _pickEmote() {
    const pool = Object.keys(EX).filter(k => { const em = EX[k].emote; return em && em.weight > 0 && k !== this._lastEmote && (!this._emoteList || this._emoteList.includes(k)); });
    let r = Math.random() * pool.reduce((a, k) => a + EX[k].emote.weight, 0);
    for (const k of pool) { r -= EX[k].emote.weight; if (r <= 0) return k; }
    return pool[0] || null;
  }
  _life(t) {                            // alive mode: notice the cursor, play emotes when bored, fall asleep when ignored
    if (pointer.active && pointer.t > this._ptrSeen && this._rect) {
      this._ptrSeen = pointer.t; const b = this._rect;
      if (Math.hypot(pointer.x - b.left - b.width / 2, pointer.y - b.top - b.height / 2) < Math.max(140, b.width * 2)) { this._lastAttn = t; if (this._asleep) { this._asleep = false; this._play('wake', t); } }
    }
    if (this._base !== 'idle' || this._override) return;
    if (this._sleepAfter > 0 && t - this._lastAttn > this._sleepAfter) this._play('doze', t);
    else if (t > this._nextEmote) { const k = this._pickEmote(); if (k) this._play(k, t); else this._nextEmote = t + this._idleTime; }
  }
  _followMode() { return this._mode === 'follow' || (this._follow && this._mode === 'drift'); }
  _aria() { if (this.isConnected) this.setAttribute('aria-label', this.getAttribute('label') || OrbAvatar.reactionLabel(this._base)); }
  _colors() {                           // resolve any CSS color (including var(--x)) to something canvas understands
    if (!this.isConnected) return;
    const pr = this._probe;
    for (const k of ['color', 'eye']) { pr.style.color = ''; pr.style.color = this._raw[k]; this._pal[k] = getComputedStyle(pr).color || this._raw[k]; }
    this._ink = getComputedStyle(this).color; this._colorVer++; this._sig = null;
  }
  _resized(w) { this._cssW = w; this._fit(); this._sig = null; if (this._static || !raf) this._update(0, performance.now() / 1000); }
  _fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, LEVELS[Q.level].dpr), px = Math.max(0, Math.round(this._cssW * CANVAS_SCALE * dpr));
    if (px !== this._cw) { this._canvas.width = this._canvas.height = px; this._cw = px; this._sig = null; }
  }
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
    if (this._override && t > this._overrideUntil) {
      const ended = this._override; this._override = null;
      if (ended === 'doze') { this._asleep = true; this._override = 'sleeping'; this._overrideAt = t; this._overrideUntil = Infinity; this._show('sleeping', false); }
      else { this._show(this._base, false); this._nextEmote = t + this._idleTime * (.7 + Math.random() * .9); }
    }
    if (this._alive && !st) this._life(t);
    if (this._override) {                // timed jiggles inside emotes (sneezes, hiccups, knocks)
      const kicks = (EX[this._override].emote || {}).kicks || [], e = t - this._overrideAt;
      while (this._kickIdx < kicks.length && e >= kicks[this._kickIdx][0]) { const j = this._jelly * kicks[this._kickIdx][1]; this._jv[0] += 3 * j; this._jv[2] += (Math.random() - .5) * 2 * j; this._kickIdx++; }
    }
    const mode = this._followMode() ? 'follow' : this._mode, fixed = mode === 'fixed' && !this._override;
    // lt drives movement (frozen for reduced motion); ft drives the face's own animation (spinning spirals, tears)
    const ex = EX[this._expr] || EX.idle, lt = calm ? 0 : t + this._ph, ft = st ? 0 : t + this._ph, p = ease(this._tp), since = this._override ? t - this._overrideAt : t - this._pokeAt; this._since = since;
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

    this._jellyStep(dt);
    const dyn = !isStatic(ex) || this._tp < 1;
    if (dyn || !this._cur || this._curExpr !== this._expr) {
      const target = prepOf(this._expr, ft, since);
      this._cur = (this._tp < 1 && this._fromSnap) ? mixFeats(this._fromSnap, target, p) : target; this._curExpr = this._expr;
    }
    this._render(this._tp < 1 ? p : 1, m, calm, dyn);
  }
  _jellyStep(dt) {                      // only pokes and reaction changes kick these; at rest the ball is a perfect circle
    const j = this._jelly, x = this._jx, v = this._jv;
    if (this._static) { for (let i = 0; i < 6; i++) { x[i] = 0; v[i] = 0; } return; }
    const w = lerp(26, 15, j), D = lerp(11, 3.6, j), n = Math.ceil(dt * 60 - 1e-6), h = n ? dt / n : 0;
    for (let s = 0; s < n; s++) for (let i = 0; i < 6; i++) { const k = i > 1 ? w * 1.35 : w; v[i] += (-k * k * x[i] - D * v[i]) * h; x[i] = clamp(x[i] + v[i] * h, -.3, .3); }
  }
  _render(p, m, calm, dyn) {
    const c = this._ctx, W = this._cw; if (!W) return;
    const t = this._t, ex = EX[this._expr] || EX.idle, pal = this._pal, x = this._jx;
    const sp = (t - this._spinAt) / 1.5, spin = (sp >= 0 && sp < 1) ? TAU * ease(sp) : 0;
    const yaw = this._yaw + spin + (m.yawAdd || 0), pitch = clamp(this._pitch, -1.25, 1.25), roll = this._roll + (m.rollAdd || 0);
    const bl = (t - this._blinkAt) / .15, sq = Math.max(.05, (ex.blink && this._tp >= 1 && bl >= 0 && bl < 1) ? 1 - Math.sin(bl * Math.PI) * .94 : 1);
    const s = m.s ?? 1, dy = calm ? 0 : (m.dy || 0);
    let energy = 0; for (let i = 0; i < 6; i++) energy += Math.abs(x[i]) + Math.abs(this._jv[i]) * .02;
    const jiggle = energy > 2e-4, fx = this._tp < 1 ? EX[this._fromExpr] : null;
    const extras = this._extras && ((ex.extra && (EXTRA[ex.extra] || BACK[ex.extra])) || (fx && fx.extra));
    const stride = Math.max(LEVELS[Q.level].stride, this._cssW < 48 ? 2 : 1);

    // Skip the frame entirely when nothing visible changed.
    const sig = [yaw, pitch, roll, sq, s, dy, W, this._colorVer, stride, this._shadow ? 1 : 0];
    if (!dyn && !jiggle && !extras && this._sig && sig.every((v, i) => Math.abs(v - this._sig[i]) < 1e-4)) return;
    this._sig = sig;
    if (extras && ++this._inkAt % 120 === 0) this._ink = getComputedStyle(this).color;

    const Fr = frame(yaw, pitch, roll), k = W / 3.2;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, W); c.setTransform(k, 0, 0, k, W / 2, W / 2); c.globalAlpha = 1;
    const R = { c, k, W, a: 1, dy, ink: this._ink, e: this._since, s, cy: 1 - s, anchor: [0, 0] };
    const layer = (tbl, e, op) => { if (extras && e && e.extra && tbl[e.extra] && op > .01) { R.a = op; tbl[e.extra](R, t + this._ph, pal); c.globalAlpha = 1; } };
    layer(BACK, fx, 1 - p); layer(BACK, ex, p);

    if (this._shadow) { c.globalAlpha = .22 * (1 + dy * 1.5); c.fillStyle = pal.color; c.beginPath();
      c.ellipse(0, 1.16, .62 * (1 + dy * .9) * (1 + x[0] * .6), .06, 0, 0, TAU); c.fill(); c.globalAlpha = 1; }

    c.fillStyle = pal.color; c.beginPath();
    let warp;
    if (!jiggle) { const sh = 1 - s + dy; c.arc(0, sh, s, 0, TAU); warp = { s, sh }; }
    else {                              // jiggling outline; the bottom stays on the floor and flattens when squashed
      const bs = Math.max(1, stride - 1), rr = []; let maxY = -9;
      for (let i = 0; i < BODY_N; i += bs) { const th = i / BODY_N * TAU, r = radius(x, th) * s; rr.push(r); if (BSIN[i] * r > maxY) maxY = BSIN[i] * r; }
      const shift = 1 - maxY, flat = dy > -.01 ? clamp(x[0], 0, .25) * .9 : 0, fy = 1 - flat;
      for (let i = 0, j = 0; i < BODY_N; i += bs, j++) { let py = BSIN[i] * rr[j] + shift; if (flat > 0 && py > fy) py = fy + (py - fy) * .25; j ? c.lineTo(BCOS[i] * rr[j], py + dy) : c.moveTo(BCOS[i] * rr[j], py + dy); }
      c.closePath(); warp = { s, sh: shift + dy, x };
    }
    c.fill();
    drawFace(c, Fr, this._cur, sq, pal, this._face, warp, Math.min(stride, 2));

    if (extras) {
      R.cy = warp.sh - dy;
      const ap = proj(0, -.13 * this._face, Fr), ar = warp.x ? radius(warp.x, Math.atan2(ap[1], ap[0])) * warp.s : warp.s;
      R.anchor = [ap[0] * ar, ap[1] * ar + warp.sh - dy];   // the spot just below the eyes
      c.translate(0, dy); layer(EXTRA, fx, 1 - p); layer(EXTRA, ex, p);
    }
    this._Fr = Fr;
  }
}

OrbAvatar.shapes = { F, X, Y, capEye, lidEye, arcEye, blush, superE, ell, qb, polyline, stroke, clipBelow, heart, drop, hop };
window.OrbAvatar = OrbAvatar;
customElements.define('orb-avatar', OrbAvatar);
})();
