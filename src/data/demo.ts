import type { Station } from '../types';
import { familyOf } from './families';

/** Bundled offline set: [name, city, country, genre, dial frequency]. Streams map to curated public channels. */
const DEMO: ReadonlyArray<readonly [string, string, string, string, number]> = [
  ['Radio Oro Marbella', 'Málaga', 'Spain', 'Flamenco', 94.4],
  ['Ràdio Gràcia', 'Barcelona', 'Spain', 'Rumba', 101.2],
  ['Onda Sur', 'Sevilla', 'Spain', 'Flamenco', 88.6],
  ['Ibiza Sunset', 'Ibiza', 'Spain', 'Balearic', 96.8],
  ['Radio Bastille', 'Paris', 'France', 'Chanson', 91.7],
  ['Ondes du Sud', 'Marseille', 'France', 'Raï', 99.1],
  ['Studio Lyon', 'Lyon', 'France', 'Jazz', 103.4],
  ['Nuit Blanche', 'Paris', 'France', 'Downtempo', 107.1],
  ['Fado Lisboa', 'Lisbon', 'Portugal', 'Fado', 92.3],
  ['Rádio Atlântico', 'Porto', 'Portugal', 'Indie', 100.5],
  ['Alfama Nights', 'Lisbon', 'Portugal', 'Fado', 88.1],
  ['Napoli Sud', 'Naples', 'Italy', 'Canzone', 97.7],
  ['Milano Notturno', 'Milan', 'Italy', 'Italo Disco', 102.6],
  ['Roma Vinile', 'Rome', 'Italy', 'Jazz', 94.9],
  ['Kosmische FM', 'Berlin', 'Germany', 'Krautrock', 93.2],
  ['Hafenwelle', 'Hamburg', 'Germany', 'Dub Techno', 98.5],
  ['Schwarzwald Radio', 'Freiburg', 'Germany', 'Ambient', 89.9],
  ['Tbilisi Polyphony', 'Tbilisi', 'Georgia', 'Polyphony', 95.6],
  ['Kazbegi Mountain', 'Stepantsminda', 'Georgia', 'Folk', 91.1],
  ['Black Sea Waves', 'Batumi', 'Georgia', 'Lounge', 99.8],
  ['Radio Tango Sur', 'Buenos Aires', 'Argentina', 'Tango', 92.9],
  ['Córdoba Cuarteto', 'Córdoba', 'Argentina', 'Cuarteto', 100.1],
  ['Patagonia Libre', 'Bariloche', 'Argentina', 'Folk', 88.3],
  ['Bossa Rio', 'Rio de Janeiro', 'Brazil', 'Bossa Nova', 96.1],
  ['Bahia Axé', 'Salvador', 'Brazil', 'Axé', 103.9],
  ['São Paulo Tropicália', 'São Paulo', 'Brazil', 'Tropicália', 90.8],
  ['City Pop Tokyo', 'Tokyo', 'Japan', 'City Pop', 93.7],
  ['Osaka Night Jazz', 'Osaka', 'Japan', 'Jazz', 105.8],
  ['Goa Sunset', 'Panaji', 'India', 'Downtempo', 89.4],
  ['Raga Chennai', 'Chennai', 'India', 'Carnatic', 94.1],
  ['Bamako Desert Blues', 'Bamako', 'Mali', 'Desert Blues', 92.1],
  ['Niger Bend Radio', 'Ségou', 'Mali', 'Griot', 98.8],
  ['Gnawa Essaouira', 'Essaouira', 'Morocco', 'Gnawa', 90.1],
  ['Casablanca Chaabi', 'Casablanca', 'Morocco', 'Chaabi', 104.3],
  ['Addis Ethio-Jazz', 'Addis Ababa', 'Ethiopia', 'Ethio-Jazz', 95.1],
  ['Highland Krar', 'Gondar', 'Ethiopia', 'Azmari', 88.7],
  ['Kingston Dub', 'Kingston', 'Jamaica', 'Dub', 91.4],
  ['Trench Town Roots', 'Kingston', 'Jamaica', 'Reggae', 99.4],
  ['Reykjavík Glacier', 'Reykjavík', 'Iceland', 'Ambient', 93.9],
  ['Nordlys Radio', 'Tromsø', 'Norway', 'Nordic Folk', 96.5],
  ['Delta Blues', 'Clarksdale', 'USA', 'Blues', 92.6],
  ['Detroit Steel', 'Detroit', 'USA', 'Techno', 100.9],
  ['Oaxaca Cumbia', 'Oaxaca', 'Mexico', 'Cumbia', 94.6],
  ['Radio Norteño', 'Monterrey', 'Mexico', 'Norteño', 98.1],
  ['Istanbul Anadolu', 'Istanbul', 'Turkey', 'Anatolian Psych', 91.9],
  ['Bosphorus Night', 'Istanbul', 'Turkey', 'Sufi', 103.1],
  ['Cairo Tarab', 'Cairo', 'Egypt', 'Tarab', 97.9],
  ['Jozi Amapiano', 'Johannesburg', 'South Africa', 'Amapiano', 95.9],
  ['Cape Kwela', 'Cape Town', 'South Africa', 'Kwela', 88.4],
  ['Cartagena Champeta', 'Cartagena', 'Colombia', 'Champeta', 99.9],
  ['Bogotá Vallenato', 'Bogotá', 'Colombia', 'Vallenato', 106.7],
  ['Habana Son', 'Havana', 'Cuba', 'Son', 93.4],
  ['Santiago Rumba', 'Santiago de Cuba', 'Cuba', 'Rumba', 101.4],
  ['Lagos Afrobeat', 'Lagos', 'Nigeria', 'Afrobeat', 96.9],
  ['Kano Highlife', 'Kano', 'Nigeria', 'Highlife', 89.6],
  ['Bristol Soundsystem', 'Bristol', 'UK', 'Dub', 92.4],
  ['Glasgow Ceilidh', 'Glasgow', 'UK', 'Celtic', 104.6],
  ['Rebetiko Piraeus', 'Piraeus', 'Greece', 'Rebetiko', 91.2],
  ['Crete Lyra', 'Chania', 'Greece', 'Cretan Folk', 100.4],
  ['Warsaw Nocturne', 'Warsaw', 'Poland', 'Jazz', 105.3],
  ['Bronx Boombap', 'New York', 'USA', 'Hip-Hop', 97.1],
  ['Marseille Rap', 'Marseille', 'France', 'French Rap', 90.3],
  ['Naija Rap', 'Lagos', 'Nigeria', 'Afro Rap', 102.1],
  ['Tokyo Beat Tapes', 'Tokyo', 'Japan', 'Boom Bap', 105.0],
  ['Baile Rio', 'Rio de Janeiro', 'Brazil', 'Funk Carioca', 93.0],
  ['Medellín Rap', 'Medellín', 'Colombia', 'Latin Rap', 95.3],
  ['East London Grime', 'London', 'UK', 'Grime', 106.2],
  ['Mumbai Gully', 'Mumbai', 'India', 'Desi Hip-Hop', 98.3],
  ['Joburg Trap', 'Johannesburg', 'South Africa', 'Trap', 107.5],
  ['Casa Rap', 'Casablanca', 'Morocco', 'Arab Rap', 88.9],
];

const CHANNELS: Record<string, string[]> = {
  Jazz: ['sonicuniverse', 'illstreet', 'secretagent', 'lush', 'rp:mellow'],
  Blues: ['thetrip', 'bootliquor', 'seventies', 'rp:rock', 'covers'],
  Folk: ['folkfwd', 'thistle', 'deepspaceone', 'suburbsofgoa', 'lush', 'dronezone', 'rp:eclectic', 'poptron'],
  Latin: ['illstreet', 'groovesalad', 'beatblender', 'u80s', 'secretagent', 'rp:global', 'suburbsofgoa'],
  Afro: ['suburbsofgoa', 'beatblender', 'groovesalad', 'thetrip', 'rp:global'],
  'Reggae & Dub': ['reggae', 'beatblender', 'dronezone', 'rp:global'],
  Electronic: ['groovesalad', 'beatblender', 'cliqhop', 'spacestation', 'deepspaceone', 'dronezone', 'u80s'],
  Indie: ['indiepop', 'poptron', 'u80s', 'spacestation', 'covers', 'rp:eclectic'],
  'Hip-Hop': ['lf:hiphop', 'fluid', 'lf:rap', 'lf:boombap', 'fluid', 'lf:hiphop'],
};

function urlFor(ch: string): string {
  if (ch.startsWith('lf:')) return 'https://stream.laut.fm/' + ch.slice(3);
  if (ch.startsWith('rp:')) return 'https://stream.radioparadise.com/' + ch.slice(3) + '-192';
  return 'https://ice1.somafm.com/' + ch + '-128-mp3';
}

let cache: Station[] | null = null;

export function demoStations(): Station[] {
  if (cache) return cache;
  const seen: Record<string, number> = {};
  cache = DEMO.map(([name, city, country, genre, freq]) => ({ name, city, country, genre, freq, family: familyOf(genre) }))
    .sort((a, b) => a.freq - b.freq)
    .map((s, i): Station => {
      const list = CHANNELS[s.family] ?? CHANNELS.Electronic;
      const n = seen[s.family] ?? 0;
      seen[s.family] = n + 1;
      return {
        id: i, uuid: '', name: s.name, city: s.city, country: s.country, cc: '', genre: s.genre, family: s.family,
        tags: s.genre.toLowerCase(), favicon: '', bitrate: 128, codec: 'MP3', votes: 0, freq: s.freq,
        url: urlFor(list[n % list.length]), fallback: urlFor(list[0]),
      };
    });
  return cache;
}
