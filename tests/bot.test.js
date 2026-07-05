import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/game-state.js';
import { isBot, botPlace, botDecideChallenge } from '../src/bot.js';

const cities = [
  { id: 1, name: 'A', lat: 45, lon: 25, pop: 100 },
  { id: 2, name: 'B', lat: 47, lon: 23, pop: 300 },
  { id: 3, name: 'C', lat: 44, lon: 26, pop: 500 },
  { id: 4, name: 'D', lat: 46, lon: 27, pop: 700 },
  { id: 5, name: 'E', lat: 43, lon: 28, pop: 900 },
];

test('isBot detects the flag', () => {
  assert.equal(isBot({ isBot: true }), true);
  assert.equal(isBot({ name: 'x' }), false);
  assert.equal(isBot(undefined), false);
});

test('botPlace makes a legal cardinal move that advances the game', () => {
  const g = createGame({ variant: 'cardinal', numTurns: 20, seed: 3,
    players: [{ id: 'you', name: 'Tu' }, { id: 'b1', name: 'Bot', isBot: true }], cities });
  const after = botPlace(g);
  assert.equal(after.cardsPlayed, g.cardsPlayed + 1);
  assert.equal(after.phase, 'challenge_window');
  const armLen = Object.values(after.arms).reduce((n, a) => n + a.length, 0);
  assert.equal(armLen, 1); // exactly one card placed on some arm
});

test('botPlace makes a legal population move', () => {
  const g = createGame({ variant: 'population', numTurns: 20, seed: 3,
    players: [{ id: 'you', name: 'Tu' }, { id: 'b1', name: 'Bot', isBot: true }], cities });
  const after = botPlace(g);
  assert.equal(after.line.length, 2);
  assert.equal(after.phase, 'challenge_window');
});

test('botDecideChallenge returns a resolved state (contra_result or passed placing)', () => {
  let g = createGame({ variant: 'cardinal', numTurns: 20, seed: 3,
    players: [{ id: 'you', name: 'Tu' }, { id: 'b1', name: 'Bot', isBot: true }], cities });
  g = botPlace(g); // now in a challenge window, bot to decide (currentPlayerIndex advanced)
  const after = botDecideChallenge(g);
  assert.ok(['contra_result', 'placing'].includes(after.phase));
});
