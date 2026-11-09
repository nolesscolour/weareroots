export type View = 'splash' | 'player' | 'list' | 'settings';
export type ListKind = 'location' | 'genre';

export interface Station {
  id: number;
  uuid: string;
  name: string;
  city: string;
  country: string;
  cc: string;
  genre: string;
  family: string;
  tags: string;
  /** https-only logo URL, or '' */
  favicon: string;
  bitrate: number;
  codec: string;
  votes: number;
  /** https-only stream URL */
  url: string;
  /** alternate stream to retry once, or '' */
  fallback: string;
  freq: number;
}

export interface RootsState {
  wide: boolean;
  view: View;
  kind: ListKind;
  idx: number;
  playing: boolean;
  loading: boolean;
  /** place name fades in once the visualiser pattern has formed */
  named: boolean;
  fc: string | null;
  fg: string | null;
  q: string;
  searchOpen: boolean;
  toast: string;
  dir: Station[];
  live: boolean;
  booting: boolean;
  dirNote: string;
  vol: number;
  sleepAt: number;
  sleepMin: number;
}
