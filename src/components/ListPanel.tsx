import { useEffect, useMemo, useRef } from 'react';
import { ACCENT } from '../config';
import { useController, useRoots } from '../controller/context';

/** Full-screen (phone) or side panel (desktop) list of countries or genres. */
export function ListPanel() {
  const ctl = useController();
  const S = useRoots();
  const { wide } = S;
  const isLoc = S.kind === 'location';
  const sel = isLoc ? S.fc : S.fg;
  const q = S.q.trim().toLowerCase();
  const searchRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => {
    const m: Record<string, number> = {};
    for (const x of ctl.stations) {
      const k = isLoc ? x.country : x.family;
      m[k] = (m[k] || 0) + 1;
    }
    return Object.keys(m)
      .sort((a, b) => m[b] - m[a] || a.localeCompare(b))
      .filter((k) => !q || k.toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [S.dir, isLoc, q, ctl]);

  useEffect(() => {
    if (S.searchOpen) searchRef.current?.focus();
  }, [S.searchOpen]);

  const pick = (k: string | null) => ctl.applyFilter(isLoc ? { fc: k } : { fg: k });

  return (
    <>
      {wide && (
        <div
          aria-hidden="true"
          onClick={ctl.closeOverlay}
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.34)', zIndex: 7, animation: 'rootsFade .2s ease' }}
        />
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isLoc ? 'Choose country' : 'Choose genre'}
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, left: wide ? 'auto' : 0, width: wide ? 440 : 'auto', background: 'var(--surface)',
          display: 'flex', flexDirection: 'column', padding: wide ? '24px 0 0' : '52px 0 0', boxSizing: 'border-box',
          animation: wide ? 'rootsSlide .28s ease' : 'rootsUp .26s ease', boxShadow: wide ? '-20px 0 60px rgba(0,0,0,.18)' : 'none', zIndex: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 12px 10px 20px' }}>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-.035em' }}>
            <span style={{ color: 'var(--fg)' }}>Choose </span>
            <span style={{ color: 'var(--muted)' }}>{isLoc ? 'Country' : 'Genre'}</span>
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button type="button" className="btn" onClick={ctl.toggleSearch} aria-label="Search" aria-expanded={S.searchOpen} style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--fg)" strokeWidth="1.7" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21" /></svg>
            </button>
            <button type="button" className="btn" onClick={ctl.closeOverlay} aria-label="Close" style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="19" height="19" viewBox="0 0 24 24" stroke="var(--fg)" strokeWidth="1.7" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg>
            </button>
          </div>
        </div>

        {S.searchOpen && (
          <div style={{ padding: '0 20px 12px' }}>
            <label htmlFor="roots-search" className="sr-only">Search {isLoc ? 'countries' : 'genres'}</label>
            <input
              id="roots-search"
              ref={searchRef}
              type="search"
              value={S.q}
              maxLength={80}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => ctl.setQuery(e.target.value)}
              placeholder="Search"
              style={{ width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', background: 'var(--chip)', borderRadius: 12, padding: '13px 15px', fontSize: 15, fontFamily: 'inherit', color: 'var(--fg)', letterSpacing: '-.01em' }}
            />
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 20px 40px' }}>
          <button
            type="button"
            className="btn"
            onClick={() => pick(null)}
            aria-pressed={!sel}
            style={{ display: 'block', width: '100%', padding: '6px 0 10px', fontSize: 22, fontWeight: 700, letterSpacing: '-.035em', color: sel ? 'var(--muted)' : ACCENT }}
          >
            {isLoc ? 'Anywhere' : 'All genres'}
          </button>
          {items.map((k) => (
            <button
              key={k}
              type="button"
              className="btn"
              aria-pressed={sel === k}
              onClick={() => pick(sel === k ? null : k)}
              style={{ display: 'block', width: '100%', padding: '5px 0', fontSize: 34, fontWeight: 700, letterSpacing: '-.045em', lineHeight: 1.1, color: sel === k ? ACCENT : 'var(--fg)', textWrap: 'balance' }}
            >
              {k}
            </button>
          ))}
          {items.length === 0 && <p style={{ margin: 0, padding: '30px 0', fontSize: 14, color: 'var(--muted)', letterSpacing: '-.01em' }}>No matches.</p>}
        </div>
      </div>
    </>
  );
}
