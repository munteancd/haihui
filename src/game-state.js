import { buildDeck, draw } from './deck.js';
import { isArmInsertCorrect, countWrong } from './rules-cardinal.js';
import { isInsertCorrect, countWrongPopulation } from './rules-population.js';

const START_DIAMONDS = 5;
const CHECKPOINT_EVERY = 15;

// Difficulty = how many cities are in play, kept to the most populous (best-known) ones.
// Easier tiers use a small, famous pool; Legendar uses everything.
export const DIFFICULTY = { usor: 200, mediu: 800, greu: 2000, legendar: Infinity };

// The pool of cities a difficulty draws from: the top `poolSize` by population.
export function pickPool(cities, poolSize) {
  if (poolSize === Infinity || cities.length <= poolSize) return cities.slice();
  return [...cities].sort((a, b) => b.pop - a.pop).slice(0, poolSize);
}

// Build a fresh game. The anchor (first card) is laid automatically and is always
// "correct" since there is nothing to compare it to.
export function createGame({ variant, numTurns, seed, players, cities, difficulty = 'legendar' }) {
  const pool = pickPool(cities, DIFFICULTY[difficulty] ?? Infinity);
  const deckSize = Math.min(numTurns, pool.length);
  const deckState = { cards: buildDeck(pool, deckSize, seed), pos: 0 };
  const { card: anchor, next } = draw(deckState);

  const anchorPlacement =
    variant === 'cardinal'
      ? { playerId: null, city: anchor, dir: null, index: null, isCorrect: true, revealed: false }
      : { playerId: null, city: anchor, index: 0, isCorrect: true, revealed: false };

  return {
    variant,
    numTurns,
    seed,
    difficulty,
    players: players.map((p) => ({ ...p, diamonds: START_DIAMONDS })),
    currentPlayerIndex: 0,
    deck: next,
    placements: [anchorPlacement],
    line: variant === 'population' ? [anchor] : undefined,   // ordered cities for population
    arms: variant === 'cardinal' ? { N: [], S: [], E: [], V: [] } : undefined, // four arms of the +
    removed: [],               // cards knocked off the board by a successful contra
    lastMove: null,            // { placementIndex, placerIndex } open to challenge
    cardsPlayed: 1,
    phase: 'placing',          // 'placing' | 'challenge_window' | 'checkpoint' | 'ended'
    checkpointEvery: CHECKPOINT_EVERY,
    checkpointEstimates: {},   // playerId -> guessed wrong-count during a checkpoint
    lastCheckpointAt: 0,       // cardsPlayed value of the last resolved checkpoint
  };
}

// The current player lays the drawn card. `move` is { dir, index } for cardinal
// (which arm, and where along it) or { index } for population. Correctness is computed
// but stays hidden until the card is revealed by a contra or checkpoint.
export function placeCard(state, move) {
  const { card, next } = draw(state.deck);
  const placerIndex = state.currentPlayerIndex;
  const placerId = state.players[placerIndex].id;

  let placement;
  let line = state.line;
  let arms = state.arms;

  if (state.variant === 'cardinal') {
    const anchorCity = state.placements[0].city;
    const arm = state.arms[move.dir];
    const isCorrect = isArmInsertCorrect(arm, anchorCity, move.dir, move.index, card);
    const newArm = arm.slice();
    newArm.splice(move.index, 0, card);
    arms = { ...state.arms, [move.dir]: newArm };
    placement = { playerId: placerId, city: card, dir: move.dir, index: move.index, isCorrect, revealed: false };
  } else {
    const isCorrect = isInsertCorrect(state.line, move.index, card);
    placement = { playerId: placerId, city: card, index: move.index, isCorrect, revealed: false };
    line = state.line.slice();
    line.splice(move.index, 0, card);
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
    // challenge window opens for the player to the RIGHT of the placer first
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

// After a challenge resolves (or is fully passed), the placer's neighbor takes the
// next turn and the challenge window closes.
function closeWindow(state, extra = {}) {
  const nextPlacer = (state.lastMove.placerIndex + 1) % state.players.length;
  return {
    ...state, phase: 'placing', lastMove: null, currentPlayerIndex: nextPlacer, ...extra,
  };
}

// The current eligible player challenges the last placement. Either way the card is
// revealed (its data is turned face-up). A correct contra (the placement was wrong)
// also knocks that card off the board into the removed pile.
export function challenge(state) {
  const challengerIndex = state.currentPlayerIndex;
  const placerIndex = state.lastMove.placerIndex;
  const idx = state.lastMove.placementIndex;
  const placement = state.placements[idx];
  const contraCorrect = !placement.isCorrect;

  // correct contra: challenger takes from placer; wrong contra: challenger gives to placer
  const players = contraCorrect
    ? moveDiamond(state.players, placerIndex, challengerIndex)
    : moveDiamond(state.players, challengerIndex, placerIndex);

  // Reveal the challenged card so everyone can verify it on the result screen.
  const placements = state.placements.map((p, i) =>
    i === idx ? { ...p, revealed: true, removed: contraCorrect } : p);

  let line = state.line;
  let arms = state.arms;
  let removed = state.removed;
  if (contraCorrect) {
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
  // turn, so the diamond transfer and the reveal are actually seen.
  return {
    ...state, players, placements, line, arms, removed,
    phase: 'contra_result',
    lastResult: {
      placementIndex: idx, placerIndex, contraCorrect,
      cardName: placement.city.name,
      placerName: state.players[placerIndex].name,
      challengerName: state.players[challengerIndex].name,
    },
  };
}

// Leave the contra result screen. A card that stayed on the board flips back to its name;
// the next player (to the placer's right) starts placing.
export function continueAfterContra(state) {
  const r = state.lastResult;
  const nextPlacer = (r.placerIndex + 1) % state.players.length;
  const placements = state.placements.map((p, i) =>
    i === r.placementIndex && !p.removed ? { ...p, revealed: false } : p);
  return {
    ...state, placements, phase: 'placing',
    currentPlayerIndex: nextPlacer, lastMove: null, lastResult: null,
  };
}

// The current eligible player declines. The right passes to the next player (not the
// placer). When it returns to the placer, the window closes with nobody challenging.
export function passChallenge(state) {
  const nextEligible = (state.currentPlayerIndex + 1) % state.players.length;
  if (nextEligible === state.lastMove.placerIndex) {
    return closeWindow(state);
  }
  return { ...state, currentPlayerIndex: nextEligible };
}

function boardWrongCount(state) {
  return state.variant === 'cardinal'
    ? countWrong(state.placements)
    : countWrongPopulation(state.placements.slice(1));
}

export function needsCheckpoint(state) {
  return (
    state.cardsPlayed > 0 &&
    state.cardsPlayed % state.checkpointEvery === 0 &&
    state.cardsPlayed !== state.lastCheckpointAt // don't re-trigger once resolved
  );
}

// estimates: { playerId -> guessedWrongCount }. Exact guessers get +2 from bank;
// if none exact, the closest (by absolute distance) get +1 each.
export function resolveCheckpoint(state, estimates) {
  const truth = boardWrongCount(state);
  const exact = state.players.filter((p) => estimates[p.id] === truth);

  let players;
  if (exact.length > 0) {
    const winnerIds = new Set(exact.map((p) => p.id));
    players = state.players.map((p) =>
      winnerIds.has(p.id) ? { ...p, diamonds: p.diamonds + 2 } : p);
  } else {
    const dist = (p) => Math.abs(estimates[p.id] - truth);
    const best = Math.min(...state.players.map(dist));
    players = state.players.map((p) =>
      dist(p) === best ? { ...p, diamonds: p.diamonds + 1 } : p);
  }
  return {
    ...state, players, phase: 'placing', checkpointEstimates: {},
    lastCheckpointAt: state.cardsPlayed,
  };
}

export function isGameOver(state) {
  return state.cardsPlayed >= state.numTurns;
}

export function winners(state) {
  const max = Math.max(...state.players.map((p) => p.diamonds));
  return state.players.filter((p) => p.diamonds === max);
}
