// Builds the world decks — data/cities.json (Lume) and data/europe.json (Europa) — from the
// GeoNames populated-places dump cities500 (CC BY 4.0, https://www.geonames.org).
//
// Usage:
//   node tools/build-cities.mjs                  # downloads cities500.zip from GeoNames
//   node tools/build-cities.mjs <cities500.txt>  # use an already unzipped dump
//
// Each card: { id (GeoNames id), name, country (ISO code), lat, lon, pop, tier }. `tier` is
// the easiest difficulty the card plays at (1 Ușor … 4 Legendar); see TIERS.
// Coordinates are never typed in by hand — everything comes from the dump.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { unzipEntry, cleanName } from './build-romania.mjs';

const ZIP_URL = 'https://download.geonames.org/export/dump/cities500.zip';

// Countries wholly counted as Europe, plus Russia west of the Urals and Turkey's European
// side (East Thrace, Istanbul included) — see inEurope().
const EUROPE = new Set(('AD AL AT AX BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR '
  + 'HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS SE SI SK SM UA VA XK').split(' '));
export const inEurope = (c) => EUROPE.has(c.country)
  || (c.country === 'RU' && c.lon < 60)
  || (c.country === 'TR' && c.lat > 40.8 && c.lon < 29);

// Per deck: how many cities per country at most, and the difficulty tiers. A tier takes
// capitals first (if at least `capitalPop` people), then the most populous cities (of at
// least `minPop`) whose name GeoNames knows in at least `minNames` spellings/languages — a
// good sign the city is known abroad (Paris has 109, an obscure Chinese prefecture seat a
// dozen; within Europe Slavic spellings blur that, hence Europa's population floor) — with
// at most `cap` cards per country across this tier and the easier ones. Everything left is
// tier 4.
export const DECKS = {
  world: { out: 'data/cities.json', perCountry: 50, filter: () => true, tiers: [
    { size: 200, cap: 10, minNames: 25, capitalPop: 4e5 },
    { size: 600, cap: 35, minNames: 12, capitalPop: 1e5 },
    { size: 1200, cap: 80, minNames: 5, capitalPop: 0 },
  ] },
  europe: { out: 'data/europe.json', perCountry: 60, filter: inEurope, tiers: [
    { size: 100, cap: 6, minNames: 25, capitalPop: 1e5, minPop: 4e5 },
    { size: 250, cap: 15, minNames: 12, capitalPop: 0 },
    { size: 600, cap: 40, minNames: 5, capitalPop: 0 },
  ] },
};

// A city within this distance of a bigger one already taken is a district or suburb of it
// (Brooklyn, Zemun, "Paris 17"): on a card it would sit on top of its neighbour.
const SUBURB_KM = 15;

// GeoNames dump columns (tab-separated, 0-indexed).
export function parseRow(line) {
  const f = line.split('\t');
  return {
    id: Number(f[0]), name: f[1], names: f[3] ? f[3].split(',').length : 0,
    lat: Number(f[4]), lon: Number(f[5]), fcode: f[7], country: f[8], pop: Number(f[14]) || 0,
  };
}

export function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

// The `perCountry` most populous cities of each country, skipping city sections (PPLX),
// repeated names within a country (the bigger one stays) and suburbs of a bigger city.
export function pickPerCountry(rows, perCountry) {
  const byCountry = new Map();
  for (const r of rows) {
    if (r.fcode === 'PPLX' || !(r.pop > 0) || !r.country) continue;
    if (!byCountry.has(r.country)) byCountry.set(r.country, []);
    byCountry.get(r.country).push(r);
  }
  const out = [];
  for (const list of byCountry.values()) {
    list.sort((a, b) => b.pop - a.pop);
    const kept = [];
    const names = new Set();
    for (const r of list) {
      if (kept.length >= perCountry) break;
      if (names.has(r.name) || kept.some((k) => distanceKm(k, r) < SUBURB_KM)) continue;
      kept.push(r);
      names.add(r.name);
    }
    out.push(...kept);
  }
  return out;
}

// Mark each city with the easiest tier it plays at (see DECKS). A name already used by an
// easier card waits for a harder tier, so an easy game never has two "Alexandria"s.
export function assignTiers(cities, tiers) {
  const order = [...cities].sort((a, b) => b.pop - a.pop);
  const perCountry = new Map();
  const names = new Set();
  const tierOf = new Map();
  tiers.forEach((t, i) => {
    let taken = 0;
    const take = (c) => {
      tierOf.set(c, i + 1);
      perCountry.set(c.country, (perCountry.get(c.country) || 0) + 1);
      names.add(c.name);
      taken++;
    };
    const fits = (c) => !tierOf.has(c) && c.names >= t.minNames && !names.has(c.name)
      && (perCountry.get(c.country) || 0) < t.cap;
    for (const c of order) if (taken < t.size && c.fcode === 'PPLC' && c.pop >= t.capitalPop && fits(c)) take(c);
    for (const c of order) if (taken < t.size && c.pop >= (t.minPop ?? 0) && fits(c)) take(c);
  });
  return cities.map((c) => ({ ...c, tier: tierOf.get(c) ?? tiers.length + 1 }));
}

// Romanian and Moldovan names get Romanian spelling (comma-below ș/ț, București).
const cardName = (c) => (c.country === 'RO' || c.country === 'MD' ? cleanName(c.name) : c.name);

export function buildDeck(rows, deck) {
  const cities = assignTiers(pickPerCountry(rows.filter(deck.filter), deck.perCountry), deck.tiers);
  return cities
    .sort((a, b) => a.tier - b.tier || b.pop - a.pop)
    .map((c) => ({ id: c.id, name: cardName(c), country: c.country, lat: c.lat, lon: c.lon, pop: c.pop, tier: c.tier }));
}

async function main() {
  const [inPath] = process.argv.slice(2);
  let text;
  if (inPath) {
    text = readFileSync(inPath, 'utf8');
  } else {
    console.log(`downloading ${ZIP_URL} …`);
    const res = await fetch(ZIP_URL);
    if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
    text = unzipEntry(Buffer.from(await res.arrayBuffer()), 'cities500.txt');
  }
  const rows = text.split('\n').filter(Boolean).map(parseRow);
  for (const [id, deck] of Object.entries(DECKS)) {
    const cards = buildDeck(rows, deck);
    writeFileSync(deck.out, `${JSON.stringify(cards)}\n`);
    const perTier = [1, 2, 3, 4].map((t) => cards.filter((c) => c.tier === t).length);
    console.log(`${id}: ${cards.length} cities from ${new Set(cards.map((c) => c.country)).size} countries, per tier ${perTier.join('/')} -> ${deck.out}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
