import { placeCard, challenge, passChallenge,
         needsCheckpoint, resolveCheckpoint, isGameOver, winners } from './game-state.js';

// Controlled board: renders a shared game `state` and only enables controls when it is
// THIS device's turn (state.players[currentPlayerIndex].id === myId). Every local action
// produces a new state and is handed to `onAction(newState)` so the caller can persist it.
// Remote updates arrive via the returned `setState`.
//
// Cardinal games are drawn as a plus: four arms grow outward from the anchor. Cards show
// their name face-up; their data lives on the back and is flipped into view only when a
// checkpoint or a knocked-off (correct) contra reveals it. On your turn the drawn card is
// shown face-up and can be dragged (or tapped) onto a drop zone between/around the cards.
export function renderBoard(root, { state, myId, onAction = () => {} }) {
  let current = state;

  const setState = (s) => { current = s; draw(); };
  const commit = (s) => { current = s; onAction(s); draw(); };
  const myTurn = () => current.players[current.currentPlayerIndex].id === myId;
  const anchorCity = () => current.placements[0].city;
  const placementOf = (cityId) => current.placements.find((p) => p.city.id === cityId);
  const drawnCard = () => current.deck.cards[current.deck.pos];

  // A card: name on the face, data on the back. `revealed` flips it to show the data.
  function cardEl(city, { revealed = false, faded = false, anchor = false, draggable = false, id = '' } = {}) {
    const data = current.variant === 'cardinal'
      ? `${city.lat.toFixed(1)}, ${city.lon.toFixed(1)}`
      : city.pop.toLocaleString();
    const cls = ['card'];
    if (revealed) cls.push('revealed');
    if (faded) cls.push('faded');
    if (anchor) cls.push('anchor-card');
    if (draggable) cls.push('draggable');
    return `<div class="${cls.join(' ')}"${id ? ` id="${id}"` : ''}><div class="card-inner">
      <div class="card-face">${city.name}</div>
      <div class="card-back">${data}</div></div></div>`;
  }

  // A drop target. `dir` is '' for population. Carries where a placed card would go.
  function zone(dir, index) {
    return `<div class="dz" data-dir="${dir}" data-index="${index}"></div>`;
  }

  function header() {
    const cur = current.players[current.currentPlayerIndex];
    const you = current.players.find((p) => p.id === myId);
    return `
      <p class="diamonds">${current.players.map((p) => `${p.name}: ${'💎'.repeat(Math.max(0, p.diamonds))} ${p.diamonds}`).join(' · ')}</p>
      <p>La rând: <b>${cur.name}</b>${you ? ` — tu ești <b>${you.name}</b>` : ''}</p>`;
  }

  // The card currently drawn from the deck, shown to everyone during the placing phase.
  function drawBanner() {
    if (current.phase !== 'placing') return '';
    const card = drawnCard();
    if (!card) return '';
    if (myTurn()) {
      return `<div class="draw-banner"><span>Trage cartea pe locul potrivit (sau apasă un loc):</span>
        ${cardEl(card, { id: 'draw-card', draggable: true })}</div>`;
    }
    return `<div class="draw-banner"><span>Carte la rând:</span>${cardEl(card)}</div>`;
  }

  // One arm as an interleaved sequence: zone, card, zone, card, …, zone. Reversed arms
  // (N, V) grow away from the anchor, so the whole sequence is flipped; data-index on each
  // zone keeps the true insertion position regardless of visual order.
  function armSeq(dir, reverse, revealAll, withZones) {
    const arm = current.arms[dir];
    const nodes = [];
    for (let i = 0; i <= arm.length; i++) {
      if (withZones) nodes.push(zone(dir, i));
      if (i < arm.length) {
        nodes.push(cardEl(arm[i], { revealed: revealAll || placementOf(arm[i].id)?.revealed }));
      }
    }
    return (reverse ? nodes.reverse() : nodes).join('');
  }

  function boardHtml(revealAll = false) {
    const zones = myTurn() && current.phase === 'placing' && !revealAll;

    if (current.variant === 'population') {
      const nodes = [];
      current.line.forEach((c, i) => {
        if (zones) nodes.push(zone('', i));
        nodes.push(cardEl(c, {
          revealed: revealAll || placementOf(c.id)?.revealed,
          anchor: c.id === anchorCity().id,
        }));
      });
      if (zones) nodes.push(zone('', current.line.length));
      return `<div class="line">${nodes.join('')}</div>${removedHtml()}`;
    }

    return `<div class="plus">
      <div class="arm arm-n">${armSeq('N', true, revealAll, zones)}</div>
      <div class="arm arm-v">${armSeq('V', true, revealAll, zones)}</div>
      <div class="anchor">${cardEl(anchorCity(), { anchor: true })}</div>
      <div class="arm arm-e">${armSeq('E', false, revealAll, zones)}</div>
      <div class="arm arm-s">${armSeq('S', false, revealAll, zones)}</div>
    </div>${removedHtml()}`;
  }

  function removedHtml() {
    if (!current.removed || current.removed.length === 0) return '';
    const cards = current.removed.map((c) => cardEl(c, { revealed: true, faded: true })).join('');
    return `<div class="discard"><span>Scoase la contră:</span>${cards}</div>`;
  }

  // Place the drawn card where a drop zone points.
  function placeAt(dz) {
    const dir = dz.dataset.dir;
    const index = Number(dz.dataset.index);
    commit(placeCard(current, dir ? { dir, index } : { index }));
  }

  // Pointer-based drag (works with touch): a floating clone follows the finger, the drop
  // zone under it highlights, and releasing over one places the card there.
  function wireDrag(cardNode) {
    cardNode.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const clone = cardNode.cloneNode(true);
      clone.classList.add('drag-clone');
      clone.removeAttribute('id');
      document.body.appendChild(clone);
      const moveClone = (x, y) => { clone.style.left = `${x}px`; clone.style.top = `${y}px`; };
      moveClone(e.clientX, e.clientY);

      const highlight = (x, y) => {
        document.querySelectorAll('.dz-over').forEach((z) => z.classList.remove('dz-over'));
        const el = document.elementFromPoint(x, y);
        const dz = el && el.closest('.dz');
        if (dz) dz.classList.add('dz-over');
        return dz;
      };
      const onMove = (ev) => { moveClone(ev.clientX, ev.clientY); highlight(ev.clientX, ev.clientY); };
      const onUp = (ev) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        clone.remove();
        const dz = highlight(ev.clientX, ev.clientY);
        document.querySelectorAll('.dz-over').forEach((z) => z.classList.remove('dz-over'));
        if (dz) placeAt(dz);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
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
    root.innerHTML = `${header()}${drawBanner()}<div id="board">${boardHtml()}</div><div id="controls"></div>`;

    if (myTurn() && current.phase === 'placing') {
      const card = root.querySelector('#draw-card');
      if (card) wireDrag(card);
      root.querySelectorAll('.dz').forEach((z) => { z.onclick = () => placeAt(z); });
      return;
    }
    if (!myTurn()) {
      root.querySelector('#controls').innerHTML =
        `<p>Așteaptă pe <b>${current.players[current.currentPlayerIndex].name}</b>…</p>`;
      return;
    }
    renderChallengeControls();
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
