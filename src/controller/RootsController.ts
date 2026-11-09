import { PHONE_MAX, SHOW_SPLASH, WAVE_SOURCE } from '../config';
import { demoStations } from '../data/demo';
import { fetchDirectory, pingPlay } from '../data/directory';
import { readVolume, writeVolume } from '../lib/storage';
import type { ListKind, RootsState, Station } from '../types';

interface Graph {
  ctx: AudioContext;
  an: AnalyserNode;
  g: GainNode;
  buf: Uint8Array<ArrayBuffer>;
}

type Listener = () => void;
type Handlers = Record<'error' | 'playing' | 'waiting' | 'pause' | 'stalled', () => void>;

/**
 * All app logic lives here (station directory, tuning, audio, sleep timer, keyboard).
 * React components only render `state` and call these methods, so the audio engine
 * survives re-renders and React StrictMode double-mounts untouched.
 */
export class RootsController {
  state: RootsState;
  private listeners = new Set<Listener>();
  private mounted = false;

  private host = '';
  private loadingDir = false;
  private pending: { dir: Station[]; note: string } | null = null;
  private pinged = '';
  private toastTimer = 0;
  private sleepTimer = 0;

  // audio: `ap` plays plain, `ax` is routed through an analyser when the stream allows CORS
  private ap: HTMLAudioElement | null = null;
  private ax: HTMLAudioElement | null = null;
  private audio: HTMLAudioElement | null = null;
  private handlers = new Map<HTMLAudioElement, Handlers>();
  private graphObj: Graph | null = null;
  private noGraph = false;
  private noCors: Record<string, 1> = {};
  private want = false;
  private liveOn = false;
  private url = '';
  private st: Station | null = null;
  private retried = false;
  private token = 0;
  /** consecutive silent analyser frames; after ~90 the visualiser falls back to simulation */
  private zf = 0;

  constructor() {
    const wide = typeof window !== 'undefined' && window.innerWidth >= PHONE_MAX;
    const demo = demoStations();
    this.state = {
      wide,
      view: SHOW_SPLASH ? 'splash' : 'player',
      kind: 'location',
      idx: Math.max(0, demo.findIndex((s) => s.name === 'Radio Oro Marbella')),
      playing: false,
      loading: false,
      named: false,
      fc: null,
      fg: null,
      q: '',
      searchOpen: false,
      toast: '',
      dir: [],
      live: false,
      booting: false,
      dirNote: '',
      vol: readVolume(),
      sleepAt: 0,
      sleepMin: 0,
    };
  }

  // ---------- store ----------
  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  getState = () => this.state;
  setState(patch: Partial<RootsState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  // ---------- lifecycle ----------
  mount() {
    if (this.mounted) return;
    this.mounted = true;
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKey);
    this.onResize();
    if (!this.ap) {
      this.ap = this.bindEl(new Audio(), this.state.vol);
      this.ax = this.bindEl(new Audio(), 1);
      this.ax.crossOrigin = 'anonymous';
      this.audio = this.ap;
    }
    this.sleepTimer = window.setInterval(() => {
      const at = this.state.sleepAt;
      if (at && Date.now() >= at) {
        this.setState({ sleepAt: 0, sleepMin: 0 });
        this.stop();
        this.say('Sleep timer — radio off');
      }
    }, 15000);
    if (!this.state.live) void this.loadDirectory();
  }

  unmount() {
    if (!this.mounted) return;
    this.mounted = false;
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKey);
    clearInterval(this.sleepTimer);
    clearTimeout(this.toastTimer);
    [this.ap, this.ax].forEach((x) => {
      try {
        x?.pause();
      } catch {
        /* ignore */
      }
    });
  }

  private onResize = () => {
    const wide = window.innerWidth >= PHONE_MAX;
    if (wide !== this.state.wide) this.setState({ wide });
  };

  // ---------- stations ----------
  get stations(): Station[] {
    return this.state.dir.length ? this.state.dir : demoStations();
  }
  matches(fc: string | null, fg: string | null) {
    return this.stations.filter((s) => (!fc || s.country === fc) && (!fg || s.family === fg));
  }
  pool() {
    const l = this.matches(this.state.fc, this.state.fg);
    return l.length ? l : this.stations;
  }
  cur(): Station {
    return this.stations[this.state.idx] ?? this.stations[0];
  }
  place(s: Station) {
    const c = s.country && s.country !== '—' ? s.country : '';
    if (s.city && s.city !== c) return c ? s.city + ', ' + c : s.city;
    return c || s.name || 'Somewhere';
  }

  async loadDirectory(manual = false) {
    if (this.loadingDir) return;
    this.loadingDir = true;
    this.setState({ booting: true });
    if (manual) this.say('Scanning the dial…');
    let res;
    try {
      res = await fetchDirectory();
    } catch {
      res = { ok: false as const, note: 'Directory unreachable — offline demo set' };
    }
    this.loadingDir = false;
    if (!res.ok) {
      this.setState({ booting: false, dirNote: res.note });
      if (manual) this.say('Could not reach the directory');
      return;
    }
    this.host = res.host;
    if (this.state.playing || this.state.loading) {
      this.pending = { dir: res.dir, note: res.note };
      this.setState({ booting: false });
      return;
    }
    this.adoptDir(res.dir, res.note);
  }

  private adoptDir(dir: Station[], note: string): Station {
    const { fc, fg } = this.state;
    const f = dir.filter((s) => (!fc || s.country === fc) && (!fg || s.family === fg));
    const pool = f.length ? f : dir;
    const best = pool.reduce((a, b) => (b.votes > a.votes ? b : a), pool[0]);
    this.setState({ dir, live: true, booting: false, dirNote: note, idx: best.id, fc: f.length ? fc : null, fg: f.length ? fg : null });
    return best;
  }

  private flushPending(): Station | null {
    if (!this.pending) return null;
    const p = this.pending;
    this.pending = null;
    return this.adoptDir(p.dir, p.note);
  }

  private ping(s: Station) {
    if (!this.state.live || !s.uuid || !this.host || this.pinged === s.uuid) return;
    this.pinged = s.uuid;
    pingPlay(this.host, s.uuid);
  }

  // ---------- ui ----------
  say(msg: string, ms = 2400) {
    clearTimeout(this.toastTimer);
    this.setState({ toast: msg });
    this.toastTimer = window.setTimeout(() => this.setState({ toast: '' }), ms);
  }
  enter = () => this.setState({ view: 'player' });
  openList = (kind: ListKind) => this.setState({ view: 'list', kind, q: '', searchOpen: false });
  openSettings = () => this.setState({ view: 'settings' });
  closeOverlay = () => this.setState({ view: 'player', q: '', searchOpen: false });
  toggleSearch = () => this.setState({ searchOpen: !this.state.searchOpen, q: '' });
  setQuery = (q: string) => this.setState({ q: q.slice(0, 80) });

  // ---------- audio ----------
  private bindEl(a: HTMLAudioElement, vol: number): HTMLAudioElement {
    a.preload = 'none';
    const old = this.handlers.get(a);
    if (old) (Object.keys(old) as (keyof Handlers)[]).forEach((k) => a.removeEventListener(k, old[k]));
    const mine = () => a === this.audio;
    const h: Handlers = {
      error: () => {
        if (!mine()) return;
        if (this.liveOn) this.toPlain();
        else this.onStreamError();
      },
      playing: () => {
        if (!mine()) return;
        this.retried = false;
        this.setState({ playing: true, loading: false });
      },
      waiting: () => {
        if (mine() && (this.state.playing || this.state.loading)) this.setState({ loading: true });
      },
      pause: () => {
        if (!mine() || (this.want && a.readyState < 3)) return;
        this.want = false;
        this.setState({ playing: false, loading: false });
      },
      stalled: () => {
        if (mine() && this.state.playing) this.onStreamError();
      },
    };
    (Object.keys(h) as (keyof Handlers)[]).forEach((k) => a.addEventListener(k, h[k]));
    this.handlers.set(a, h);
    a.volume = vol;
    return a;
  }

  private graph(): Graph | null {
    if (this.graphObj || this.noGraph || !this.ax) return this.graphObj;
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) {
      this.noGraph = true;
      return null;
    }
    try {
      try {
        const nav = navigator as unknown as { audioSession?: { type: string } };
        if (nav.audioSession) nav.audioSession.type = 'playback';
      } catch {
        /* ignore */
      }
      const ctx = new AC();
      const src = ctx.createMediaElementSource(this.ax);
      const an = ctx.createAnalyser();
      const g = ctx.createGain();
      an.fftSize = 1024;
      src.connect(an);
      src.connect(g);
      g.connect(ctx.destination);
      this.graphObj = { ctx, an, g, buf: new Uint8Array(new ArrayBuffer(an.fftSize)) };
    } catch {
      this.noGraph = true;
    }
    return this.graphObj;
  }

  start(s: Station | null | undefined, url?: string) {
    if (!this.ap || !this.ax || !s) return;
    const src = url || s.url;
    const token = ++this.token;
    const G = WAVE_SOURCE !== 'simulated' && !this.noCors[src] ? this.graph() : null;
    const a = G ? this.ax : this.ap;
    const other = G ? this.ap : this.ax;
    this.want = true;
    this.liveOn = !!G;
    this.url = src;
    this.st = s;
    this.zf = 0;
    this.audio = a;
    this.setState({ loading: true });
    try {
      other.pause();
      if (other.getAttribute('src')) {
        other.removeAttribute('src');
        other.load();
      }
    } catch {
      /* ignore */
    }
    try {
      a.pause();
    } catch {
      /* ignore */
    }
    if (G) {
      G.g.gain.value = this.state.vol;
      if (G.ctx.state === 'suspended') G.ctx.resume().catch(() => {});
    } else a.volume = this.state.vol;
    a.removeAttribute('src');
    a.load();
    a.src = src;
    a.load();
    this.ping(s);
    this.mediaSession(s);
    a.play().catch((err: unknown) => {
      const n = err instanceof Error || err instanceof DOMException ? err.name : '';
      if (token !== this.token || n === 'AbortError') return;
      if (this.liveOn && n !== 'NotAllowedError') return this.toPlain();
      this.want = false;
      this.setState({ playing: false, loading: false });
      this.say(n === 'NotAllowedError' ? 'Tap Play to start the radio' : 'This stream will not open in the browser — try another station');
    });
  }

  private toPlain() {
    if (!this.want) return;
    this.noCors[this.url] = 1;
    this.start(this.st, this.url);
  }

  stop() {
    this.token++;
    this.want = false;
    [this.ap, this.ax].forEach((x) => {
      try {
        if (!x) return;
        x.pause();
        if (x.getAttribute('src')) {
          x.removeAttribute('src');
          x.load();
        }
      } catch {
        /* ignore */
      }
    });
    this.setState({ playing: false, loading: false });
    setTimeout(() => this.flushPending(), 60);
  }

  togglePlay = () => {
    if (this.want) this.stop();
    else this.start(this.cur());
  };

  private onStreamError() {
    if (!this.want) return;
    const s = this.st ?? this.cur();
    if (!this.retried) {
      this.retried = true;
      this.say('Signal dropped — retrying…');
      const alt = s.fallback && s.fallback !== s.url ? s.fallback : s.url;
      setTimeout(() => {
        if (this.want) this.start(s, alt);
      }, 900);
    } else {
      this.retried = false;
      this.say('Unavailable here — tuning to the next station');
      this.step(1);
    }
  }

  private tune(i: number, play = false) {
    const s = this.stations[i];
    if (!s) return;
    this.retried = false;
    const on = this.want;
    this.setState({ idx: i });
    if (play || on) this.start(s);
    else this.mediaSession(s);
  }

  step = (dir: number) => {
    const b = this.flushPending();
    if (b) {
      if (this.want) this.start(b);
      return;
    }
    const p = this.pool();
    const at = p.findIndex((s) => s.id === this.state.idx);
    const nx = at < 0 ? 0 : (at + dir + p.length) % p.length;
    if (p[nx]) this.tune(p[nx].id);
  };

  applyFilter(patch: { fc?: string | null; fg?: string | null }) {
    const S = this.state;
    let fc = 'fc' in patch ? (patch.fc ?? null) : S.fc;
    let fg = 'fg' in patch ? (patch.fg ?? null) : S.fg;
    let list = this.matches(fc, fg);
    if (!list.length) {
      this.say('fc' in patch ? 'No ' + fg + ' in ' + fc + ' — genre reset' : 'No ' + fg + ' in ' + fc + ' — location reset');
      if ('fc' in patch) fg = null;
      else fc = null;
      list = this.matches(fc, fg);
    }
    this.setState({ view: 'player', q: '', searchOpen: false, fc, fg });
    if (!list.length || list.some((x) => x.id === S.idx)) return;
    const best = list.reduce((a, b) => (b.votes > a.votes ? b : a), list[0]);
    this.tune(best.id);
  }

  private mediaSession(s: Station) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || typeof MediaMetadata !== 'function') return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: s.name,
        artist: this.place(s),
        album: 'Roots',
        artwork: s.favicon ? [{ src: s.favicon, sizes: '512x512' }] : [],
      });
      navigator.mediaSession.setActionHandler('play', () => this.start(this.cur()));
      navigator.mediaSession.setActionHandler('pause', () => this.stop());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.step(-1));
      navigator.mediaSession.setActionHandler('nexttrack', () => this.step(1));
    } catch {
      /* ignore */
    }
  }

  setVol = (v: number) => {
    const vol = Math.min(1, Math.max(0, Number.isFinite(v) ? v : 1));
    this.setState({ vol });
    if (this.ap) this.ap.volume = vol;
    if (this.graphObj) this.graphObj.g.gain.value = vol;
    writeVolume(vol);
  };

  setSleep = (min: number) => {
    if (!min) {
      this.setState({ sleepAt: 0, sleepMin: 0 });
      this.say('Sleep timer off');
      return;
    }
    this.setState({ sleepAt: Date.now() + min * 60000, sleepMin: min });
    this.say('Radio off in ' + min + ' minutes');
  };

  /** Live signal level for the visualiser, or null when it should simulate. */
  readRms(): number | null {
    const G = this.liveOn && this.audio === this.ax ? this.graphObj : null;
    if (!G || this.zf >= 90) return null;
    G.an.getByteTimeDomainData(G.buf);
    let sum = 0;
    for (let i = 0; i < G.buf.length; i += 2) {
      const d = (G.buf[i] - 128) / 128;
      sum += d * d;
    }
    const rms = Math.sqrt(sum / (G.buf.length / 2));
    this.zf = rms < 0.003 ? this.zf + 1 : 0;
    return rms;
  }

  private onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    const S = this.state;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key === 'Escape' && (S.view === 'list' || S.view === 'settings')) {
      this.closeOverlay();
      return;
    }
    if (S.view === 'splash') {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.enter();
      }
      return;
    }
    if (S.view !== 'player') return;
    // let focused buttons handle Space/Enter themselves
    if (t && t.tagName === 'BUTTON' && (e.code === 'Space' || e.key === 'Enter')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      this.togglePlay();
    } else if (e.key === 'ArrowLeft') this.step(-1);
    else if (e.key === 'ArrowRight') this.step(1);
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.setVol(S.vol + 0.1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.setVol(S.vol - 0.1);
    }
  };
}
