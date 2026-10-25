import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPlacementCorrect, isArmInsertCorrect, isPairInOrder, armNeighbours,
  isContestedPairCorrect, walkArm, wrongCards } from '../src/rules-cardinal.js';

const brasov = { id: 1, name: 'Brașov', lat: 45.65, lon: 25.60 };
const zalau  = { id: 2, name: 'Zalău',  lat: 47.19, lon: 23.06 }; // NW of Brașov

test('a NW city is correct placed North', () => {
  assert.equal(isPlacementCorrect(zalau, brasov, 'N'), true);
});

test('a NW city is correct placed West', () => {
  assert.equal(isPlacementCorrect(zalau, brasov, 'V'), true);
});

test('a NW city is wrong placed South', () => {
  assert.equal(isPlacementCorrect(zalau, brasov, 'S'), false);
});

test('a NW city is wrong placed East', () => {
  assert.equal(isPlacementCorrect(zalau, brasov, 'E'), false);
});

test('ties count as correct in every direction', () => {
  const same = { lat: 45.65, lon: 25.60 };
  for (const dir of ['N', 'S', 'E', 'V']) assert.equal(isPlacementCorrect(same, brasov, dir), true, dir);
});

test('coordinates are compared at the precision the card shows (whole arc-minutes)', () => {
  // 45.6501 and 45.6499 both read 45° 39' N: equal, so correct both ways.
  const a = { lat: 45.6501, lon: 0 };
  const b = { lat: 45.6499, lon: 0 };
  assert.equal(isPairInOrder(a, b, 'N'), true);
  assert.equal(isPairInOrder(b, a, 'N'), true);
  assert.equal(isPairInOrder(a, b, 'S'), true);
});

// The Oslo→Copenhaga→Berlin→Palermo south arm, inserting Geneva between Berlin and Palermo.
const oslo   = { id: 10, name: 'Oslo', lat: 59.9, lon: 10.7 };
const copen  = { id: 11, name: 'Copenhaga', lat: 55.7, lon: 12.6 };
const berlin = { id: 12, name: 'Berlin', lat: 52.5, lon: 13.4 };
const palermo = { id: 13, name: 'Palermo', lat: 38.1, lon: 13.4 };
const geneva = { id: 14, name: 'Geneva', lat: 46.2, lon: 6.1 };

test('south arm: appending a city farther south than the tip fits', () => {
  const arm = [copen, berlin]; // anchor oslo, arm grows to smaller latitudes
  assert.equal(isArmInsertCorrect(arm, oslo, 'S', 2, palermo), true); // tip
});

test('south arm: inserting Geneva between Berlin and Palermo fits', () => {
  const arm = [copen, berlin, palermo];
  assert.equal(isArmInsertCorrect(arm, oslo, 'S', 2, geneva), true);
});

test('south arm: inserting a too-southern city between Copenhaga and Berlin does not fit', () => {
  const arm = [copen, berlin, palermo];
  const madrid = { lat: 40.4, lon: -3.7 };
  assert.equal(isArmInsertCorrect(arm, oslo, 'S', 1, madrid), false);
});

test('north arm inserts by increasing latitude; east/west arms by longitude', () => {
  const anchor = { lat: 45, lon: 25 };
  assert.equal(isArmInsertCorrect([], anchor, 'N', 0, { lat: 47, lon: 0 }), true);
  assert.equal(isArmInsertCorrect([], anchor, 'N', 0, { lat: 44, lon: 0 }), false);
  assert.equal(isArmInsertCorrect([], anchor, 'E', 0, { lat: 0, lon: 27 }), true);
  assert.equal(isArmInsertCorrect([], anchor, 'E', 0, { lat: 0, lon: 23 }), false);
  assert.equal(isArmInsertCorrect([], anchor, 'V', 0, { lat: 0, lon: 23 }), true);
  assert.equal(isArmInsertCorrect([], anchor, 'V', 0, { lat: 0, lon: 27 }), false);
});

test('armNeighbours: the first card leans on the anchor; a tip card has only its inner neighbour', () => {
  const arm = [copen, berlin, palermo];
  assert.deepEqual(armNeighbours(arm, oslo, 0).map((n) => [n.side, n.city.name]),
    [['prev', 'Oslo'], ['next', 'Berlin']]);
  assert.deepEqual(armNeighbours(arm, oslo, 2).map((n) => [n.side, n.city.name]), [['prev', 'Berlin']]);
});

test('a contest judges only the chosen neighbour', () => {
  // Geneva (46.2) sits between Copenhaga (55.7) and Berlin (52.5) on the south arm:
  // fine against Copenhaga, out of order against Berlin.
  assert.equal(isContestedPairCorrect(geneva, copen, 'prev', 'S'), true);
  assert.equal(isContestedPairCorrect(geneva, berlin, 'next', 'S'), false);
});

test('walkArm eliminates cards out of order with the last card still standing', () => {
  // N arm from anchor 45: 60 ok, 55 wrong (ref stays 60), 58 wrong, 61 ok.
  const anchor = { id: 0, lat: 45, lon: 0 };
  const arm = [60, 55, 58, 61].map((lat, i) => ({ id: i + 1, lat, lon: 0 }));
  assert.deepEqual(walkArm(anchor, arm, 'N').map((c) => c.id), [2, 3]);
});

test('wrongCards walks all four arms', () => {
  const anchor = { id: 0, lat: 45, lon: 25 };
  const arms = {
    N: [{ id: 1, lat: 44, lon: 0 }],              // wrong: south of the anchor
    S: [{ id: 2, lat: 43, lon: 0 }],              // ok
    E: [{ id: 3, lat: 0, lon: 25 }],              // tie: ok
    V: [{ id: 4, lat: 0, lon: 26 }],              // wrong: east of the anchor
  };
  assert.deepEqual(wrongCards(anchor, arms).map((c) => c.id).sort(), [1, 4]);
});
