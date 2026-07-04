// Correctness is judged only against the card you attach to, on the chosen axis.
// N: newer latitude greater; S: smaller; E: longitude greater; V(west): smaller.
export function isPlacementCorrect(city, ref, dir) {
  switch (dir) {
    case 'N': return city.lat > ref.lat;
    case 'S': return city.lat < ref.lat;
    case 'E': return city.lon > ref.lon;
    case 'V': return city.lon < ref.lon;
    default: throw new Error(`bad direction: ${dir}`);
  }
}

// Grid cell offset for a direction. y increases North, x increases East.
export function neighborCell(cell, dir) {
  switch (dir) {
    case 'N': return { x: cell.x, y: cell.y + 1 };
    case 'S': return { x: cell.x, y: cell.y - 1 };
    case 'E': return { x: cell.x + 1, y: cell.y };
    case 'V': return { x: cell.x - 1, y: cell.y };
    default: throw new Error(`bad direction: ${dir}`);
  }
}

// How many placed cards are geographically wrong (anchor excluded).
export function countWrong(placements) {
  return placements.filter((p) => p.refId !== null && !p.isCorrect).length;
}
