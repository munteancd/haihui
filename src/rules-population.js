// Insert `city` at position `index` in `line` (0..line.length).
// Correct if it keeps the sequence non-decreasing at that spot.
export function isInsertCorrect(line, index, city) {
  const left = index > 0 ? line[index - 1].pop : -Infinity;
  const right = index < line.length ? line[index].pop : Infinity;
  return city.pop >= left && city.pop <= right;
}

// Cards knocked off the board by a successful contra (removed) no longer count.
export function countWrongPopulation(placements) {
  return placements.filter((p) => !p.removed && !p.isCorrect).length;
}
