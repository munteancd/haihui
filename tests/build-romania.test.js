import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { selectCities, selectAttractions, unzipEntry, ATTRACTIONS } from '../tools/build-romania.mjs';

// A minimal GeoNames-shaped row (only the fields the build script reads).
const row = (id, name, fclass, fcode, admin1, pop, { lat = 45, lon = 25, alt = [] } = {}) =>
  ({ id, name, ascii: name, alt, lat, lon, fclass, fcode, cc: 'RO', admin1, pop });

test('county seats are always in; names get Romanian spelling and a county label', () => {
  const rows = [
    row(1, 'Bucharest', 'P', 'PPLC', '10', 1800000),
    row(2, 'Târgu-Mureş', 'P', 'PPLA', '27', 140000),
    row(3, 'Sector 2', 'P', 'PPLX', '10', 345000),   // a city district, not a town
    row(4, 'Buftea', 'P', 'PPLA2', '43', 20000),     // Ilfov's seat
    row(5, 'Tiny Seat', 'P', 'PPLA', '41', 6000),     // implausible seat population
  ];
  const { cities, warnings } = selectCities(rows);
  const byId = Object.fromEntries(cities.map((c) => [c.id, c]));
  assert.equal(byId[1].name, 'București');
  assert.equal(byId[1].county, 'Municipiul București');
  assert.equal(byId[2].name, 'Târgu Mureș');
  assert.equal(byId[2].county, 'Județul Mureș');
  assert.equal(byId[3], undefined);
  assert.ok(byId[4]);
  assert.equal(byId[5].popSuspect, true);
  assert.ok(warnings.some((w) => w.includes('Tiny Seat')));
});

test('attractions are matched by name inside their county, ignoring towns and diacritics', () => {
  const rows = [
    row(10, 'Bran', 'P', 'PPLA2', '09', 5000),
    row(11, 'Bran Castle', 'S', 'CSTL', '09', 0, { alt: ['Castelul Bran'], lat: 45.515, lon: 25.367 }),
    row(12, 'Castelul Bran', 'S', 'CSTL', '30', 0),   // wrong county: ignored
    row(13, 'Lacul Roşu', 'H', 'LK', '00', 0),         // GeoNames left the county blank
  ];
  const list = [
    { name: 'Castelul Bran', counties: ['09'], match: ['Castelul Bran'] },
    { name: 'Lacul Roșu', counties: ['20'], match: ['Lacul Roșu'] },
    { name: 'Castelul Peleș', counties: ['30'], match: ['Peleș Castle'] },
  ];
  const { attractions, report } = selectAttractions(rows, list);
  const bran = attractions.find((a) => a.name === 'Castelul Bran');
  assert.equal(bran.id, 11);
  assert.equal(bran.lat, 45.515);
  assert.equal(bran.county, 'Județul Brașov');
  assert.equal(bran.kind, 'attraction');
  assert.equal(attractions.find((a) => a.name === 'Lacul Roșu').county, 'Județul Harghita');
  assert.ok(report.some((l) => l.startsWith('MISSING') && l.includes('Castelul Peleș')));
});

test('pinned attractions are taken by GeoNames id', () => {
  const rows = [row(7535371, 'Hunyad Castle', 'S', 'CSTL', '21', 0, { lat: 45.74922, lon: 22.88835 })];
  const { attractions } = selectAttractions(rows, [{ name: 'Castelul Corvinilor', geonameId: 7535371 }]);
  assert.deepEqual(attractions, [{ id: 7535371, name: 'Castelul Corvinilor', county: 'Județul Hunedoara',
    lat: 45.74922, lon: 22.88835, kind: 'attraction' }]);
  assert.equal(ATTRACTIONS.length, 38);
  assert.ok(ATTRACTIONS.every((a) => a.geonameId), 'every attraction is pinned');
});

test('unzipEntry reads a deflated file out of a zip archive', () => {
  const content = Buffer.from('683506\tBucharest\n', 'utf8');
  const data = deflateRawSync(content);
  const name = Buffer.from('RO.txt');
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(content.length, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);
  const cdOffset = local.length + name.length + data.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length + name.length, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  const zip = Buffer.concat([local, name, data, central, name, eocd]);
  assert.equal(unzipEntry(zip, 'RO.txt'), content.toString('utf8'));
});
