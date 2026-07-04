import { placeCard, challenge, passChallenge,
         needsCheckpoint, resolveCheckpoint, isGameOver, winners } from './game-state.js';

// Controlled board: renders a shared game `state` and only enables controls when it is
// THIS device's turn (state.players[currentPlayerIndex].id === myId). Every local action
// produces a new state and is handed to `onAction(newState)` so the caller can persist it
// to Supabase. Remote updates arrive via the returned `setState`.
//
// Cardinal games are drawn as a plus: four arms grow outward from the anchor. Cards show
// their name face-up; their data lives on the back and is flipped into view when a contra
// or a checkpoint reveals them.
export function renderBoard(root, { state, myId, onAction = () => {} }) {
  let current = state;

  const setState = (s) => { current = s; draw(); };
  const commit = (s) => { current = s; onAction(s); draw(); };
  const myTurn = () => current.players[current.currentPlayerIndex].id === myId;
  const anchorCity = () => current.placements[0].city;
  const placementOf = (cityId) =>
    current.placements.find((p) => p.city.id === cityId);

  // A card: name on the face, data on the back. `revealed` flips it to show the data.
  function cardEl(city, { revealed = false, faded = false, anchor = false } = {}) {
    const data = current.variant === 'cardinal'
      ? `${city.lat.toFixed(1)}, ${city.lon.toFixed(1)}`
      : city.pop.toLocaleString();
    const cls = ['card'];
    if (revealed) cls.push('revealed');
    if (faded) cls.push('faded');
    if (anchor) cls.push('anchor-card');
    return `<div class="${cls.join(' ')}"><div class="card-inner">
      <div class="card-face">${city.name}</div>
      <div class="card-back">${data}</div></div></div>`;
  }

  function header() {
    const cur = current.players[current.currentPlayerIndex];
    const you = current.players.find((p) => p.id === myId);
    return `
      <p class="diamonds">${current.players.map((p) => `${p.name}: ${'💎'.repeat(Math.max(0, p.diamonds))} ${p.diamonds}`).join(' · ')}</p>
      <p>La rând: <b>${cur.name}</b>${you ? ` — tu ești <b>${you.name}</b>` : ''}</p>`;
  }

  function armHtml(dir, reverse, revealAll) {
    let cards = current.arms[dir].map((c) =>
      cardEl(c, { revealed: revealAll || placementOf(c.id)?.revealed }));
    if (reverse) cards = cards.reverse();
    return cards.join('');
  }

  function boardHtml(revealAll = false) {
    if (current.variant === 'population') {
      const cards = current.line.map((c) =>
        cardEl(c, {
          revealed: revealAll || placementOf(c.id)?.revealed,
          anchor: c.id === anchorCity().id,
        })).join('');
      return `<div class="line">${cards}</div>${removedHtml()}`;
    }
    return `<div class="plus">
      <div class="arm arm-n">${armHtml('N', true, revealAll)}</div>
      <div class="arm arm-v">${armHtml('V', true, revealAll)}</div>
      <div class="anchor">${cardEl(anchorCity(), { revealed: true, anchor: true })}</div>
      <div class="arm arm-e">${armHtml('E', false, revealAll)}</div>
      <div class="arm arm-s">${armHtml('S', false, revealAll)}</div>
    </div>${removedHtml()}`;
  }

  function removedHtml() {
    if (!current.removed || current.removed.length === 0) return '';
    const cards = current.removed.map((c) => cardEl(c, { revealed: true, faded: true })).join('');
    return `<div class="discard"><span>Scoase la contră:</span>${cards}</div>`;
  }

  function draw() {
    if (isGameOver(current)) {
      const w = winners(current).map((p) => p.name).join(', ');
      root.innerHTML = `${header()}<h2>Gata! Câștigă: ${w} 🏆</h2><div id="board">${boardHtml(true)}</div>`;
      return;
    }
    if (needsCheckpoint(current) && current.phase === 'placing') {
      renderCheckpoint();
      return;
    }
    root.innerHTML = `${header()}<div id="board">${boardHtml()}</div><div id="controls"></div>`;
    if (!myTurn()) {
      root.querySelector('#controls').innerHTML =
        `<p>Așteaptă pe <b>${current.players[current.currentPlayerIndex].name}</b>…</p>`;
      return;
    }
    current.phase === 'placing' ? renderPlaceControls() : renderChallengeControls();
  }

  // Slot options for population: named gaps in the line.
  function lineSlots() {
    const line = current.line;
    const opts = [];
    for (let i = 0; i <= line.length; i++) {
      const inner = i > 0 ? line[i - 1].name : null;
      const outer = i < line.length ? line[i].name : null;
      const label = !inner ? `înainte de ${outer}` : !outer ? `după ${inner}` : `între ${inner} și ${outer}`;
      opts.push(`<option value="${i}">${label}</option>`);
    }
    return opts.join('');
  }

  // Slot options for a cardinal arm: named gaps from the anchor outward.
  function armSlots(dir) {
    const arm = current.arms[dir];
    const opts = [];
    for (let i = 0; i <= arm.length; i++) {
      const inner = i > 0 ? arm[i - 1].name : anchorCity().name;
      const outer = i < arm.length ? arm[i].name : null;
      const label = outer ? `între ${inner} și ${outer}` : `după ${inner}`;
      opts.push(`<option value="${i}">${label}</option>`);
    }
    return opts.join('');
  }

  function renderPlaceControls() {
    const c = root.querySelector('#controls');
    const drawn = current.deck.cards[current.deck.pos];

    if (current.variant === 'population') {
      c.innerHTML = `<p>Cartea ta: <b>${drawn.name}</b></p>
        <label>Loc <select id="idx">${lineSlots()}</select></label>
        <button id="place">Pune</button>`;
      c.querySelector('#place').onclick = () =>
        commit(placeCard(current, { index: Number(c.querySelector('#idx').value) }));
      return;
    }

    c.innerHTML = `<p>Cartea ta: <b>${drawn.name}</b></p>
      <label>Direcție <select id="dir">
        <option value="N">Nord</option><option value="S">Sud</option>
        <option value="E">Est</option><option value="V">Vest</option></select></label>
      <label>Loc <select id="idx"></select></label>
      <button id="place">Pune</button>`;
    const dirSel = c.querySelector('#dir');
    const idxSel = c.querySelector('#idx');
    const fillIdx = () => { idxSel.innerHTML = armSlots(dirSel.value); };
    dirSel.onchange = fillIdx;
    fillIdx();
    c.querySelector('#place').onclick = () =>
      commit(placeCard(current, { dir: dirSel.value, index: Number(idxSel.value) }));
  }

  function renderChallengeControls() {
    const c = root.querySelector('#controls');
    const eligible = current.players[current.currentPlayerIndex];
    const challenged = current.placements[current.lastMove.placementIndex].city;
    c.innerHTML = `<p><b>${eligible.name}</b>, contrezi plasarea lui <b>${challenged.name}</b>?</p>
      <button id="contra">Contra</button><button id="pass" class="ghost">Las-o</button>`;
    c.querySelector('#contra').onclick = () => commit(challenge(current));
    c.querySelector('#pass').onclick = () => commit(passChallenge(current));
  }

  function renderCheckpoint() {
    // Everyone sees the board revealed; only the current player's device enters estimates.
    const board = `<div id="board">${boardHtml(true)}</div>`;
    if (!myTurn()) {
      root.innerHTML = `${header()}${board}<p>Se punctează checkpoint-ul…</p>`;
      return;
    }
    root.innerHTML = `${header()}${board}
      <h3>Checkpoint — câte cărți sunt greșite pe tablă?</h3>
      ${current.players.map((p) =>
        `<label>${p.name} <input data-p="${p.id}" type="number" min="0" value="0" /></label>`).join('')}
      <button id="score">Punctează</button>`;
    root.querySelector('#score').onclick = () => {
      const est = {};
      root.querySelectorAll('input[data-p]').forEach((i) => { est[i.dataset.p] = Number(i.value); });
      commit(resolveCheckpoint(current, est));
    };
  }

  draw();
  return { setState };
}
