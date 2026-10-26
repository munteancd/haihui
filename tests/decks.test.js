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

test('Lume and Europa play the cards up to the chosen difficulty tier', () => {
  const deck = [1, 1, 2, 3, 4, 4].map((tier, id) => ({ id, name: `City ${id}`, tier, pop: 1000 }));
  for (const id of ['world', 'europe']) {
    assert.equal(poolFor(id, deck, 'cardinal', 'usor').length, 2);
    assert.equal(poolFor(id, deck, 'population', 'mediu').length, 3);
    assert.equal(poolFor(id, deck, 'cardinal', 'greu').length, 4);
    assert.equal(poolFor(id, deck, 'cardinal', 'legendar').length, 6);
  }
  assert.deepEqual(pickPool(deck, 1).map((c) => c.id), [0, 1]);
});

test('a game never deals two cards with the same name: the best-known one stays', () => {
  const deck = [
    { id: 1, name: 'Brest', tier: 3, pop: 1e5 },   // France
    { id: 2, name: 'Brest', tier: 2, pop: 3e5 },   // Belarus, easier tier
    { id: 3, name: 'Alexandria', tier: 4, pop: 5e4 },
    { id: 4, name: 'Alexandria', tier: 4, pop: 5e6 },
    { id: 5, name: 'Paris', tier: 1, pop: 2e6 },
  ];
  assert.deepEqual(poolFor('europe', deck, 'cardinal', 'legendar').map((c) => c.id).sort(), [2, 4, 5]);
  assert.deepEqual(poolFor('europe', deck, 'cardinal', 'greu').map((c) => c.id).sort(), [2, 5]);
});

// The lobby shows DECKS[…].sizes; they must match what the build put in the data.
for (const id of ['world', 'europe']) {
  test(`the committed ${DECKS[id].label} deck matches its tier sizes and is well-formed`, () => {
    const data = JSON.parse(readFileSync(new URL(`../${DECKS[id].file}`, import.meta.url), 'utf8'));
    const sizes = [1, 2, 3, 4].map((t) => pickPool(data, t).length);
    assert.deepEqual(sizes, DECKS[id].sizes);
    assert.equal(new Set(data.map((c) => c.id)).size, data.length);
    for (const c of data) {
      assert.ok(c.name && /^[A-Z]{2}$/.test(c.country), `${c.id} has a name and country`);
      assert.ok(Math.abs(c.lat) <= 90 && Math.abs(c.lon) <= 180 && c.pop > 0, `${c.name} has data`);
    }
    // an easy game never deals two cards with the same name
    const easy = data.filter((c) => c.tier <= 2);
    assert.equal(new Set(easy.map((c) => c.name)).size, easy.length);
  });
}

test('the Europa deck stays in Europe', () => {
  const data = JSON.parse(readFileSync(new URL('../data/europe.json', import.meta.url), 'utf8'));
  for (const c of data) assert.ok(c.lat > 27 && c.lat < 72 && c.lon > -32 && c.lon < 60, `${c.name} (${c.country})`);
  const names = new Set(data.filter((c) => c.tier === 1).map((c) => c.name));
  for (const n of ['Paris', 'London', 'Berlin', 'Rome', 'București', 'Chișinău', 'Istanbul']) assert.ok(names.has(n), n);
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
