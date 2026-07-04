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
  const { data: player } = await supabase.from('players')
    .insert({ room_id: room.id, name, seat_order: count ?? 0 }).select().single();
  return { room, player };
}

export function subscribeRoom(roomId, onChange) {
  return supabase.channel(`room-${roomId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, onChange)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, onChange)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'moves', filter: `room_id=eq.${roomId}` }, onChange)
    .subscribe();
}
