import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/prng.js';
import { shuffle, buildDeck, draw } from '../src/deck.js';

test('mulberry32 is deterministic for a seed', () => {
  const a = mulberry32(123);
  const b = mulberry32(123);
  assert.equal(a(), b());
  assert.equal(a(), b());
});

test('shuffle is a permutation and deterministic per seed', () => {
  const input = Array.from({ length: 10 }, (_, i) => i);
  const s1 = shuffle(input, 42);
  const s2 = shuffle(input, 42);
  assert.deepEqual(s1, s2);                 // same seed => same order
  assert.deepEqual([...s1].sort((a, b) => a - b), input); // still a permutation
  assert.notDeepEqual(shuffle(input, 7), s1); // different seed => different order
});

test('shuffle does not mutate its input', () => {
  const input = [1, 2, 3, 4, 5];
  shuffle(input, 1);
  assert.deepEqual(input, [1, 2, 3, 4, 5]);
});

test('buildDeck takes a random subset of given size', () => {
  const cities = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `c${i}` }));
  const deck = buildDeck(cities, 30, 99);
  assert.equal(deck.length, 30);
  const ids = new Set(deck.map((c) => c.id));
  assert.equal(ids.size, 30); // no duplicates
});

test('draw returns next card and advances position', () => {
  const state = { cards: [{ id: 1 }, { id: 2 }, { id: 3 }], pos: 0 };
  const { card, next } = draw(state);
  assert.equal(card.id, 1);
  assert.equal(next.pos, 1);
  assert.equal(state.pos, 0); // original untouched
});
