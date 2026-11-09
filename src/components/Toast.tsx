import { useRoots } from '../controller/context';

export function Toast() {
  const { toast, wide } = useRoots();
  return (
    <div role="status" aria-live="polite" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 0, pointerEvents: 'none', zIndex: 20 }}>
      {toast && (
        <div
          style={{
            position: 'absolute', left: wide ? 'auto' : 20, right: wide ? 40 : 20, width: wide ? 360 : 'auto', bottom: wide ? 200 : 186,
            background: 'var(--inv)', color: 'var(--invfg)', borderRadius: 14, padding: '12px 16px', fontSize: 13, letterSpacing: '-.01em',
            animation: 'rootsFade .2s ease', textAlign: 'center',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
