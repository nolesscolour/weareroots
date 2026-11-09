import { useEffect, useState } from 'react';
import { RootsController } from './controller/RootsController';
import { RootsContext, useRoots } from './controller/context';
import { Cymatics } from './engine/cymatics';
import { ListPanel } from './components/ListPanel';
import { Player } from './components/Player';
import { SettingsSheet } from './components/SettingsSheet';
import { Splash } from './components/Splash';
import { Toast } from './components/Toast';

function Screens({ cymatics }: { cymatics: Cymatics }) {
  const { view, wide } = useRoots();
  // desktop keeps the player visible behind the list panel; phone swaps screens
  const showPlayer = view === 'player' || view === 'settings' || (view === 'list' && wide);
  return (
    <>
      {view === 'splash' && <Splash />}
      {showPlayer && <Player cymatics={cymatics} />}
      {view === 'list' && <ListPanel />}
      {view === 'settings' && <SettingsSheet />}
      <Toast />
    </>
  );
}

export function App() {
  const [ctl] = useState(() => new RootsController());
  const [cymatics] = useState(
    () =>
      new Cymatics({
        frameState: () => {
          const S = ctl.state;
          return { playing: S.playing, loading: S.loading, idx: S.idx, named: S.named, wide: S.wide, key: ctl.cur()?.name ?? '' };
        },
        setNamed: (v) => {
          if (ctl.state.named !== v) ctl.setState({ named: v });
        },
        readRms: () => ctl.readRms(),
      }),
  );

  useEffect(() => {
    ctl.mount();
    return () => ctl.unmount();
  }, [ctl]);

  return (
    <RootsContext.Provider value={ctl}>
      <Screens cymatics={cymatics} />
    </RootsContext.Provider>
  );
}
