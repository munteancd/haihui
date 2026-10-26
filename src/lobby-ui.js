import { createRoom, joinRoom } from './realtime-sync.js';
import { DECKS, DEFAULT_DECK, DIFFICULTY_LABELS, DEFAULT_DIFFICULTY } from './decks.js';
import { DEFAULT_ROUNDS, ROUND_SIZE, ROUND_SIZES } from './game-state.js';
import { LOGO } from './logo.js';
import { avatar } from './avatar.js';

const VARIANTS = `<option value="cardinal">Puncte cardinale</option><option value="population">Populație</option>`;
const DECK_OPTIONS = Object.entries(DECKS).map(([id, d]) =>
  `<option value="${id}"${id === DEFAULT_DECK ? ' selected' : ''}>${d.label}</option>`).join('');
// Difficulty options for a deck, with how many cities each one plays ("Ușor (100 de orașe)").
// România has no tiers: it gets one placeholder option and the select is disabled.
function difficultyOptions(deckId, selected = DEFAULT_DIFFICULTY) {
  const sizes = DECKS[deckId].sizes;
  if (!sizes) return '<option value="legendar">Toate cărțile</option>';
  return Object.entries(DIFFICULTY_LABELS).map(([id, label], i) => {
    const n = sizes[i];
    const what = i === 0 ? 'cele mai cunoscute' : i === sizes.length - 1 ? 'toate' : '';
    const de = n % 100 === 0 || n % 100 >= 20 ? ' de' : ''; // "100 de orașe", "101 orașe"
    return `<option value="${id}"${id === selected ? ' selected' : ''}>${label} (${n.toLocaleString('ro-RO')}${de} orașe${what ? `, ${what}` : ''})</option>`;
  }).join('');
}
const DIFFICULTIES = difficultyOptions(DEFAULT_DECK);
const ROUND_SIZE_OPTIONS = ROUND_SIZES.map((n) =>
  `<option value="${n}"${n === ROUND_SIZE ? ' selected' : ''}>${n} cărți</option>`).join('');

// The rules in a nutshell, in our own words.
const HOW_TO = `
  <h2>Cum se joacă</h2>
  <ol class="howto">
    <li>Pe masă stă o carte de start. La rândul tău tragi o carte și o pui pe crucea din jurul ei: sus (Nord), jos (Sud), dreapta (Est) sau stânga (Vest) — la capătul unui braț sau între două cărți.</li>
    <li>Pe brațele Nord–Sud contează doar latitudinea, pe Est–Vest doar longitudinea. Datele stau pe spatele cărții, ascunse.</li>
    <li>După ce ai pus cartea, următorul jucător poate da <b>Contra</b>. Dacă nu vrea, poate cel de după el, și tot așa.</li>
    <li>La contra se întorc cartea pusă și <b>o singură</b> vecină a ei (dacă are două, alege cel care dă contra). Doar perechea asta contează; valori egale = corect.</li>
    <li>Contra corectă: cine a pus cartea dă un 💎 celui care a dat contra, iar cartea iese din joc. Contra greșită: cel care a dat contra dă un 💎. Cine nu mai are 💎 nu dă nimic — câștigătorul ia din bancă.</li>
    <li>O rundă are 15 cărți (sau 18, 20, 25 — se alege din meniu). La final fiecare ghicește câte cărți sunt greșite pe masă, fără să le vadă.</li>
    <li>Apoi se întorc toate: braț cu braț, pornind de la cartea de start, fiecare carte e comparată cu ultima carte bună dinaintea ei; cele greșite ies.</li>
    <li>Cine ghicește exact ia 2 💎 din bancă; dacă nimeni nu nimerește, cel mai apropiat ia 1 💎. Masa se golește și runda următoare începe cu o carte de start nouă.</li>
    <li>Fiecare începe cu 4 💎. După ultima rundă câștigă cine are cele mai multe 💎.</li>
    <li>Varianta <b>Populație</b>: o singură coloană, orașele cu cei mai puțini locuitori jos, cele mai mari sus. Obiectivele turistice (★) apar doar la puncte cardinale.</li>
  </ol>`;

// Create/join screen. `onEnter({ room, me, isHost, deck, difficulty, roundSize })` runs once
// this device is in a multiplayer room; `onSolo({ variant, deck, difficulty, numBots, numRounds,
// roundSize })`
// starts a local game against bots (no other players needed).
export function renderLobby(root, { onEnter, onSolo }) {
  root.innerHTML = `
    <header class="hero">
      ${LOGO}
      <div><h1>Haihui</h1><p class="tagline">Pune orașele la locul lor pe hartă.</p></div>
      <button id="howto-btn" class="ghost">📖 Cum se joacă</button>
    </header>
    <section id="howto" class="panel" hidden>${HOW_TO}</section>
    <div class="lobby-grid">
      <section class="panel">
        <h2><span class="ico">🏠</span>Cameră nouă</h2>
        <p class="hint">Joci cu prietenii: le dai codul camerei.</p>
        <div class="fields">
          <label>Variantă <select id="variant">${VARIANTS}</select></label>
          <label>Pachet <select id="deck">${DECK_OPTIONS}</select></label>
          <label>Dificultate <select id="difficulty">${DIFFICULTIES}</select></label>
          <label>Runde <input id="rounds" type="number" value="${DEFAULT_ROUNDS}" min="1" max="5" /></label>
          <label>Cărți pe rundă <select id="round-size">${ROUND_SIZE_OPTIONS}</select></label>
          <label class="full">Numele tău <input id="host-name" placeholder="Cristi" /></label>
        </div>
        <button id="create" class="wide">Creează camera</button>
      </section>
      <section class="panel">
        <h2><span class="ico">🔑</span>Intră cu cod</h2>
        <p class="hint">Ai primit un cod de 4 caractere? Scrie-l aici.</p>
        <div class="fields">
          <label class="full">Cod <input id="code" placeholder="ABCD" autocapitalize="characters" /></label>
          <label class="full">Numele tău <input id="join-name" placeholder="Nume" /></label>
        </div>
        <button id="join" class="wide">Intră</button>
      </section>
      <section class="panel">
        <h2><span class="ico">🤖</span>Solo cu boți</h2>
        <p class="hint">Joci singur, fără să aștepți pe nimeni.</p>
        <div class="fields">
          <label>Variantă <select id="solo-variant">${VARIANTS}</select></label>
          <label>Pachet <select id="solo-deck">${DECK_OPTIONS}</select></label>
          <label>Dificultate <select id="solo-difficulty">${DIFFICULTIES}</select></label>
          <label>Boți <input id="solo-bots" type="number" value="2" min="1" max="5" /></label>
          <label>Runde <input id="solo-rounds" type="number" value="${DEFAULT_ROUNDS}" min="1" max="5" /></label>
          <label>Cărți pe rundă <select id="solo-round-size">${ROUND_SIZE_OPTIONS}</select></label>
        </div>
        <button id="solo" class="wide">Începe</button>
      </section>
    </div>
    <pre id="lobby-state"></pre>`;

  const showError = (e) => { root.querySelector('#lobby-state').textContent = `Eroare: ${e?.message || e}`; };
  const val = (id) => root.querySelector(id).value;
  const rounds = (id) => Math.min(5, Math.max(1, Math.round(Number(val(id))) || DEFAULT_ROUNDS));

  root.querySelector('#howto-btn').onclick = () => {
    const box = root.querySelector('#howto');
    box.hidden = !box.hidden;
  };

  // Difficulty tiers exist for Lume and Europa; switching decks keeps the chosen level.
  const linkDifficulty = (deckSel, diffSel) => {
    const select = root.querySelector(diffSel);
    let chosen = DEFAULT_DIFFICULTY;
    select.onchange = () => { chosen = select.value; };
    const sync = () => {
      const deck = val(deckSel);
      select.innerHTML = difficultyOptions(deck, chosen);
      select.disabled = !DECKS[deck].sizes;
    };
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
      onEnter({ room, me: player, isHost: true, deck, difficulty, roundSize: Number(val('#round-size')) });
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
      roundSize: Number(val('#solo-round-size')),
    });
  };
}

// Waiting room: shows the code + live player list. Host sees a Start button. The room's
// `num_turns` column holds the number of rounds. The deck and the cards per round are the
// host's choice and only known on the host's device.
export function renderWaiting(root, { room, me, players, isHost, deck, roundSize, onStart }) {
  const deckInfo = (deck ? ` · pachet <b>${DECKS[deck].label}</b>` : '')
    + (roundSize ? ` · ${roundSize} cărți pe rundă` : '');
  root.innerHTML = `
    <section class="panel waiting">
      <h1>Cameră <span class="room-code">${room.code}</span></h1>
      <p class="hint">Dă-le prietenilor codul ăsta: ei aleg „Intră cu cod”.</p>
      <p>Variantă: <b>${room.variant === 'cardinal' ? 'Puncte cardinale' : 'Populație'}</b> · ${room.num_turns} ${room.num_turns === 1 ? 'rundă' : 'runde'}${deckInfo}</p>
      <h3>Jucători</h3>
      <div class="players">${players.map((p) => `<span class="pchip">${avatar(p.name, p.id)}${p.name}${p.seat_order === 0 ? ' <span class="you">gazdă</span>' : ''}${p.id === me.id ? ' <span class="tag">tu</span>' : ''}</span>`).join('')}</div>
      <div id="wait-controls"></div>
    </section>`;
  const c = root.querySelector('#wait-controls');
  if (isHost) {
    const canStart = players.length >= 2;
    c.innerHTML = `<button id="start" ${canStart ? '' : 'disabled'}>Start joc</button>
      ${canStart ? '' : '<p class="hint waiting-turn">Așteaptă cel puțin un jucător…</p>'}`;
    if (canStart) root.querySelector('#start').onclick = onStart;
  } else {
    c.innerHTML = `<p class="waiting-turn">Așteaptă ca gazda să pornească jocul…</p>`;
  }
}
