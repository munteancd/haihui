import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, placeCard } from '../src/game-state.js';
import { isBot, botPlace, botDecideChallenge, botEstimate } from '../src/bot.js';

const cities = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1, name: `C${i + 1}`, lat: 43 + (i % 7), lon: 21 + ((i * 3) % 8), pop: 100 + i * 50,
}));
const players = [{ id: 'you', name: 'Tu' }, { id: 'b1', name: 'Bot', isBot: true }];

test('isBot detects the flag', () => {
  assert.equal(isBot({ isBot: true }), true);
  assert.equal(isBot({ name: 'x' }), false);
  assert.equal(isBot(undefined), false);
});

test('botPlace makes a legal cardinal move that advances the game', () => {
  const g = createGame({ variant: 'cardinal', seed: 3, players, cards: cities });
  const after = botPlace(g);
  assert.equal(after.cardsPlayed, g.cardsPlayed + 1);
  assert.equal(after.phase, 'challenge_window');
  const armLen = Object.values(after.arms).reduce((n, a) => n + a.length, 0);
  assert.equal(armLen, 1);
});

test('botPlace makes a legal population move', () => {
  const g = createGame({ variant: 'population', seed: 3, players, cards: cities });
  const after = botPlace(g);
  assert.equal(after.line.length, 2);
  assert.equal(after.phase, 'challenge_window');
});

test('botDecideChallenge returns a resolved state (contra_result or passed placing)', () => {
  let g = createGame({ variant: 'cardinal', seed: 3, players, cards: cities });
  g = botPlace(g);
  const after = botDecideChallenge(g);
  assert.ok(['contra_result', 'placing'].includes(after.phase));
});

test('when a bot contests a card between two others, it picks the neighbour that is out of order', () => {
  // N arm: anchor 45, 50, 55; the card 57 sits between 50 and 55 — only 55 exposes it.
  const anchor = { id: 100, name: 'A', lat: 45, lon: 25, pop: 1 };
  const c = (id, lat) => ({ id, name: `X${id}`, lat, lon: 25, pop: 1 });
  let g = createGame({ variant: 'cardinal', seed: 3, players, cards: cities });
  g = { ...g, placements: [{ playerId: null, city: anchor, dir: null, index: null }],
    arms: { N: [c(1, 50), c(2, 55)], S: [], E: [], V: [] }, deck: { cards: [c(3, 57)], pos: 0 } };
  g = placeCard(g, { dir: 'N', index: 1 });
  for (let i = 0; i < 50; i++) {
    const after = botDecideChallenge(g);
    if (after.phase === 'contra_result') {
      assert.equal(after.lastResult.side, 'next');
      assert.equal(after.lastResult.contraCorrect, true);
    }
  }
});

test('botEstimate is a small non-negative number', () => {
  const g = botPlace(createGame({ variant: 'population', seed: 3, players, cards: cities }));
  const e = botEstimate(g);
  assert.ok(Number.isInteger(e) && e >= 0 && e <= 1);
});
