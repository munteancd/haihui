import { createRoom, joinRoom } from './realtime-sync.js';

// Create/join screen. Calls onEnter({ room, me, isHost }) once this device is in a room.
export function renderLobby(root, onEnter) {
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

  const showError = (e) => { root.querySelector('#lobby-state').textContent = `Eroare: ${e?.message || e}`; };

  root.querySelector('#create').onclick = async () => {
    try {
      const variant = root.querySelector('#variant').value;
      const numTurns = Number(root.querySelector('#turns').value);
      const name = root.querySelector('#host-name').value || 'Gazdă';
      const room = await createRoom({ variant, numTurns });
      const { player } = await joinRoom(room.code, name);
      onEnter({ room, me: player, isHost: true });
    } catch (e) { showError(e); }
  };

  root.querySelector('#join').onclick = async () => {
    try {
      const code = root.querySelector('#code').value;
      const name = root.querySelector('#join-name').value || 'Jucător';
      const { room, player } = await joinRoom(code, name);
      onEnter({ room, me: player, isHost: player.seat_order === 0 });
    } catch (e) { showError(e); }
  };
}

// Waiting room: shows the code + live player list. Host sees a Start button.
export function renderWaiting(root, { room, me, players, isHost, onStart }) {
  root.innerHTML = `
    <h1>Cameră ${room.code}</h1>
    <p>Variantă: <b>${room.variant === 'cardinal' ? 'Puncte cardinale' : 'Populație'}</b> · ${room.num_turns} ture</p>
    <p>Tu ești <b>${me.name}</b>.</p>
    <h3>Jucători</h3>
    <ul>${players.map((p) => `<li>${p.name}${p.seat_order === 0 ? ' (gazdă)' : ''}</li>`).join('')}</ul>
    <div id="wait-controls"></div>`;
  const c = root.querySelector('#wait-controls');
  if (isHost) {
    const canStart = players.length >= 2;
    c.innerHTML = `<button id="start" ${canStart ? '' : 'disabled'}>Start joc</button>
      ${canStart ? '' : '<p>Așteaptă cel puțin un jucător…</p>'}`;
    if (canStart) root.querySelector('#start').onclick = onStart;
  } else {
    c.innerHTML = `<p>Așteaptă ca gazda să pornească jocul…</p>`;
  }
}
