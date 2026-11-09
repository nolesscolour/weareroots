import { useController, useRoots } from '../controller/context';

const SLEEP = [0, 15, 30, 60] as const;

/** Sleep timer chips + directory source/rescan row (desktop sidebar and phone settings sheet). */
export function SleepAndSource({ showNote }: { showNote: boolean }) {
  const ctl = useController();
  const S = useRoots();
  const note = S.booting ? 'Scanning the directory…' : S.dirNote || 'Bundled stations, no network needed';

  return (
    <>
      <div>
        <h2 id="sleep-label" style={{ fontSize: 9, letterSpacing: '.2em', fontWeight: 700, color: 'var(--muted)', margin: '0 0 8px' }}>SLEEP TIMER</h2>
        <div role="group" aria-labelledby="sleep-label" style={{ display: 'flex', gap: 6 }}>
          {SLEEP.map((n) => {
            const on = S.sleepMin === n;
            return (
              <button
                key={n}
                type="button"
                className="btn"
                aria-pressed={on}
                onClick={(e) => {
                  e.stopPropagation();
                  ctl.setSleep(n);
                }}
                style={{
                  flex: 1, textAlign: 'center', padding: '11px 0', borderRadius: 10, fontSize: 13, fontWeight: 600, letterSpacing: '-.01em',
                  background: on ? 'var(--inv)' : 'var(--chip)', color: on ? 'var(--invfg)' : 'var(--muted)',
                }}
              >
                {n ? n + 'm' : 'Off'}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTop: '1px solid var(--line)', paddingTop: showNote ? 14 : 16, marginTop: showNote ? 0 : 20 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-.015em', color: 'var(--fg)' }}>
            {(S.live ? 'Radio Browser · live' : 'Offline demo set') + ' · ' + ctl.stations.length}
          </div>
          {showNote && <div style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note}</div>}
        </div>
        <button
          type="button"
          className="btn"
          aria-label="Rescan station directory"
          disabled={S.booting}
          onClick={(e) => {
            e.stopPropagation();
            void ctl.loadDirectory(true);
          }}
          style={{ flex: '0 0 auto', padding: '11px 14px', borderRadius: 12, background: 'var(--chip)', fontSize: 10, fontWeight: 700, letterSpacing: '.16em', color: 'var(--fg)' }}
        >
          {S.booting ? '···' : 'RESCAN'}
        </button>
      </div>
    </>
  );
}
