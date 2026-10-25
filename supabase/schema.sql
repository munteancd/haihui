-- Paste into the Supabase SQL editor of a fresh project and Run.
-- The whole game lives in rooms.state (one JSON blob all clients render from);
-- rooms.num_turns holds the number of rounds.

create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  variant text not null check (variant in ('cardinal','population')),
  num_turns int not null,
  deck_seed bigint not null,
  status text not null default 'lobby' check (status in ('lobby','playing','ended')),
  state jsonb,
  created_at timestamptz not null default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  name text not null,
  seat_order int not null,
  diamonds int not null default 4
);

-- Open-but-scoped access: anyone with a room code can read and play in it.
alter table rooms enable row level security;
alter table players enable row level security;
create policy rooms_rw on rooms for all using (true) with check (true);
create policy players_rw on players for all using (true) with check (true);
grant select, insert, update, delete on rooms, players to anon, authenticated;

-- Live updates for the waiting room and the shared game state.
alter publication supabase_realtime add table rooms, players;
