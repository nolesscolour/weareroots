/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Player visualiser: 4,200 "sand" particles settling into Chladni-style patterns that
 * react to the live stream (or a simulated beat when the stream blocks CORS).
 * Ported 1:1 from Roots v3. Pattern descriptors are loosely typed on purpose: there are
 * 22 shapes, each with its own random parameters.
 */
import { ABERRATION, ACCENT, INK, WAVE_COLOR } from '../config';

type Pattern = { type: string; env: string; [k: string]: any };

export interface CymaticsHost {
  /** snapshot of what the visualiser needs each frame */
  frameState(): { playing: boolean; loading: boolean; idx: number; named: boolean; wide: boolean; key: string };
  setNamed(v: boolean): void;
  /** live RMS level of the stream, or null to simulate */
  readRms(): number | null;
}

interface Cy {
  N: number;
  X: Float32Array;
  Y: Float32Array;
  FX: Float32Array;
  FY: Float32Array;
  MX?: Float32Array;
  MY?: Float32Array;
  MF?: Uint8Array;
  mode: 'fill' | 'pattern';
  placed: boolean;
  beat: number;
  last: number;
  beats: number;
  en: number;
  [k: string]: any;
}

export class Cymatics {
  private C: Cy;
  private canvas: HTMLCanvasElement | null = null;
  private host: CymaticsHost;
  private avg = 0;
  private flatKey = '';
  private flatCv: HTMLCanvasElement | null = null;

  constructor(host: CymaticsHost) {
    this.host = host;
    const N = 4200, X = new Float32Array(N), Y = new Float32Array(N), FX = new Float32Array(N), FY = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      FX[i] = Math.random() * 2 - 1;
      FY[i] = Math.random() * 2 - 1;
    }
    this.C = { N, X, Y, FX, FY, mode: 'fill', placed: false, beat: 0, last: 0, beats: 0, en: 0 };
  }

  attach(cv: HTMLCanvasElement | null) {
    this.canvas = cv;
    this.flatCv = null;
  }

  private radius(W: number, H: number, wide: boolean) {
    return wide ? Math.min(W, H) * 0.44 : Math.max(W, H) * 0.62;
  }

  private rand(noMix = false): Pattern {
    const R = Math.random, C = this.C, hist: string[] = C.hist || (C.hist = []);
    const pick = <T,>(arr: T[]): T => arr[Math.floor(R() * arr.length)];
    const sgn = () => (R() < 0.5 ? -1 : 1);
    const G: Record<string, () => any> = {
      w: () => { const n = 1 + Math.floor(R() * 5), s = []; for (let j = 0; j < n; j++) { const an = R() * 6.2832, rd = n === 1 ? R() * 0.25 : 0.1 + R() * 0.4; s.push([rd * Math.cos(an), rd * Math.sin(an), R() * 6.2832]); } return { s, k: 11 + R() * 17 }; },
      c: () => { const n = 1 + Math.floor(R() * 5); return { n, m: n + 1 + Math.floor(R() * 4), rot: R() * 3.1416, sc: 1 + R() * 0.9 }; },
      p: () => ({ k: 9 + R() * 18, m: 2 + Math.floor(R() * 7), ph: R() * 6.2832, rot: R() * 6.2832, tw: (R() - 0.5) * (R() < 0.4 ? 0 : 6) }),
      s: () => ({ k: 14 + R() * 22, a: R() * 3.1416, bend: R() < 0.6 ? R() * 1.4 : 0, bk: 2 + R() * 5 }),
      h: () => ({ k: 12 + R() * 16, a: R() * 1.05, sq: R() < 0.4 }),
      g: () => { const n = 5 + Math.floor(R() * 10), s = []; for (let j = 0; j < n; j++) s.push([(R() * 2 - 1) * 0.9, (R() * 2 - 1) * 0.9, 0.04 + R() * 0.16]); return { s }; },
      r: () => ({ m: 5 + Math.floor(R() * 18), tw: R() < 0.5 ? 0 : (R() - 0.5) * 6, hole: 0.08 + R() * 0.3, rot: R() * 6.2832 }),
      o: () => ({ k: 14 + R() * 20, wob: R() < 0.6 ? R() * 0.6 : 0, lobes: 2 + Math.floor(R() * 5), cx: (R() - 0.5) * 0.3, cy: (R() - 0.5) * 0.3 }),
      m: () => ({ k: 22 + R() * 18, d: 0.06 + R() * 0.14 }),
      v: () => ({ m: 1 + Math.floor(R() * 6), k: sgn() * (3 + R() * 7), ph: R() * 6.2832 }),
      k: () => ({ k: 8 + R() * 14, a: R() * 0.8 }),
      q: () => ({ n: 2 + Math.floor(R() * 6), sc: 0.75 + R() * 0.2, w: 7 + R() * 6, layers: 1 + Math.floor(R() * 3) }),
      e: () => ({ k: 14 + R() * 18, p: R() < 0.5 ? 0.6 + R() * 0.3 : 2.6 + R() * 3 }),
      u: () => { const m1 = 5 + Math.floor(R() * 9); return { m1, m2: m1 + 3 + Math.floor(R() * 8), k: 5 + R() * 6 }; },
      t: () => { const s = []; for (let j = 0; j < 4; j++) { const an = R() * 6.2832, f = 1.5 + R() * 3.5; s.push([Math.cos(an) * f, Math.sin(an) * f, R() * 6.2832]); } return { s, k: 9 + R() * 10 }; },
      n: () => ({ k: 9 + R() * 14, a: R() * 0.8, tri: R() < 0.4 }),
      y: () => { const n = 6 + Math.floor(R() * 12), s = []; for (let j = 0; j < n; j++) s.push([(R() * 2 - 1) * 1.1, (R() * 2 - 1) * 1.1]); return { s, w: 18 + R() * 20 }; },
      z: () => ({ k: 12 + R() * 16, f: 3 + R() * 7, amp: 0.05 + R() * 0.15, a: R() * 3.1416 }),
      L: () => { const n = 1 + Math.floor(R() * 3), md = []; for (let j = 0; j < n; j++) { const a = 1 + Math.floor(R() * 7); md.push([a, a + 1 + Math.floor(R() * 5), sgn(), j ? 0.3 + R() * 0.5 : 1]); } return { md, circ: R() < 0.25, k: 8 + R() * 14, m: 2 + Math.floor(R() * 6) }; },
      T: () => { const a = 1 + Math.floor(R() * 2); return { n: R() < 0.5 ? 2 : 3, a, b: a + 1 + Math.floor(R() * 2), s: sgn(), ck: 10 + R() * 12, cm: 4 + Math.floor(R() * 8), diag: R() < 0.5 }; },
      J: () => { const rt = pick([[1, 2], [2, 3], [3, 4], [3, 5], [4, 5], [5, 6], [5, 8], [8, 9], [1, 3], [2, 5]]); return { a: rt[0], b: rt[1], ph: R() * 6.2832, drift: (R() < 0.5 ? 0.04 : 0.12) * sgn(), sp: 0.004 + R() * 0.006 }; },
      Q: () => { const k = pick([2, 3, 4, 5, 6, 7, 8, 9]); return { k, dir: R() < 0.5 ? 1 : -1, c: 0.3 + R() * 0.45, ph: R() * 6.2832, drift: 0.05 * sgn(), sp: 0.003 + R() * 0.005 }; },
    };
    const envs: Record<string, string[]> = {
      w: ['disc', 'disc', 'ring', 'twin'], c: ['square', 'disc'], p: ['disc', 'ring'], s: ['square', 'disc', 'ring'], h: ['square', 'disc', 'twin'],
      g: ['square', 'twin', 'disc'], r: ['disc', 'ring'], o: ['disc', 'square', 'twin'], m: ['square', 'disc'], v: ['disc', 'ring'], k: ['square', 'disc', 'twin'],
      q: ['disc'], e: ['disc', 'square'], u: ['disc'], t: ['square', 'disc'], n: ['square', 'disc', 'ring'], y: ['square', 'disc', 'twin'], z: ['square', 'disc'],
      L: ['square'], T: ['square'], J: ['disc', 'square'], Q: ['disc'],
    };
    const NEWK = ['L', 'T', 'J', 'Q'], OLDK = Object.keys(G).filter((k) => NEWK.indexOf(k) < 0), useNew = R() < 0.5;
    const keys = useNew ? NEWK : OLDK;
    const one = (avoid: string[], from?: string[]) => {
      const src = from || keys, ok = src.filter((t) => avoid.indexOf(t) < 0);
      const t = pick(ok.length ? ok : src);
      const d = G[t]();
      d.type = t;
      return d;
    };
    let d: any;
    if (!noMix && !useNew && R() < 0.18) {
      const x = one(hist, OLDK), y = one(hist.concat([x.type]), OLDK);
      d = { type: 'x', a: x, b: y, mix: 0.35 + R() * 0.3, env: pick(envs[x.type]) };
      hist.push(x.type);
    } else {
      d = one(hist);
      d.env = pick(envs[d.type]);
      hist.push(d.type);
    }
    while (hist.length > 6) hist.shift();
    return d as Pattern;
  }

  private F(d: any, x: number, y: number): number {
    const t = d.type, P = Math.PI;
    if (t === 'x') return this.F(d.a, x, y) * (1 - d.mix) + this.F(d.b, x, y) * d.mix;
    if (t === 'J' || t === 'Q') {
      if (!d.grid) return 1;
      const N = d.gN, fx = (x + d.gL) / d.gcs - 0.5, fy = (y + d.gL) / d.gcs - 0.5, i = Math.floor(fx), j = Math.floor(fy);
      if (i < 0 || j < 0 || i >= N - 1 || j >= N - 1) return 1;
      const u = fx - i, v = fy - j, G = d.grid, o = j * N + i;
      const dd = (G[o] * (1 - u) + G[o + 1] * u) * (1 - v) + (G[o + N] * (1 - u) + G[o + N + 1] * u) * v;
      return Math.min(1, dd * d.gcs * 6);
    }
    if (t === 'L' || t === 'T') {
      const C = this.C, X = x / Math.max(0.3, C.ax || 1), Y = y / Math.max(0.3, C.ay || 1);
      if (t === 'L') {
        if (d.circ) { const r = Math.sqrt(X * X + Y * Y), th = Math.atan2(Y, X); return Math.cos(d.k * r) * Math.cos(d.m * th) * 0.8 + 0.2 * Math.cos(d.k * 0.5 * r); }
        let v = 0, tot = 0;
        for (const m of d.md) { v += m[3] * (Math.cos(m[0] * P * X) * Math.cos(m[1] * P * Y) + m[2] * Math.cos(m[1] * P * X) * Math.cos(m[0] * P * Y)); tot += m[3] * 2; }
        return (v / tot) * 2;
      }
      const ts = 2 / d.n, fi = (X + 1) / ts, fj = (Y + 1) / ts, i = Math.floor(fi), j = Math.floor(fj);
      let u = (fi - i) * 2 - 1, w = (fj - j) * 2 - 1;
      if (i % 2) u = -u;
      if (j % 2) w = -w;
      if (d.diag && (i + j) % 2) { const q = u; u = w; w = q; }
      const edge = Math.min(1 - Math.abs(u), 1 - Math.abs(w));
      let sub;
      if (d.n === 3 && i === 1 && j === 1) { const r = Math.sqrt(u * u + w * w), th = Math.atan2(w, u); sub = Math.cos(Math.min(d.ck, 12) * r) * Math.cos(d.cm * th); }
      else sub = (Math.cos(d.a * P * u) * Math.cos(d.b * P * w) + d.s * Math.cos(d.b * P * u) * Math.cos(d.a * P * w)) * 0.5;
      return Math.min(Math.abs(sub) * 1.4, edge / 0.1, 1);
    }
    if (t === 'w') { let f = 0; for (const s of d.s) { const dx = x - s[0], dy = y - s[1]; f += Math.cos(d.k * Math.sqrt(dx * dx + dy * dy) + s[2]); } return f / d.s.length; }
    if (t === 'c') {
      const cr = Math.cos(d.rot), sr = Math.sin(d.rot), X = (x * cr - y * sr) * d.sc, Y = (x * sr + y * cr) * d.sc;
      return (Math.cos(d.n * P * X) * Math.cos(d.m * P * Y) - Math.cos(d.m * P * X) * Math.cos(d.n * P * Y)) / 2;
    }
    if (t === 'p') { const r = Math.sqrt(x * x + y * y), th = Math.atan2(y, x); return Math.cos(d.k * r + d.ph) * Math.cos(d.m * (th + d.tw * r) + d.rot); }
    if (t === 's') { const ca = Math.cos(d.a), sa = Math.sin(d.a), u = x * ca + y * sa, w = -x * sa + y * ca; return Math.cos(d.k * u + d.bend * Math.sin(d.bk * w) * 3); }
    if (t === 'h') {
      const ca = Math.cos(d.a), sa = Math.sin(d.a), X = x * ca - y * sa, Y = x * sa + y * ca;
      if (d.sq) return (Math.cos(d.k * X) + Math.cos(d.k * Y)) / 2;
      return (Math.cos(d.k * X) + Math.cos(d.k * (-0.5 * X + 0.866 * Y)) + Math.cos(d.k * (-0.5 * X - 0.866 * Y))) / 3;
    }
    if (t === 'g') { let m = 0; for (const s of d.s) { const dx = x - s[0], dy = y - s[1], e = Math.exp(-(dx * dx + dy * dy) / (s[2] * s[2])); if (e > m) m = e; } return m * 2 - 1; }
    if (t === 'r') { const r = Math.sqrt(x * x + y * y), th = Math.atan2(y, x); return r < d.hole ? 1 : Math.cos(d.m * (th + d.tw * r) + d.rot); }
    if (t === 'o') { const dx = x - d.cx, dy = y - d.cy, r = Math.sqrt(dx * dx + dy * dy), th = Math.atan2(dy, dx); return Math.cos(d.k * r * (1 + d.wob * 0.25 * Math.sin(d.lobes * th))); }
    if (t === 'm') { const c1 = Math.cos(d.d), s1 = Math.sin(d.d); return (Math.cos(d.k * x) + Math.cos(d.k * (x * c1 - y * s1))) / 2; }
    if (t === 'v') { const r = Math.sqrt(x * x + y * y) + 1e-3, th = Math.atan2(y, x); return Math.cos(d.m * th + d.k * Math.log(r) * 2 + d.ph); }
    if (t === 'k') { const ca = Math.cos(d.a), sa = Math.sin(d.a), X = x * ca - y * sa, Y = x * sa + y * ca; return Math.cos(d.k * X) * Math.cos(d.k * Y); }
    if (t === 'q') {
      const r = Math.sqrt(x * x + y * y), th = Math.atan2(y, x);
      let best = 9;
      for (let l = 1; l <= d.layers; l++) { const rr = (Math.abs(Math.cos(d.n * th)) * d.sc * l) / d.layers; best = Math.min(best, Math.abs(r - rr)); }
      return Math.min(1, best * 6);
    }
    if (t === 'e') { const q = Math.pow(Math.pow(Math.abs(x), d.p) + Math.pow(Math.abs(y), d.p), 1 / d.p); return Math.cos(d.k * q); }
    if (t === 'u') { const r = Math.sqrt(x * x + y * y) + 1e-3, th = Math.atan2(y, x), L = Math.log(r) * d.k; return Math.cos(d.m1 * th + L * d.m1 * 0.5) * Math.cos(d.m2 * th - L * d.m2 * 0.5); }
    if (t === 't') { let n = 0; for (const s of d.s) n += Math.sin(s[0] * x + s[1] * y + s[2]); return Math.cos(d.k * n * 0.5); }
    if (t === 'n') {
      const ca = Math.cos(d.a), sa = Math.sin(d.a), X = x * ca - y * sa, Y = x * sa + y * ca;
      if (d.tri) return Math.max(Math.cos(d.k * X), Math.cos(d.k * (-0.5 * X + 0.866 * Y)), Math.cos(d.k * (-0.5 * X - 0.866 * Y))) * 2 - 1;
      return Math.max(Math.cos(d.k * X), Math.cos(d.k * Y)) * 2 - 1;
    }
    if (t === 'y') {
      let d1 = 9, d2 = 9;
      for (const s of d.s) { const dx = x - s[0], dy = y - s[1], q = Math.sqrt(dx * dx + dy * dy); if (q < d1) { d2 = d1; d1 = q; } else if (q < d2) d2 = q; }
      return Math.min(1, (d2 - d1) * d.w * 0.3);
    }
    const ca = Math.cos(d.a), sa = Math.sin(d.a), u = x * ca + y * sa, w = -x * sa + y * ca;
    const tri = Math.abs((((w * d.f) % 2) + 2) % 2 - 1) * 2 - 1;
    return Math.cos(d.k * (u + d.amp * tri));
  }

  private grid(d: any) {
    const C = this.C, N = 150, L = 1.15, cs = (2 * L) / N, D: Float32Array = d.grid && d.grid.length === N * N ? d.grid : new Float32Array(N * N);
    D.fill(1e6);
    const sc = Math.min(1, C.ax || 1, C.ay || 1) * 0.86, ph = d.ph + (performance.now() / 1000) * d.drift, S = 4200;
    for (let s = 0; s < S; s++) {
      const t = (s / S) * 6.2832;
      let px, py;
      if (d.type === 'J') { px = Math.sin(d.a * t + ph); py = Math.sin(d.b * t); }
      else { const k = d.k * d.dir; px = (Math.cos(t) + d.c * Math.cos(k * t + ph)) / (1 + d.c); py = (Math.sin(t) + d.c * Math.sin(k * t + ph)) / (1 + d.c); }
      const gx = Math.floor((px * sc + L) / cs), gy = Math.floor((py * sc + L) / cs);
      if (gx >= 0 && gy >= 0 && gx < N && gy < N) D[gy * N + gx] = 0;
    }
    const nb = (i: number, j: number, w: number) => { if (D[j] + w < D[i]) D[i] = D[j] + w; };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x; if (x) nb(i, i - 1, 1); if (y) { nb(i, i - N, 1); if (x) nb(i, i - N - 1, 1.414); if (x < N - 1) nb(i, i - N + 1, 1.414); } }
    for (let y = N - 1; y >= 0; y--) for (let x = N - 1; x >= 0; x--) { const i = y * N + x; if (x < N - 1) nb(i, i + 1, 1); if (y < N - 1) { nb(i, i + N, 1); if (x < N - 1) nb(i, i + N + 1, 1.414); if (x) nb(i, i + N - 1, 1.414); } }
    d.grid = D; d.gN = N; d.gL = L; d.gcs = cs;
  }

  private inside(env: string, x: number, y: number, slack = 1) {
    const C = this.C, ax = C.ax || 1, ay = C.ay || 1, s = slack;
    if (env === 'curve') return true;
    if (env === 'square') return Math.abs(x) < ax * 0.94 * s && Math.abs(y) < ay * 0.94 * s;
    const r2 = x * x + y * y;
    if (env === 'ring') return r2 < s * s && r2 > (0.42 * 0.42) / s;
    if (env === 'twin') {
      const hz = ax >= ay, ox = hz ? Math.min(0.55, ax * 0.5) : 0, oy = hz ? 0 : Math.min(0.55, ay * 0.5), rr = 0.5 * s;
      return (x - ox) * (x - ox) + (y - oy) * (y - oy) < rr * rr || (x + ox) * (x + ox) + (y + oy) * (y + oy) < rr * rr;
    }
    return r2 < s * s;
  }

  private sample(env: string): [number, number] {
    const C = this.C, bx = Math.max(1, C.ax || 1), by = Math.max(1, C.ay || 1);
    for (let k = 0; k < 30; k++) { const x = (Math.random() * 2 - 1) * bx, y = (Math.random() * 2 - 1) * by; if (this.inside(env, x, y)) return [x, y]; }
    return [0, 0];
  }

  private field(x: number, y: number) {
    const C = this.C, sc = 1 + 0.45 * (C.loud || 0), ca = C.ca == null ? 1 : C.ca, sa = C.sa || 0;
    const X = (x * ca - y * sa) * sc, Y = (x * sa + y * ca) * sc;
    const t = C.tr >= 1 || !C.prev ? 1 : C.tr * C.tr * (3 - 2 * C.tr);
    let f = this.F(C.cur, X, Y);
    if (t < 1) f = f * t + this.F(C.prev, X, Y) * (1 - t);
    return f;
  }

  private newMode() {
    const C = this.C;
    C.prev = C.cur || null;
    C.cur = this.rand();
    C.tr = C.prev ? 0 : 1;
    const ty = C.cur.type;
    if (ty === 'J' || ty === 'Q') this.grid(C.cur);
    C.spinT = Math.random() < 0.25 ? 0 : (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.4);
    if ((ty === 'L' || ty === 'T') && Math.random() < 0.7) C.spinT = 0;
    C.burst = C.prev ? 1 : 0;
    if (!C.MX || C.MX.length !== C.N) { C.MX = new Float32Array(C.N); C.MY = new Float32Array(C.N); C.MF = new Uint8Array(C.N); }
    const MX = C.MX, MY = C.MY!, MF = C.MF!;
    for (let i = 0; i < C.N; i++) {
      if (!isFinite(C.X[i]) || !isFinite(C.Y[i])) { C.X[i] = (Math.random() * 2 - 1) * 0.5; C.Y[i] = (Math.random() * 2 - 1) * 0.5; }
      MF[i] = 0;
      if (C.burst && !this.inside(C.cur.env, C.X[i], C.Y[i])) { const p = this.sample(C.cur.env); MX[i] = p[0]; MY[i] = p[1]; MF[i] = 1; }
    }
  }

  private fill(ax: number, ay: number, rate: number) {
    const C = this.C, X = C.X, Y = C.Y;
    for (let i = 0; i < C.N; i++) {
      const tx = C.FX[i] * ax, ty = C.FY[i] * ay;
      X[i] += (tx - X[i]) * rate + (Math.random() - 0.5) * 0.002;
      Y[i] += (ty - Y[i]) * rate + (Math.random() - 0.5) * 0.002;
    }
  }

  private step(en: number, calm = 1) {
    const C = this.C, X = C.X, Y = C.Y;
    if (!C.cur) this.newMode();
    if (C.tr < 1) C.tr = Math.min(1, C.tr + 0.007);
    // ease-out onset: sand settles into the first pattern over ~3.5s instead of snapping
    C.formT = Math.min(1, (C.formT == null ? 1 : C.formT) + 1 / 210);
    const fk = 1 - Math.pow(1 - C.formT, 3);
    // one full turn per 128 beats of the station's tempo: always slow, no beat surges
    const bpm = Math.min(180, Math.max(60, C.tempo || C.bpm || 100)), w = ((bpm / 60) * 6.2832) / 128 / 60;
    C.spin = (C.spin || 0) + ((C.spinT || 0) * w - (C.spin || 0)) * 0.006;
    C.ang = (C.ang || 0) + C.spin * (0.5 + 0.5 * calm);
    C.ca = Math.cos(C.ang);
    C.sa = Math.sin(C.ang);
    const cur = C.cur;
    if ((cur.type === 'J' || cur.type === 'Q') && calm > 0.2 && (C.gf = (C.gf || 0) + 1) % 10 === 0) this.grid(cur);
    const env = cur.env, radial = env === 'disc' || env === 'ring', bu = C.burst || 0, bt = C.beat || 0;
    C.burst = bu > 0.02 ? bu * 0.968 : 0;
    const base = (0.0007 + 0.0045 * bt * fk) * calm, amp = (0.014 + 0.022 * en) * calm * (0.25 + 0.75 * fk), eta = 0.0045 * calm * (1 - 0.75 * bu) * (0.06 + 0.94 * fk), hh = 0.003;
    const MX = C.MX!, MY = C.MY!, MF = C.MF!;
    for (let i = 0; i < C.N; i++) {
      const x = X[i], y = Y[i];
      if (bu > 0.04 && MF[i]) {
        X[i] += (MX[i] - x) * 0.05 + (Math.random() - 0.5) * 0.02 * bu;
        Y[i] += (MY[i] - y) * 0.05 + (Math.random() - 0.5) * 0.02 * bu;
        continue;
      }
      const A = this.field(x, y), gx = (this.field(x + hh, y) - A) / hh, gy = (this.field(x, y + hh) - A) / hh;
      const ins = this.inside(env, x, y), r2 = x * x + y * y;
      const shake = Math.min(1, Math.abs(A)) * (radial ? 0.75 + 0.6 * r2 : 1) * (ins ? 1 : 3);
      const s = base + amp * shake + 0.016 * bu;
      let dx = -A * gx, dy = -A * gy;
      const dm = Math.sqrt(dx * dx + dy * dy);
      if (dm > 1e-6) { const k = (eta * Math.min(1, dm / 4)) / dm; dx *= k; dy *= k; } else { dx = 0; dy = 0; }
      let nx = x + (Math.random() - 0.5) * s * 2 + dx, ny = y + (Math.random() - 0.5) * s * 2 + dy;
      if (bu < 0.05 && !this.inside(env, nx, ny, 1.12)) { const p = this.sample(env); nx = p[0]; ny = p[1]; }
      else if (bu >= 0.05 && !this.inside(env, nx, ny, 1.12)) { nx = x * 0.98; ny = y * 0.98; }
      if (!isFinite(nx) || !isFinite(ny)) { const p = this.sample(env); nx = p[0]; ny = p[1]; }
      X[i] = nx;
      Y[i] = ny;
    }
  }

  private energy(now: number, key: string) {
    const C = this.C;
    let beat = false, lvl: number;
    const rms = this.host.readRms();
    if (rms != null) {
      this.avg = (this.avg || rms) * 0.95 + rms * 0.05;
      if (rms > this.avg * 1.3 && rms > 0.02 && now - C.last > 260) beat = true;
      lvl = Math.min(1, rms * 3.2);
    } else {
      if (C.key !== key) { let hs = 0; for (let i = 0; i < key.length; i++) hs = (hs * 31 + key.charCodeAt(i)) | 0; C.key = key; C.bpm = 84 + (Math.abs(hs) % 48); }
      const iv = 60000 / C.bpm;
      if (now - C.last >= iv) beat = Math.random() > 0.12 || now - C.last > iv * 1.9;
      lvl = 0.28 + 0.12 * Math.sin(now / 900);
    }
    if (beat) {
      const biv = now - C.last;
      if (biv > 300 && biv < 1500) C.tempo = C.tempo ? C.tempo * 0.9 + (60000 / biv) * 0.1 : 60000 / biv;
      C.last = now;
      C.beat = 0.6 + Math.random() * 0.4;
      C.beats++;
      if (C.beat > 0.85 && Math.random() < 0.18 && now > (C.abNext || 0)) { C.abT = performance.now(); C.abW = 0.7 + Math.random() * 0.8; C.abA = Math.random() * 6.2832; C.abNext = now + 4000 + Math.random() * 6000; }
    }
    if (!C.modeAt) C.modeAt = now;
    if (now - C.modeAt > 10000) { C.modeAt = now; this.newMode(); }
    C.beat *= 0.9;
    C.loud = (C.loud || 0) * 0.985 + Math.min(1, lvl * 1.6) * 0.015;
    return Math.min(1, lvl * 0.6 + C.beat * 0.9);
  }

  /** Call once per animation frame. */
  tick(now: number) {
    const cv = this.canvas;
    if (!cv || document.hidden || !cv.offsetParent) return;
    const W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    const S = this.host.frameState(), on = S.playing && !S.loading, C = this.C;
    const R = this.radius(W, H, S.wide), ax = W / 2 / R, ay = H / 2 / R;
    C.ax = ax;
    C.ay = ay;
    if (!C.placed) { for (let i = 0; i < C.N; i++) { C.X[i] = C.FX[i] * ax; C.Y[i] = C.FY[i] * ay; } C.placed = true; C.idx = S.idx; }
    const tnow = now || performance.now();
    if (C.idx !== S.idx) {
      C.idx = S.idx; C.mode = 'fill'; C.idle = 0; C.holdUntil = tnow + 900;
      if (S.named) this.host.setNamed(false);
    }
    if (on && C.mode !== 'pattern' && tnow >= (C.holdUntil || 0)) { C.mode = 'pattern'; C.modeAt = 0; C.formedAt = tnow + 2600; this.newMode(); C.tr = 1; C.formT = 0; }
    if (C.mode === 'pattern' && !S.named && tnow >= (C.formedAt || 0)) this.host.setNamed(true);
    if (C.mode === 'fill' && S.named) this.host.setNamed(false);
    let active = true;
    if (C.mode === 'fill') {
      C.en = 0;
      C.idle = on ? 0 : (C.idle || 0) + 1;
      if (C.idle > 150) active = false;
      else this.fill(ax, ay, 0.045);
    } else if (on) { C.en = this.energy(tnow, S.key); C.idle = 0; this.step(C.en); }
    else if (S.loading) { C.en = 0.15; C.idle = 0; this.step(C.en); }
    else {
      C.en *= 0.9;
      C.idle = (C.idle || 0) + 1;
      const calm = Math.max(0, 1 - C.idle / 360);
      if (calm <= 0) active = false;
      else this.step(C.en, calm * 0.5);
    }
    const key = W + 'x' + H + '|' + S.wide;
    if (!active && this.flatCv === cv && this.flatKey === key) return;
    if (!active) { this.flatCv = cv; this.flatKey = key; } else this.flatCv = null;
    this.draw(cv, S.wide);
  }

  private draw(cv: HTMLCanvasElement, wide: boolean) {
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    const pw = Math.round(W * dpr), ph = Math.round(H * dpr);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    const c = cv.getContext('2d');
    if (!c) return;
    const C = this.C;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    const R = this.radius(W, H, wide) * (1 + 0.035 * (C.beat || 0)), cx = W / 2, cy = H / 2, Pth = new Path2D();
    const ink = WAVE_COLOR === 'accent' ? ACCENT : INK;
    const age = C.abT ? (performance.now() - C.abT) / 1000 : 99, live = ABERRATION && age < 1.1;
    if (!live) {
      for (let i = 0; i < C.N; i++) Pth.rect(cx + C.X[i] * R - 0.8, cy + C.Y[i] * R - 0.8, 1.6, 1.6);
      c.fillStyle = ink;
      c.fill(Pth);
      return;
    }
    const ring = (age / 0.85) * 1.15, env = Math.sin(Math.min(1, age / 1.1) * Math.PI);
    const A = new Path2D(), B = new Path2D(), G = new Path2D(), cw = C.abW || 1;
    for (let i = 0; i < C.N; i++) {
      const x = C.X[i], y = C.Y[i], r = Math.sqrt(x * x + y * y) || 1e-4, px = cx + x * R - 0.8, py = cy + y * R - 0.8;
      const q = r - ring, band = Math.exp(-(q * q) / (0.018 * cw)) * env;
      if (band < 0.06) { Pth.rect(px, py, 1.6, 1.6); continue; }
      const sw = Math.sin(r * 22 + (C.abA || 0)) * 0.35, ux = x / r, uy = y / r;
      const ox = (ux - uy * sw) * band * 6, oy = (uy + ux * sw) * band * 6;
      A.rect(px + ox, py + oy, 1.6, 1.6);
      B.rect(px - ox, py - oy, 1.6, 1.6);
      G.rect(px + ox * 0.25, py + oy * 0.25, 1.6, 1.6);
    }
    c.fillStyle = ink;
    c.fill(Pth);
    // dark theme: additive RGB split
    c.globalCompositeOperation = 'screen';
    c.fillStyle = '#FF2A1F'; c.fill(A);
    c.fillStyle = '#2A5BFF'; c.fill(B);
    c.fillStyle = '#22FF5A'; c.fill(G);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
  }
}
