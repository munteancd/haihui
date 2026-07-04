import { renderLobby, renderWaiting } from './lobby-ui.js';
import { renderBoard } from './board-ui.js';
import { listPlayers, getRoom, startGame, saveState, subscribeRoom } from './realtime-sync.js';
import { createGame } from './game-state.js';

const app = document.getElementById('app');
renderLobby(app, enterRoom);

function enterRoom({ room, me, isHost }) {
  let board = null; // board controller once the game is playing

  async function refresh() {
    const fresh = await getRoom(room.id);
    if (fresh.status === 'playing' && fresh.state) {
      if (!board) {
        board = renderBoard(app, {
          state: fresh.state,
          myId: me.id,
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
    const cities = await fetch('data/cities.json').then((r) => r.json());
    const state = createGame({
      variant: room.variant, numTurns: room.num_turns, seed: room.deck_seed,
      players: players.map((p) => ({ id: p.id, name: p.name })), cities,
    });
    await startGame(room.id, state); // realtime update flips everyone to the board
  }

  subscribeRoom(room.id, refresh);
  refresh();
}
