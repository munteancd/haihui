import { placeCard, challenge, contestOptions, passChallenge, continueAfterContra,
         needsCheckpoint, resolveCheckpoint, continueAfterCheckpoint, cardsThisRound,
         isLastRound, isGameOver, winners } from './game-state.js';
import { isBot, botEstimate } from './bot.js';
import { formatLat, formatLon, formatPop } from './geo-format.js';
import { LOGO } from './logo.js';
import { avatar } from './avatar.js';

// World cards carry an ISO country code, shown as a Romanian country name ("EG" → "Egipt")
// on the card BACK only: on the face it would give the location away. (A game never deals
// two cards with the same name — see poolFor — so the name alone is never ambiguous.)
const regionNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['ro'], { type: 'region' }) : null;
// Shorter forms for names too long for a card.
const SHORT_COUNTRY = { US: 'SUA', GB: 'Marea Britanie', AE: 'Emiratele Arabe', CD: 'RD Congo',
  CG: 'Congo', CF: 'Rep. Centrafricană', DO: 'Rep. Dominicană', BA: 'Bosnia', KR: 'Coreea de Sud',
  KP: 'Coreea de Nord', HK: 'Hong Kong', MO: 'Macao', PS: 'Palestina' };
const countryName = (cc) => {
  if (SHORT_COUNTRY[cc]) return SHORT_COUNTRY[cc];
  try { return regionNames?.of(cc) ?? cc; } catch { return cc; }
};

const ARM_TAGS = {
  N: ['N', 'Nord: spre capăt, latitudinea crește'],
  S: ['S', 'Sud: spre capăt, latitudinea scade'],
  E: ['E', 'Est: spre capăt, longitudinea crește'],
  V: ['V', 'Vest: spre capăt, longitudinea scade'],
};

// Controlled board: renders a shared game `state` and only enables controls when it is
// THIS device's turn (state.players[currentPlayerIndex].id === myId). Every local action
// produces a new state and is handed to `onAction(newState)` so the caller can persist it.
// Remote updates arrive via the returned `setState`.
//
// Cardinal games are drawn as a plus: four arms grow outward from the start card.
// Population games are one vertical line, fewest people at the bottom. Cards show their
// name face-up; their data (county, coordinates or population) is on the back and only
// flips into view for a contra or a scoring. On your turn the drawn card is shown face-up
// and can be dragged (or tapped) onto a drop zone between/around the cards.
export function renderBoard(root, { state, myId, isHost = false, onAction = () => {} }) {
  let current = state;
  // While contesting a card that sits between two others, the contester taps the neighbour
  // to flip with it. Purely local: nothing is shared until the choice is made.
  let picking = false;

  const setState = (s) => { current = s; picking = false; draw(); };
  const commit = (s) => { current = s; picking = false; onAction(s); draw(); };
  const myTurn = () => current.players[current.currentPlayerIndex].id === myId;
  // A scoring is driven by the current player's device; if that player is a bot, the
  // host drives it instead (bots never have a device of their own).
  const iDriveCheckpoint = () => myTurn() || (isHost && isBot(current.players[current.currentPlayerIndex]));
  const anchorCity = () => current.placements[0].city;
  // The most recently placed card still on the board (skips the start card and any card a
  // successful contra knocked off). Used to glow "the last card played".
  const lastPlacedId = () => {
    for (let i = current.placements.length - 1; i >= 1; i--) {
      if (!current.placements[i].removed) return current.placements[i].city.id;
    }
    return null;
  };
  const drawnCard = () => current.deck.cards[current.deck.pos];
  // The two cards a contra flipped stay face-up on its result screen.
  const contraIds = () => (current.phase === 'contra_result' && current.lastResult
    ? [current.lastResult.card.id, current.lastResult.neighbour.id] : []);
  // Cards the scoring walk eliminated, ringed red once the board is revealed.
  const wrongIds = () => new Set(current.lastCheckpoint?.wrongIds ?? []);
  const axisOf = (dir) => (dir === 'N' || dir === 'S' ? 'lat' : 'lon');

  // Card ids that should play a one-shot animation on the next render.
  let animFlipIds = [];   // cards being revealed by a contra (flip)
  let animPlaceId = null; // card that has just been placed (slide/scale in)
  let animatedPlaceKey = null; // lastMove index already animated, so we don't repeat it
  let pickSides = new Map();   // card id -> neighbour side, while picking

  // A card: name (and a ★ for tourist attractions) on the face; county and the data on
  // the back, in the printed cards' style. `revealed` flips it. `axis` highlights the
  // coordinate that matters on that arm.
  function cardEl(city, { revealed = false, faded = false, anchor = false, draggable = false, wrong = false, last = false, axis = null, id = '' } = {}) {
    const attraction = city.kind === 'attraction';
    const cn = city.country ? countryName(city.country) : '';
    const country = cn === city.name ? '' : cn; // no "Singapore / Singapore"
    const region = city.county || country;
    const data = current.variant === 'cardinal'
      ? `<span class="coord${axis === 'lon' ? ' dim' : ''}">↑ ${formatLat(city.lat)}</span>
         <span class="coord${axis === 'lat' ? ' dim' : ''}">→ ${formatLon(city.lon)}</span>`
      : `<span class="coord">${formatPop(city.pop)} loc.</span>`;
    const cls = ['card'];
    if (revealed) cls.push('revealed');
    if (faded) cls.push('faded');
    if (anchor) cls.push('anchor-card');
    if (draggable) cls.push('draggable');
    if (wrong) cls.push('wrong');
    if (last) cls.push('last');
    if (pickSides.has(String(city.id))) cls.push('pick');
    if (animFlipIds.includes(city.id)) cls.push('flip-anim');
    if (city.id === animPlaceId) cls.push('place-anim');
    return `<div class="${cls.join(' ')}" data-id="${city.id}"${id ? ` id="${id}"` : ''}><div class="card-inner">
      <div class="card-face">${attraction ? '<span class="kind" title="Obiectiv turistic">★</span>' : ''}<span class="cname">${city.name}</span></div>
      <div class="card-back"><span class="bname">${city.name}</span>${region ? `<span class="county">${region}</span>` : ''}${data}</div></div></div>`;
  }

  // A drop target. `dir` is '' for population. Carries where a placed card would go.
  function zone(dir, index) {
    return `<div class="dz" data-dir="${dir}" data-index="${index}"></div>`;
  }

  // The plus can be wider than a phone screen: keep the start card in view after a render.
  function centerBoard() {
    const board = root.querySelector('#board');
    const anchor = board?.querySelector('.anchor');
    if (anchor) board.scrollLeft = anchor.offsetLeft - (board.clientWidth - anchor.offsetWidth) / 2;
  }

  // Brand + round progress, then one chip per player (diamonds, whose turn it is, which is you).
  function header({ turn = true } = {}) {
    const curId = current.players[current.currentPlayerIndex].id;
    const chips = current.players.map((p) => `
      <span class="pchip pscore${turn && p.id === curId ? ' turn' : ''}" data-p="${p.id}">
        ${avatar(p.name, p.id)}<span>${p.name}${isBot(p) ? ' 🤖' : ''}${p.id === myId && p.name !== 'Tu' ? ' <span class="you">(tu)</span>' : ''}</span>
        <span class="dcount">💎 ${p.diamonds}</span>${turn && p.id === curId ? '<span class="tag">la rând</span>' : ''}
      </span>`).join('');
    const placed = Math.min(cardsThisRound(current), current.roundSize);
    return `
      <header class="topbar">
        <div class="brand-mini">${LOGO}<span>Haihui</span></div>
        <div class="round-box">
          <p class="round">Runda <b>${current.round}</b> din ${current.numRounds} · cărți puse: <b>${placed}</b>/${current.roundSize}</p>
          <div class="progress"><span style="width:${(100 * placed) / current.roundSize}%"></span></div>
        </div>
      </header>
      <div class="players">${chips}</div>`;
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
      return `<div class="draw-banner mine">${cardEl(card, { id: 'draw-card', draggable: true })}
        <span>E rândul tău: trage cartea pe un loc liber <span class="hint">(sau apasă direct pe un ＋)</span></span></div>`;
    }
    return `<div class="draw-banner">${cardEl(card)}<span>Cartea pe care o pune acum <b>${current.players[current.currentPlayerIndex].name}</b></span></div>`;
  }

  // Shared per-card options for a card on the board.
  function boardCardOpts(city, revealAll, lastId, axis) {
    return {
      revealed: revealAll || contraIds().includes(city.id),
      wrong: revealAll && wrongIds().has(city.id),
      last: city.id === lastId,
      axis,
    };
  }

  // One arm as an interleaved sequence: zone, card, zone, card, …, zone. Reversed arms
  // (N, V) grow away from the start card, so the whole sequence is flipped; data-index on
  // each zone keeps the true insertion position regardless of visual order.
  function armSeq(dir, reverse, revealAll, withZones) {
    const arm = current.arms[dir];
    const lastId = revealAll ? null : lastPlacedId();
    const nodes = [];
    for (let i = 0; i <= arm.length; i++) {
      if (withZones) nodes.push(zone(dir, i));
      if (i < arm.length) nodes.push(cardEl(arm[i], boardCardOpts(arm[i], revealAll, lastId, axisOf(dir))));
    }
    return (reverse ? nodes.reverse() : nodes).join('');
  }

  function boardHtml(revealAll = false) {
    // No drop zones while a scoring guess is pending (phase is still 'placing' then).
    const zones = myTurn() && current.phase === 'placing' && !revealAll && !needsCheckpoint(current);
    const anchor = anchorCity();
    const anchorOpts = { ...boardCardOpts(anchor, revealAll, null, null), wrong: false, anchor: true };

    if (current.variant === 'population') {
      // line[0] has the fewest people and sits at the BOTTOM, so the column is built top-down
      // from the end of the line.
      const lastId = revealAll ? null : lastPlacedId();
      const nodes = [];
      current.line.forEach((c, i) => {
        if (zones) nodes.push(zone('', i));
        nodes.push(c.id === anchor.id ? cardEl(c, anchorOpts) : cardEl(c, boardCardOpts(c, revealAll, lastId, null)));
      });
      if (zones) nodes.push(zone('', current.line.length));
      return `<div class="pop-col"><div class="pop-label">↑ mai mulți locuitori</div>
        <div class="line">${nodes.reverse().join('')}</div>
        <div class="pop-label">↓ mai puțini locuitori</div></div>${removedHtml()}`;
    }

    // Each arm ends in its compass letter: first in DOM order for N and V (they grow up and
    // left), last for E and S.
    const tag = (dir) => `<span class="arm-tag" title="${ARM_TAGS[dir][1]}">${ARM_TAGS[dir][0]}</span>`;
    return `<div class="plus">
      <div class="arm arm-n">${tag('N')}${armSeq('N', true, revealAll, zones)}</div>
      <div class="arm arm-v">${tag('V')}${armSeq('V', true, revealAll, zones)}</div>
      <div class="anchor">${cardEl(anchor, anchorOpts)}</div>
      <div class="arm arm-e">${armSeq('E', false, revealAll, zones)}${tag('E')}</div>
      <div class="arm arm-s">${armSeq('S', false, revealAll, zones)}${tag('S')}</div>
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
    render();
    centerBoard();
  }

  function render() {
    animFlipIds = [];
    animPlaceId = null;
    pickSides = picking && myTurn() && current.phase === 'challenge_window'
      ? new Map(contestOptions(current).map((o) => [String(o.city.id), o.side]))
      : new Map();
    if (isGameOver(current)) {
      renderGameOver();
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
        `<p class="waiting-turn">Așteaptă pe <b>${current.players[current.currentPlayerIndex].name}</b>…</p>`;
      return;
    }
    renderChallengeControls();
  }

  // How a pair is judged, in words, for the contra result screen.
  function orderHint(dir) {
    switch (dir) {
      case 'N': return 'Pe brațul Nord contează doar latitudinea: spre capăt trebuie să crească.';
      case 'S': return 'Pe brațul Sud contează doar latitudinea: spre capăt trebuie să scadă.';
      case 'E': return 'Pe brațul Est contează doar longitudinea: spre capăt trebuie să crească.';
      case 'V': return 'Pe brațul Vest contează doar longitudinea: spre capăt trebuie să scadă.';
      default: return 'Mai sus trebuie să stea orașul cu mai mulți locuitori.';
    }
  }

  // Shared result screen after a contra: the two flipped cards are shown side by side the
  // way they lie on the board, the outcome and diamond transfer are spelled out, and
  // anyone can press Continuă to move on.
  function renderContraResult() {
    const r = current.lastResult;
    const msg = r.contraCorrect
      ? `✅ Contra <b>corectă</b>! „${r.cardName}" era greșit pusă — <b>${r.challengerName}</b> ia un 💎 de la <b>${r.placerName}</b>, iar cartea iese din joc.`
      : `❌ Contra <b>greșită</b>! „${r.cardName}" era bine pusă — <b>${r.challengerName}</b> dă un 💎 lui <b>${r.placerName}</b>. Cărțile se întorc la loc.`;
    // The pair in board order: toward the start card / below first.
    const pair = r.side === 'prev' ? [r.neighbour, r.card] : [r.card, r.neighbour];
    const axis = r.dir ? axisOf(r.dir) : null;
    animFlipIds = contraIds();
    const pairHtml = pair.map((c) => `<figure>${cardEl(c, {
      revealed: true, axis, wrong: c.id === r.card.id && r.contraCorrect, last: c.id === r.card.id,
    })}<figcaption>${c.id === r.card.id ? 'pusă acum' : 'vecina'}</figcaption></figure>`).join('');
    root.innerHTML = `${header()}<div id="board">${boardHtml()}</div>
      <div class="result ${r.contraCorrect ? 'good' : 'bad'}">
        <div class="pair pair-${r.dir || 'pop'}">${pairHtml}</div>
        <div class="result-text"><p>${msg}</p>
        <p class="hint">${orderHint(r.dir)} Valori egale = corect. Celelalte cărți nu contează.</p>
        <button id="cont">Continuă</button></div></div>`;
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
    if (picking) {
      c.innerHTML = `<p><b>${eligible.name}</b>, cu care vecină compari „${challenged.name}"?
        Atinge una din cele două cărți evidențiate — doar ea contează.</p>
        <button id="cancel" class="ghost">Renunță</button>`;
      root.querySelectorAll('#board .card.pick').forEach((el) => {
        el.onclick = () => commit(challenge(current, pickSides.get(el.dataset.id)));
      });
      c.querySelector('#cancel').onclick = () => { picking = false; draw(); };
      return;
    }
    c.innerHTML = `<p><b>${eligible.name}</b>, contrezi plasarea lui <b>${challenged.name}</b>?</p>
      <button id="contra">Contra</button><button id="pass" class="ghost">Las-o</button>`;
    c.querySelector('#contra').onclick = () => {
      const options = contestOptions(current);
      if (options.length === 1) {
        commit(challenge(current, options[0].side));
      } else {
        picking = true;
        draw();
      }
    };
    c.querySelector('#pass').onclick = () => commit(passChallenge(current));
  }

  function scoringTitle() {
    return isLastRound(current) ? 'Punctaj final' : `Punctaj intermediar (runda ${current.round} din ${current.numRounds})`;
  }

  function renderCheckpoint() {
    // The guess is made BLIND: the board stays face-down while estimates are entered. The
    // cards only flip face-up on the reveal screen, after Punctează. Bot players get an
    // automatic (pre-filled) guess so a human need only enter the human guesses.
    const board = `<div id="board">${boardHtml(false)}</div>`;
    if (!iDriveCheckpoint()) {
      root.innerHTML = `${header()}${board}<div class="result"><p class="waiting-turn">${scoringTitle()}: se ghicește…</p></div>`;
      return;
    }
    root.innerHTML = `${header()}${board}<div class="result">
      <h3>${scoringTitle()} — câte cărți sunt greșite pe masă?</h3>
      <p class="hint">Ghicește fără să întorci cărțile. Nimeresc exact → +2 💎; dacă nimeni nu nimerește, cel mai aproape → +1 💎.</p>
      <div class="score-form">
      ${current.players.map((p) => {
        const bot = isBot(p);
        return `<label>${p.name}${bot ? ' 🤖' : ''} <input data-p="${p.id}" type="number" min="0"
          value="${bot ? botEstimate(current, p) : 0}"${bot ? ' disabled' : ''} /></label>`;
      }).join('')}
      <button id="score">Punctează</button></div></div>`;
    root.querySelector('#score').onclick = () => {
      const est = {};
      root.querySelectorAll('input[data-p]').forEach((i) => { est[i.dataset.p] = Number(i.value); });
      commit(resolveCheckpoint(current, est));
    };
  }

  // After scoring: flip the whole board face-up in a cascade so everyone sees which cards
  // the walk from the start card eliminated (red ring), the true count, and who guessed
  // best. Continuă starts a fresh round (or shows the winner after the last one).
  function renderCheckpointReveal() {
    const cp = current.lastCheckpoint;
    const who = cp.scorerNames.join(', ');
    const verb = cp.exact ? (cp.scorerNames.length > 1 ? 'au nimerit exact' : 'a nimerit exact')
      : (cp.scorerNames.length > 1 ? 'au fost cei mai aproape' : 'a fost cel mai aproape');
    const found = cp.truth === 0 ? 'nu era nicio carte greșită'
      : cp.truth === 1 ? 'era <b>1</b> carte greșită (încercuită cu roșu)'
      : `erau <b>${cp.truth}</b> cărți greșite (încercuite cu roșu)`;
    const msg = `Pe masă ${found}. <b>${who}</b> ${verb} → +${cp.reward} 💎.`;
    const next = cp.final ? 'Vezi câștigătorul' : 'Continuă (runda următoare)';
    root.innerHTML = `${header()}<div id="board">${boardHtml(true)}</div>
      <div class="result"><p>${msg}</p>
      <p class="hint">${current.variant === 'cardinal'
        ? 'Am verificat braț cu braț, pornind de la cartea de start'
        : 'Am verificat de la cartea de start în sus, apoi în jos'}: fiecare carte e comparată cu ultima carte rămasă bună dinaintea ei.</p>
      <button id="cont">${next}</button></div>`;
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

  function renderGameOver() {
    const w = winners(current).map((p) => p.name).join(', ');
    const medals = ['🥇', '🥈', '🥉'];
    const standings = [...current.players].sort((a, b) => b.diamonds - a.diamonds)
      .map((p, i) => `<li>${medals[i] ?? `${i + 1}.`} ${p.name}: ${p.diamonds} 💎</li>`).join('');
    root.innerHTML = `${header({ turn: false })}<section class="gameover"><h2>Gata! Câștigă: ${w} 🏆</h2><ol class="standings">${standings}</ol></section>
      <div id="board">${boardHtml(true)}</div><button id="menu">Meniu</button>`;
    root.querySelector('#menu').onclick = () => location.reload();
  }

  draw();
  return { setState };
}
