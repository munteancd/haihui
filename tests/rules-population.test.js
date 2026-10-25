import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isInsertCorrect, lineNeighbours, isContestedPairCorrect,
  wrongCardsPopulation } from '../src/rules-population.js';

// line is the current ordered array of placed cities, bottom (fewest people) to top
const line = [{ id: 1, pop: 100 }, { id: 2, pop: 500 }, { id: 3, pop: 900 }];

test('insert between two cities fits when pop fits the gap', () => {
  assert.equal(isInsertCorrect(line, 1, { pop: 300 }), true); // between 100 and 500
});

test('insert between two cities does not fit when pop breaks order', () => {
  assert.equal(isInsertCorrect(line, 1, { pop: 700 }), false); // 700 > 500
});

test('insert at the bottom fits only if smallest', () => {
  assert.equal(isInsertCorrect(line, 0, { pop: 50 }), true);
  assert.equal(isInsertCorrect(line, 0, { pop: 150 }), false);
});

test('insert at the top fits only if largest', () => {
  assert.equal(isInsertCorrect(line, 3, { pop: 1000 }), true);
  assert.equal(isInsertCorrect(line, 3, { pop: 800 }), false);
});

test('equal populations count as correct', () => {
  assert.equal(isInsertCorrect(line, 1, { pop: 500 }), true);
  assert.equal(isContestedPairCorrect({ pop: 500 }, { pop: 500 }, 'prev'), true);
  assert.equal(isContestedPairCorrect({ pop: 500 }, { pop: 500 }, 'next'), true);
});

test('lineNeighbours: below is prev, above is next; ends have one', () => {
  assert.deepEqual(lineNeighbours(line, 1).map((n) => [n.side, n.city.id]), [['prev', 1], ['next', 3]]);
  assert.deepEqual(lineNeighbours(line, 0).map((n) => [n.side, n.city.id]), [['next', 2]]);
  assert.deepEqual(lineNeighbours(line, 2).map((n) => [n.side, n.city.id]), [['prev', 2]]);
});

test('a contest judges only the chosen neighbour', () => {
  // 700 between 100 and 500: fine against the one below, wrong against the one above.
  assert.equal(isContestedPairCorrect({ pop: 700 }, line[0], 'prev'), true);
  assert.equal(isContestedPairCorrect({ pop: 700 }, line[1], 'next'), false);
});

test('wrongCardsPopulation walks up and down from the start card', () => {
  // The start card (id 10, pop 500) sits in the middle of the line (bottom → top).
  const l = [
    { id: 1, pop: 300 },  // down: 300 ≤ 400 → ok
    { id: 2, pop: 600 },  // down: 600 > 400 → wrong (reference stays 400)
    { id: 3, pop: 400 },  // down: 400 ≤ 500 → ok, new reference
    { id: 10, pop: 500 }, // start card
    { id: 4, pop: 450 },  // up: 450 < 500 → wrong (reference stays 500)
    { id: 5, pop: 800 },  // up: 800 ≥ 500 → ok
  ];
  assert.deepEqual(wrongCardsPopulation(l, 10).map((c) => c.id).sort(), [2, 4]);
});
