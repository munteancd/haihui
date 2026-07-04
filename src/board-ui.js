import { placeCard, challenge, passChallenge,
         needsCheckpoint, resolveCheckpoint, isGameOver, winners } from './game-state.js';

// Controlled board: renders a shared game `state` and only enables controls when it is
// THIS device's turn (state.players[currentPlayerIndex].id === myId). Every local action
// produces a new state and is handed to `onAction(newState)` so the caller can persist it
// to Supabase. Remote updates arrive via the returned `setState`.
//
// Returns { setState } so the caller can push remote state in and trigger a re-render.
export function renderBoard(root, { state, myId, onAction = () => {} }) {
  let current = state;

  const setState = (s) => { current = s; draw(); };
  const commit = (s) => { current = s; onAction(s); draw(); };
  const myTurn = () => current.players[current.currentPlayerIndex].id === myId;

  function header() {
    const cur = current.players[current.currentPlayerIndex];
    const you = current.players.find((p) => p.id === myId);
    return `
      <p>Diamante: ${current.players.map((p) => `${p.name}:${p.diamonds}`).join('  ')}</p>
      <p>La rând: <b>${cur.name}</b>${you ? ` — tu ești <b>${you.name}</b>` : ''} — fază: ${current.phase}</p>`;
  }

  function draw() {
    if (isGameOver(current)) {
      const w = winners(current).map((p) => p.name).join(', ');
      root.innerHTML = `<h2>Gata! Câștigă: ${w}</h2>`;
      return;
    }
    if (needsCheckpoint(current) && current.phase === 'placing') {
      renderCheckpoint();
      return;
    }
    root.innerHTML = `${header()}<div id="grid"></div><div id="controls"></div>`;
    renderGrid();
    if (!myTurn()) {
      root.querySelector('#controls').innerHTML =
        `<p>Așteaptă pe <b>${current.players[current.currentPlayerIndex].name}</b>…</p>`;
      return;
    }
    current.phase === 'placing' ? renderPlaceControls() : renderChallengeControls();
  }

  function renderGrid() {
    if (current.variant === 'population') return renderLine();
    const grid = root.querySelector('#grid');
    grid.style.cssText = 'position:relative;height:320px;overflow:auto;border:1px solid #333';
    for (const p of current.placements) {
      const el = document.createElement('div');
      el.textContent = p.city.name;
      el.style.cssText = `position:absolute;left:${160 + p.cell.x * 90}px;top:${150 - p.cell.y * 40}px;` +
        'padding:4px 6px;background:#1e293b;border-radius:6px;font-size:13px';
      grid.appendChild(el);
    }
  }

  function renderLine() {
    const grid = root.querySelector('#grid');
    grid.style.cssText = 'display:flex;gap:6px;overflow:auto;border:1px solid #333;padding:8px';
    current.line.forEach((city) => {
      const el = document.createElement('div');
      el.textContent = `${city.name} (${city.pop.toLocaleString()})`;
      el.style.cssText = 'padding:4px 6px;background:#1e293b;border-radius:6px;white-space:nowrap';
      grid.appendChild(el);
    });
  }

  function renderPlaceControls() {
    const c = root.querySelector('#controls');
    const drawn = current.deck.cards[current.deck.pos];

    if (current.variant === 'population') {
      const slots = Array.from({ length: current.line.length + 1 },
        (_, i) => `<option value="${i}">poziția ${i}</option>`).join('');
      c.innerHTML = `<p>Carte: <b>${drawn.name}</b></p>
        <select id="idx">${slots}</select><button id="place">Pune</button>`;
      c.querySelector('#place').onclick = () =>
        commit(placeCard(current, { index: Number(c.querySelector('#idx').value) }));
      return;
    }

    const refOptions = current.placements
      .map((p) => `<option value="${p.city.id}">${p.city.name}</option>`).join('');
    c.innerHTML = `
      <p>Carte: <b>${drawn.name}</b></p>
      <select id="ref">${refOptions}</select>
      <select id="dir"><option>N</option><option>S</option><option>E</option><option>V</option></select>
      <button id="place">Pune</button>`;
    c.querySelector('#place').onclick = () =>
      commit(placeCard(current, {
        refId: Number(c.querySelector('#ref').value),
        dir: c.querySelector('#dir').value,
      }));
  }

  function renderChallengeControls() {
    const c = root.querySelector('#controls');
    const eligible = current.players[current.currentPlayerIndex];
    c.innerHTML = `<p><b>${eligible.name}</b>, contrezi ultima plasare?</p>
      <button id="contra">Contra</button><button id="pass">Las-o</button>`;
    c.querySelector('#contra').onclick = () => commit(challenge(current));
    c.querySelector('#pass').onclick = () => commit(passChallenge(current));
  }

  function renderCheckpoint() {
    // Only the current player's device drives the checkpoint (a shared moment among friends).
    if (!myTurn()) {
      root.innerHTML = `${header()}<p>Se punctează checkpoint-ul…</p>`;
      return;
    }
    root.innerHTML = `<h3>Checkpoint — câte cărți sunt greșite?</h3>
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
