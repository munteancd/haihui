import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPlacementCorrect, isArmInsertCorrect, countWrong } from '../src/rules-cardinal.js';

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

// The Oslo→Copenhaga→Berlin→Palermo south arm, inserting Geneva between Berlin and Palermo.
const oslo   = { id: 10, name: 'Oslo', lat: 59.9, lon: 10.7 };
const copen  = { id: 11, name: 'Copenhaga', lat: 55.7, lon: 12.6 };
const berlin = { id: 12, name: 'Berlin', lat: 52.5, lon: 13.4 };
const palermo = { id: 13, name: 'Palermo', lat: 38.1, lon: 13.4 };
const geneva = { id: 14, name: 'Geneva', lat: 46.2, lon: 6.1 };

test('south arm: appending a city farther south than the tip is correct', () => {
  const arm = [copen, berlin]; // anchor oslo, arm grows to smaller latitudes
  assert.equal(isArmInsertCorrect(arm, oslo, 'S', 2, palermo), true); // tip
});

test('south arm: inserting Geneva between Berlin and Palermo is correct', () => {
  const arm = [copen, berlin, palermo];
  // Geneva lat 46.2 is below Berlin (52.5) and above Palermo (38.1) → fits at index 2
  assert.equal(isArmInsertCorrect(arm, oslo, 'S', 2, geneva), true);
});

test('south arm: inserting a too-southern city between Copenhaga and Berlin is wrong', () => {
  const arm = [copen, berlin, palermo];
  const madrid = { lat: 40.4, lon: -3.7 };
  // index 1 sits between Copenhaga (55.7) and Berlin (52.5): Madrid 40.4 is below Berlin → wrong
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

test('countWrong ignores the anchor and removed cards', () => {
  const placements = [
    { city: brasov, dir: null, isCorrect: true },          // anchor
    { city: zalau, dir: 'N', isCorrect: true },
    { city: zalau, dir: 'S', isCorrect: false },           // wrong, still on board
    { city: zalau, dir: 'E', isCorrect: false, removed: true }, // wrong but knocked off
  ];
  assert.equal(countWrong(placements), 1);
});
