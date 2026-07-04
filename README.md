# Haihui

Multiplayer city-placement game (PWA), inspired by the Romanian board game
"Haihui prin România / Europa / Lume" (Cardline/Timeline style).

Two variants, chosen at the start:
- **Puncte cardinale** — place a city N/S/E/V of a city already on the board.
- **Populație** — insert a city into a line ordered by population.

Bluff/challenge mechanic: placements aren't revealed. The player to your right may
**contra** the last placement; a correct contra steals a diamond, a wrong one gives one.
Everyone starts with 5 diamonds. Every 15 cards, a checkpoint scores who guesses how many
placements are wrong. Most diamonds at the end wins.

Play with friends via a room code — real-time state syncs through Supabase.
City data © GeoNames (CC BY 4.0), thousands of cities worldwide.

## Setup
1. Create a Supabase project; run `supabase/schema.sql` in the SQL editor, plus
   `alter table rooms add column state jsonb;`. Enable Realtime for `rooms` and `players`.
2. Put your Supabase URL + publishable key in `src/config.js`.

## Dev
- Serve statically: `npx serve` (or `python -m http.server`) and open the printed URL.
- Tests: `npm test` (pure game logic).

## Deploy
GitHub Pages from the default branch, root. Live at `munteancd.github.io/haihui`.
