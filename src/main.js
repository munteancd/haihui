import { renderLobby } from './lobby-ui.js';

const app = document.getElementById('app');
renderLobby(app, ({ room, player }) => {
  app.innerHTML = `<p>Intrat în ${room.code} ca ${player.name}. (Tabla vine în Task 13.)</p>`;
});
