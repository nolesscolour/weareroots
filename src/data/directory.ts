import type { Station } from '../types';
import { PER_FAMILY, TAGS } from './families';
import { toStationFields } from './sanitize';

/** Fixed mirror list: the app never talks to a host it wasn't built with. */
const API_HOSTS = [
  'https://all.api.radio-browser.info/json/',
  'https://de1.api.radio-browser.info/json/',
  'https://at1.api.radio-browser.info/json/',
  'https://nl1.api.radio-browser.info/json/',
] as const;

const MIN = 88;
const MAX = 108;

async function jget(url: string, ms = 7000): Promise<unknown> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!r.ok) throw new Error('http ' + r.status);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

async function pickHost(): Promise<string> {
  for (const h of API_HOSTS) {
    try {
      const r = await jget(h + 'stations/search?limit=1&hidebroken=true', 5000);
      if (Array.isArray(r)) return h;
    } catch {
      /* try next mirror */
    }
  }
  return '';
}

/** Stable pseudo FM frequency per station (the API has none). */
function hashFreq(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 100000;
  return Math.round((MIN + (h % 200) / 10) * 10) / 10;
}

type Unplaced = Omit<Station, 'id' | 'freq' | 'fallback'>;

function finalize(list: Unplaced[]): Station[] {
  const used: Record<string, 1> = {};
  return list
    .map((s) => {
      let f = hashFreq(s.uuid || s.name);
      let n = 0;
      while (used[f] && n < 200) {
        f = Math.round((f + 0.1) * 10) / 10;
        if (f > MAX) f = MIN;
        n++;
      }
      used[f] = 1;
      return { ...s, freq: f, fallback: '', id: 0 };
    })
    .sort((a, b) => a.freq - b.freq)
    .map((s, i) => ({ ...s, id: i }));
}

export type DirectoryResult =
  | { ok: true; host: string; dir: Station[]; note: string }
  | { ok: false; note: string };

export async function fetchDirectory(): Promise<DirectoryResult> {
  const host = await pickHost();
  if (!host) return { ok: false, note: 'Directory unreachable — offline demo set' };

  const jobs: Promise<{ fam: string; rows: unknown[] }>[] = [];
  for (const fam of Object.keys(TAGS)) {
    for (const tag of TAGS[fam]) {
      jobs.push(
        jget(host + 'stations/search?hidebroken=true&order=votes&reverse=true&limit=60&tag=' + encodeURIComponent(tag))
          .then((rows) => ({ fam, rows: Array.isArray(rows) ? rows : [] }))
          .catch(() => ({ fam, rows: [] })),
      );
    }
  }
  const res = await Promise.all(jobs);

  const seen: Record<string, 1> = {};
  const byFam: Record<string, Unplaced[]> = {};
  for (const g of res) {
    for (const r of g.rows) {
      const f = toStationFields(r);
      if (!f) continue;
      const key = f.name.toLowerCase() + '|' + f.cc;
      if (seen[key]) continue;
      seen[key] = 1;
      (byFam[g.fam] ??= []).push({ ...f, genre: g.fam, family: g.fam });
    }
  }

  let picked: Unplaced[] = [];
  for (const fam of Object.keys(byFam)) {
    picked = picked.concat(byFam[fam].sort((a, b) => b.votes - a.votes).slice(0, PER_FAMILY));
  }
  if (picked.length < 30) return { ok: false, note: 'Too few playable streams — offline demo set' };

  const dir = finalize(picked);
  const countries = new Set(dir.map((s) => s.country)).size;
  return { ok: true, host, dir, note: `${dir.length} stations · ${countries} countries · https only` };
}

/** Radio Browser counts plays; the UUID is validated hex so it's safe in the path. */
export function pingPlay(host: string, uuid: string): void {
  if (!host || !uuid) return;
  fetch(host + 'url/' + encodeURIComponent(uuid), { credentials: 'omit', referrerPolicy: 'no-referrer' }).catch(() => {});
}
