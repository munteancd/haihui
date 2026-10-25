import { shuffle, draw } from './deck.js';
import { armNeighbours, isContestedPairCorrect as isArmPairCorrect, wrongCards } from './rules-cardinal.js';
import { lineNeighbours, isContestedPairCorrect as isLinePairCorrect, wrongCardsPopulation } from './rules-population.js';

export const START_DIAMONDS = 4;
export const ROUND_SIZE = 15;      // cards placed per round (the start card not counted)
export const DEFAULT_ROUNDS = 3;

// Shuffle the pool and split it into the set-aside start cards (one per round) and the
// draw pile (ROUND_SIZE cards per round). Start cards never come out of the draw pile.
export function dealDeck(pool, numRounds, seed) {
  const shuffled = shuffle(pool, seed);
  return {
    startCards: shuffled.slice(0, numRounds),
    cards: shuffled.slice(numRounds, numRounds + numRounds * ROUND_SIZE),
  };
}

// An empty board around a start card. The start card is laid automatically and is never
// judged itself: it is the reference everything else is compared to.
function freshBoard(variant, anchor) {
  return {
    placements: [variant === 'cardinal'
      ? { playerId: null, city: anchor, dir: null, index: null }
      : { playerId: null, city: anchor, index: null }],
    line: variant === 'population' ? [anchor] : undefined,             // ordered bottom → top
    arms: variant === 'cardinal' ? { N: [], S: [], E: [], V: [] } : undefined, // the + arms
    removed: [],               // cards knocked off the board by a successful contra
  };
}

// Build a fresh game from `cards` (the deck's pool for this variant).
export function createGame({ variant, numRounds = DEFAULT_ROUNDS, seed, players, cards, deckId = null, difficulty = null }) {
  const { startCards, cards: pile } = dealDeck(cards, numRounds, seed);
  return {
    variant,
    numRounds,
    roundSize: ROUND_SIZE,
    seed,
    deckId,
    difficulty,
    players: players.map((p) => ({ ...p, diamonds: START_DIAMONDS })),
    currentPlayerIndex: 0,
    deck: { cards: pile, pos: 0 },
    startCards,
    round: 1,
    ...freshBoard(variant, startCards[0]),
    lastMove: null,            // { placementIndex, placerIndex } open to challenge
    lastResult: null,          // outcome of the last contra, for its result screen
    cardsPlayed: 0,            // cards placed from the draw pile so far (start cards excluded)
    // 'placing' | 'challenge_window' | 'contra_result' | 'checkpoint_reveal' | 'game_over'
    // (the scoring GUESS step is 'placing' + needsCheckpoint(); the reveal is its own phase)
    phase: 'placing',
    lastCheckpointAt: 0,       // cardsPlayed value of the last resolved scoring
    lastCheckpoint: null,      // result of the last scoring, for its reveal screen
  };
}

// The current player lays the drawn card. `move` is { dir, index } for cardinal
// (which arm, and where along it) or { index } for population. Nothing is judged now:
// a contra or the next scoring decides whether it was right.
export function placeCard(state, move) {
  const { card, next } = draw(state.deck);
  const placerIndex = state.currentPlayerIndex;
  const placerId = state.players[placerIndex].id;

  let placement;
  let line = state.line;
  let arms = state.arms;
  if (state.variant === 'cardinal') {
    const arm = state.arms[move.dir].slice();
    arm.splice(move.index, 0, card);
    arms = { ...state.arms, [move.dir]: arm };
    placement = { playerId: placerId, city: card, dir: move.dir, index: move.index };
  } else {
    line = state.line.slice();
    line.splice(move.index, 0, card);
    placement = { playerId: placerId, city: card, index: move.index };
  }

  return {
    ...state,
    deck: next,
    placements: [...state.placements, placement],
    line,
    arms,
    cardsPlayed: state.cardsPlayed + 1,
    phase: 'challenge_window',
    lastMove: { placementIndex: state.placements.length, placerIndex },
    // the next player in turn order gets the first chance to contest
    currentPlayerIndex: (placerIndex + 1) % state.players.length,
  };
}

// The winner always gains a diamond; the loser gives one only if they have any. Nobody
// drops below zero and nobody is knocked out — when the loser is already empty, the
// winner's diamond comes from the bank instead.
function moveDiamond(players, fromIndex, toIndex) {
  return players.map((p, i) => {
    if (i === fromIndex) return { ...p, diamonds: Math.max(0, p.diamonds - 1) };
    if (i === toIndex) return { ...p, diamonds: p.diamonds + 1 };
    return p;
  });
}

// The neighbours a contest can flip together with the last placed card: just one at a
// tip, two when the card went between two others (then the contester picks). Each is
// { side: 'prev' | 'next', city } — 'prev' is toward the start card (cardinal) or below
// (population), 'next' is outward or above.
export function contestOptions(state) {
  const p = state.placements[state.lastMove.placementIndex];
  return state.variant === 'cardinal'
    ? armNeighbours(state.arms[p.dir], state.placements[0].city, p.index)
    : lineNeighbours(state.line, p.index);
}

// The current eligible player contests the last placement against ONE neighbour (`side`;
// defaults to the only/first one). Only that pair is checked. A correct contra (the pair
// is out of order) knocks the card off the board; either way both cards are shown on the
// result screen.
export function challenge(state, side) {
  const options = contestOptions(state);
  const pick = options.find((o) => o.side === side) ?? options[0];
  const challengerIndex = state.currentPlayerIndex;
  const placerIndex = state.lastMove.placerIndex;
  const idx = state.lastMove.placementIndex;
  const placement = state.placements[idx];
  const pairCorrect = state.variant === 'cardinal'
    ? isArmPairCorrect(placement.city, pick.city, pick.side, placement.dir)
    : isLinePairCorrect(placement.city, pick.city, pick.side);
  const contraCorrect = !pairCorrect;

  // correct contra: challenger takes from placer; wrong contra: challenger gives to placer
  const players = contraCorrect
    ? moveDiamond(state.players, placerIndex, challengerIndex)
    : moveDiamond(state.players, challengerIndex, placerIndex);

  let { placements, line, arms, removed } = state;
  if (contraCorrect) {
    placements = state.placements.map((p, i) => (i === idx ? { ...p, removed: true } : p));
    removed = [...state.removed, placement.city];
    if (state.variant === 'cardinal') {
      const arm = state.arms[placement.dir].slice();
      arm.splice(placement.index, 1);
      arms = { ...state.arms, [placement.dir]: arm };
    } else {
      line = state.line.slice();
      line.splice(placement.index, 1);
    }
  }

  // Pause on a result screen (visible to everyone) instead of jumping straight to the next
  // turn, so the two flipped cards and the diamond transfer are actually seen.
  return {
    ...state, players, placements, line, arms, removed,
    phase: 'contra_result',
    lastResult: {
      placementIndex: idx, placerIndex, challengerIndex, contraCorrect,
      card: placement.city, neighbour: pick.city, side: pick.side, dir: placement.dir ?? null,
      cardName: placement.city.name,
      placerName: state.players[placerIndex].name,
      challengerName: state.players[challengerIndex].name,
    },
  };
}

// Leave the contra result screen: the cards that stayed flip back face-down and the
// player after the placer starts placing.
export function continueAfterContra(state) {
  const nextPlacer = (state.lastResult.placerIndex + 1) % state.players.length;
  return {
    ...state, phase: 'placing',
    currentPlayerIndex: nextPlacer, lastMove: null, lastResult: null,
  };
}

// The current eligible player declines. The right passes to the next player (not the
// placer). When it returns to the placer, the window closes with nobody challenging.
export function passChallenge(state) {
  const nextEligible = (state.currentPlayerIndex + 1) % state.players.length;
  if (nextEligible === state.lastMove.placerIndex) {
    return {
      ...state, phase: 'placing', lastMove: null,
      currentPlayerIndex: (state.lastMove.placerIndex + 1) % state.players.length,
    };
  }
  return { ...state, currentPlayerIndex: nextEligible };
}

// The cards the scoring walk eliminates on the current board.
export function wrongOnBoard(state) {
  const anchor = state.placements[0].city;
  return state.variant === 'cardinal'
    ? wrongCards(anchor, state.arms)
    : wrongCardsPopulation(state.line, anchor.id);
}

function pileEmpty(state) {
  return state.deck.pos >= state.deck.cards.length;
}

// The round in play is the last one: its scoring ends the game.
export function isLastRound(state) {
  return state.round >= state.numRounds || pileEmpty(state);
}

// Cards placed so far in the current round.
export function cardsThisRound(state) {
  return state.cardsPlayed - (state.round - 1) * state.roundSize;
}

// A scoring is due once a round's cards are all placed (or the draw pile runs out).
export function needsCheckpoint(state) {
  return (
    state.cardsPlayed > 0 &&
    state.cardsPlayed !== state.lastCheckpointAt && // don't re-trigger once resolved
    (state.cardsPlayed % state.roundSize === 0 || pileEmpty(state))
  );
}

// estimates: { playerId -> guessedWrongCount }. The truth is how many cards the scoring
// walk eliminates. Exact guessers get +2 from the bank; if none is exact, the closest (by
// absolute distance) get +1 each. This SCORES the guesses but does not yet reveal the
// board — it moves to 'checkpoint_reveal', where the cards flip face-up (so the guess is
// made blind) and the result is shown.
export function resolveCheckpoint(state, estimates) {
  const wrong = wrongOnBoard(state);
  const truth = wrong.length;
  const exact = state.players.filter((p) => estimates[p.id] === truth);

  let scorers;
  let reward;
  if (exact.length > 0) {
    scorers = exact;
    reward = 2;
  } else {
    const dist = (p) => Math.abs(estimates[p.id] - truth);
    const best = Math.min(...state.players.map(dist));
    scorers = state.players.filter((p) => dist(p) === best);
    reward = 1;
  }
  const winnerIds = new Set(scorers.map((p) => p.id));
  const players = state.players.map((p) =>
    winnerIds.has(p.id) ? { ...p, diamonds: p.diamonds + reward } : p);
  return {
    ...state, players, phase: 'checkpoint_reveal',
    lastCheckpointAt: state.cardsPlayed,
    lastCheckpoint: {
      truth, reward, exact: exact.length > 0,
      estimates: { ...estimates },
      wrongIds: wrong.map((c) => c.id),
      round: state.round,
      final: isLastRound(state),
      scorerIds: scorers.map((p) => p.id),
      scorerNames: scorers.map((p) => p.name),
    },
  };
}

// Leave the scoring reveal. After the last round's scoring the game is over (the board
// stays up for the final screen). Otherwise everything is cleared — start card included —
// a new start card comes from the set-aside ones, and whoever's turn it is plays on.
export function continueAfterCheckpoint(state) {
  if (isLastRound(state)) return { ...state, phase: 'game_over' };
  let deck = state.deck;
  let anchor = state.startCards[state.round];
  if (!anchor) ({ card: anchor, next: deck } = draw(deck)); // tiny pool: borrow from the pile
  return {
    ...state,
    deck,
    round: state.round + 1,
    ...freshBoard(state.variant, anchor),
    lastMove: null,
    lastResult: null,
    lastCheckpoint: null,
    phase: 'placing',
  };
}

export function isGameOver(state) {
  return state.phase === 'game_over';
}

export function winners(state) {
  const max = Math.max(...state.players.map((p) => p.diamonds));
  return state.players.filter((p) => p.diamonds === max);
}
