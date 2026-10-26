import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, dealDeck, placeCard, challenge, contestOptions, passChallenge,
  continueAfterContra, needsCheckpoint, resolveCheckpoint, continueAfterCheckpoint,
  wrongOnBoard, cardsThisRound, isGameOver, winners,
  START_DIAMONDS, ROUND_SIZE, ROUND_SIZES } from '../src/game-state.js';
import { isArmInsertCorrect } from '../src/rules-cardinal.js';

// Enough distinct cities for a full game (3 start cards + 45 to place).
function makeCities(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1, name: `C${i + 1}`,
    lat: 43 + ((i * 7) % 50) / 10, lon: 20 + ((i * 11) % 90) / 10, pop: 1000 + i * 37,
  }));
}
const cities = makeCities(60);
const twoPlayers = [{ id: 'p1', name: 'Cristi' }, { id: 'p2', name: 'Lore' }];

const newGame = (extra = {}) =>
  createGame({ variant: 'cardinal', seed: 5, players: twoPlayers, cards: cities, ...extra });

// A cardinal game whose board is fully controlled: anchor at lat 45 / lon 25, then `deck`.
function rigged(deck, extra = {}) {
  const g = newGame(extra);
  const anchor = { id: 100, name: 'Anchor', lat: 45, lon: 25, pop: 5000 };
  return {
    ...g,
    placements: [{ playerId: null, city: anchor, dir: null, index: null }],
    deck: { cards: deck, pos: 0 },
  };
}
const city = (id, lat, lon = 25, pop = 1000) => ({ id, name: `X${id}`, lat, lon, pop });

// Nobody contests: every eligible player passes until the window closes.
function passAll(g) {
  while (g.phase === 'challenge_window') g = passChallenge(g);
  return g;
}

// Place cards at the N tip (nobody contests) until a scoring is due.
function playRound(g) {
  while (!needsCheckpoint(g)) g = passAll(placeCard(g, { dir: 'N', index: g.arms.N.length }));
  return g;
}

test('createGame seats players with 4 diamonds and lays a start card', () => {
  const g = newGame();
  assert.equal(START_DIAMONDS, 4);
  assert.equal(g.players.length, 2);
  assert.ok(g.players.every((p) => p.diamonds === 4));
  assert.equal(g.placements.length, 1);            // start card already on the table
  assert.equal(g.placements[0].dir, null);
  assert.deepEqual(g.arms, { N: [], S: [], E: [], V: [] });
  assert.deepEqual(g.removed, []);
  assert.equal(g.cardsPlayed, 0);                   // the start card is not a placed card
  assert.equal(g.round, 1);
  assert.equal(g.numRounds, 3);
  assert.equal(g.phase, 'placing');
  assert.equal(g.currentPlayerIndex, 0);
});

test('the draw pile holds 15 cards per round; start cards are set aside outside it', () => {
  const g = newGame();
  assert.equal(ROUND_SIZE, 15);
  assert.equal(g.deck.cards.length, 45);
  assert.equal(g.startCards.length, 3);
  assert.equal(g.placements[0].city.id, g.startCards[0].id);
  const pileIds = new Set(g.deck.cards.map((c) => c.id));
  assert.ok(g.startCards.every((c) => !pileIds.has(c.id)));

  const { startCards, cards } = dealDeck(cities, 2, 9);
  assert.equal(startCards.length, 2);
  assert.equal(cards.length, 30);
});

test('placeCard (cardinal) grows the chosen arm, advances turn, opens challenge window', () => {
  let g = newGame();
  const drawn = g.deck.cards[g.deck.pos];
  g = placeCard(g, { dir: 'N', index: 0 });
  const last = g.placements[g.placements.length - 1];
  assert.equal(last.city.id, drawn.id);
  assert.equal(last.dir, 'N');
  assert.equal(g.arms.N[0].id, drawn.id);
  assert.equal(g.cardsPlayed, 1);
  assert.equal(g.phase, 'challenge_window');
  assert.equal(g.lastMove.placerIndex, 0);
  assert.equal(g.currentPlayerIndex, 1);           // next player may contest first
});

test('placeCard (cardinal) can insert between two cards on an arm', () => {
  let g = rigged([city(1, 35), city(2, 40)]);
  g = passAll(placeCard(g, { dir: 'S', index: 0 })); // 35 at the tip
  g = placeCard(g, { dir: 'S', index: 0 });           // 40 between the anchor and 35
  assert.deepEqual(g.arms.S.map((c) => c.id), [2, 1]);
});

test('placeCard (population) inserts into the line at the chosen index', () => {
  let g = createGame({ variant: 'population', seed: 5, players: twoPlayers, cards: cities });
  const drawn = g.deck.cards[g.deck.pos];
  g = placeCard(g, { index: 0 });
  assert.equal(g.line[0].id, drawn.id);
  assert.equal(g.line.length, 2);
});

test('a card at a tip can only be contested against its inner neighbour', () => {
  let g = rigged([city(1, 50)]);
  g = placeCard(g, { dir: 'N', index: 0 });
  const opts = contestOptions(g);
  assert.equal(opts.length, 1);
  assert.equal(opts[0].side, 'prev');
  assert.equal(opts[0].city.id, 100);              // the start card
});

test('correct contra: placer pays a diamond, card leaves the game, both cards shown', () => {
  let g = rigged([city(1, 40)]);                     // 40 is south of the anchor...
  g = placeCard(g, { dir: 'N', index: 0 });          // ...but placed North
  g = challenge(g);
  assert.equal(g.phase, 'contra_result');
  assert.equal(g.lastResult.contraCorrect, true);
  assert.equal(g.lastResult.card.id, 1);
  assert.equal(g.lastResult.neighbour.id, 100);
  assert.equal(g.players.find((p) => p.id === 'p1').diamonds, 3);
  assert.equal(g.players.find((p) => p.id === 'p2').diamonds, 5);
  assert.equal(g.arms.N.length, 0);
  assert.equal(g.removed.length, 1);
  assert.equal(g.placements[g.placements.length - 1].removed, true);

  g = continueAfterContra(g);
  assert.equal(g.phase, 'placing');
  assert.equal(g.lastMove, null);
  assert.equal(g.lastResult, null);
  assert.equal(g.currentPlayerIndex, 1);           // placer(0) + 1 places next
});

test('wrong contra: contester pays a diamond, both cards stay', () => {
  let g = rigged([city(1, 50)]);
  g = placeCard(g, { dir: 'N', index: 0 });
  g = challenge(g);
  assert.equal(g.lastResult.contraCorrect, false);
  assert.equal(g.players.find((p) => p.id === 'p1').diamonds, 5);
  assert.equal(g.players.find((p) => p.id === 'p2').diamonds, 3);
  assert.equal(g.arms.N.length, 1);
  assert.equal(g.removed.length, 0);
  g = continueAfterContra(g);
  assert.equal(g.phase, 'placing');
});

test('a tie is correct, so contesting it loses', () => {
  let g = rigged([city(1, 45, 30)]);                 // same latitude as the anchor
  g = placeCard(g, { dir: 'S', index: 0 });
  g = challenge(g);
  assert.equal(g.lastResult.contraCorrect, false);
  assert.equal(g.arms.S.length, 1);
});

test('between two cards the contester picks the neighbour, and only that one counts', () => {
  // N arm: anchor 45, then 50, 55. The new card (57) goes between 50 and 55:
  // in order against 50 (below it), out of order against 55 (above it).
  let base = rigged([city(1, 50), city(2, 55), city(3, 57)]);
  base = passAll(placeCard(base, { dir: 'N', index: 0 }));
  base = passAll(placeCard(base, { dir: 'N', index: 1 }));
  base = placeCard(base, { dir: 'N', index: 1 });
  assert.deepEqual(base.arms.N.map((c) => c.id), [1, 3, 2]);
  assert.deepEqual(contestOptions(base).map((o) => [o.side, o.city.id]), [['prev', 1], ['next', 2]]);

  const vsInner = challenge(base, 'prev');
  assert.equal(vsInner.lastResult.contraCorrect, false); // 57 ≥ 50: fine, the card stays
  assert.equal(vsInner.lastResult.neighbour.id, 1);
  assert.equal(vsInner.arms.N.length, 3);

  const vsOuter = challenge(base, 'next');
  assert.equal(vsOuter.lastResult.contraCorrect, true);  // 57 > 55: wrong, the card leaves
  assert.equal(vsOuter.lastResult.neighbour.id, 2);
  assert.deepEqual(vsOuter.arms.N.map((c) => c.id), [1, 2]);
});

test('population contests pick the neighbour below or above', () => {
  let g = createGame({ variant: 'population', seed: 5, players: twoPlayers, cards: cities });
  const anchor = { id: 100, name: 'A', lat: 45, lon: 25, pop: 500 };
  g = { ...g, placements: [{ playerId: null, city: anchor, index: null }], line: [anchor],
    deck: { cards: [city(1, 0, 0, 900), city(2, 0, 0, 1000)], pos: 0 } };
  g = passAll(placeCard(g, { index: 1 }));           // 900 above the start card
  g = placeCard(g, { index: 1 });                    // 1000 between 500 and 900
  assert.deepEqual(contestOptions(g).map((o) => [o.side, o.city.id]), [['prev', 100], ['next', 1]]);
  assert.equal(challenge(g, 'prev').lastResult.contraCorrect, false); // 1000 ≥ 500
  assert.equal(challenge(g, 'next').lastResult.contraCorrect, true);  // 1000 > 900
});

test('passChallenge moves the right to challenge to the next player, then closes', () => {
  let g = rigged([city(1, 40)]);
  g = placeCard(g, { dir: 'N', index: 0 });          // placer p1, current player p2
  g = passChallenge(g);                              // only 2 players: window closes
  assert.equal(g.phase, 'placing');
  assert.ok(g.players.every((p) => p.diamonds === 4));
  assert.equal(g.currentPlayerIndex, 1);             // p2 places next
});

test('a player at zero is not knocked out: a lost contra is paid by the bank', () => {
  let g = rigged([city(1, 40)]);
  g = { ...g, players: g.players.map((p) => (p.id === 'p1' ? { ...p, diamonds: 0 } : p)) };
  g = placeCard(g, { dir: 'N', index: 0 });          // p1 places wrong
  g = challenge(g);                                  // p2 contras correctly
  assert.equal(g.players.find((p) => p.id === 'p1').diamonds, 0);
  assert.equal(g.players.find((p) => p.id === 'p2').diamonds, 5);
});

test('a round is 15 placed cards; the start card does not count', () => {
  let g = newGame();
  for (let i = 0; i < 14; i++) {
    g = passAll(placeCard(g, { dir: 'N', index: g.arms.N.length }));
    assert.equal(needsCheckpoint(g), false);
  }
  g = passAll(placeCard(g, { dir: 'N', index: g.arms.N.length }));
  assert.equal(g.cardsPlayed, 15);
  assert.equal(cardsThisRound(g), 15);
  assert.equal(g.arms.N.length, 15);                 // 15 cards besides the start card
  assert.equal(needsCheckpoint(g), true);
});

test('a game can be set to longer rounds: the pile and the scoring follow the round size', () => {
  assert.deepEqual(ROUND_SIZES, [15, 18, 20, 25]);
  let g = newGame({ numRounds: 2, roundSize: 20 });
  assert.equal(g.roundSize, 20);
  assert.equal(g.deck.cards.length, 40);
  for (let i = 0; i < 19; i++) g = passAll(placeCard(g, { dir: 'N', index: g.arms.N.length }));
  assert.equal(needsCheckpoint(g), false);           // 15 is no longer the end of a round
  g = passAll(placeCard(g, { dir: 'N', index: g.arms.N.length }));
  assert.equal(cardsThisRound(g), 20);
  assert.equal(needsCheckpoint(g), true);
});

// Scoring states: anchor 45 with a hand-built N arm.
function scoringState(armLats, players = [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }]) {
  const g = rigged([city(200, 47), city(201, 48)], { players }); // cards still to draw
  return { ...g, arms: { N: armLats.map((lat, i) => city(i + 1, lat)), S: [], E: [], V: [] }, cardsPlayed: 15 };
}

test('scoring truth comes from walking out from the start card', () => {
  // 60 ok, 55 wrong (ref stays 60), 58 wrong (still below 60).
  const g = scoringState([60, 55, 58]);
  assert.deepEqual(wrongOnBoard(g).map((c) => c.id), [2, 3]);
  const out = resolveCheckpoint(g, { p1: 2, p2: 1 });
  assert.equal(out.lastCheckpoint.truth, 2);
  assert.deepEqual(out.lastCheckpoint.wrongIds, [2, 3]);
});

test('the walk differs from judging each card when it was placed', () => {
  // Placed in order: 60 at the tip (fits), 55 at the tip (did not fit), then 58 at the tip
  // — which fitted next to 55 when it was laid. Judged at placement time only one card
  // was wrong; the walk from the start card compares 58 with 60 and eliminates it too.
  let g = rigged([city(1, 60), city(2, 55), city(3, 58)]);
  const anchor = g.placements[0].city;
  const fitsAtPlacement = [];
  for (let i = 0; i < 3; i++) {
    const card = g.deck.cards[g.deck.pos];
    fitsAtPlacement.push(isArmInsertCorrect(g.arms.N, anchor, 'N', g.arms.N.length, card));
    g = passAll(placeCard(g, { dir: 'N', index: g.arms.N.length }));
  }
  assert.deepEqual(g.arms.N.map((c) => c.lat), [60, 55, 58]);
  assert.deepEqual(fitsAtPlacement, [true, false, true]);  // the old count said 1 wrong
  assert.deepEqual(wrongOnBoard(g).map((c) => c.id), [2, 3]);
});

test('resolveCheckpoint: exact guessers get +2 from the bank', () => {
  const g = scoringState([50, 40],
    [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }, { id: 'p3', name: 'C' }]); // 1 wrong
  const out = resolveCheckpoint(g, { p1: 1, p2: 1, p3: 0 });
  assert.equal(out.players.find((p) => p.id === 'p1').diamonds, 6);
  assert.equal(out.players.find((p) => p.id === 'p2').diamonds, 6);
  assert.equal(out.players.find((p) => p.id === 'p3').diamonds, 4);
  assert.equal(out.lastCheckpoint.reward, 2);
  assert.deepEqual(out.lastCheckpoint.scorerIds, ['p1', 'p2']);
});

test('resolveCheckpoint: nobody exact => closest get +1', () => {
  const g = scoringState([50, 40, 41]);             // 40 and 41 both below 50: 2 wrong
  const out = resolveCheckpoint(g, { p1: 1, p2: 4 }); // |1-2|=1, |4-2|=2 => p1 closest
  assert.equal(out.players.find((p) => p.id === 'p1').diamonds, 5);
  assert.equal(out.players.find((p) => p.id === 'p2').diamonds, 4);
});

test('cards knocked off by a contra are not on the board, so they are not counted', () => {
  let g = rigged([city(1, 40), city(2, 50)]);
  g = continueAfterContra(challenge(placeCard(g, { dir: 'N', index: 0 }))); // 40 removed
  g = passAll(placeCard(g, { dir: 'N', index: 0 }));
  assert.equal(g.removed.length, 1);
  assert.equal(wrongOnBoard(g).length, 0);
});

test('resolveCheckpoint moves to the reveal phase', () => {
  const out = resolveCheckpoint(scoringState([50, 40]), { p1: 1, p2: 0 });
  assert.equal(out.phase, 'checkpoint_reveal');
  assert.equal(out.lastCheckpoint.truth, 1);
  assert.deepEqual(out.lastCheckpoint.scorerNames, ['A']);
  assert.equal(out.lastCheckpoint.final, false);
});

test('checkpoint does not re-trigger after being resolved', () => {
  const base = scoringState([50, 40]);
  assert.equal(needsCheckpoint(base), true);
  const after = resolveCheckpoint(base, { p1: 1, p2: 0 });
  assert.equal(after.lastCheckpointAt, 15);
  assert.equal(needsCheckpoint(after), false);
  assert.equal(needsCheckpoint({ ...after, cardsPlayed: 30 }), true);
});

test('continueAfterCheckpoint clears everything and lays a set-aside start card', () => {
  let g = playRound(newGame());
  g = resolveCheckpoint(g, { p1: 0, p2: 0 });
  const turn = g.currentPlayerIndex;
  const deckPos = g.deck.pos;
  const out = continueAfterCheckpoint(g);
  assert.equal(out.phase, 'placing');
  assert.equal(out.round, 2);
  assert.equal(out.placements.length, 1);
  assert.equal(out.placements[0].city.id, g.startCards[1].id); // the second set-aside card
  assert.deepEqual(out.arms, { N: [], S: [], E: [], V: [] });
  assert.equal(out.removed.length, 0);
  assert.equal(out.lastCheckpoint, null);
  assert.equal(out.deck.pos, deckPos);               // nothing taken from the draw pile
  assert.equal(out.currentPlayerIndex, turn);        // whoever's turn it is plays on
});

test('three rounds, each ending with a scoring; the third one ends the game', () => {
  let g = newGame();
  for (let round = 1; round <= 3; round++) {
    g = playRound(g);
    assert.equal(g.round, round);
    assert.equal(g.cardsPlayed, round * 15);
    assert.equal(isGameOver(g), false);              // the scoring comes first
    g = resolveCheckpoint(g, { p1: 0, p2: 0 });
    assert.equal(g.lastCheckpoint.final, round === 3);
    g = continueAfterCheckpoint(g);
  }
  assert.equal(isGameOver(g), true);
  assert.equal(g.deck.pos, 45);                      // the whole pile was played
});

test('a short draw pile ends the round (and the game) with a final scoring', () => {
  let g = createGame({ variant: 'cardinal', seed: 5, players: twoPlayers, cards: makeCities(23) });
  assert.equal(g.deck.cards.length, 20);             // 23 - 3 start cards
  g = playRound(g);                                  // 15
  g = continueAfterCheckpoint(resolveCheckpoint(g, { p1: 0, p2: 0 }));
  g = playRound(g);                                  // the last 5
  assert.equal(g.cardsPlayed, 20);
  g = resolveCheckpoint(g, { p1: 0, p2: 0 });
  assert.equal(g.lastCheckpoint.final, true);
  assert.equal(isGameOver(continueAfterCheckpoint(g)), true);
});

test('winners: most diamonds', () => {
  const g = { players: [{ id: 'p1', diamonds: 7 }, { id: 'p2', diamonds: 5 }, { id: 'p3', diamonds: 7 }] };
  assert.deepEqual(winners(g).map((p) => p.id), ['p1', 'p3']);
});
