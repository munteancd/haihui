import { supabase } from './supabase-client.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function makeCode(len = 4) {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

export async function createRoom({ variant, numTurns }) {
  const code = makeCode();
  const deck_seed = Math.floor(Math.random() * 2 ** 31);
  const { data, error } = await supabase.from('rooms')
    .insert({ code, variant, num_turns: numTurns, deck_seed }).select().single();
  if (error) throw error;
  return data;
}

export async function joinRoom(code, name) {
  const { data: room, error } = await supabase.from('rooms')
    .select().eq('code', code.toUpperCase()).single();
  if (error) throw error;
  const { count } = await supabase.from('players')
    .select('*', { count: 'exact', head: true }).eq('room_id', room.id);
  const { data: player, error: perr } = await supabase.from('players')
    .insert({ room_id: room.id, name, seat_order: count ?? 0 }).select().single();
  if (perr) throw perr;
  return { room, player };
}

export async function listPlayers(roomId) {
  const { data, error } = await supabase.from('players')
    .select().eq('room_id', roomId).order('seat_order', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getRoom(roomId) {
  const { data, error } = await supabase.from('rooms').select().eq('id', roomId).single();
  if (error) throw error;
  return data;
}

// Host starts the game: store the initial shared state and flip status to 'playing'.
export async function startGame(roomId, state) {
  const { error } = await supabase.from('rooms')
    .update({ state, status: 'playing' }).eq('id', roomId);
  if (error) throw error;
}

// Persist the whole game state after any action; all clients re-render from it.
export async function saveState(roomId, state) {
  const { error } = await supabase.from('rooms').update({ state }).eq('id', roomId);
  if (error) throw error;
}

export function subscribeRoom(roomId, onChange) {
  return supabase.channel(`room-${roomId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, onChange)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, onChange)
    .subscribe();
}
