# Haihui

**▶ Joacă: https://munteancd.github.io/haihui/**

Multiplayer place-the-card geography game (PWA), inspired by the Romanian board game
"Hai-Hui prin România" (Cardline/Timeline style). A fan project, not affiliated with the
board game's publishers.

## Pe scurt, pentru jucători

- Deschide linkul de mai sus pe telefon sau pe calculator. Nu trebuie cont.
- **Singur:** la „Solo cu boți” alegi varianta și apeși **Începe**.
- **Cu prietenii:** unul apasă **Creează** la „Cameră nouă” și le dă celorlalți codul de 4
  litere. Ceilalți îl scriu la „Intră cu cod”. Când sunt toți, gazda apasă **Start joc**.
  În cameră aveți și un **chat** (butonul 💬 din dreapta jos). Mesajele nu se păstrează:
  după o reîncărcare a paginii, chatul pornește gol.
- **Pachetul:** România (orașe și obiective turistice), Lume sau Europa. La Lume și Europa
  alegi și dificultatea: Ușor are doar capitale și orașe mari, cunoscute; Legendar le are
  pe toate.
- **Regulile:** butonul **Cum se joacă** din meniu.
- **Ca aplicație pe telefon:** Android/Chrome: meniul ⋮ → *Adaugă pe ecranul de pornire*.
  iPhone/Safari: *Partajează* → *Adaugă pe ecranul principal*.
- După o actualizare, pagina se reîncarcă singură. Un joc cu prietenii început înainte de
  actualizare nu mai continuă: faceți o cameră nouă.

## Rules (as the app plays them)

Two variants, chosen at the start:
- **Puncte cardinale** — a start card lies on the table; each card goes on the cross (+)
  through it: on the North–South axis (only latitude counts) or the East–West axis (only
  longitude counts), at the end of an arm or between two cards already on it.
- **Populație** — one vertical line, least populated city at the bottom, most at the top.

- Everyone starts with **4 diamonds** (💎); the bank is unlimited.
- After a card is placed, the next player may **contra**; if they pass, the one after them,
  and so on. A contra flips the placed card and **one** neighbour (at a tip there is only
  the inner one; between two cards the contester picks). Only that pair is judged, and
  **equal values count as correct**. Coordinates are compared in whole arc-minutes, exactly
  as the cards show them (`46° 46' N`).
- Contra right: the placer gives the contester a 💎 and the card leaves the game. Contra
  wrong: the contester gives the placer a 💎 and both cards stay. A player with no 💎 gives
  nothing; the winner takes one from the bank.
- A game is **3 rounds of 15 placed cards** by default (the lobby also offers 1–5 rounds and
  18, 20 or 25 cards per round; the start card isn't counted; start cards are set aside and
  never come from the draw pile — 45 cards for 3 × 15). If a small deck runs out first, the
  round in play is the last. After each round everyone guesses
  how many cards are wrong, blind. Then the board is checked from the start card outward,
  card by card, against the last card still standing; wrong ones are eliminated. Exact
  guess → +2 💎; if nobody is exact, the closest → +1 💎. The board is cleared and the next
  round starts from a new start card. Most 💎 after the last round wins.

Play with friends via a room code (state syncs through Supabase) or solo against bots.

## Decks
- **România** (default) — 140 Romanian cities (every county seat plus the largest other
  towns, with county and population) and 38 tourist attractions (★: castles,
  monasteries, caves, lakes, peaks…), which play in the cardinal variant only. Built from
  the GeoNames dump for Romania by `tools/build-romania.mjs` (see `docs/data.md`).
- **Lume** — 7 627 world cities, in four difficulties: Ușor plays the 200 best-known
  (capitals and big cities), Legendar all of them. The country is on the card back.
- **Europa** — 2 226 European cities (Russia up to the Urals, Istanbul and East Thrace),
  same four difficulties from 85 cities (capitals and 400 000+ cities) up.

Geographic data © GeoNames (CC BY 4.0), credited in the app footer.

## Setup
Multiplayer needs a free Supabase project: run `supabase/schema.sql` in its SQL editor and
put the Project URL + publishable key in `src/config.js`. A scheduled GitHub Action pings
it twice a week so the free project isn't paused. Steps, and what to do if it is paused
anyway, in `docs/supabase-setup.md`.

## Dev
- Serve statically: `npx serve` (or `python -m http.server`) and open the printed URL.
- Tests: `npm test` (pure game logic + the data build helpers).
- Any frontend change: bump `CACHE` in `sw.js` so open tabs pick it up.

Where things live:
- `src/game-state.js` — the game as pure state transitions (turns, contra, rounds, scoring);
  `src/rules-cardinal.js` / `src/rules-population.js` — what counts as correct.
- `src/board-ui.js`, `src/lobby-ui.js` — the screens; `src/main.js` wires solo and rooms.
- `src/bot.js` — the solo bots; `src/realtime-sync.js` — Supabase rooms (state + chat
  broadcasts); `src/chat-ui.js` — the room chat panel.
- `src/decks.js` — deck choice; `data/` — the card data, built by `tools/`.
- `css/style.css` — the look: colour tokens at the top (light, plus a dark-mode block),
  then components; `src/logo.js` / `icon.svg` — the compass logo.

## Deploy
GitHub Pages from `master`, repo root: a push to `master` is live within a minute or two
at https://munteancd.github.io/haihui/. Work on a branch and merge when ready.
