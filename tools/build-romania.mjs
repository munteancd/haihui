// Builds data/romania.json — the România deck (cities + tourist attractions) — from the
// GeoNames dump for Romania (CC BY 4.0, https://www.geonames.org).
//
// Usage:
//   node tools/build-romania.mjs                         # downloads RO.zip from GeoNames
//   node tools/build-romania.mjs <RO.txt> [out.json]     # use an already unzipped dump
//   node tools/build-romania.mjs <cities500.txt> [out]   # cities only (see below)
//
// RO.txt (https://download.geonames.org/export/dump/RO.zip) holds every GeoNames feature
// in Romania, so it yields both the cities and the attractions. cities500.txt holds only
// populated places: it yields the cities and reports every attraction as missing.
// Coordinates are never typed in by hand — everything comes from the dump.
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

const RO_ZIP_URL = 'https://download.geonames.org/export/dump/RO.zip';
const NUM_CITIES = 140;

// GeoNames admin1 code -> county. (Code 24 is unused in GeoNames.)
const COUNTIES = {
  '01': 'Alba', '02': 'Arad', '03': 'Argeș', '04': 'Bacău', '05': 'Bihor',
  '06': 'Bistrița-Năsăud', '07': 'Botoșani', '08': 'Brăila', '09': 'Brașov',
  '10': 'București', '11': 'Buzău', '12': 'Caraș-Severin', '13': 'Cluj', '14': 'Constanța',
  '15': 'Covasna', '16': 'Dâmbovița', '17': 'Dolj', '18': 'Galați', '19': 'Gorj',
  '20': 'Harghita', '21': 'Hunedoara', '22': 'Ialomița', '23': 'Iași', '25': 'Maramureș',
  '26': 'Mehedinți', '27': 'Mureș', '28': 'Neamț', '29': 'Olt', '30': 'Prahova',
  '31': 'Sălaj', '32': 'Satu Mare', '33': 'Sibiu', '34': 'Suceava', '35': 'Teleorman',
  '36': 'Timiș', '37': 'Tulcea', '38': 'Vaslui', '39': 'Vâlcea', '40': 'Vrancea',
  '41': 'Călărași', '42': 'Giurgiu', '43': 'Ilfov',
};
const countyLabel = (code) =>
  code === '10' ? 'Municipiul București' : COUNTIES[code] ? `Județul ${COUNTIES[code]}` : '';

// County seats GeoNames doesn't flag as PPLA: Ilfov is run from Buftea.
const EXTRA_SEATS = { '43': 'Buftea' };

// Spelling fixes for names GeoNames keeps in English or hyphenated.
const NAME_FIXES = {
  'Bucharest': 'București',
  'Târgu-Mureș': 'Târgu Mureș',
  'Miercurea-Ciuc': 'Miercurea Ciuc',
};

// The 38 attractions, matched by name in the dump (Romanian or English, any spelling the
// dump knows) within the listed counties. `classes` limits the GeoNames feature class
// (S = spot/building, T = mountain/rock, H = water, L = area, R = road, P = town). Once an
// attraction's GeoNames id is known it can be pinned with `geonameId` to skip matching.
const ATTRACTIONS = [
  { name: 'Castelul Bran', counties: ['09'], match: ['Castelul Bran', 'Bran Castle', 'Castle Bran'] },
  { name: 'Castelul Peleș', counties: ['30'], match: ['Castelul Peleș', 'Peleș Castle'] },
  { name: 'Castelul Corvinilor', counties: ['21'], match: ['Castelul Corvinilor', 'Corvin Castle', 'Hunyad Castle', 'Castelul Huniazilor'] },
  { name: 'Cetatea Sighișoara', counties: ['27'], match: ['Cetatea Sighișoara', 'Cetatea Sighișoarei', 'Sighișoara Citadel'] },
  { name: 'Cetatea Râșnov', counties: ['09'], match: ['Cetatea Râșnov', 'Cetatea Râșnovului', 'Râșnov Citadel', 'Râșnov Fortress'] },
  { name: 'Cetatea Alba Carolina', counties: ['01'], match: ['Cetatea Alba Carolina', 'Alba Carolina Citadel', 'Alba Carolina'] },
  { name: 'Sarmizegetusa Regia', counties: ['21'], match: ['Sarmizegetusa Regia', 'Sarmisegetusa Regia'] },
  { name: 'Biserica Neagră', counties: ['09'], match: ['Biserica Neagră', 'Black Church'] },
  { name: 'Mănăstirea Voroneț', counties: ['34'], match: ['Mănăstirea Voroneț', 'Voroneț Monastery'] },
  { name: 'Mănăstirea Sucevița', counties: ['34'], match: ['Mănăstirea Sucevița', 'Sucevița Monastery'] },
  { name: 'Mănăstirea Putna', counties: ['34'], match: ['Mănăstirea Putna', 'Putna Monastery'] },
  { name: 'Mănăstirea Horezu', counties: ['39'], match: ['Mănăstirea Horezu', 'Mănăstirea Hurezi', 'Horezu Monastery', 'Hurezi Monastery'] },
  { name: 'Mănăstirea Curtea de Argeș', counties: ['03'], match: ['Mănăstirea Curtea de Argeș', 'Curtea de Argeș Monastery', 'Curtea de Argeș Cathedral'] },
  { name: 'Cetatea de Scaun a Sucevei', counties: ['34'], match: ['Cetatea de Scaun a Sucevei', 'Cetatea Sucevei', 'Suceava Fortress', 'Suceava Citadel'] },
  { name: 'Cetatea Neamțului', counties: ['28'], match: ['Cetatea Neamțului', 'Cetatea Neamț', 'Neamț Citadel', 'Neamț Fortress'] },
  { name: 'Cimitirul Vesel', counties: ['25'], match: ['Cimitirul Vesel', 'Merry Cemetery'] },
  { name: 'Salina Turda', counties: ['13'], match: ['Salina Turda', 'Turda Salt Mine'] },
  { name: 'Salina Praid', counties: ['20'], match: ['Salina Praid', 'Praid Salt Mine'] },
  { name: 'Cheile Turzii', counties: ['13'], match: ['Cheile Turzii', 'Turda Gorge'] },
  { name: 'Cheile Bicazului', counties: ['28', '20'], match: ['Cheile Bicazului', 'Bicaz Gorge'] },
  { name: 'Lacul Roșu', counties: ['20'], classes: ['H'], match: ['Lacul Roșu', 'Lacu Roșu', 'Red Lake'] },
  { name: 'Lacul Sfânta Ana', counties: ['20'], classes: ['H'], match: ['Lacul Sfânta Ana', 'Lacul Sf. Ana', 'Lake Saint Anne', 'Lake Sfânta Ana'] },
  { name: 'Lacul Bâlea', counties: ['33'], classes: ['H'], match: ['Lacul Bâlea', 'Bâlea Lac', 'Bâlea Lake'] },
  { name: 'Transfăgărășan', counties: ['33', '03'], match: ['Transfăgărășan', 'Transfăgărăşan', 'DN7C'] },
  { name: 'Sfinxul din Bucegi', counties: ['30', '16'], classes: ['T', 'S'], match: ['Sfinxul', 'Sfinxul din Bucegi', 'Romanian Sphinx'] },
  { name: 'Babele', counties: ['30', '16'], classes: ['T', 'S'], match: ['Babele'] },
  { name: 'Vârful Moldoveanu', counties: ['03'], classes: ['T'], match: ['Vârful Moldoveanu', 'Moldoveanu', 'Moldoveanu Peak'] },
  { name: 'Vârful Omu', counties: ['30', '09', '16'], classes: ['T'], match: ['Vârful Omu', 'Omu', 'Omu Peak'] },
  { name: 'Vulcanii Noroioși', counties: ['11'], match: ['Vulcanii Noroioși', 'Pâclele Mari', 'Vulcanii Noroioși de la Pâclele Mari', 'Mud Volcanoes'] },
  { name: 'Râpa Roșie', counties: ['01'], match: ['Râpa Roșie', 'Red Ravine'] },
  { name: 'Peștera Urșilor', counties: ['05'], match: ['Peștera Urșilor', 'Bears Cave', "Bears' Cave", 'Bear Cave'] },
  { name: 'Peștera Scărișoara', counties: ['01'], match: ['Peștera Scărișoara', 'Ghețarul Scărișoara', 'Scărișoara Cave', 'Scărișoara Glacier Cave'] },
  { name: 'Cascada Bigăr', counties: ['12'], match: ['Cascada Bigăr', 'Bigăr Waterfall', 'Izvorul Bigăr'] },
  { name: 'Podul lui Dumnezeu', counties: ['26'], match: ['Podul lui Dumnezeu', 'Podul Natural de la Ponoarele', "God's Bridge"] },
  { name: 'Cazanele Dunării', counties: ['26'], match: ['Cazanele Dunării', 'Cazanele Mari', 'Cazanele'] },
  { name: 'Chipul lui Decebal', counties: ['26'], match: ['Chipul lui Decebal', 'Statuia lui Decebal', 'Rock Sculpture of Decebalus', 'Decebalus Rex'] },
  { name: 'Sulina (Delta Dunării)', counties: ['37'], classes: ['P'], match: ['Sulina'] },
  { name: 'Barajul Vidraru', counties: ['03'], match: ['Barajul Vidraru', 'Vidraru Dam', 'Lacul Vidraru'] },
];

// GeoNames still writes some names with a cedilla (ş ţ); Romanian uses a comma below.
const fixDiacritics = (s) =>
  s.replace(/ş/g, 'ș').replace(/Ş/g, 'Ș').replace(/ţ/g, 'ț').replace(/Ţ/g, 'Ț');
const cleanName = (s) => { const n = fixDiacritics(s); return NAME_FIXES[n] ?? n; };
// Loose key for matching names: no diacritics, no case, no punctuation.
const key = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim();

// GeoNames dump columns (tab-separated, 0-indexed).
function parseRow(line) {
  const f = line.split('\t');
  return {
    id: Number(f[0]), name: f[1], ascii: f[2], alt: f[3] ? f[3].split(',') : [],
    lat: Number(f[4]), lon: Number(f[5]), fclass: f[6], fcode: f[7], cc: f[8],
    admin1: f[10], pop: Number(f[14]) || 0,
  };
}

// Pull one file out of a .zip held in memory (stored or deflated entries — what GeoNames
// ships), so the script needs nothing beyond Node itself.
export function unzipEntry(buf, wanted) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (name === wanted) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      return (method === 0 ? data : inflateRawSync(data)).toString('utf8');
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${wanted} not found in zip`);
}

// County seats (always in) plus the most populous other towns, NUM_CITIES in total.
export function selectCities(rows) {
  const places = rows.filter((r) => r.cc === 'RO' && r.fclass === 'P' && r.pop > 0
    && ['PPLC', 'PPLA', 'PPLA2', 'PPLA3', 'PPL'].includes(r.fcode)
    && !/^Sector \d/.test(r.name));
  const isSeat = (r) => r.fcode === 'PPLC' || r.fcode === 'PPLA' || EXTRA_SEATS[r.admin1] === r.name;
  const seats = places.filter(isSeat);
  const others = places.filter((r) => !isSeat(r)).sort((a, b) => b.pop - a.pop);
  const chosen = [...seats, ...others.slice(0, Math.max(0, NUM_CITIES - seats.length))];

  const warnings = [];
  for (const code of Object.keys(COUNTIES)) {
    if (!seats.some((r) => r.admin1 === code)) warnings.push(`no county seat found for ${COUNTIES[code]}`);
  }
  const cities = chosen.map((r) => {
    const city = { id: r.id, name: cleanName(r.name), county: countyLabel(r.admin1), lat: r.lat, lon: r.lon, pop: r.pop };
    // A county seat under 15 000 people is a GeoNames data slip (every seat is far larger):
    // keep its coordinates, but keep it out of the population game.
    if (isSeat(r) && r.pop < 15000) {
      city.popSuspect = true;
      warnings.push(`suspicious population for ${city.name}: ${r.pop} (excluded from Populație)`);
    }
    return city;
  });
  // Same name twice (it happens with villages): tell them apart by county.
  const counts = new Map();
  cities.forEach((c) => counts.set(c.name, (counts.get(c.name) || 0) + 1));
  cities.forEach((c) => { if (counts.get(c.name) > 1) c.name = `${c.name} (${c.county.replace(/^Județul /, '')})`; });
  cities.sort((a, b) => b.pop - a.pop);
  return { cities, warnings };
}

// Find each attraction in the dump. Returns the found ones plus a line per attraction.
export function selectAttractions(rows) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const attractions = [];
  const report = [];
  const classRank = { S: 0, T: 1, H: 2, L: 3, V: 4, R: 5, U: 6, P: 7 };
  for (const a of ATTRACTIONS) {
    let candidates;
    if (a.geonameId) {
      candidates = byId.has(a.geonameId) ? [byId.get(a.geonameId)] : [];
    } else {
      const wanted = new Set(a.match.map(key));
      const classes = a.classes ?? ['S', 'T', 'H', 'L', 'V', 'R', 'U'];
      candidates = rows.filter((r) => r.cc === 'RO' && classes.includes(r.fclass)
        && a.counties.includes(r.admin1)
        && [r.name, r.ascii, ...r.alt].some((n) => wanted.has(key(n))));
      candidates.sort((x, y) => (classRank[x.fclass] ?? 9) - (classRank[y.fclass] ?? 9) || y.pop - x.pop);
    }
    if (candidates.length === 0) { report.push(`MISSING   ${a.name}`); continue; }
    const r = candidates[0];
    attractions.push({ id: r.id, name: a.name, county: countyLabel(r.admin1), lat: r.lat, lon: r.lon, kind: 'attraction' });
    const others = candidates.slice(1, 4).map((c) => `${c.id} ${c.name} ${c.fclass}.${c.fcode}`).join('; ');
    report.push(`${candidates.length > 1 ? 'AMBIGUOUS' : 'OK       '} ${a.name} <- ${r.id} ${r.name} ${r.fclass}.${r.fcode} ${r.lat},${r.lon}${others ? `   (also: ${others})` : ''}`);
  }
  return { attractions, report };
}

async function main() {
  const [inPath, outPath = 'data/romania.json'] = process.argv.slice(2);
  let text;
  let sourceFile;
  if (inPath) {
    text = readFileSync(inPath, 'utf8');
    sourceFile = inPath.split(/[\\/]/).pop();
  } else {
    console.log(`downloading ${RO_ZIP_URL} …`);
    const res = await fetch(RO_ZIP_URL);
    if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
    text = unzipEntry(Buffer.from(await res.arrayBuffer()), 'RO.txt');
    sourceFile = 'RO.txt';
  }
  const rows = text.split('\n').filter(Boolean).map(parseRow);
  const { cities, warnings } = selectCities(rows);
  const { attractions, report } = selectAttractions(rows);

  const out = {
    source: 'GeoNames (https://www.geonames.org), CC BY 4.0',
    builtFrom: sourceFile,
    builtAt: new Date().toISOString().slice(0, 10),
    cities,
    attractions,
  };
  writeFileSync(outPath, `${JSON.stringify(out, null, 0)}\n`);
  warnings.forEach((w) => console.warn(`warning: ${w}`));
  console.log(report.join('\n'));
  console.log(`wrote ${cities.length} cities + ${attractions.length}/${ATTRACTIONS.length} attractions -> ${outPath}`);
}

// Run only when executed directly (the tests import the helpers).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message || e); process.exit(1); });
}
