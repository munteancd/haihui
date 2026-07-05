import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, placeCard, challenge, passChallenge,
  needsCheckpoint, resolveCheckpoint, isGameOver, winners } from '../src/game-state.js';

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
  assert.equal(g.placements[0].dir, null);
  assert.equal(g.placements[0].isCorrect, true);
  assert.deepEqual(g.arms, { N: [], S: [], E: [], V: [] });
  assert.deepEqual(g.removed, []);
  assert.equal(g.cardsPlayed, 1);
  assert.equal(g.phase, 'placing');
  assert.equal(g.currentPlayerIndex, 0);           // player after the one who laid the anchor
});

test('placeCard (cardinal) grows the chosen arm, advances turn, opens challenge window', () => {
  let g = createGame({ variant: 'cardinal', numTurns: 20, seed: 5,
    players: [{ id: 'p1', name: 'Cristi' }, { id: 'p2', name: 'Lore' }], cities });
  const drawn = g.deck.cards[g.deck.pos];
  g = placeCard(g, { dir: 'N', index: 0 });

  const last = g.placements[g.placements.length - 1];
  assert.equal(last.city.id, drawn.id);
  assert.equal(last.dir, 'N');
  assert.equal(last.revealed, false);
  assert.equal(typeof last.isCorrect, 'boolean');
  assert.equal(g.arms.N[0].id, drawn.id);          // card is on the north arm
  assert.equal(g.cardsPlayed, 2);
  assert.equal(g.phase, 'challenge_window');
  assert.equal(g.lastMove.placerIndex, 0);
  assert.equal(g.currentPlayerIndex, 1); // next player up
});

test('placeCard (cardinal) can insert between two cards on an arm', () => {
  // anchor A(lat45). Put a card far south, then insert one between anchor and it.
  let g = createGame({ variant: 'cardinal', numTurns: 20, seed: 5,
    players: [{ id: 'p1', name: 'Cristi' }, { id: 'p2', name: 'Lore' }], cities });
  const anchor = g.placements[0].city;
  const far = { id: 90, name: 'Far', lat: anchor.lat - 10, lon: anchor.lon };
  const mid = { id: 91, name: 'Mid', lat: anchor.lat - 5, lon: anchor.lon };
  g = { ...g, deck: { cards: [far, mid], pos: 0 } };
  g = placeCard(g, { dir: 'S', index: 0 });        // Far at tip of south arm
  g = { ...g, phase: 'placing', currentPlayerIndex: g.lastMove.placerIndex }; // skip challenge
  g = placeCard(g, { dir: 'S', index: 0 });        // Mid between anchor and Far
  assert.deepEqual(g.arms.S.map((c) => c.id), [91, 90]);
  const last = g.placements[g.placements.length - 1];
  assert.equal(last.isCorrect, true);              // 40 is between anchor 45 and Far 35
});

test('placeCard (population) inserts into the line at the chosen index', () => {
  let g = createGame({ variant: 'population', numTurns: 20, seed: 5,
    players: [{ id: 'p1', name: 'Cristi' }, { id: 'p2', name: 'Lore' }], cities });
  const drawn = g.deck.cards[g.deck.pos];
  g = placeCard(g, { index: 0 });
  assert.equal(g.line[0].id, drawn.id);
  assert.equal(g.line.length, 2);
});

// Force a known-wrong placement so we can test challenge outcomes deterministically.
function wrongPlacement() {
  let g = createGame({ variant: 'cardinal', numTurns: 20, seed: 5,
    players: [{ id: 'p1', name: 'Cristi' }, { id: 'p2', name: 'Lore' }], cities });
  const anchor = g.placements[0].city;
  const drawn = g.deck.cards[g.deck.pos];
  // pick a direction guaranteed wrong: if drawn is north, place it South, else North
  const dir = drawn.lat > anchor.lat ? 'S' : 'N';
  g = placeCard(g, { dir, index: 0 });
  return g; // placer = p1, challenge window open, currentPlayer = p2 (to the right)
}

test('correct contra: challenger takes a diamond and the card is removed from the board', () => {
  let g = wrongPlacement();
  const arm = g.placements[g.placements.length - 1].dir;
  g = challenge(g); // p2 challenges a wrong placement
  const p1 = g.players.find((p) => p.id === 'p1');
  const p2 = g.players.find((p) => p.id === 'p2');
  assert.equal(p1.diamonds, 4);
  assert.equal(p2.diamonds, 6);
  assert.equal(g.phase, 'placing');
  assert.equal(g.lastMove, null);
  assert.equal(g.arms[arm].length, 0);             // card knocked off its arm
  assert.equal(g.removed.length, 1);               // and into the removed pile
  assert.equal(g.placements[g.placements.length - 1].removed, true);
  assert.equal(g.placements[g.placements.length - 1].revealed, true);
});

test('wrong contra: challenger gives a diamond and the card stays face-up (not revealed)', () => {
  // build a known-correct placement, then challenge it
  let g = createGame({ variant: 'cardinal', numTurns: 20, seed: 5,
    players: [{ id: 'p1', name: 'Cristi' }, { id: 'p2', name: 'Lore' }], cities });
  const anchor = g.placements[0].city;
  const drawn = g.deck.cards[g.deck.pos];
  const dir = drawn.lat > anchor.lat ? 'N' : 'S'; // guaranteed correct
  g = placeCard(g, { dir, index: 0 });
  g = challenge(g);
  const p1 = g.players.find((p) => p.id === 'p1');
  const p2 = g.players.find((p) => p.id === 'p2');
  assert.equal(p1.diamonds, 6);
  assert.equal(p2.diamonds, 4);
  assert.equal(g.arms[dir].length, 1);             // card stays on the board
  assert.equal(g.removed.length, 0);
  assert.equal(g.placements[g.placements.length - 1].revealed, false); // stays face-up (name)
});

test('passChallenge moves the right to challenge to the next player, then closes', () => {
  let g = wrongPlacement(); // placer p1, currentPlayer p2
  g = passChallenge(g);     // p2 passes; only 2 players so window closes back to placer+1
  assert.equal(g.phase, 'placing');
  // nobody challenged: no diamonds moved
  assert.ok(g.players.every((p) => p.diamonds === 5));
  assert.equal(g.currentPlayerIndex, 1); // p2 now places next
});

test('needsCheckpoint is true after every 15th card', () => {
  const base = createGame({ variant: 'cardinal', numTurns: 40, seed: 5,
    players: [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }], cities });
  assert.equal(needsCheckpoint({ ...base, cardsPlayed: 15 }), true);
  assert.equal(needsCheckpoint({ ...base, cardsPlayed: 16 }), false);
  assert.equal(needsCheckpoint({ ...base, cardsPlayed: 30 }), true);
});

test('resolveCheckpoint: exact guessers get +2 from the bank', () => {
  const g = {
    variant: 'cardinal',
    players: [{ id: 'p1', diamonds: 5 }, { id: 'p2', diamonds: 5 }, { id: 'p3', diamonds: 5 }],
    placements: [
      { dir: null, isCorrect: true },
      { dir: 'N', isCorrect: false }, // 1 wrong on the board
    ],
  };
  const estimates = { p1: 1, p2: 1, p3: 0 };
  const out = resolveCheckpoint(g, estimates);
  assert.equal(out.players.find((p) => p.id === 'p1').diamonds, 7);
  assert.equal(out.players.find((p) => p.id === 'p2').diamonds, 7);
  assert.equal(out.players.find((p) => p.id === 'p3').diamonds, 5);
});

test('resolveCheckpoint: nobody exact => closest get +1', () => {
  const g = {
    variant: 'cardinal',
    players: [{ id: 'p1', diamonds: 5 }, { id: 'p2', diamonds: 5 }],
    placements: [{ dir: null, isCorrect: true }, { dir: 'N', isCorrect: false },
      { dir: 'S', isCorrect: false }], // 2 wrong
  };
  const out = resolveCheckpoint(g, { p1: 1, p2: 4 }); // |1-2|=1, |4-2|=2 => p1 closest
  assert.equal(out.players.find((p) => p.id === 'p1').diamonds, 6);
  assert.equal(out.players.find((p) => p.id === 'p2').diamonds, 5);
});

test('resolveCheckpoint: removed cards are not counted as wrong', () => {
  const g = {
    variant: 'cardinal',
    players: [{ id: 'p1', diamonds: 5 }, { id: 'p2', diamonds: 5 }],
    placements: [{ dir: null, isCorrect: true },
      { dir: 'N', isCorrect: false, removed: true }, // knocked off — doesn't count
      { dir: 'S', isCorrect: false }],               // 1 wrong left on the board
  };
  const out = resolveCheckpoint(g, { p1: 1, p2: 2 }); // truth is 1 → p1 exact
  assert.equal(out.players.find((p) => p.id === 'p1').diamonds, 7);
  assert.equal(out.players.find((p) => p.id === 'p2').diamonds, 5);
});

test('isGameOver + winners', () => {
  const g = { numTurns: 4, cardsPlayed: 4,
    players: [{ id: 'p1', diamonds: 7 }, { id: 'p2', diamonds: 5 }] };
  assert.equal(isGameOver(g), true);
  assert.deepEqual(winners(g).map((p) => p.id), ['p1']);
});

test('checkpoint does not re-trigger after being resolved', () => {
  const base = {
    variant: 'cardinal',
    players: [{ id: 'p1', diamonds: 5 }, { id: 'p2', diamonds: 5 }],
    placements: [{ dir: null, isCorrect: true }, { dir: 'N', isCorrect: false }],
    cardsPlayed: 15,
    checkpointEvery: 15,
    lastCheckpointAt: 0,
  };
  assert.equal(needsCheckpoint(base), true);           // 15th card -> checkpoint due
  const after = resolveCheckpoint(base, { p1: 1, p2: 0 });
  assert.equal(after.lastCheckpointAt, 15);
  assert.equal(needsCheckpoint(after), false);         // resolved -> no re-trigger at 15
  assert.equal(needsCheckpoint({ ...after, cardsPlayed: 30 }), true); // next one at 30
});
