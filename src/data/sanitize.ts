/**
 * Everything from Radio Browser is untrusted: it is a public, user-edited directory.
 * Nothing from it is ever rendered as HTML (React escapes text), but URLs and IDs are
 * validated here before they reach <audio src>, fetch() or the OS media controls.
 */

const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩]/g;

/** Plain text: strips control and bidi-override characters, collapses whitespace, caps length. */
export function cleanText(v: unknown, max: number): string {
  if (v == null) return '';
  return String(v).replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Only absolute https URLs with a real host survive; everything else becomes ''. */
export function safeHttpsUrl(v: unknown, max = 2048): string {
  if (typeof v !== 'string') return '';
  const s = v.trim();
  if (!s || s.length > max) return '';
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' || !u.hostname || u.username || u.password) return '';
    return u.href;
  } catch {
    return '';
  }
}

/** Radio Browser station UUIDs: hex + dashes only, so they are safe inside a URL path. */
export function cleanUuid(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : '';
  return /^[0-9a-f-]{8,64}$/i.test(s) ? s : '';
}

export function cleanInt(v: unknown, min: number, max: number): number {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export interface RawStationFields {
  uuid: string;
  name: string;
  city: string;
  country: string;
  cc: string;
  tags: string;
  favicon: string;
  bitrate: number;
  codec: string;
  votes: number;
  url: string;
}

/** One Radio Browser row → validated fields, or null if it can't be played safely. */
export function toStationFields(r: unknown): RawStationFields | null {
  if (!r || typeof r !== 'object') return null;
  const o = r as Record<string, unknown>;
  const url = safeHttpsUrl(o.url_resolved) || safeHttpsUrl(o.url);
  if (!url) return null;
  const name = cleanText(o.name, 200);
  if (!name || name.length > 40) return null;
  const country = cleanText(o.country, 60);
  const cc = cleanText(o.countrycode, 2).toUpperCase().replace(/[^A-Z]/g, '');
  return {
    uuid: cleanUuid(o.stationuuid),
    name,
    city: cleanText(o.state, 60) || country,
    country: country || cc || '—',
    cc,
    tags: cleanText(o.tags, 300),
    favicon: safeHttpsUrl(o.favicon, 1024),
    bitrate: cleanInt(o.bitrate, 0, 10000),
    codec: cleanText(o.codec, 12).toUpperCase(),
    votes: cleanInt(o.votes, 0, 1e9),
    url,
  };
}
