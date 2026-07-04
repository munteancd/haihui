// Usage: node tools/build-cities.mjs path/to/cities500.txt data/cities.json
import { readFileSync, writeFileSync } from 'node:fs';

const PER_COUNTRY = 50;
const [inPath, outPath] = process.argv.slice(2);
if (!inPath || !outPath) {
  console.error('usage: node tools/build-cities.mjs <cities500.txt> <cities.json>');
  process.exit(1);
}

const byCountry = new Map();
for (const line of readFileSync(inPath, 'utf8').split('\n')) {
  if (!line) continue;
  const f = line.split('\t');
  const name = f[1], cc = f[8], pop = Number(f[14]);
  const lat = Number(f[4]), lon = Number(f[5]);
  if (!name || !cc || !Number.isFinite(pop) || pop <= 0) continue;
  if (!byCountry.has(cc)) byCountry.set(cc, []);
  byCountry.get(cc).push({ name, cc, lat, lon, pop });
}

let id = 1;
const out = [];
for (const [, list] of byCountry) {
  list.sort((a, b) => b.pop - a.pop);
  for (const c of list.slice(0, PER_COUNTRY)) {
    out.push({ id: id++, name: c.name, cc: c.cc, country: c.cc, lat: c.lat, lon: c.lon, pop: c.pop });
  }
}

writeFileSync(outPath, JSON.stringify(out));
console.log(`wrote ${out.length} cities from ${byCountry.size} countries -> ${outPath}`);
