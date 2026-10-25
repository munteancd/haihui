// Coordinates as the printed cards show them: whole degrees and minutes, e.g. 46° 46' N.
// The game compares coordinates at exactly this precision, so two cards that read the
// same are equal (and equal counts as correct).

// A coordinate as signed whole arc-minutes (rounded the same way it is displayed).
export function toArcMinutes(value) {
  return Math.sign(value) * Math.round(Math.abs(value) * 60);
}

function degMin(value) {
  const total = Math.round(Math.abs(value) * 60);
  return `${Math.floor(total / 60)}° ${String(total % 60).padStart(2, '0')}'`;
}

// N/S for latitude; E/V (Est/Vest) for longitude.
export function formatLat(lat) {
  return `${degMin(lat)} ${toArcMinutes(lat) < 0 ? 'S' : 'N'}`;
}

export function formatLon(lon) {
  return `${degMin(lon)} ${toArcMinutes(lon) < 0 ? 'V' : 'E'}`;
}

export function formatPop(pop) {
  return Number(pop).toLocaleString('ro-RO');
}
