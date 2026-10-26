// A round badge with the player's initial, in a colour derived from their id so each player
// keeps the same colour on every device.
export function avatar(name, id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  const safe = initial.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`); // names are typed by players
  return `<span class="avatar" style="--h:${h}">${safe}</span>`;
}
