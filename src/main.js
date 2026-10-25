import { renderLobby, renderWaiting } from './lobby-ui.js';
import { renderBoard } from './board-ui.js';
import { listPlayers, getRoom, startGame, saveState, subscribeRoom } from './realtime-sync.js';
import { createGame, needsCheckpoint } from './game-state.js';
import { DECKS, DEFAULT_DECK, poolFor } from './decks.js';
import { isBot, botPlace, botDecideChallenge } from './bot.js';

const app = document.getElementById('app');
const loadDeck = (deck) => fetch(DECKS[deck].file).then((r) => r.json());

renderLobby(app, { onEnter: enterRoom, onSolo: startSolo });

function enterRoom({ room, me, isHost, deck = DEFAULT_DECK, difficulty = 'legendar' }) {
  let board = null; // board controller once the game is playing
  let shown = null;  // last game state fetched, so a catch-up refresh doesn't re-render

  async function refresh() {
    const fresh = await getRoom(room.id);
    if (fresh.status === 'playing' && fresh.state) {
      const json = JSON.stringify(fresh.state);
      if (!board) {
        board = renderBoard(app, {
          state: fresh.state,
          myId: me.id,
          isHost,
          onAction: (s) => saveState(room.id, s),
        });
      } else if (json !== shown) {
        board.setState(fresh.state);
      }
      shown = json;
      return;
    }
    const players = await listPlayers(room.id);
    renderWaiting(app, { room: fresh, me, players, isHost, deck: isHost ? deck : null, onStart: start });
  }

  async function start() {
    const players = await listPlayers(room.id);
    const data = await loadDeck(deck);
    const state = createGame({
      variant: room.variant, numRounds: room.num_turns, seed: room.deck_seed, deckId: deck, difficulty,
      players: players.map((p) => ({ id: p.id, name: p.name })),
      cards: poolFor(deck, data, room.variant, difficulty),
    });
    await startGame(room.id, state); // realtime update flips everyone to the board
  }

  subscribeRoom(room.id, refresh);
  refresh();
  // Back from another app or a locked screen: catch up on anything missed meanwhile.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
}

// Local single-player game against bots. Everything runs on this device: the human plays
// their turns; a short timer drives each bot's placement and contra decision.
async function startSolo({ variant, deck, difficulty, numBots, numRounds }) {
  const data = await loadDeck(deck);
  const players = [{ id: 'you', name: 'Tu' }];
  for (let i = 1; i <= numBots; i++) players.push({ id: `bot${i}`, name: `Bot ${i}`, isBot: true });
  const state = createGame({
    variant, numRounds, deckId: deck, difficulty, seed: Math.floor(Math.random() * 1e9), players,
    cards: poolFor(deck, data, variant, difficulty),
  });

  let current = state;
  let timer = null;
  const board = renderBoard(app, { state, myId: 'you', isHost: true, onAction: onLocalAction });

  // The human's own move is already rendered (and animated) by the board itself via its
  // internal draw. We must NOT re-render here — a second synchronous render would rebuild
  // the board and wipe the just-added place/flip animation before it ever paints. We only
  // track the new state and let the bots respond.
  function onLocalAction(s) {
    current = s;
    scheduleBot();
  }

  // A bot produced a new state: push it into the board (this renders and animates the bot's
  // move) and continue.
  function driveBot(s) {
    current = s;
    board.setState(s);
    scheduleBot();
  }

  // If a bot is the active player, act after a short pause so the human can follow along.
  function scheduleBot() {
    clearTimeout(timer);
    const actor = current.players[current.currentPlayerIndex];
    if (!isBot(actor)) return;
    if (current.phase === 'placing' && !needsCheckpoint(current)) {
      timer = setTimeout(() => driveBot(botPlace(current)), 900);
    } else if (current.phase === 'challenge_window') {
      timer = setTimeout(() => driveBot(botDecideChallenge(current)), 900);
    }
    // contra_result and scoring stay human-paced (the human presses Continuă / scores).
  }

  scheduleBot();
}
