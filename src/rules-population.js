// The population line runs bottom to top: line[0] is the least populated city, the last
// one the most populated. Equal populations count as correct.

// Is `upper` correctly placed above `lower`?
export function isPairInOrder(lower, upper) {
  return lower.pop <= upper.pop;
}

// Would `city` inserted at `index` (0..line.length) fit both its neighbours? Contests only
// check one neighbour; bots use this to aim.
export function isInsertCorrect(line, index, city) {
  const below = index > 0 ? line[index - 1] : null;
  const above = index < line.length ? line[index] : null;
  return (below === null || isPairInOrder(below, city)) && (above === null || isPairInOrder(city, above));
}

// The neighbours of the card at line[index]: 'prev' is the one below, 'next' the one above.
export function lineNeighbours(line, index) {
  const out = [];
  if (index > 0) out.push({ side: 'prev', city: line[index - 1] });
  if (index + 1 < line.length) out.push({ side: 'next', city: line[index + 1] });
  return out;
}

export function isContestedPairCorrect(city, neighbour, side) {
  return side === 'prev' ? isPairInOrder(neighbour, city) : isPairInOrder(city, neighbour);
}

// Scoring walk: from the start card, go up comparing each card with the last one still
// standing, then down the same way. Out-of-order cards are eliminated (the reference
// stays). Returns the eliminated cards.
export function wrongCardsPopulation(line, anchorId) {
  const start = line.findIndex((c) => c.id === anchorId);
  const wrong = [];
  let ref = line[start];
  for (let i = start + 1; i < line.length; i++) {
    if (isPairInOrder(ref, line[i])) ref = line[i];
    else wrong.push(line[i]);
  }
  ref = line[start];
  for (let i = start - 1; i >= 0; i--) {
    if (isPairInOrder(line[i], ref)) ref = line[i];
    else wrong.push(line[i]);
  }
  return wrong;
}
