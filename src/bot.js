import { placeCard, challenge, passChallenge, contestOptions, wrongOnBoard } from './game-state.js';
import { isArmInsertCorrect, isContestedPairCorrect as isArmPairCorrect } from './rules-cardinal.js';
import { isInsertCorrect, isContestedPairCorrect as isLinePairCorrect } from './rules-population.js';

// Bots for solo games. They are not perfect on purpose: they place a wrong card now and then
// (so you have something to contra) and they miss some contras. How often is set by their
// level, chosen in the lobby.

export function isBot(player) {
  return !!player?.isBot;
}

// Per level: how often a bot places its card correctly, how often it contras a genuinely
// wrong placement, how often it wrongly contras a correct one, and how far off its scoring
// guess may be (null: a rough guess that ignores the board; 0: exact).
export const BOT_LEVELS = {
  usor: { label: 'Ușor', place: 0.55, contraWrong: 0.4, contraRight: 0.12, guessSpread: null },
  mediu: { label: 'Mediu', place: 0.75, contraWrong: 0.7, contraRight: 0.08, guessSpread: null },
  greu: { label: 'Greu', place: 0.9, contraWrong: 0.9, contraRight: 0.04, guessSpread: 1 },
  expert: { label: 'Expert', place: 0.97, contraWrong: 0.97, contraRight: 0.02, guessSpread: 0 },
};
export const DEFAULT_BOT_LEVEL = 'mediu';
const levelOf = (player) => BOT_LEVELS[player?.level] ?? BOT_LEVELS[DEFAULT_BOT_LEVEL];

// Names a solo game gives its bots.
export const BOT_NAMES = [
  'Busola Amețită', 'GPS-ul Rătăcit', 'Harta Mototolită', 'Tanti Latitudine', 'Nea Meridian',
  'Turistul Pierdut', 'Ghidul Somnoros', 'Atlasul Prăfuit', 'Cartograful Grăbit',
  'Pinguinul Explorator', 'Măgărușul Hai-Hui', 'Domnul Ecuator',
];

// `n` different names, in random order.
export function botNames(n) {
  const pool = BOT_NAMES.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

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

// The current player (a bot) places the drawn card, aiming for a correct slot as often as
// its level says.
export function botPlace(state) {
  const card = state.deck.cards[state.deck.pos];
  const wantCorrect = Math.random() < levelOf(state.players[state.currentPlayerIndex]).place;
  const options = state.variant === 'cardinal'
    ? cardinalOptions(state, card)
    : populationOptions(state, card);
  const wanted = options.filter((o) => o.correct === wantCorrect);
  const pick = randOf(wanted.length ? wanted : options);
  const move = state.variant === 'cardinal' ? { dir: pick.dir, index: pick.index } : { index: pick.index };
  return placeCard(state, move);
}

// The current player (a bot) decides whether to contra the last placement. It checks the
// card against each neighbour it could flip: if one of them shows the card is out of order
// it usually contests against exactly that neighbour; otherwise it occasionally bluff-calls.
export function botDecideChallenge(state) {
  const level = levelOf(state.players[state.currentPlayerIndex]);
  const placement = state.placements[state.lastMove.placementIndex];
  const options = contestOptions(state);
  const wrongSides = options.filter((o) => (state.variant === 'cardinal'
    ? !isArmPairCorrect(placement.city, o.city, o.side, placement.dir)
    : !isLinePairCorrect(placement.city, o.city, o.side)));
  if (wrongSides.length > 0) {
    return Math.random() < level.contraWrong ? challenge(state, randOf(wrongSides).side) : passChallenge(state);
  }
  return Math.random() < level.contraRight ? challenge(state, randOf(options).side) : passChallenge(state);
}

// A bot's scoring guess. Easier bots guess a small number near what's on the board; harder
// ones land on (or one off) the true count of wrong cards.
export function botEstimate(state, player) {
  const { guessSpread } = levelOf(player);
  if (guessSpread === null) {
    const onBoard = state.variant === 'cardinal'
      ? Object.values(state.arms).reduce((n, arm) => n + arm.length, 0)
      : state.line.length - 1;
    return Math.max(0, Math.round(Math.random() * Math.min(4, onBoard)));
  }
  const truth = wrongOnBoard(state).length;
  const off = Math.round((Math.random() * 2 - 1) * guessSpread);
  return Math.max(0, truth + off);
}
