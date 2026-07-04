import { buildDeck, draw } from './deck.js';
import { isPlacementCorrect, neighborCell } from './rules-cardinal.js';
import { isInsertCorrect } from './rules-population.js';

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
      ? { playerId: null, city: anchor, refId: null, dir: null, cell: { x: 0, y: 0 }, isCorrect: true }
      : { playerId: null, city: anchor, index: 0, isCorrect: true };

  return {
    variant,
    numTurns,
    seed,
    players: players.map((p) => ({ ...p, diamonds: START_DIAMONDS })),
    currentPlayerIndex: 0,
    deck: next,
    placements: [anchorPlacement],
    line: variant === 'population' ? [anchor] : undefined, // ordered cities for population
    lastMove: null,            // { placementIndex, placerIndex } open to challenge
    cardsPlayed: 1,
    phase: 'placing',          // 'placing' | 'challenge_window' | 'checkpoint' | 'ended'
    checkpointEvery: CHECKPOINT_EVERY,
    checkpointEstimates: {},   // playerId -> guessed wrong-count during a checkpoint
  };
}

// The current player lays the drawn card. `move` is { refId, dir } for cardinal
// or { index } for population. Correctness is computed but stays hidden in the UI.
export function placeCard(state, move) {
  const { card, next } = draw(state.deck);
  const placerIndex = state.currentPlayerIndex;
  const placerId = state.players[placerIndex].id;

  let placement;
  let line = state.line;

  if (state.variant === 'cardinal') {
    const ref = state.placements.find((p) => p.city.id === move.refId);
    const isCorrect = isPlacementCorrect(card, ref.city, move.dir);
    placement = {
      playerId: placerId, city: card, refId: move.refId, dir: move.dir,
      cell: neighborCell(ref.cell, move.dir), isCorrect,
    };
  } else {
    const isCorrect = isInsertCorrect(state.line, move.index, card);
    placement = { playerId: placerId, city: card, index: move.index, isCorrect };
    line = state.line.slice();
    line.splice(move.index, 0, card);
  }

  return {
    ...state,
    deck: next,
    placements: [...state.placements, placement],
    line,
    cardsPlayed: state.cardsPlayed + 1,
    phase: 'challenge_window',
    lastMove: { placementIndex: state.placements.length, placerIndex },
    // challenge window opens for the player to the RIGHT of the placer first
    currentPlayerIndex: (placerIndex + 1) % state.players.length,
  };
}
