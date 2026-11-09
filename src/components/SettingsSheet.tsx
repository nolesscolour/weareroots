import { useController, useRoots } from '../controller/context';
import { SleepAndSource } from './SleepAndSource';

/** Phone: bottom sheet. Desktop: right-hand panel (desktop shows these controls inline too). */
export function SettingsSheet() {
  const ctl = useController();
  const { wide } = useRoots();
  return (
    <div
      onClick={ctl.closeOverlay}
      style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,.34)', display: 'flex', flexDirection: wide ? 'row' : 'column',
        justifyContent: 'flex-end', zIndex: 9, animation: 'rootsFade .18s ease',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)', width: wide ? 440 : 'auto', boxSizing: 'border-box', borderRadius: wide ? 0 : '28px 28px 46px 46px',
          padding: wide ? '40px 28px' : '24px 22px 34px', animation: wide ? 'rootsSlide .28s ease' : 'rootsUp .24s ease',
        }}
      >
        <h2 id="settings-title" style={{ margin: '0 0 16px', fontSize: 22, fontWeight: 700, letterSpacing: '-.035em', color: 'var(--fg)' }}>Settings</h2>
        <SleepAndSource showNote={false} />
      </div>
    </div>
  );
}
