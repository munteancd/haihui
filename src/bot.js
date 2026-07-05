import { placeCard, challenge, passChallenge } from './game-state.js';
import { isArmInsertCorrect } from './rules-cardinal.js';
import { isInsertCorrect } from './rules-population.js';

// Simple, beatable bots for solo testing. They are not perfect on purpose: they place a
// wrong card now and then (so you have something to contra) and they miss some contras.

export function isBot(player) {
  return !!player?.isBot;
}

const CORRECT_PLACE_CHANCE = 0.75; // how often a bot places its card correctly
const CONTRA_WHEN_WRONG = 0.7;     // how often a bot contras a genuinely wrong placement
const CONTRA_WHEN_RIGHT = 0.08;    // how often a bot wrongly contras a correct placement

function randOf(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Enumerate every legal slot for the drawn card, flagged by whether it would be correct.
function cardinalOptions(state, card) {
  const anchor = state.placements[0].city;
  const opts = [];
  for (const dir of ['N', 'S', 'E', 'V']) {
    const arm = state.arms[dir];
    for (let i = 0; i <= arm.length; i++) {
      opts.push({ dir, index: i, correct: isArmInsertCorrect(arm, anchor, dir, i, card) });
    }
  }
  return opts;
}

function populationOptions(state, card) {
  const opts = [];
  for (let i = 0; i <= state.line.length; i++) {
    opts.push({ index: i, correct: isInsertCorrect(state.line, i, card) });
  }
  return opts;
}

// The bot places the current drawn card, aiming for a correct slot most of the time.
export function botPlace(state) {
  const card = state.deck.cards[state.deck.pos];
  const wantCorrect = Math.random() < CORRECT_PLACE_CHANCE;
  const options = state.variant === 'cardinal'
    ? cardinalOptions(state, card)
    : populationOptions(state, card);
  const wanted = options.filter((o) => o.correct === wantCorrect);
  const pick = randOf(wanted.length ? wanted : options);
  const move = state.variant === 'cardinal' ? { dir: pick.dir, index: pick.index } : { index: pick.index };
  return placeCard(state, move);
}

// The bot decides whether to contra the last placement: usually catches wrong placements,
// occasionally bluff-calls a correct one.
export function botDecideChallenge(state) {
  const placement = state.placements[state.lastMove.placementIndex];
  const chance = placement.isCorrect ? CONTRA_WHEN_RIGHT : CONTRA_WHEN_WRONG;
  return Math.random() < chance ? challenge(state) : passChallenge(state);
}

// A rough (non-omniscient) checkpoint guess for a bot: a small number near what's on the board.
export function botEstimate(state) {
  const onBoard = state.placements.filter((p) => p.dir !== null && !p.removed).length
    || (state.line ? state.line.length - 1 : 0);
  return Math.max(0, Math.round(Math.random() * Math.min(4, onBoard)));
}
