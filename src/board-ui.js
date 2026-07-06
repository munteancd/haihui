import { placeCard, challenge, passChallenge, continueAfterContra,
         needsCheckpoint, resolveCheckpoint, continueAfterCheckpoint,
         isGameOver, winners } from './game-state.js';
import { isBot, botEstimate } from './bot.js';

// Controlled board: renders a shared game `state` and only enables controls when it is
// THIS device's turn (state.players[currentPlayerIndex].id === myId). Every local action
// produces a new state and is handed to `onAction(newState)` so the caller can persist it.
// Remote updates arrive via the returned `setState`.
//
// Cardinal games are drawn as a plus: four arms grow outward from the anchor. Cards show
// their name face-up; their data lives on the back and is flipped into view only when a
// checkpoint or a knocked-off (correct) contra reveals it. On your turn the drawn card is
// shown face-up and can be dragged (or tapped) onto a drop zone between/around the cards.
export function renderBoard(root, { state, myId, isHost = false, onAction = () => {} }) {
  let current = state;

  const setState = (s) => { current = s; draw(); };
  const commit = (s) => { current = s; onAction(s); draw(); };
  const myTurn = () => current.players[current.currentPlayerIndex].id === myId;
  // A checkpoint is driven by the current player's device; if that player is a bot, the
  // host drives it instead (bots never have a device of their own).
  const iDriveCheckpoint = () => myTurn() || (isHost && isBot(current.players[current.currentPlayerIndex]));
  const anchorCity = () => current.placements[0].city;
  const placementOf = (cityId) => current.placements.find((p) => p.city.id === cityId);
  // The most recently placed card still on the board (skips the anchor and any card a
  // successful contra knocked off). Used to glow "the last card played".
  const lastPlacedId = () => {
    for (let i = current.placements.length - 1; i >= 1; i--) {
      if (!current.placements[i].removed) return current.placements[i].city.id;
    }
    return null;
  };
  const drawnCard = () => current.deck.cards[current.deck.pos];

  // Card ids that should play a one-shot animation on the next render.
  let animFlipId = null;  // card being revealed by a contra (flip)
  let animPlaceId = null; // card that has just been placed (slide/scale in)
  let animatedPlaceKey = null; // lastMove index already animated, so we don't repeat it

  // A card: name on the face, data on the back. `revealed` flips it to show the data. We
  // deliberately do NOT show the country/flag — it would give away roughly where the city is.
  function cardEl(city, { revealed = false, faded = false, anchor = false, draggable = false, wrong = false, last = false, id = '' } = {}) {
    const data = current.variant === 'cardinal'
      ? `${city.lat.toFixed(1)}, ${city.lon.toFixed(1)}`
      : city.pop.toLocaleString();
    const cls = ['card'];
    if (revealed) cls.push('revealed');
    if (faded) cls.push('faded');
    if (anchor) cls.push('anchor-card');
    if (draggable) cls.push('draggable');
    if (wrong) cls.push('wrong');
    if (last) cls.push('last');
    if (city.id === animFlipId) cls.push('flip-anim');
    if (city.id === animPlaceId) cls.push('place-anim');
    return `<div class="${cls.join(' ')}"${id ? ` id="${id}"` : ''}><div class="card-inner">
      <div class="card-face"><span class="cname">${city.name}</span></div>
      <div class="card-back">${data}</div></div></div>`;
  }

  // A drop target. `dir` is '' for population. Carries where a placed card would go.
  function zone(dir, index) {
    return `<div class="dz" data-dir="${dir}" data-index="${index}"></div>`;
  }

  function header() {
    const cur = current.players[current.currentPlayerIndex];
    const you = current.players.find((p) => p.id === myId);
    const scores = current.players.map((p) =>
      `<span class="pscore" data-p="${p.id}">${p.name}: <span class="dcount">${'💎'.repeat(Math.max(0, p.diamonds))} ${p.diamonds}</span></span>`)
      .join(' · ');
    return `
      <p class="diamonds">${scores}</p>
      <p>La rând: <b>${cur.name}</b>${you ? ` — tu ești <b>${you.name}</b>` : ''}</p>`;
  }

  // Animate a diamond flying from the loser's score to the winner's, then pulse the winner.
  function flyDiamond(loserId, winnerId) {
    const from = root.querySelector(`.pscore[data-p="${loserId}"]`);
    const to = root.querySelector(`.pscore[data-p="${winnerId}"]`);
    if (!from || !to) return;
    const a = from.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    const gem = document.createElement('div');
    gem.className = 'fly-diamond';
    gem.textContent = '💎';
    gem.style.left = `${a.left + a.width / 2}px`;
    gem.style.top = `${a.top}px`;
    document.body.appendChild(gem);
    requestAnimationFrame(() => {
      gem.style.transform = `translate(${b.left + b.width / 2 - (a.left + a.width / 2)}px, ${b.top - a.top}px) scale(1.8) rotate(360deg)`;
      gem.style.opacity = '0.2';
    });
    setTimeout(() => {
      gem.remove();
      to.querySelector('.dcount')?.classList.add('pulse');
    }, 650);
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
    const lastId = revealAll ? null : lastPlacedId();
    const nodes = [];
    for (let i = 0; i <= arm.length; i++) {
      if (withZones) nodes.push(zone(dir, i));
      if (i < arm.length) {
        nodes.push(cardEl(arm[i], {
          revealed: revealAll || placementOf(arm[i].id)?.revealed,
          wrong: revealAll && placementOf(arm[i].id)?.isCorrect === false,
          last: arm[i].id === lastId,
        }));
      }
    }
    return (reverse ? nodes.reverse() : nodes).join('');
  }

  function boardHtml(revealAll = false) {
    // No drop zones while a checkpoint guess is pending (phase is still 'placing' then).
    const zones = myTurn() && current.phase === 'placing' && !revealAll && !needsCheckpoint(current);

    if (current.variant === 'population') {
      const lastId = revealAll ? null : lastPlacedId();
      const nodes = [];
      current.line.forEach((c, i) => {
        if (zones) nodes.push(zone('', i));
        nodes.push(cardEl(c, {
          revealed: revealAll || placementOf(c.id)?.revealed,
          anchor: c.id === anchorCity().id,
          wrong: revealAll && placementOf(c.id)?.isCorrect === false,
          last: c.id === lastId,
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
    animFlipId = null;
    animPlaceId = null;
    if (isGameOver(current)) {
      const w = winners(current).map((p) => p.name).join(', ');
      root.innerHTML = `${header()}<h2>Gata! Câștigă: ${w} 🏆</h2><div id="board">${boardHtml(true)}</div>`;
      return;
    }
    if (current.phase === 'contra_result') {
      renderContraResult();
      return;
    }
    if (current.phase === 'checkpoint_reveal') {
      renderCheckpointReveal();
      return;
    }
    if (needsCheckpoint(current) && current.phase === 'placing') {
      renderCheckpoint();
      return;
    }
    // Animate a freshly placed card sliding into its slot (once per placement).
    if (current.phase === 'challenge_window' && current.lastMove
        && animatedPlaceKey !== current.lastMove.placementIndex) {
      animPlaceId = current.placements[current.lastMove.placementIndex].city.id;
      animatedPlaceKey = current.lastMove.placementIndex;
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

  // Shared result screen after a contra: the challenged card is revealed, the outcome and
  // diamond transfer are spelled out, and anyone can press Continuă to move on.
  function renderContraResult() {
    const r = current.lastResult;
    const msg = r.contraCorrect
      ? `✅ Contra <b>corectă</b>! „${r.cardName}" era greșit pusă — <b>${r.challengerName}</b> ia un 💎 de la <b>${r.placerName}</b>, iar cartea iese de pe tablă.`
      : `❌ Contra <b>greșită</b>! „${r.cardName}" era bine pusă — <b>${r.challengerName}</b> dă un 💎 lui <b>${r.placerName}</b>.`;
    // Flip the challenged card as it is revealed.
    animFlipId = current.placements[r.placementIndex].city.id;
    root.innerHTML = `${header()}<div id="board">${boardHtml()}</div>
      <div class="result"><p>${msg}</p><button id="cont">Continuă</button></div>`;
    root.querySelector('#cont').onclick = () => commit(continueAfterContra(current));
    // Fly a diamond from the loser to the winner, then pulse the winner's score.
    const winnerIdx = r.contraCorrect ? r.challengerIndex : r.placerIndex;
    const loserIdx = r.contraCorrect ? r.placerIndex : r.challengerIndex;
    flyDiamond(current.players[loserIdx].id, current.players[winnerIdx].id);
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
    // The guess is made BLIND: the board stays face-down while estimates are entered. The
    // cards only flip face-up on the reveal screen, after Punctează. Bot players get an
    // automatic (pre-filled) guess so a human need only enter the human guesses.
    const board = `<div id="board">${boardHtml(false)}</div>`;
    if (!iDriveCheckpoint()) {
      root.innerHTML = `${header()}${board}<p>Se punctează checkpoint-ul…</p>`;
      return;
    }
    root.innerHTML = `${header()}${board}
      <h3>Checkpoint — câte cărți sunt greșite pe tablă?</h3>
      <p class="hint">Ghicește fără să întorci cărțile. Nimeresc exact → +2 💎; cel mai aproape → +1 💎.</p>
      ${current.players.map((p) => {
        const bot = isBot(p);
        return `<label>${p.name}${bot ? ' 🤖' : ''} <input data-p="${p.id}" type="number" min="0"
          value="${bot ? botEstimate(current) : 0}"${bot ? ' disabled' : ''} /></label>`;
      }).join('')}
      <button id="score">Punctează</button>`;
    root.querySelector('#score').onclick = () => {
      const est = {};
      root.querySelectorAll('input[data-p]').forEach((i) => { est[i.dataset.p] = Number(i.value); });
      commit(resolveCheckpoint(current, est));
    };
  }

  // After scoring: flip the whole board face-up in a cascade so everyone sees which cards
  // were mis-placed (red ring), the true count, and who guessed best. Continuă starts a
  // fresh round (the board is cleared and a new anchor is drawn).
  function renderCheckpointReveal() {
    const cp = current.lastCheckpoint;
    const who = cp.scorerNames.join(', ');
    const verb = cp.exact ? 'a nimerit exact' : 'a fost cel mai aproape';
    const msg = `Pe tablă erau <b>${cp.truth}</b> cărți greșite. <b>${who}</b> ${verb} → +${cp.reward} 💎.`;
    root.innerHTML = `${header()}<div id="board">${boardHtml(true)}</div>
      <div class="result"><p>${msg}</p><button id="cont">Continuă (rundă nouă)</button></div>`;
    // Cascade the flip: every card starts face-down and flips to its data one after another.
    root.querySelectorAll('#board .card').forEach((el, i) => {
      el.classList.add('reveal-flip');
      el.style.setProperty('--d', `${i * 80}ms`);
    });
    // Pulse the scorers' totals.
    cp.scorerIds.forEach((id) =>
      root.querySelector(`.pscore[data-p="${id}"] .dcount`)?.classList.add('pulse'));
    root.querySelector('#cont').onclick = () => commit(continueAfterCheckpoint(current));
  }

  draw();
  return { setState };
}
