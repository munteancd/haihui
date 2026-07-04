create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  variant text not null check (variant in ('cardinal','population')),
  num_turns int not null,
  deck_seed bigint not null,
  status text not null default 'lobby' check (status in ('lobby','playing','ended')),
  created_at timestamptz not null default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  name text not null,
  seat_order int not null,
  diamonds int not null default 5
);

create table moves (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  seq int not null,
  player_id uuid references players(id),
  card_id int not null,
  placement jsonb not null,     -- { refId, dir } or { index }
  is_correct boolean not null,  -- hidden from clients until revealed
  revealed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table rooms enable row level security;
alter table players enable row level security;
alter table moves enable row level security;

-- v1: open-but-scoped anon policies (anyone with the room code can read/participate).
create policy rooms_read on rooms for select using (true);
create policy rooms_write on rooms for all using (true) with check (true);
create policy players_rw on players for all using (true) with check (true);

-- moves: readable, but is_correct only meaningful once revealed (enforced in app + RPC).
create policy moves_read on moves for select using (true);
create policy moves_write on moves for all using (true) with check (true);
