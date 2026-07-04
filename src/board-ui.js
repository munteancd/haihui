import { createGame, placeCard, challenge, passChallenge,
         needsCheckpoint, resolveCheckpoint, isGameOver, winners } from './game-state.js';

// Minimal DOM board. `hooks.onState(state)` fires after every action so the caller can
// persist to Supabase. Supports both the cardinal (2D grid) and population (line) variants.
export function renderBoard(root, cities, opts, hooks = {}) {
  let state = createGame({ ...opts, cities });
  const emit = () => { hooks.onState?.(state); draw(); };

  function draw() {
    if (isGameOver(state)) {
      const w = winners(state).map((p) => p.name).join(', ');
      root.innerHTML = `<h2>Gata! Câștigă: ${w}</h2>`;
      return;
    }
    if (needsCheckpoint(state) && state.phase === 'placing') {
      renderCheckpoint();
      return;
    }
    const cur = state.players[state.currentPlayerIndex];
    root.innerHTML = `
      <p>Diamante: ${state.players.map((p) => `${p.name}:${p.diamonds}`).join('  ')}</p>
      <p>La rând: <b>${cur.name}</b> — fază: ${state.phase}</p>
      <div id="grid"></div>
      <div id="controls"></div>`;
    renderGrid();
    state.phase === 'placing' ? renderPlaceControls() : renderChallengeControls();
  }

  function renderGrid() {
    if (state.variant === 'population') return renderLine();
    const grid = root.querySelector('#grid');
    grid.style.cssText = 'position:relative;height:320px;overflow:auto;border:1px solid #333';
    for (const p of state.placements) {
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
    state.line.forEach((city) => {
      const el = document.createElement('div');
      el.textContent = `${city.name} (${city.pop.toLocaleString()})`;
      el.style.cssText = 'padding:4px 6px;background:#1e293b;border-radius:6px;white-space:nowrap';
      grid.appendChild(el);
    });
  }

  function renderPlaceControls() {
    const c = root.querySelector('#controls');
    const drawn = state.deck.cards[state.deck.pos];

    if (state.variant === 'population') {
      const slots = Array.from({ length: state.line.length + 1 },
        (_, i) => `<option value="${i}">poziția ${i}</option>`).join('');
      c.innerHTML = `<p>Carte: <b>${drawn.name}</b></p>
        <select id="idx">${slots}</select><button id="place">Pune</button>`;
      c.querySelector('#place').onclick = () => {
        state = placeCard(state, { index: Number(c.querySelector('#idx').value) });
        emit();
      };
      return;
    }

    const refOptions = state.placements
      .map((p) => `<option value="${p.city.id}">${p.city.name}</option>`).join('');
    c.innerHTML = `
      <p>Carte: <b>${drawn.name}</b></p>
      <select id="ref">${refOptions}</select>
      <select id="dir"><option>N</option><option>S</option><option>E</option><option>V</option></select>
      <button id="place">Pune</button>`;
    c.querySelector('#place').onclick = () => {
      state = placeCard(state, {
        refId: Number(c.querySelector('#ref').value),
        dir: c.querySelector('#dir').value,
      });
      emit();
    };
  }

  function renderChallengeControls() {
    const c = root.querySelector('#controls');
    const eligible = state.players[state.currentPlayerIndex];
    c.innerHTML = `<p><b>${eligible.name}</b>, contrezi ultima plasare?</p>
      <button id="contra">Contra</button><button id="pass">Las-o</button>`;
    c.querySelector('#contra').onclick = () => { state = challenge(state); emit(); };
    c.querySelector('#pass').onclick = () => { state = passChallenge(state); emit(); };
  }

  function renderCheckpoint() {
    root.innerHTML = `<h3>Checkpoint — câte cărți sunt greșite?</h3>
      ${state.players.map((p) =>
        `<label>${p.name} <input data-p="${p.id}" type="number" min="0" value="0" /></label>`).join('')}
      <button id="score">Punctează</button>`;
    root.querySelector('#score').onclick = () => {
      const est = {};
      root.querySelectorAll('input[data-p]').forEach((i) => { est[i.dataset.p] = Number(i.value); });
      state = resolveCheckpoint(state, est);
      emit();
    };
  }

  draw();
}
