import { renderLobby, renderWaiting } from './lobby-ui.js';
import { renderBoard } from './board-ui.js';
import { listPlayers, getRoom, startGame, saveState, subscribeRoom } from './realtime-sync.js';
import { createGame, needsCheckpoint } from './game-state.js';
import { isBot, botPlace, botDecideChallenge } from './bot.js';

const app = document.getElementById('app');
const loadCities = () => fetch('data/cities.json').then((r) => r.json());

renderLobby(app, { onEnter: enterRoom, onSolo: startSolo });

function enterRoom({ room, me, isHost, difficulty = 'legendar' }) {
  let board = null; // board controller once the game is playing

  async function refresh() {
    const fresh = await getRoom(room.id);
    if (fresh.status === 'playing' && fresh.state) {
      if (!board) {
        board = renderBoard(app, {
          state: fresh.state,
          myId: me.id,
          isHost,
          onAction: (s) => saveState(room.id, s),
        });
      } else {
        board.setState(fresh.state);
      }
      return;
    }
    const players = await listPlayers(room.id);
    renderWaiting(app, { room: fresh, me, players, isHost, onStart: start });
  }

  async function start() {
    const players = await listPlayers(room.id);
    const cities = await loadCities();
    const state = createGame({
      variant: room.variant, numTurns: room.num_turns, seed: room.deck_seed, difficulty,
      players: players.map((p) => ({ id: p.id, name: p.name })), cities,
    });
    await startGame(room.id, state); // realtime update flips everyone to the board
  }

  subscribeRoom(room.id, refresh);
  refresh();
}

// Local single-player game against bots. Everything runs on this device: the human plays
// their turns; a short timer drives each bot's placement and contra decision.
async function startSolo({ variant, difficulty, numBots, numTurns }) {
  const cities = await loadCities();
  const players = [{ id: 'you', name: 'Tu' }];
  for (let i = 1; i <= numBots; i++) players.push({ id: `bot${i}`, name: `Bot ${i}`, isBot: true });
  const state = createGame({
    variant, numTurns, difficulty, seed: Math.floor(Math.random() * 1e9), players, cities,
  });

  let current = state;
  let timer = null;
  const board = renderBoard(app, { state, myId: 'you', isHost: true, onAction: apply });

  function apply(s) {
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
      timer = setTimeout(() => apply(botPlace(current)), 900);
    } else if (current.phase === 'challenge_window') {
      timer = setTimeout(() => apply(botDecideChallenge(current)), 900);
    }
    // contra_result and checkpoint stay human-paced (the human presses Continuă / scores).
  }

  scheduleBot();
}
