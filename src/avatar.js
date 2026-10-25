// A round badge with the player's initial, in a colour derived from their id so each player
// keeps the same colour on every device.
export function avatar(name, id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return `<span class="avatar" style="--h:${h}">${initial}</span>`;
}
