import { createRoom, joinRoom } from './realtime-sync.js';
import { DECKS, DEFAULT_DECK } from './decks.js';
import { DEFAULT_ROUNDS } from './game-state.js';

const VARIANTS = `<option value="cardinal">Puncte cardinale</option><option value="population">Populație</option>`;
const DECK_OPTIONS = Object.entries(DECKS).map(([id, d]) =>
  `<option value="${id}"${id === DEFAULT_DECK ? ' selected' : ''}>${d.label}</option>`).join('');
const DIFFICULTIES = `
  <option value="usor">Ușor (~200 orașe cunoscute)</option>
  <option value="mediu">Mediu (~800)</option>
  <option value="greu">Greu (~2000)</option>
  <option value="legendar" selected>Legendar (toate)</option>`;

// The rules in a nutshell, in our own words.
const HOW_TO = `
  <h2>Cum se joacă</h2>
  <ol class="howto">
    <li>Pe masă stă o carte de start. La rândul tău tragi o carte și o pui pe crucea din jurul ei: sus (Nord), jos (Sud), dreapta (Est) sau stânga (Vest) — la capătul unui braț sau între două cărți.</li>
    <li>Pe brațele Nord–Sud contează doar latitudinea, pe Est–Vest doar longitudinea. Datele stau pe spatele cărții, ascunse.</li>
    <li>După ce ai pus cartea, următorul jucător poate da <b>Contra</b>. Dacă nu vrea, poate cel de după el, și tot așa.</li>
    <li>La contra se întorc cartea pusă și <b>o singură</b> vecină a ei (dacă are două, alege cel care dă contra). Doar perechea asta contează; valori egale = corect.</li>
    <li>Contra corectă: cine a pus cartea dă un 💎 celui care a dat contra, iar cartea iese din joc. Contra greșită: cel care a dat contra dă un 💎. Cine nu mai are 💎 nu dă nimic — câștigătorul ia din bancă.</li>
    <li>O rundă are 15 cărți. La final fiecare ghicește câte cărți sunt greșite pe masă, fără să le vadă.</li>
    <li>Apoi se întorc toate: braț cu braț, pornind de la cartea de start, fiecare carte e comparată cu ultima carte bună dinaintea ei; cele greșite ies.</li>
    <li>Cine ghicește exact ia 2 💎 din bancă; dacă nimeni nu nimerește, cel mai apropiat ia 1 💎. Masa se golește și runda următoare începe cu o carte de start nouă.</li>
    <li>Fiecare începe cu 4 💎. După ultima rundă câștigă cine are cele mai multe 💎.</li>
    <li>Varianta <b>Populație</b>: o singură coloană, orașele cu cei mai puțini locuitori jos, cele mai mari sus. Obiectivele turistice (★) apar doar la puncte cardinale.</li>
  </ol>`;

// Create/join screen. `onEnter({ room, me, isHost, deck, difficulty })` runs once this
// device is in a multiplayer room; `onSolo({ variant, deck, difficulty, numBots, numRounds })`
// starts a local game against bots (no other players needed).
export function renderLobby(root, { onEnter, onSolo }) {
  root.innerHTML = `
    <h1>Haihui</h1>
    <button id="howto-btn" class="ghost">Cum se joacă</button>
    <section id="howto" hidden>${HOW_TO}</section>
    <section>
      <h2>Cameră nouă</h2>
      <label>Variantă <select id="variant">${VARIANTS}</select></label>
      <label>Pachet <select id="deck">${DECK_OPTIONS}</select></label>
      <label>Dificultate <select id="difficulty">${DIFFICULTIES}</select></label>
      <label>Runde <input id="rounds" type="number" value="${DEFAULT_ROUNDS}" min="1" max="5" /></label>
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
      <label>Pachet <select id="solo-deck">${DECK_OPTIONS}</select></label>
      <label>Dificultate <select id="solo-difficulty">${DIFFICULTIES}</select></label>
      <label>Boți <input id="solo-bots" type="number" value="2" min="1" max="5" /></label>
      <label>Runde <input id="solo-rounds" type="number" value="${DEFAULT_ROUNDS}" min="1" max="5" /></label>
      <button id="solo">Începe</button>
    </section>
    <pre id="lobby-state"></pre>`;

  const showError = (e) => { root.querySelector('#lobby-state').textContent = `Eroare: ${e?.message || e}`; };
  const val = (id) => root.querySelector(id).value;
  const rounds = (id) => Math.min(5, Math.max(1, Math.round(Number(val(id))) || DEFAULT_ROUNDS));

  root.querySelector('#howto-btn').onclick = () => {
    const box = root.querySelector('#howto');
    box.hidden = !box.hidden;
  };

  // Difficulty tiers only exist for the world deck.
  const linkDifficulty = (deckSel, diffSel) => {
    const sync = () => { root.querySelector(diffSel).disabled = val(deckSel) !== 'world'; };
    root.querySelector(deckSel).onchange = sync;
    sync();
  };
  linkDifficulty('#deck', '#difficulty');
  linkDifficulty('#solo-deck', '#solo-difficulty');

  root.querySelector('#create').onclick = async () => {
    try {
      const variant = val('#variant');
      const deck = val('#deck');
      const difficulty = val('#difficulty');
      const name = val('#host-name') || 'Gazdă';
      const room = await createRoom({ variant, numRounds: rounds('#rounds') });
      const { player } = await joinRoom(room.code, name);
      onEnter({ room, me: player, isHost: true, deck, difficulty });
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
      deck: val('#solo-deck'),
      difficulty: val('#solo-difficulty'),
      numBots: Number(val('#solo-bots')),
      numRounds: rounds('#solo-rounds'),
    });
  };
}

// Waiting room: shows the code + live player list. Host sees a Start button. The room's
// `num_turns` column holds the number of rounds. The deck is the host's choice and only
// known on the host's device.
export function renderWaiting(root, { room, me, players, isHost, deck, onStart }) {
  const deckInfo = deck ? ` · pachet <b>${DECKS[deck].label}</b>` : '';
  root.innerHTML = `
    <h1>Cameră ${room.code}</h1>
    <p>Variantă: <b>${room.variant === 'cardinal' ? 'Puncte cardinale' : 'Populație'}</b> · ${room.num_turns} ${room.num_turns === 1 ? 'rundă' : 'runde'}${deckInfo}</p>
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
