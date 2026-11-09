import { useEffect, useRef } from 'react';
import { useController, useRoots } from '../controller/context';
import { RootsField } from '../engine/rootsField';

const MONO = 'ui-monospace, Menlo, Consolas, monospace';

export function Splash() {
  const ctl = useController();
  const { wide } = useRoots();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tagRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const fieldRef = useRef<RootsField | null>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const field = new RootsField(cv, {
      tagline: () => tagRef.current,
      cta: () => ctaRef.current,
      wide: () => ctl.state.wide,
    });
    fieldRef.current = field;
    field.start();
    return () => {
      field.destroy();
      fieldRef.current = null;
    };
  }, [ctl]);

  // tagline / ENTER sizes change with the layout: re-measure their clearings
  useEffect(() => {
    fieldRef.current?.invalidate();
  }, [wide]);

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0A0A0A', color: '#FFFFFF', overflow: 'hidden' }}>
      <h1 className="sr-only">Roots</h1>
      <canvas ref={canvasRef} aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }} />
      <p
        ref={tagRef}
        style={{
          position: 'absolute', left: '50%', top: '55%', transform: 'translateX(-50%)', margin: 0,
          fontFamily: MONO, fontSize: wide ? 18 : 13, lineHeight: 1.4, letterSpacing: '.06em', whiteSpace: 'nowrap',
          animation: 'rootsFade .7s ease 2.2s both',
        }}
      >
        Time to explore world music
      </p>
      <button
        ref={ctaRef}
        type="button"
        className="btn"
        onClick={ctl.enter}
        aria-label="Enter Roots"
        style={{
          position: 'absolute', left: 0, right: 0, bottom: wide ? 150 : 240, margin: '0 auto', width: 'max-content',
          padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'rootsFade .7s ease 2.2s both',
        }}
      >
        <span style={{ display: 'block', fontFamily: MONO, fontSize: wide ? 20 : 16, fontWeight: 600, letterSpacing: '.34em', paddingLeft: '.34em' }}>ENTER</span>
      </button>
    </div>
  );
}
