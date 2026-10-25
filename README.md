# Haihui

Multiplayer place-the-card geography game (PWA), inspired by the Romanian board game
"Hai-Hui prin România" (Cardline/Timeline style).

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
- A game is **3 rounds of 15 placed cards** (the start card isn't counted; start cards are
  set aside and never come from the 45-card draw pile). After each round everyone guesses
  how many cards are wrong, blind. Then the board is checked from the start card outward,
  card by card, against the last card still standing; wrong ones are eliminated. Exact
  guess → +2 💎; if nobody is exact, the closest → +1 💎. The board is cleared and the next
  round starts from a new start card. Most 💎 after the last round wins.

Play with friends via a room code (state syncs through Supabase) or solo against bots.

## Decks
- **România** (default) — 140 Romanian cities: every county seat plus the largest other
  towns, with county and population; tourist attractions (★) join the cardinal variant
  once `data/romania.json` is built from the full GeoNames dump (see `docs/data.md`).
- **Lume** — the world cities (top 50 per country), with difficulty tiers.

Geographic data © GeoNames (CC BY 4.0), credited in the app footer.

## Setup
1. Create a Supabase project; run `supabase/schema.sql` in the SQL editor, plus
   `alter table rooms add column state jsonb;`. Enable Realtime for `rooms` and `players`.
   (`rooms.num_turns` now stores the number of rounds; no migration needed.)
2. Put your Supabase URL + publishable key in `src/config.js`.

## Dev
- Serve statically: `npx serve` (or `python -m http.server`) and open the printed URL.
- Tests: `npm test` (pure game logic + the data build helpers).
- Any frontend change: bump `CACHE` in `sw.js` so open tabs pick it up.

## Deploy
GitHub Pages from the default branch, root. Live at `munteancd.github.io/haihui`.
