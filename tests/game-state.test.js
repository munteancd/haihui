import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/game-state.js';

const cities = [
  { id: 1, name: 'A', lat: 45, lon: 25, pop: 100 },
  { id: 2, name: 'B', lat: 47, lon: 23, pop: 300 },
  { id: 3, name: 'C', lat: 44, lon: 26, pop: 500 },
  { id: 4, name: 'D', lat: 46, lon: 27, pop: 700 },
];

test('createGame seats players, deals 5 diamonds, plays anchor card', () => {
  const g = createGame({
    variant: 'cardinal',
    numTurns: 20,
    seed: 5,
    players: [{ id: 'p1', name: 'Cristi' }, { id: 'p2', name: 'Lore' }],
    cities,
  });
  assert.equal(g.players.length, 2);
  assert.ok(g.players.every((p) => p.diamonds === 5));
  assert.equal(g.placements.length, 1);            // anchor already on the table
  assert.equal(g.placements[0].refId, null);
  assert.equal(g.placements[0].isCorrect, true);
  assert.equal(g.cardsPlayed, 1);
  assert.equal(g.phase, 'placing');
  assert.equal(g.currentPlayerIndex, 0);           // player after the one who laid the anchor
});
