import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inEurope, pickPerCountry, assignTiers, buildDeck, distanceKm, parseRow } from '../tools/build-cities.mjs';

// A minimal row as parseRow() returns it.
const city = (id, name, country, pop, { lat = 45, lon = 25, fcode = 'PPL', names = 30 } = {}) =>
  ({ id, name, country, pop, lat, lon, fcode, names });

test('parseRow reads the GeoNames columns and counts the alternate names', () => {
  const f = Array(19).fill('');
  Object.assign(f, { 0: '683506', 1: 'Bucharest', 3: 'Bucarest,Bukarest,București', 4: '44.43225',
    5: '26.10626', 7: 'PPLC', 8: 'RO', 14: '1877155' });
  assert.deepEqual(parseRow(f.join('\t')), { id: 683506, name: 'Bucharest', names: 3, lat: 44.43225,
    lon: 26.10626, fcode: 'PPLC', country: 'RO', pop: 1877155 });
});

test('Europe: whole European countries, Russia west of the Urals, Turkey west of the Bosphorus', () => {
  assert.ok(inEurope(city(1, 'Paris', 'FR', 1, { lat: 48.85, lon: 2.35 })));
  assert.ok(inEurope(city(2, 'Moscow', 'RU', 1, { lat: 55.75, lon: 37.6 })));
  assert.ok(!inEurope(city(3, 'Novosibirsk', 'RU', 1, { lat: 55, lon: 82.9 })));
  assert.ok(inEurope(city(4, 'Istanbul', 'TR', 1, { lat: 41.01, lon: 28.95 })));
  assert.ok(!inEurope(city(5, 'Üsküdar', 'TR', 1, { lat: 41.02, lon: 29.02 })));
  assert.ok(!inEurope(city(6, 'Ankara', 'TR', 1, { lat: 39.9, lon: 32.85 })));
  assert.ok(!inEurope(city(7, 'Cairo', 'EG', 1, { lat: 30, lon: 31.2 })));
});

test('per country: biggest first, no city sections, no repeated names, no suburbs', () => {
  const rows = [
    city(1, 'Big', 'XX', 9e6, { lat: 40, lon: 20 }),
    city(2, 'Borough', 'XX', 2e6, { lat: 40.05, lon: 20.05 }),   // ~7 km away: a suburb
    city(3, 'Section 5', 'XX', 3e6, { lat: 41, lon: 21, fcode: 'PPLX' }),
    city(4, 'Twin', 'XX', 1e6, { lat: 42, lon: 22 }),
    city(5, 'Twin', 'XX', 5e5, { lat: 43, lon: 23 }),             // same name, smaller
    city(6, 'Far', 'XX', 4e5, { lat: 44, lon: 24 }),
    city(7, 'Other', 'YY', 1e5, { lat: 40.01, lon: 20.01 }),      // other country: not a suburb
  ];
  assert.deepEqual(pickPerCountry(rows, 10).map((c) => c.id).sort(), [1, 4, 6, 7]);
  assert.deepEqual(pickPerCountry(rows, 2).filter((c) => c.country === 'XX').map((c) => c.id), [1, 4]);
  assert.ok(Math.abs(distanceKm({ lat: 44.43, lon: 26.1 }, { lat: 46.77, lon: 23.6 }) - 324) < 5); // București–Cluj
});

test('tiers: capitals first, then known big cities, a per-country cap, one card per name', () => {
  const cities = [
    city(1, 'Megacity', 'AA', 2e7),
    city(2, 'Second', 'AA', 1e7),
    city(3, 'Obscure', 'AA', 9e6, { names: 5 }),        // few names abroad: not easy
    city(4, 'Capital', 'BB', 5e5, { fcode: 'PPLC' }),
    city(5, 'Megacity', 'BB', 8e6),                      // name already taken by an easy card
    city(6, 'Third', 'AA', 7e6),
  ];
  const tiers = [{ size: 3, cap: 2, minNames: 25, capitalPop: 1e5 }, { size: 10, cap: 10, minNames: 1, capitalPop: 0 }];
  const tierOf = Object.fromEntries(assignTiers(cities, tiers).map((c) => [c.id, c.tier]));
  assert.deepEqual(tierOf, { 1: 1, 2: 1, 3: 2, 4: 1, 5: 3, 6: 2 });
});

test('a built deck lists cards easiest first, with Romanian spelling for RO/MD names', () => {
  const rows = [city(1, 'Chisinau', 'MD', 6e5, { fcode: 'PPLC' }), city(2, 'Iaşi', 'RO', 3e5, { lat: 47, lon: 27 })];
  const deck = buildDeck(rows, { perCountry: 5, filter: () => true, tiers: [{ size: 1, cap: 1, minNames: 1, capitalPop: 0 }] });
  assert.deepEqual(deck.map((c) => [c.name, c.tier]), [['Chișinău', 1], ['Iași', 2]]);
  assert.deepEqual(Object.keys(deck[0]), ['id', 'name', 'country', 'lat', 'lon', 'pop', 'tier']);
});
