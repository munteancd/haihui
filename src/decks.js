// The decks a game can be played with. România: Romanian cities, plus tourist attractions
// in the cardinal game. Lume and Europa: GeoNames cities narrowed by difficulty.
// `sizes` is how many cards each difficulty plays with (shown in the lobby).
export const DECKS = {
  romania: { label: 'România', file: 'data/romania.json' },
  world: { label: 'Lume', file: 'data/cities.json', sizes: [200, 800, 2000, 7622] },
  europe: { label: 'Europa', file: 'data/europe.json', sizes: [85, 335, 935, 2226] },
};
export const DEFAULT_DECK = 'romania';

// Difficulty = the hardest tier in play. tools/build-cities.mjs gives every card the easiest
// tier it plays at: 1 holds capitals and well-known big cities, 4 everything else.
export const DIFFICULTY = { usor: 1, mediu: 2, greu: 3, legendar: 4 };
export const DIFFICULTY_LABELS = { usor: 'Ușor', mediu: 'Mediu', greu: 'Greu', legendar: 'Legendar' };
export const DEFAULT_DIFFICULTY = 'mediu';

// The cards of a tiered deck up to (and including) `tier`, one card per name: cards show
// only the name, so where several cities share one (Brest, Alexandria…) the game keeps the
// best known — the easiest tier, then the most populous.
export function pickPool(cities, tier) {
  const seen = new Set();
  return cities
    .filter((c) => (c.tier ?? 4) <= tier)
    .sort((a, b) => (a.tier ?? 4) - (b.tier ?? 4) || b.pop - a.pop)
    .filter((c) => !seen.has(c.name) && seen.add(c.name));
}

// The cards a game draws from, given the deck's loaded data. Attractions have no
// population, so the population game uses cities only (and leaves out any city whose
// population the source flagged as unreliable).
export function poolFor(deckId, data, variant, difficulty = 'legendar') {
  if (deckId === 'romania') {
    if (variant === 'population') return data.cities.filter((c) => !c.popSuspect);
    return [...data.cities, ...(data.attractions || [])];
  }
  return pickPool(data, DIFFICULTY[difficulty] ?? 4);
}
