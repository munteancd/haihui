import { renderLobby } from './lobby-ui.js';
import { renderBoard } from './board-ui.js';

const app = document.getElementById('app');
renderLobby(app, async ({ room, player }) => {
  const cities = await fetch('data/cities.json').then((r) => r.json());
  renderBoard(app, cities, {
    variant: room.variant, numTurns: room.num_turns, seed: room.deck_seed,
    players: [{ id: player.id, name: player.name }, { id: 'guest', name: 'Invitat' }],
  });
});
