/** 9 genre families that normalise 60+ sub-styles. */
export const FAMILIES: Record<string, string[]> = {
  Jazz: ['Jazz', 'Ethio-Jazz', 'Lounge'],
  Blues: ['Blues', 'Desert Blues'],
  Folk: ['Folk', 'Nordic Folk', 'Cretan Folk', 'Celtic', 'Griot', 'Azmari', 'Polyphony', 'Chanson', 'Fado', 'Canzone', 'Rebetiko', 'Raï', 'Flamenco', 'Sufi', 'Carnatic', 'Tarab'],
  Latin: ['Tango', 'Cumbia', 'Vallenato', 'Champeta', 'Son', 'Rumba', 'Norteño', 'Cuarteto', 'Bossa Nova', 'Axé', 'Tropicália'],
  Afro: ['Afrobeat', 'Highlife', 'Amapiano', 'Kwela', 'Chaabi', 'Gnawa'],
  'Reggae & Dub': ['Reggae', 'Dub'],
  Electronic: ['Techno', 'Dub Techno', 'Downtempo', 'Ambient', 'Balearic', 'Italo Disco'],
  Indie: ['Indie', 'Indie Pop', 'Indie Rock', 'Dream Pop', 'City Pop', 'Krautrock', 'Anatolian Psych'],
  'Hip-Hop': ['Hip-Hop', 'Boom Bap', 'French Rap', 'Latin Rap', 'Afro Rap', 'Arab Rap', 'Desi Hip-Hop', 'Grime', 'Trap', 'Funk Carioca'],
};

const FAMILY_OF: Record<string, string> = {};
for (const fam of Object.keys(FAMILIES)) for (const g of FAMILIES[fam]) FAMILY_OF[g] = fam;

export function familyOf(genre: string): string {
  return FAMILY_OF[genre] ?? genre;
}

/** Radio Browser tags queried per family. */
export const TAGS: Record<string, string[]> = {
  Jazz: ['jazz', 'swing', 'bebop', 'smooth jazz', 'ethio-jazz'],
  Blues: ['blues', 'delta blues', 'desert blues', 'soul blues'],
  Folk: ['folk', 'world music', 'fado', 'flamenco', 'chanson', 'celtic', 'traditional'],
  Latin: ['latin', 'salsa', 'tango', 'cumbia', 'bossa nova', 'mpb', 'son cubano'],
  Afro: ['afrobeat', 'african', 'highlife', 'amapiano', 'afro house', 'gnawa'],
  'Reggae & Dub': ['reggae', 'dub', 'dancehall', 'roots reggae', 'ska'],
  Electronic: ['electronic', 'techno', 'house', 'ambient', 'downtempo', 'drum and bass'],
  Indie: ['indie', 'indie rock', 'indie pop', 'shoegaze', 'post rock', 'city pop'],
  'Hip-Hop': ['hip hop', 'rap', 'boom bap', 'trap', 'grime', 'old school hip hop'],
};

export const PER_FAMILY = 34;
