import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DECKS, DEFAULT_DECK, poolFor, pickPool } from '../src/decks.js';
import { formatLat, formatLon, formatPop, toArcMinutes } from '../src/geo-format.js';

const romania = {
  cities: [
    { id: 1, name: 'Cluj-Napoca', county: 'Județul Cluj', lat: 46.77, lon: 23.6, pop: 300000 },
    { id: 2, name: 'Călărași', county: 'Județul Călărași', lat: 44.2, lon: 27.3, pop: 6687, popSuspect: true },
  ],
  attractions: [
    { id: 3, name: 'Castelul Bran', county: 'Județul Brașov', lat: 45.51, lon: 25.37, kind: 'attraction' },
  ],
};

test('România is the default deck; Lume is the world deck', () => {
  assert.equal(DEFAULT_DECK, 'romania');
  assert.equal(DECKS.romania.file, 'data/romania.json');
  assert.equal(DECKS.world.file, 'data/cities.json');
});

test('România cardinal plays cities and attractions', () => {
  assert.deepEqual(poolFor('romania', romania, 'cardinal').map((c) => c.id), [1, 2, 3]);
});

test('România population plays cities only (attractions have no population)', () => {
  // and leaves out a city whose population the data flags as unreliable
  assert.deepEqual(poolFor('romania', romania, 'population').map((c) => c.id), [1]);
});

test('Lume keeps its difficulty tiers', () => {
  const world = Array.from({ length: 300 }, (_, i) => ({ id: i, pop: i }));
  assert.equal(poolFor('world', world, 'cardinal', 'usor').length, 200);
  assert.equal(poolFor('world', world, 'population', 'legendar').length, 300);
  assert.equal(poolFor('world', world, 'cardinal', 'usor')[0].pop, 299); // most populous first
});

test('pickPool keeps only the most populous cities', () => {
  const cs = [{ id: 1, pop: 100 }, { id: 2, pop: 900 }, { id: 3, pop: 500 }, { id: 4, pop: 300 }];
  assert.deepEqual(pickPool(cs, 2).map((c) => c.id), [2, 3]);
  assert.equal(pickPool(cs, Infinity).length, 4);
});

test('the committed România deck is real-sized and well-formed', () => {
  const data = JSON.parse(readFileSync(new URL('../data/romania.json', import.meta.url), 'utf8'));
  assert.equal(data.cities.length, 140);
  assert.equal(new Set(data.cities.map((c) => c.name)).size, 140);
  for (const c of [...data.cities, ...data.attractions]) {
    assert.ok(c.lat > 43.5 && c.lat < 48.3 && c.lon > 20.2 && c.lon < 29.8, `${c.name} is in Romania`);
    assert.ok(c.county, `${c.name} has a county`);
  }
  assert.ok(data.cities.every((c) => c.pop > 0));
  assert.ok(data.attractions.every((a) => a.kind === 'attraction' && a.pop === undefined));
  // every county seat is in (41 counties + București)
  assert.equal(new Set(data.cities.map((c) => c.county)).size, 42);
});

test('coordinates read like the printed cards: degrees and minutes', () => {
  assert.equal(formatLat(46.7667), "46° 46' N");
  assert.equal(formatLon(24.7), "24° 42' E");
  assert.equal(formatLon(23.05), "23° 03' E");
  assert.equal(formatLat(-33.8688), "33° 52' S");
  assert.equal(formatLon(-70.6693), "70° 40' V");
  assert.equal(formatLat(45.9999), "46° 00' N");     // minutes round up into the degree
  assert.equal(toArcMinutes(46.7667), 46 * 60 + 46);
  assert.equal(toArcMinutes(-0.5 / 60), -1);          // symmetric rounding below zero
  assert.equal(formatPop(1877155), (1877155).toLocaleString('ro-RO'));
});
