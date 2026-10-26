import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, placeCard } from '../src/game-state.js';
import { isArmInsertCorrect } from '../src/rules-cardinal.js';
import { isBot, botPlace, botDecideChallenge, botEstimate, botNames, BOT_LEVELS, BOT_NAMES } from '../src/bot.js';

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

// Run `fn` with Math.random pinned to `value`.
function withRandom(value, fn) {
  const real = Math.random;
  Math.random = () => value;
  try { return fn(); } finally { Math.random = real; }
}

// A cardinal game where `level`'s bot is about to act: anchor 45 on a hand-built N arm.
function levelGame(level, armLats, drawLat) {
  const anchor = { id: 100, name: 'A', lat: 45, lon: 25, pop: 1 };
  const c = (id, lat) => ({ id, name: `X${id}`, lat, lon: 25, pop: 1 });
  const ps = [{ id: 'b1', name: 'Bot', isBot: true, level }, { id: 'you', name: 'Tu' }];
  const g = createGame({ variant: 'cardinal', seed: 3, players: ps, cards: cities });
  return { ...g, placements: [{ playerId: null, city: anchor, dir: null, index: null }],
    arms: { N: armLats.map((lat, i) => c(i + 1, lat)), S: [], E: [], V: [] },
    deck: { cards: [c(50, drawLat)], pos: 0 } };
}

test('bot levels: the same roll places correctly for an expert and wrongly for an easy bot', () => {
  assert.deepEqual(Object.keys(BOT_LEVELS), ['usor', 'mediu', 'greu', 'expert']);
  const placedRight = (level) => withRandom(0.6, () => {
    const before = levelGame(level, [50, 55], 52);
    const after = botPlace(before);
    const p = after.placements[after.lastMove.placementIndex];
    return isArmInsertCorrect(before.arms[p.dir], before.placements[0].city, p.dir, p.index, p.city);
  });
  assert.equal(placedRight('expert'), true);
  assert.equal(placedRight('usor'), false);
});

test('bot levels: an easy bot lets a wrong card go where a hard one contests it', () => {
  // the card at 57 sits between 50 and 55: wrong
  const wrongPlaced = (level) => {
    const g = levelGame(level, [50, 55], 57);
    const ps = [g.players[1], g.players[0]];               // the human places, the bot judges
    return placeCard({ ...g, players: ps, currentPlayerIndex: 0 }, { dir: 'N', index: 1 });
  };
  assert.equal(withRandom(0.5, () => botDecideChallenge(wrongPlaced('usor'))).phase, 'placing');
  assert.equal(withRandom(0.5, () => botDecideChallenge(wrongPlaced('greu'))).phase, 'contra_result');
});

test('an expert bot guesses the true number of wrong cards', () => {
  const g = { ...levelGame('expert', [50, 48, 60], 70), cardsPlayed: 15 }; // 48 is wrong
  assert.equal(botEstimate(g, g.players[0]), 1);
});

test('bots get different funny names', () => {
  const names = botNames(5);
  assert.equal(new Set(names).size, 5);
  assert.ok(names.every((n) => BOT_NAMES.includes(n)));
});
