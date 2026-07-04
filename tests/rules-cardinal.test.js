import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPlacementCorrect, countWrong, neighborCell } from '../src/rules-cardinal.js';

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

test('neighborCell offsets by direction', () => {
  assert.deepEqual(neighborCell({ x: 0, y: 0 }, 'N'), { x: 0, y: 1 });
  assert.deepEqual(neighborCell({ x: 0, y: 0 }, 'S'), { x: 0, y: -1 });
  assert.deepEqual(neighborCell({ x: 0, y: 0 }, 'E'), { x: 1, y: 0 });
  assert.deepEqual(neighborCell({ x: 0, y: 0 }, 'V'), { x: -1, y: 0 });
});

test('countWrong counts placements whose direction contradicts reality', () => {
  const placements = [
    { city: brasov, refId: null, dir: null, isCorrect: true },   // anchor
    { city: zalau, refId: 1, dir: 'N', isCorrect: true },
    { city: zalau, refId: 1, dir: 'S', isCorrect: false },
  ];
  assert.equal(countWrong(placements), 1);
});
