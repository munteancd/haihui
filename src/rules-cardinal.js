import { toArcMinutes } from './geo-format.js';

// The board is a plus (+) built around the start card (the anchor). Four arms grow
// outward from it: N and S order cards by latitude, E and V by longitude. Each arm is a
// single ordered line; a card may go at the tip or between two cards already on it.
// Coordinates are compared in whole arc-minutes (what the cards show), and equal values
// always count as correct.

// Which coordinate an arm orders by, in arc-minutes.
export function axisValue(city, dir) {
  return toArcMinutes(dir === 'N' || dir === 'S' ? city.lat : city.lon);
}

// N and E grow to larger coordinates outward; S and V grow to smaller ones.
export function ascendingOutward(dir) {
  return dir === 'N' || dir === 'E';
}

// Is `outer` (farther from the start card) correctly ordered after `inner` on arm `dir`?
// Only the arm's own axis counts; a tie is correct.
export function isPairInOrder(inner, outer, dir) {
  const a = axisValue(inner, dir);
  const b = axisValue(outer, dir);
  return ascendingOutward(dir) ? b >= a : b <= a;
}

// Single-card check against the card you attach to, on the chosen axis.
// N: latitude not smaller; S: not larger; E: longitude not smaller; V(west): not larger.
export function isPlacementCorrect(city, ref, dir) {
  if (!['N', 'S', 'E', 'V'].includes(dir)) throw new Error(`bad direction: ${dir}`);
  return isPairInOrder(ref, city, dir);
}

// Would `city` inserted at `index` (0..arm.length) fit BOTH its neighbours? The inner
// neighbour is the anchor at index 0, otherwise arm[index-1]; the outer one is arm[index]
// (none at the tip). Contests only ever check one neighbour; bots use this to aim.
export function isArmInsertCorrect(arm, anchor, dir, index, city) {
  const inner = index > 0 ? arm[index - 1] : anchor;
  const outer = index < arm.length ? arm[index] : null;
  return isPairInOrder(inner, city, dir) && (outer === null || isPairInOrder(city, outer, dir));
}

// The neighbours of the card sitting at arm[index]: 'prev' is the inner one (the anchor
// for the first card), 'next' the outer one (absent at the tip).
export function armNeighbours(arm, anchor, index) {
  const out = [{ side: 'prev', city: index > 0 ? arm[index - 1] : anchor }];
  if (index + 1 < arm.length) out.push({ side: 'next', city: arm[index + 1] });
  return out;
}

// A contest flips the card and ONE neighbour; only that pair decides.
export function isContestedPairCorrect(city, neighbour, side, dir) {
  return side === 'prev' ? isPairInOrder(neighbour, city, dir) : isPairInOrder(city, neighbour, dir);
}

// Scoring walk for one arm: from the start card outward, compare each card with the last
// card still standing; a card out of order is eliminated and the reference stays put.
// Returns the eliminated cards.
export function walkArm(anchor, arm, dir) {
  const wrong = [];
  let ref = anchor;
  for (const city of arm) {
    if (isPairInOrder(ref, city, dir)) ref = city;
    else wrong.push(city);
  }
  return wrong;
}

// All cards the scoring walk eliminates, over the four arms.
export function wrongCards(anchor, arms) {
  return ['N', 'S', 'E', 'V'].flatMap((dir) => walkArm(anchor, arms[dir], dir));
}
