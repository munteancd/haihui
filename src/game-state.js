import { buildDeck, draw } from './deck.js';

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
