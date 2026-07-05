import { buildDeck, draw } from './deck.js';
import { isArmInsertCorrect, countWrong } from './rules-cardinal.js';
import { isInsertCorrect, countWrongPopulation } from './rules-population.js';

const START_DIAMONDS = 5;
const CHECKPOINT_EVERY = 15;

// Build a fresh game. The anchor (first card) is laid automatically and is always
// "correct" since there is nothing to compare it to.
export function createGame({ variant, numTurns, seed, players, cities }) {
  const deckSize = Math.min(numTurns, cities.length);
  const deckState = { cards: buildDeck(cities, deckSize, seed), pos: 0 };
  const { card: anchor, next } = draw(deckState);

  const anchorPlacement =
    variant === 'cardinal'
      ? { playerId: null, city: anchor, dir: null, index: null, isCorrect: true, revealed: false }
      : { playerId: null, city: anchor, index: 0, isCorrect: true, revealed: false };

  return {
    variant,
    numTurns,
    seed,
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

function moveDiamond(players, fromIndex, toIndex) {
  return players.map((p, i) => {
    if (i === fromIndex) return { ...p, diamonds: p.diamonds - 1 };
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

  // A correct contra reveals the card (its data) as it leaves the board; a failed contra
  // leaves the card on the board face-up (name), so it is not revealed to its data side.
  const placements = state.placements.map((p, i) =>
    i === idx ? { ...p, revealed: contraCorrect, removed: contraCorrect } : p);

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

  return closeWindow({ ...state, players, placements, line, arms, removed });
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
