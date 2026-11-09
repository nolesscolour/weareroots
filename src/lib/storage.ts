/** localStorage can throw (private mode, blocked storage) and can hold anything: validate on read. */

const VOL_KEY = 'roots.vol';

export function readVolume(): number {
  try {
    const v = parseFloat(localStorage.getItem(VOL_KEY) ?? '');
    if (Number.isFinite(v)) return Math.min(1, Math.max(0, v));
  } catch {
    /* storage unavailable */
  }
  return 1;
}

export function writeVolume(v: number): void {
  try {
    localStorage.setItem(VOL_KEY, String(Math.min(1, Math.max(0, v))));
  } catch {
    /* storage unavailable */
  }
}
