// The decks a game can be played with. România: Romanian cities, plus tourist attractions
// in the cardinal game. Lume: the world cities, narrowed by difficulty.
export const DECKS = {
  romania: { label: 'România', file: 'data/romania.json' },
  world: { label: 'Lume', file: 'data/cities.json' },
};
export const DEFAULT_DECK = 'romania';

// Difficulty (Lume only) = how many cities are in play, kept to the most populous
// (best-known) ones. Easier tiers use a small, famous pool; Legendar uses everything.
export const DIFFICULTY = { usor: 200, mediu: 800, greu: 2000, legendar: Infinity };

// The pool of cities a difficulty draws from: the top `poolSize` by population.
export function pickPool(cities, poolSize) {
  if (poolSize === Infinity || cities.length <= poolSize) return cities.slice();
  return [...cities].sort((a, b) => b.pop - a.pop).slice(0, poolSize);
}

// The cards a game draws from, given the deck's loaded data. Attractions have no
// population, so the population game uses cities only (and leaves out any city whose
// population the source flagged as unreliable).
export function poolFor(deckId, data, variant, difficulty = 'legendar') {
  if (deckId === 'romania') {
    if (variant === 'population') return data.cities.filter((c) => !c.popSuspect);
    return [...data.cities, ...(data.attractions || [])];
  }
  return pickPool(data, DIFFICULTY[difficulty] ?? Infinity);
}
