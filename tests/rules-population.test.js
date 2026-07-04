import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isInsertCorrect, countWrongPopulation } from '../src/rules-population.js';

// line is the current ordered array of placed cities (by play, meant to be ascending pop)
const line = [{ id: 1, pop: 100 }, { id: 2, pop: 500 }, { id: 3, pop: 900 }];

test('insert between two cities is correct when pop fits the gap', () => {
  assert.equal(isInsertCorrect(line, 1, { pop: 300 }), true); // between 100 and 500
});

test('insert between two cities is wrong when pop breaks order', () => {
  assert.equal(isInsertCorrect(line, 1, { pop: 700 }), false); // 700 > 500
});

test('insert at the far left is correct only if smallest', () => {
  assert.equal(isInsertCorrect(line, 0, { pop: 50 }), true);
  assert.equal(isInsertCorrect(line, 0, { pop: 150 }), false);
});

test('insert at the far right is correct only if largest', () => {
  assert.equal(isInsertCorrect(line, 3, { pop: 1000 }), true);
  assert.equal(isInsertCorrect(line, 3, { pop: 800 }), false);
});

test('countWrongPopulation counts placements flagged incorrect', () => {
  const placements = [
    { isCorrect: true }, { isCorrect: false }, { isCorrect: true }, { isCorrect: false },
  ];
  assert.equal(countWrongPopulation(placements), 2);
});
