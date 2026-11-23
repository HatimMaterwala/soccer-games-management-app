-- Northside Youth Soccer: database setup
-- Paste this whole file into Supabase > SQL Editor > New query, then click Run.
-- Safe to run once on a new, empty project.

-- ---------- Tables ----------
create table if not exists settings (
  id int primary key default 1 check (id = 1),
  league_name text not null default 'Northside Youth Soccer',
  season text not null default 'Fall season 2026',
  fee numeric not null default 150,
  show_last_names boolean not null default false,
  welcome text not null default 'Schedules, rosters and team news in one place. Bookmark this page on your phone.'
);
insert into settings (id) values (1) on conflict do nothing;

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  age text not null,                -- e.g. U10
  name text not null,               -- e.g. Lions
  coach text default '',
  coach_phone text default '',
  practice_note text default '',    -- e.g. Tue & Thu 6:00 PM, Field 2
  sort int default 0,
  created_at timestamptz default now()
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete set null,
  first text not null,
  last text default '',
  number int,
  position text default 'MID',      -- GK, DEF, MID, FWD
  age int,
  stats jsonb default '{"SPD":60,"SHO":60,"PAS":60,"DRI":60,"DEF":60,"TEM":60}'::jsonb,
  created_at timestamptz default now()
);

-- Private: only signed-in coaches can read or change this table.
create table if not exists payments (
  player_id uuid primary key references players(id) on delete cascade,
  paid numeric not null default 0,
  guardian text default '',
  guardian_phone text default '',
  note text default '',
  updated_at timestamptz default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,  -- empty = whole league
  kind text not null default 'practice',                -- practice, game, event
  title text default '',
  opponent text default '',
  home boolean default true,
  starts_at timestamptz not null,
  location text default '',
  notes text default '',
  result text default '',                               -- e.g. W 3-1
  created_at timestamptz default now()
);

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text default '',
  tag text default 'News',
  pinned boolean default false,
  created_at timestamptz default now()
);

-- ---------- Security ----------
-- Everyone (parents) can READ the public tables. Only signed-in coaches can change anything.
alter table settings enable row level security;
alter table teams enable row level security;
alter table players enable row level security;
alter table payments enable row level security;
alter table events enable row level security;
alter table announcements enable row level security;

do $$
declare t text;
begin
  foreach t in array array['settings','teams','players','events','announcements'] loop
    execute format('drop policy if exists "public read" on %I', t);
    execute format('create policy "public read" on %I for select using (true)', t);
    execute format('drop policy if exists "coach write" on %I', t);
    execute format('create policy "coach write" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

drop policy if exists "coach only" on payments;
create policy "coach only" on payments for all to authenticated using (true) with check (true);
