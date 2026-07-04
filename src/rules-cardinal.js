// The board is a plus (+) built from the first card (the anchor). Four arms grow
// outward from it: N and S order cities by latitude, E and V by longitude. Each arm
// is a single ordered line; you may insert a card anywhere along it (including between
// two cards), and correctness is judged only against its neighbours on that arm.

// Which coordinate an arm orders by.
export function axisValue(city, dir) {
  return dir === 'N' || dir === 'S' ? city.lat : city.lon;
}

// N and E grow to larger coordinates outward; S and V grow to smaller ones.
export function ascendingOutward(dir) {
  return dir === 'N' || dir === 'E';
}

// Single-card check: correct relative to the one card you attach to, on the chosen axis.
// N: latitude greater; S: smaller; E: longitude greater; V(west): smaller.
export function isPlacementCorrect(city, ref, dir) {
  switch (dir) {
    case 'N': return city.lat > ref.lat;
    case 'S': return city.lat < ref.lat;
    case 'E': return city.lon > ref.lon;
    case 'V': return city.lon < ref.lon;
    default: throw new Error(`bad direction: ${dir}`);
  }
}

// Insert `city` at position `index` (0..arm.length) in `arm`, which grows outward from
// `anchor`. The inner neighbour is the anchor at index 0, otherwise arm[index-1]; the
// outer neighbour is arm[index] (or none at the tip). Correct if the coordinate keeps
// the arm monotonic in its outward direction.
export function isArmInsertCorrect(arm, anchor, dir, index, city) {
  const inner = index > 0 ? arm[index - 1] : anchor;
  const outer = index < arm.length ? arm[index] : null;
  const v = axisValue(city, dir);
  const vi = axisValue(inner, dir);
  if (ascendingOutward(dir)) {
    return v > vi && (outer === null || v < axisValue(outer, dir));
  }
  return v < vi && (outer === null || v > axisValue(outer, dir));
}

// How many placed cards are geographically wrong. The anchor (dir null) and cards
// knocked off the board by a successful contra (removed) don't count.
export function countWrong(placements) {
  return placements.filter((p) => p.dir != null && !p.removed && !p.isCorrect).length;
}
