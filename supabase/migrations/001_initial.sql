-- Wireman Golf League — initial Supabase schema.
-- Paste this whole file into the Supabase SQL editor and run it.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists players (
  id text primary key,                      -- 'dad', 'mom', etc.
  family_id uuid references families,
  name text not null,
  handicap int not null default 0,
  handicap_effective_from_round int not null default 1,
  tees jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists holes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families,
  hole_number int not null,
  par int not null,
  unique (family_id, hole_number)
);

create table if not exists rounds (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families,
  round_number int not null,
  date date not null,
  format text not null,                     -- 'individual' | 'scramble' | 'championship'
  nine text not null,                       -- 'front' | 'back'
  completed boolean default false,
  player_ids text[] not null,
  pars int[] not null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists player_scores (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references rounds on delete cascade,
  player_id text references players,
  handicap_at_round int not null,
  unique (round_id, player_id)
);

create table if not exists hole_scores (
  id uuid primary key default gen_random_uuid(),
  player_score_id uuid references player_scores on delete cascade,
  hole int not null,
  strokes int not null,
  picked_up boolean default false,
  updated_at timestamptz default now(),
  unique (player_score_id, hole)
);

-- Scramble rounds score a team ball. Team scores live here keyed by round.
create table if not exists team_scores (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references rounds on delete cascade,
  team_id text not null,
  player_ids text[] not null,
  handicaps jsonb not null,
  hole_scores jsonb not null,               -- [{hole, strokes, kidDriveUsed}]
  updated_at timestamptz default now(),
  unique (round_id, team_id)
);

create table if not exists handicap_changes (
  id uuid primary key default gen_random_uuid(),
  player_id text references players,
  from_value int not null,
  to_value int not null,
  after_round int not null,
  created_at timestamptz default now()
);

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families,
  round_id uuid references rounds on delete cascade,
  hole int,
  player_id text references players,
  storage_path text not null,
  caption text,
  created_at timestamptz default now()
);

-- Helpful indexes for the queries the app runs.
create index if not exists idx_rounds_family on rounds (family_id);
create index if not exists idx_player_scores_round on player_scores (round_id);
create index if not exists idx_hole_scores_ps on hole_scores (player_score_id);
create index if not exists idx_team_scores_round on team_scores (round_id);
create index if not exists idx_photos_round on photos (round_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- This is a single shared family account (one inbox, one login), so any
-- authenticated user has full access. A future multi-family setup would add a
-- family_members(auth_uid, family_id) table and scope these policies to it.
-- ---------------------------------------------------------------------------

alter table families enable row level security;
alter table players enable row level security;
alter table holes enable row level security;
alter table rounds enable row level security;
alter table player_scores enable row level security;
alter table hole_scores enable row level security;
alter table team_scores enable row level security;
alter table handicap_changes enable row level security;
alter table photos enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'families','players','holes','rounds','player_scores',
    'hole_scores','team_scores','handicap_changes','photos'
  ]
  loop
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true);',
      t || '_authenticated_all', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Storage policies for the golf-photos bucket.
-- Create the bucket first (Storage → New bucket → name "golf-photos",
-- "Public bucket" checked), then run this block.
-- ---------------------------------------------------------------------------

create policy "golf_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'golf-photos');

create policy "golf_photos_auth_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'golf-photos');

create policy "golf_photos_auth_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'golf-photos');

create policy "golf_photos_auth_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'golf-photos');
