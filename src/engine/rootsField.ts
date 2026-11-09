/**
 * Splash texture: animated "roots" strands on a 4px dot-matrix grid, with the wordmark
 * cut out as a crisp vector shape. Ported 1:1 from Roots v3 (Claude Design); only dead
 * code paths were removed. Framework-agnostic: React just mounts it on a <canvas>.
 */

interface Branch {
  y0: number;
  dir: number;
  len: number;
  k: number;
  ph: number;
  yl: boolean;
  sub: { at: number; k: number; dir: number } | null;
}

interface Wire {
  u: number;
  dr: number;
  ph: number;
  f1: number;
  f2: number;
  a1: number;
  sp: number;
  g: number;
  pz: number;
  j: number;
  br: Branch[];
  ci: number;
}

interface Masks {
  cols: number;
  rows: number;
  /** stroked-glyph cell mask (used to weight edge smoothing) */
  m1: Uint8Array;
  /** cells fully inside the glyph fill */
  mi: Uint8Array;
  /** soft edge ramp around the glyphs */
  me: Float32Array;
  /** soft clearings behind the tagline and ENTER */
  fz: Float32Array;
  /** vector knockout spec */
  ko: { font: string; x: number; y: number; lw: number };
  /** per-row [start, end) spans of the knockout shape at 1px precision */
  kr: (number[] | null)[];
  dot: { x: number; y: number; r: number };
  /** cells covered by the glyph fill, for the red sweep */
  red: number[];
  wx0: number;
}

export interface RootsFieldDeps {
  tagline: () => HTMLElement | null;
  cta: () => HTMLElement | null;
  wide: () => boolean;
}

const P = 4; // dot grid pitch in CSS px
const NL = 12; // brightness levels
const LV: number[] = [];
const SZ: number[] = [];
for (let q = 0; q < NL; q++) {
  const u = q / (NL - 1);
  LV.push(0.07 + 0.93 * u);
  SZ.push(1.4 + 1.6 * u);
}
// strand palette: muted base green + five distinct greens (moss, sage, fern, mint, olive)
const PAL = ['oklch(0.66 0.06 145)', 'oklch(0.82 0.15 150)', 'oklch(0.78 0.09 140)', 'oklch(0.74 0.17 135)', 'oklch(0.86 0.11 165)', 'oklch(0.80 0.12 120)'];
const RED = '#D0584A';
const FONT = "800 100px 'Helvetica Neue', Helvetica, Arial, sans-serif";

const smooth = (x: number) => {
  x = Math.min(1, Math.max(0, x));
  return x * x * (3 - 2 * x);
};

export class RootsField {
  private raf = 0;
  private dead = false;
  private t0 = 0;
  private last = 0;
  private gap = 15;
  private cost = 0;
  private seedW = 0;
  private wideAt: boolean | null = null;
  private wires: Wire[] = [];
  private mk: Masks | null = null;
  private acc: Float32Array = new Float32Array(0);
  private sacc: Float32Array = new Float32Array(0);
  private cid: Uint8Array = new Uint8Array(0);
  private cmx: Float32Array = new Float32Array(0);
  private canvas: HTMLCanvasElement;
  private deps: RootsFieldDeps;

  constructor(canvas: HTMLCanvasElement, deps: RootsFieldDeps) {
    this.canvas = canvas;
    this.deps = deps;
  }

  start() {
    this.dead = false;
    this.t0 = 0;
    this.seedW = 0;
    this.mk = null;
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
  }

  /** Re-measure tagline / ENTER and rebuild masks on the next frame. */
  invalidate() {
    this.mk = null;
  }

  private seed() {
    const R = Math.random;
    const N = Math.round(96 * Math.max(1, (this.seedW || 390) / 390));
    const ws: Wire[] = [];
    for (let i = 0; i < N; i++) {
      const br: Branch[] = [];
      const nb = R() < 0.4 ? 0 : 1 + Math.floor(R() * 3);
      for (let j = 0; j < nb; j++)
        br.push({
          y0: 0.04 + R() * 0.86, dir: R() < 0.5 ? -1 : 1, len: 0.04 + R() * 0.16, k: 0.04 + R() * 0.16,
          ph: R() * 6.28, yl: R() < 0.5, sub: R() < 0.5 ? { at: 0.25 + R() * 0.5, k: 0.03 + R() * 0.08, dir: R() < 0.5 ? -1 : 1 } : null,
        });
      const cross = R() < 0.14;
      ws.push({
        u: -0.06 + 1.12 * (i / (N - 1)) + (R() - 0.5) * 0.03,
        dr: cross ? (R() < 0.5 ? -1 : 1) * (0.25 + R() * 0.35) : (R() - 0.5) * 0.16,
        ph: R() * 6.28, f1: 0.5 + R() * 1.2, f2: 2.5 + R() * 4, a1: 0.02 + R() * 0.05,
        sp: 0.15 + R() * 0.35, g: 0.45 + R() * 0.5, pz: R() * 1.6, j: R(), br, ci: R() < 0.62 ? 0 : 1 + Math.floor(R() * 5),
      });
    }
    this.wires = ws;
  }

  private masks(W: number, H: number, cols: number, rows: number): Masks | null {
    const p = P, n = cols * rows, off = document.createElement('canvas');
    off.width = cols;
    off.height = rows;
    const c = off.getContext('2d', { willReadFrequently: true });
    if (!c) return null;
    c.scale(1 / p, 1 / p);
    c.font = FONT;
    const w100 = c.measureText('Roots').width || 300;
    const fs = (100 * Math.min(W * 0.84, H * 0.95)) / (w100 + 30);
    c.font = FONT.replace('100px', fs.toFixed(1) + 'px');
    const tw = c.measureText('Roots').width, dr = fs * 0.1, gap = fs * 0.06;
    const x0 = (W - tw - gap - dr * 2) / 2, base = H * 0.38 + fs * 0.36;
    const dot = { x: x0 + tw + gap + dr, y: base - dr, r: dr };
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    c.fillStyle = c.strokeStyle = '#000';
    c.lineWidth = 7;
    c.lineJoin = 'round';
    c.fillText('Roots', x0, base);
    const d0 = c.getImageData(0, 0, cols, rows).data, red: number[] = [], mi = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (d0[i * 4 + 3] > 140) red.push(i);
      if (d0[i * 4 + 3] > 200) mi[i] = 1;
    }
    // gap scales with the wordmark: 8px stroke on desktop, ~3px on phone so letters and counters don't merge
    const ko = { font: c.font, x: x0, y: base, lw: Math.max(2, Math.min(p * 2, fs * 0.03)) };

    // per-row spans of the knockout shape at 1px horizontal precision: strands are pushed to these
    // exact edges (not to the 4px cell edges), so the void around the letters follows the vector outline
    const kr: (number[] | null)[] = [];
    try {
      const kc = document.createElement('canvas'), KW = Math.max(1, Math.ceil(W));
      kc.width = KW;
      kc.height = rows;
      const kx = kc.getContext('2d', { willReadFrequently: true });
      if (kx) {
        kx.scale(1, 1 / p);
        kx.font = ko.font;
        kx.textAlign = 'left';
        kx.textBaseline = 'alphabetic';
        kx.fillStyle = kx.strokeStyle = '#000';
        kx.lineWidth = ko.lw;
        kx.lineJoin = 'round';
        kx.fillText('Roots', x0, base);
        kx.strokeText('Roots', x0, base);
        kx.beginPath();
        kx.arc(dot.x, dot.y, dot.r + ko.lw / 2, 0, 6.2832);
        kx.fill();
        const kd = kx.getImageData(0, 0, KW, rows).data;
        for (let y = 0; y < rows; y++) {
          const sp: number[] = [];
          let a = -1;
          for (let x = 0; x <= KW; x++) {
            const on = x < KW && kd[(y * KW + x) * 4 + 3] > 127;
            if (on && a < 0) a = x;
            else if (!on && a >= 0) {
              sp.push(a, x);
              a = -1;
            }
          }
          kr.push(sp.length ? sp : null);
        }
      }
    } catch {
      kr.length = 0;
    }

    c.strokeText('Roots', x0, base);
    c.beginPath();
    c.arc(dot.x, dot.y, dr + 5, 0, 6.2832);
    c.fill();

    // place the tagline under the wordmark and clear soft zones behind it and ENTER
    const cr = this.canvas.getBoundingClientRect(), sx = W / (cr.width || W), sy = H / (cr.height || H);
    const tz: { cx: number; cy: number; hx: number; hy: number; F: number }[] = [];
    const ct = this.deps.cta()?.firstElementChild;
    if (ct) {
      const r = ct.getBoundingClientRect();
      tz.push({ cx: ((r.left + r.right) / 2 - cr.left) * sx, cy: ((r.top + r.bottom) / 2 - cr.top) * sy, hx: r.width * sx * 0.5 + 34, hy: r.height * sy * 0.5 + 14, F: 40 });
    }
    const tg = this.deps.tagline();
    if (tg) {
      tg.style.left = x0 + (dot.x + dot.r - x0) / 2 + 'px';
      tg.style.transform = 'translateX(-50%)';
      tg.style.top = base + fs * (this.deps.wide() ? 0.24 : 0.38) + 'px';
      tg.style.visibility = 'visible';
      const r = tg.getBoundingClientRect();
      tz.push({ cx: ((r.left + r.right) / 2 - cr.left) * sx, cy: ((r.top + r.bottom) / 2 - cr.top) * sy, hx: r.width * sx * 0.5 + 14, hy: r.height * sy * 0.5 + 6, F: 30 });
    }

    const d = c.getImageData(0, 0, cols, rows).data, m1 = new Uint8Array(n);
    for (let i = 0; i < n; i++) m1[i] = d[i * 4 + 3] > 70 ? 1 : 0;

    // soft letter edge: chamfer distance (in cells) from the wordmark, ramped over ~3 cells
    const ds = new Float32Array(n), BIG = 1e6, D2 = 1.414;
    for (let i = 0; i < n; i++) ds[i] = m1[i] ? 0 : BIG;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        let v = ds[i];
        if (!v) continue;
        if (x > 0) v = Math.min(v, ds[i - 1] + 1);
        if (y > 0) {
          v = Math.min(v, ds[i - cols] + 1);
          if (x > 0) v = Math.min(v, ds[i - cols - 1] + D2);
          if (x < cols - 1) v = Math.min(v, ds[i - cols + 1] + D2);
        }
        ds[i] = v;
      }
    for (let y = rows - 1; y >= 0; y--)
      for (let x = cols - 1; x >= 0; x--) {
        const i = y * cols + x;
        let v = ds[i];
        if (!v) continue;
        if (x < cols - 1) v = Math.min(v, ds[i + 1] + 1);
        if (y < rows - 1) {
          v = Math.min(v, ds[i + cols] + 1);
          if (x < cols - 1) v = Math.min(v, ds[i + cols + 1] + D2);
          if (x > 0) v = Math.min(v, ds[i + cols - 1] + D2);
        }
        ds[i] = v;
      }
    const me = new Float32Array(n), RAMP = 3.2;
    for (let i = 0; i < n; i++) {
      const q = Math.min(1, ds[i] / RAMP);
      me[i] = 1 - q * q * (3 - 2 * q);
    }

    const fz = new Float32Array(n);
    for (const z of tz) {
      const rad = z.hy, F = z.F, ix = z.hx - rad;
      for (let y = 0; y < rows; y++) {
        const dy = Math.abs((y + 0.5) * p - z.cy);
        if (dy > z.hy + F) continue;
        for (let x = 0; x < cols; x++) {
          const dx = Math.max(0, Math.abs((x + 0.5) * p - z.cx) - ix);
          const o = Math.hypot(dx, dy) - rad;
          if (o >= F) continue;
          const q = Math.max(0, o) / F, i = y * cols + x;
          fz[i] = Math.max(fz[i], 1 - q * q * (3 - 2 * q));
        }
      }
    }
    return { cols, rows, m1, mi, me, fz, ko, kr, dot, red, wx0: x0 };
  }

  private frame = (now: number) => {
    if (this.dead) return;
    this.raf = requestAnimationFrame(this.frame);
    if (document.hidden || now - this.last < this.gap) return;
    this.last = now;
    if (!this.t0) this.t0 = now;
    const cv = this.canvas, dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    const pw = Math.round(W * dpr), ph = Math.round(H * dpr);
    if (cv.width !== pw || cv.height !== ph) {
      cv.width = pw;
      cv.height = ph;
      this.mk = null;
    }
    if (this.seedW !== W) {
      this.seedW = W;
      this.seed();
      this.mk = null;
    }
    const wide = this.deps.wide();
    if (this.wideAt !== wide) {
      this.wideAt = wide;
      this.mk = null;
    }
    const p = P, cols = Math.ceil(W / p), rows = Math.ceil(H / p), n = cols * rows;
    if (!this.mk || this.mk.cols !== cols || this.mk.rows !== rows) this.mk = this.masks(W, H, cols, rows);
    const M = this.mk;
    if (!M) return;
    if (this.acc.length !== n) {
      this.acc = new Float32Array(n);
      this.sacc = new Float32Array(n);
      this.cid = new Uint8Array(n);
      this.cmx = new Float32Array(n);
    }
    const acc = this.acc, cid = this.cid, cmx = this.cmx;
    acc.fill(0);
    cmx.fill(0);
    const t = now / 1000, el = (now - this.t0) / 1000, TAU = 6.283;
    const k1 = smooth((el - 0.4) / 1.8);
    let fw = 1;
    const KR = M.kr.length === rows ? M.kr : null;
    // push strands that cross the wordmark out to its exact outline (+ a little random spread)
    const fit = (r: number, x: number, j: number) => {
      fw = 1;
      if (!KR || !k1) return x;
      const S = KR[r];
      if (!S) return x;
      for (let q = 0; q < S.length; q += 2) {
        const a = S[q], b = S[q + 1];
        if (x <= a || x >= b) continue;
        fw = 0.8;
        const tx = x < (a + b) / 2 ? a - j * p * 3 : b + j * p * 3;
        return x + k1 * (tx - x);
      }
      return x;
    };
    // one colour index per cell: the strongest strand stamped there wins
    let ci = 0;
    const put = (i: number, a: number) => {
      acc[i] += a;
      if (a > cmx[i]) {
        cmx[i] = a;
        cid[i] = ci;
      }
    };
    const stamp = (r: number, x: number, v: number) => {
      const cc = x / p - 0.5, c0 = Math.floor(cc), f = cc - c0, o = r * cols;
      if (c0 >= 0 && c0 < cols) put(o + c0, v * (1 - f));
      if (c0 + 1 >= 0 && c0 + 1 < cols) put(o + c0 + 1, v * f);
    };
    const blob = (r: number, x: number, v: number) => {
      stamp(r, x, v);
      stamp(r, x - p, v * 0.45);
      stamp(r, x + p, v * 0.45);
      if (r > 0) stamp(r - 1, x, v * 0.45);
      if (r + 1 < rows) stamp(r + 1, x, v * 0.45);
    };
    const yb: number[] = [];
    for (const w of this.wires) {
      ci = w.ci || 0;
      const pulseY = ((t * w.sp * 0.15 + w.pz) % 1.6) - 0.3;
      for (let r = 0; r < rows; r++) {
        const yn = (r + 0.5) / rows;
        const x0 = W * (w.u + w.dr * (yn - 0.5) + w.a1 * Math.sin(yn * w.f1 * TAU + w.ph + t * w.sp * 0.4)) + W * 0.012 * Math.sin(yn * w.f2 * TAU + w.ph * 2 + t * w.sp * 0.6);
        const x = fit(r, x0, w.j);
        const edge = smooth(yn / 0.2) * smooth((1 - yn) / 0.16);
        if (edge <= 0) continue;
        const pd = yn - pulseY;
        stamp(r, x, (w.g + 1.3 * Math.exp(-(pd * pd) / 0.0012)) * edge * 0.55 * fw);
        for (const b of w.br) {
          const L = b.len * (0.7 + 0.3 * Math.sin(t * 0.3 + b.ph));
          if (yn < b.y0 || yn > b.y0 + L) continue;
          const s = (yn - b.y0) / L, last = yn + 1 / rows > b.y0 + L;
          const bx0 = x0 + b.dir * W * b.k * Math.pow(s, 1.5) + W * 0.004 * Math.sin(s * 9 + b.ph + t);
          const bx = fit(r, bx0, w.j);
          stamp(r, bx, (1 - s * 0.7) * 0.5 * edge * fw);
          if (last) {
            blob(r, bx, 1.1 * edge);
            if (b.yl) {
              const f = Math.exp(-(pd * pd) / 0.0006);
              if (f > 0.04) yb.push(bx, r, f * edge);
            }
          }
          if (b.sub && s > b.sub.at) {
            const q = (s - b.sub.at) / (1 - b.sub.at), sx = fit(r, bx0 + b.sub.dir * W * b.sub.k * Math.pow(q, 1.3), w.j);
            stamp(r, sx, (1 - q * 0.6) * 0.4 * edge * fw);
            if (last) {
              blob(r, sx, 0.9 * edge);
              if (b.yl) {
                const f = Math.exp(-(pd * pd) / 0.0006);
                if (f > 0.04) yb.push(sx, r, f * edge);
              }
            }
          }
        }
      }
    }
    const sa = this.sacc;
    for (let i = 0; i < n; i++) {
      let v = acc[i];
      if (v > 0.9) v = 0.9 + (v - 0.9) * 0.25;
      // only cells fully inside the glyphs are zeroed here; the crisp outline comes from the vector knockout
      v *= (1 - k1 * M.mi[i]) * (1 - k1 * M.fz[i]);
      // temporal smoothing: kills flicker, heavier in the edge ramp where strands slide past the outline
      sa[i] += (v - sa[i]) * (0.22 - 0.13 * k1 * M.me[i] * (1 - M.m1[i]));
      acc[i] = sa[i];
    }

    const c = cv.getContext('2d');
    if (!c) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    const paths = PAL.map(() => LV.map(() => new Path2D()));
    for (let r = 0; r < rows; r++)
      for (let k = 0; k < cols; k++) {
        const i = r * cols + k, v = acc[i];
        if (v < 0.1) continue; // empty cells stay pure black
        const L = Math.min(NL - 1, Math.floor(Math.sqrt(Math.min(1, (v - 0.1) / 1.1)) * NL));
        const s = SZ[L];
        paths[cmx[i] > 0 ? cid[i] : 0][L].rect(k * p + (p - s) / 2, r * p + (p - s) / 2, s, s);
      }
    paths.forEach((set, q) => {
      c.fillStyle = PAL[q];
      set.forEach((Pth, i) => {
        c.globalAlpha = LV[i];
        c.fill(Pth);
      });
    });

    // vector knockout: erase the wordmark (+ gap) so letter edges are anti-aliased, not cell-stepped
    if (k1 > 0) {
      const K = M.ko;
      c.save();
      c.globalCompositeOperation = 'destination-out';
      c.globalAlpha = k1;
      c.fillStyle = c.strokeStyle = '#000';
      c.font = K.font;
      c.textAlign = 'left';
      c.textBaseline = 'alphabetic';
      c.lineWidth = K.lw;
      c.lineJoin = 'round';
      c.fillText('Roots', K.x, K.y);
      c.strokeText('Roots', K.x, K.y);
      c.beginPath();
      c.arc(M.dot.x, M.dot.y, M.dot.r + K.lw / 2, 0, 6.2832);
      c.fill();
      c.restore();
    }

    // adaptive frame rate: if a frame costs too much, drop toward 30fps instead of stalling
    const cost = performance.now() - now;
    this.cost = (this.cost || cost) * 0.9 + cost * 0.1;
    this.gap = this.cost > 9 ? 33 : this.cost > 5 ? 22 : 15;

    if (yb.length) {
      c.fillStyle = '#EADFB4';
      const bulb = (A: Path2D, x: number, r: number, s: number) => {
        const k = Math.floor(x / p);
        for (const q of [[0, 0, 3], [-1, 0, 2], [1, 0, 2], [0, -1, 2], [0, 1, 2]]) {
          const z = q[2] + s;
          A.rect((k + q[0]) * p + (p - z) / 2, (r + q[1]) * p + (p - z) / 2, z, z);
        }
      };
      for (let q = 0; q < yb.length; q += 3) {
        const Pth = new Path2D();
        bulb(Pth, yb[q], yb[q + 1], 0.3);
        c.globalAlpha = Math.min(1, yb[q + 2]);
        c.fill(Pth);
      }
    }

    // red sweep across the letters, then the pulsing dot
    const st = el - 2.4, SW = 1.3;
    if (st > 0) {
      const D = M.dot, span = D.x + D.r - M.wx0, sxp = M.wx0 + span * Math.min(1, st / SW);
      const after = st < SW ? 1 : Math.max(0, 1 - (st - SW) / 1.1);
      if (after > 0) {
        const RP = [new Path2D(), new Path2D(), new Path2D()], RA = [1, 0.55, 0.25];
        for (const i of M.red) {
          const cxp = ((i % cols) + 0.5) * p, dx = sxp - cxp;
          if (dx < 0) continue;
          const v = dx < 2 * p && st < SW ? 1 : 0.55 * Math.exp(-dx / 60) * after;
          if (v < 0.12) continue;
          const L = v > 0.7 ? 0 : v > 0.35 ? 1 : 2;
          RP[L].rect((i % cols) * p + 0.5, Math.floor(i / cols) * p + 0.5, 3, 3);
        }
        c.fillStyle = RED;
        RP.forEach((Pth, L) => {
          c.globalAlpha = RA[L];
          c.fill(Pth);
        });
      }
      if (sxp >= D.x - D.r) {
        const tDot = (SW * (D.x - D.r - M.wx0)) / span, ph2 = Math.max(0, st - tDot);
        const dp = new Path2D();
        for (let y = Math.floor((D.y - D.r) / p); y <= Math.ceil((D.y + D.r) / p); y++)
          for (let x = Math.floor((D.x - D.r) / p); x <= Math.ceil((D.x + D.r) / p); x++)
            if (Math.hypot((x + 0.5) * p - D.x, (y + 0.5) * p - D.y) <= D.r) dp.rect(x * p + 0.5, y * p + 0.5, 3, 3);
        c.fillStyle = RED;
        c.globalAlpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.cos((ph2 * TAU) / 2.6));
        c.fill(dp);
      }
    }
    c.globalAlpha = 1;
  };
}
