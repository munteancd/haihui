import { mulberry32 } from './prng.js';

// Fisher–Yates using a seeded PRNG. Pure: returns a new array.
export function shuffle(array, seed) {
  const rng = mulberry32(seed);
  const out = array.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Random subset of `size` cities for one game, using the room seed.
export function buildDeck(cities, size, seed) {
  return shuffle(cities, seed).slice(0, size);
}

// Draw the next card. Pure: returns { card, next } without mutating state.
export function draw(state) {
  const card = state.cards[state.pos];
  return { card, next: { ...state, pos: state.pos + 1 } };
}
