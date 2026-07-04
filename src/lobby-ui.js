import { createRoom, joinRoom, subscribeRoom } from './realtime-sync.js';

// Renders create/join screen into `root`. Calls onStart({ room, player }) when the game begins.
export function renderLobby(root, onStart) {
  root.innerHTML = `
    <h1>Haihui</h1>
    <section>
      <h2>Cameră nouă</h2>
      <label>Variantă
        <select id="variant">
          <option value="cardinal">Puncte cardinale</option>
          <option value="population">Populație</option>
        </select>
      </label>
      <label>Ture <input id="turns" type="number" value="30" min="15" step="15" /></label>
      <label>Nume <input id="host-name" placeholder="Cristi" /></label>
      <button id="create">Creează</button>
    </section>
    <section>
      <h2>Intră cu cod</h2>
      <input id="code" placeholder="COD" />
      <input id="join-name" placeholder="Nume" />
      <button id="join">Intră</button>
    </section>
    <pre id="lobby-state"></pre>`;

  root.querySelector('#create').onclick = async () => {
    const variant = root.querySelector('#variant').value;
    const numTurns = Number(root.querySelector('#turns').value);
    const name = root.querySelector('#host-name').value || 'Gazdă';
    const room = await createRoom({ variant, numTurns });
    const { player } = await joinRoom(room.code, name);
    watch(root, room, player, onStart);
  };

  root.querySelector('#join').onclick = async () => {
    const code = root.querySelector('#code').value;
    const name = root.querySelector('#join-name').value || 'Jucător';
    const { room, player } = await joinRoom(code, name);
    watch(root, room, player, onStart);
  };
}

function watch(root, room, player, onStart) {
  const box = root.querySelector('#lobby-state');
  box.textContent = `Camera ${room.code} — aștept jucători…`;
  subscribeRoom(room.id, async () => {
    // when host starts, room.status flips to 'playing' (host presses a Start button — future)
    box.textContent = `Camera ${room.code} — conectat ca ${player.name}`;
  });
  // For v1, expose the room so the board task can pick it up.
  onStart({ room, player });
}
