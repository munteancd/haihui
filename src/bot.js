import { placeCard, challenge, passChallenge, contestOptions } from './game-state.js';
import { isArmInsertCorrect, isContestedPairCorrect as isArmPairCorrect } from './rules-cardinal.js';
import { isInsertCorrect, isContestedPairCorrect as isLinePairCorrect } from './rules-population.js';

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

// Enumerate every legal slot for the drawn card, flagged by whether it would fit both
// neighbours.
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

// The bot decides whether to contra the last placement. It checks the card against each
// neighbour it could flip: if one of them shows the card is out of order it usually
// contests against exactly that neighbour; otherwise it occasionally bluff-calls one.
export function botDecideChallenge(state) {
  const placement = state.placements[state.lastMove.placementIndex];
  const options = contestOptions(state);
  const wrongSides = options.filter((o) => (state.variant === 'cardinal'
    ? !isArmPairCorrect(placement.city, o.city, o.side, placement.dir)
    : !isLinePairCorrect(placement.city, o.city, o.side)));
  if (wrongSides.length > 0) {
    return Math.random() < CONTRA_WHEN_WRONG ? challenge(state, randOf(wrongSides).side) : passChallenge(state);
  }
  return Math.random() < CONTRA_WHEN_RIGHT ? challenge(state, randOf(options).side) : passChallenge(state);
}

// A rough (non-omniscient) scoring guess for a bot: a small number near what's on the board.
export function botEstimate(state) {
  const onBoard = state.variant === 'cardinal'
    ? Object.values(state.arms).reduce((n, arm) => n + arm.length, 0)
    : state.line.length - 1;
  return Math.max(0, Math.round(Math.random() * Math.min(4, onBoard)));
}
