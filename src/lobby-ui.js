import { createRoom, joinRoom } from './realtime-sync.js';

const VARIANTS = `<option value="cardinal">Puncte cardinale</option><option value="population">Populație</option>`;
const DIFFICULTIES = `
  <option value="usor">Ușor (~200 orașe cunoscute)</option>
  <option value="mediu">Mediu (~800)</option>
  <option value="greu">Greu (~2000)</option>
  <option value="legendar" selected>Legendar (toate)</option>`;

// Create/join screen. `onEnter({ room, me, isHost, difficulty })` runs once this device is
// in a multiplayer room; `onSolo({ variant, difficulty, numBots, numTurns })` starts a
// local game against bots (no other players needed).
export function renderLobby(root, { onEnter, onSolo }) {
  root.innerHTML = `
    <h1>Haihui</h1>
    <section>
      <h2>Cameră nouă</h2>
      <label>Variantă <select id="variant">${VARIANTS}</select></label>
      <label>Dificultate <select id="difficulty">${DIFFICULTIES}</select></label>
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
    <section>
      <h2>Solo cu boți</h2>
      <p class="hint">Testează singur, fără să aștepți pe nimeni.</p>
      <label>Variantă <select id="solo-variant">${VARIANTS}</select></label>
      <label>Dificultate <select id="solo-difficulty">${DIFFICULTIES}</select></label>
      <label>Boți <input id="solo-bots" type="number" value="2" min="1" max="5" /></label>
      <label>Ture <input id="solo-turns" type="number" value="30" min="15" step="15" /></label>
      <button id="solo">Începe</button>
    </section>
    <pre id="lobby-state"></pre>`;

  const showError = (e) => { root.querySelector('#lobby-state').textContent = `Eroare: ${e?.message || e}`; };
  const val = (id) => root.querySelector(id).value;

  root.querySelector('#create').onclick = async () => {
    try {
      const variant = val('#variant');
      const difficulty = val('#difficulty');
      const numTurns = Number(val('#turns'));
      const name = val('#host-name') || 'Gazdă';
      const room = await createRoom({ variant, numTurns });
      const { player } = await joinRoom(room.code, name);
      onEnter({ room, me: player, isHost: true, difficulty });
    } catch (e) { showError(e); }
  };

  root.querySelector('#join').onclick = async () => {
    try {
      const { room, player } = await joinRoom(val('#code'), val('#join-name') || 'Jucător');
      onEnter({ room, me: player, isHost: player.seat_order === 0 });
    } catch (e) { showError(e); }
  };

  root.querySelector('#solo').onclick = () => {
    onSolo({
      variant: val('#solo-variant'),
      difficulty: val('#solo-difficulty'),
      numBots: Number(val('#solo-bots')),
      numTurns: Number(val('#solo-turns')),
    });
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
