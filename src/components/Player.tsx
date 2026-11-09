import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { useController, useRoots } from '../controller/context';
import type { Cymatics } from '../engine/cymatics';
import { SleepAndSource } from './SleepAndSource';

const chev = (
  <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="var(--fg)" strokeWidth="1.6" style={{ flex: '0 0 auto' }} aria-hidden="true">
    <path d="M1 1l5 5-5 5" />
  </svg>
);

const rowBtn = (area: string): CSSProperties => ({
  gridArea: area, minWidth: 0, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  gap: 12, padding: '0 16px 0 18px', borderRadius: 16, background: 'var(--chip)',
});
const rowLabel: CSSProperties = { fontSize: 17, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--fg)' };
const rowValue: CSSProperties = { fontSize: 15, letterSpacing: '-.01em', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const ctlBtn: CSSProperties = { height: 100, borderRadius: 16, background: 'var(--chip)', display: 'flex', alignItems: 'center', justifyContent: 'center' };

export function Player({ cymatics }: { cymatics: Cymatics }) {
  const ctl = useController();
  const S = useRoots();
  const { wide } = S;
  const waveRef = useRef<HTMLCanvasElement>(null);
  const volRect = useRef<DOMRect | null>(null);

  useEffect(() => {
    cymatics.attach(waveRef.current);
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      cymatics.tick(now);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      cymatics.attach(null);
    };
  }, [cymatics]);

  const s = ctl.cur();
  const vol = Math.round(S.vol * 100);
  const volAt = (x: number) => {
    const r = volRect.current;
    if (r && r.width) ctl.setVol((x - r.left) / r.width);
  };
  const onVolDown = (e: PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    volRect.current = el.getBoundingClientRect();
    el.setPointerCapture?.(e.pointerId);
    volAt(e.clientX);
  };
  const onVolKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const k = e.key;
    let v: number | null = null;
    if (k === 'ArrowLeft' || k === 'ArrowDown') v = S.vol - 0.05;
    else if (k === 'ArrowRight' || k === 'ArrowUp') v = S.vol + 0.05;
    else if (k === 'Home') v = 0;
    else if (k === 'End') v = 1;
    if (v == null) return;
    e.preventDefault();
    e.stopPropagation();
    ctl.setVol(v);
  };

  return (
    <main
      style={{
        position: 'absolute', inset: 0, display: 'grid', gap: 8, background: 'var(--surface)', boxSizing: 'border-box',
        gridTemplateColumns: wide ? 'minmax(0,1fr) 20px 200px 200px' : 'minmax(0,1fr)',
        gridTemplateRows: wide ? '88px 64px minmax(0,1fr) auto 44px' : '88px 64px 64px minmax(0,1fr) auto 44px',
        gridTemplateAreas: wide ? "'card . head head' 'card . loc gen' 'card . set set' 'card . ctl ctl' 'card . vol vol'" : "'head' 'loc' 'gen' 'card' 'ctl' 'vol'",
        padding: wide ? '36px 40px 40px' : '52px 20px 26px',
      }}
    >
      <header style={{ gridArea: 'head', position: 'relative', height: 66, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
          <h1 style={{ margin: 0, fontFamily: "'DotGothic16', monospace", fontWeight: 400, fontSize: 42, lineHeight: 0.9, color: 'var(--fg)' }}>Roots</h1>
          <div aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--accent)', marginBottom: 5, animation: 'rootsPulse 2.6s ease-in-out infinite' }} />
        </div>
        {!wide && (
          <button
            type="button"
            className="btn"
            onClick={ctl.openSettings}
            aria-label="Settings"
            style={{ position: 'absolute', right: -10, top: '50%', marginTop: -22, width: 44, height: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <span style={{ width: 16, height: 1.6, background: 'var(--fg)' }} />
            <span style={{ width: 16, height: 1.6, background: 'var(--fg)' }} />
          </button>
        )}
      </header>

      <button type="button" className="btn" onClick={() => ctl.openList('location')} style={rowBtn('loc')}>
        <span style={rowLabel}>Location</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={rowValue}>{S.fc || 'Anywhere'}</span>
          {chev}
        </span>
      </button>
      <button type="button" className="btn" onClick={() => ctl.openList('genre')} style={rowBtn('gen')}>
        <span style={rowLabel}>Genre</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={rowValue}>{S.fg || 'All'}</span>
          {chev}
        </span>
      </button>

      {wide && (
        <div style={{ gridArea: 'set', alignSelf: 'end', display: 'flex', flexDirection: 'column', gap: 16, padding: '0 2px 16px' }}>
          <SleepAndSource showNote />
        </div>
      )}

      <section aria-label="Now playing" style={{ gridArea: 'card', minHeight: 0, position: 'relative', borderRadius: 22, background: 'var(--chip)', overflow: 'hidden' }}>
        <canvas ref={waveRef} aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', display: 'block' }} />
        <p
          aria-live="polite"
          style={{
            position: 'relative', margin: 0, padding: wide ? '30px 32px 0' : '22px 20px 0', fontSize: wide ? 38 : 26, fontWeight: 700,
            letterSpacing: '-.04em', lineHeight: 1.08, color: 'var(--fg)', textWrap: 'balance', transition: 'opacity .9s ease', opacity: S.named ? 1 : 0,
          }}
        >
          {ctl.place(s)}
        </p>
        <span className="sr-only">{s.name}</span>
      </section>

      <div style={{ gridArea: 'ctl', display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
        <button type="button" className="btn" onClick={() => ctl.step(-1)} aria-label="Previous station" style={ctlBtn}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--fg)" aria-hidden="true"><path d="M7 5h2.4v14H7z" /><path d="M19 5v14L9.6 12z" /></svg>
        </button>
        <button
          type="button"
          className="btn"
          onClick={ctl.togglePlay}
          aria-pressed={S.playing}
          style={{ ...ctlBtn, background: 'var(--inv)', color: 'var(--invfg)', fontSize: 16, fontWeight: 600, letterSpacing: '-.01em' }}
        >
          {S.loading ? 'Tuning…' : S.playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" className="btn" onClick={() => ctl.step(1)} aria-label="Next station" style={ctlBtn}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--fg)" aria-hidden="true"><path d="M14.6 5H17v14h-2.4z" /><path d="M5 5v14l9.4-7z" /></svg>
        </button>
      </div>

      <div
        role="slider"
        tabIndex={0}
        className="slider"
        aria-label="Volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={vol}
        onPointerDown={onVolDown}
        onPointerMove={(e) => volRect.current && volAt(e.clientX)}
        onPointerUp={() => (volRect.current = null)}
        onPointerCancel={() => (volRect.current = null)}
        onKeyDown={onVolKey}
        style={{ gridArea: 'vol', position: 'relative', height: 44, borderRadius: 14, background: 'var(--chip)', overflow: 'hidden', cursor: 'pointer', touchAction: 'none' }}
      >
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: vol + '%', background: 'var(--inv)' }} />
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ position: 'absolute', left: 14, top: 13, mixBlendMode: 'difference', pointerEvents: 'none' }}>
          <path d="M3 9h4l5-4v14l-5-4H3z" fill="#FFFFFF" />
          <path d="M16 8.5a5 5 0 0 1 0 7" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>
    </main>
  );
}
