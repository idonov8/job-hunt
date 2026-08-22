-- Job Hunt HQ — schema
-- Applied by `npm run db:migrate`. Safe to re-run (everything is IF NOT EXISTS).

create table if not exists jobs (
  id          serial primary key,
  slug        text unique not null,          -- stable handle, e.g. "neural-frames-product-engineer-growth"
  company     text not null,
  role        text not null,
  url         text,
  city        text,                          -- Berlin | Israel | Remote
  employment  text,                          -- Full-time | Part-time | Freelance | Contract
  remote      boolean not null default false,
  top_fit     boolean not null default false,
  impact      boolean not null default false,
  fresh       boolean not null default false, -- surfaced by the most recent scan
  tags        text[] not null default '{}',
  fit_note    text not null default '',      -- the curated "why this one" note
  status      text not null default '',      -- '' | applied | talking | offer | pass
  my_notes    text not null default '',      -- Ido's own running notes
  source      text,                          -- board or scan that surfaced it
  first_seen  date not null default current_date,
  last_seen   date not null default current_date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists jobs_status_idx on jobs (status);
create index if not exists jobs_city_idx on jobs (city);
create index if not exists jobs_fresh_idx on jobs (fresh);

-- Companies worth approaching directly, grouped by theme.
create table if not exists targets (
  id          serial primary key,
  group_name  text not null,
  name        text not null,
  description text not null default '',
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists targets_group_name_idx on targets (group_name, name);

-- Reusable outreach email / message templates.
create table if not exists outreach (
  id         serial primary key,
  title      text not null unique,
  body       text not null,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Playbook advice, one card per section.
create table if not exists playbook (
  id         serial primary key,
  heading    text not null unique,
  bullets    text[] not null default '{}',
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per weekly scan, so the footer can say when the data was last refreshed.
create table if not exists scans (
  id         serial primary key,
  scanned_on date not null default current_date,
  sources    text not null default '',
  jobs_added integer not null default 0,
  summary    text not null default '',
  created_at timestamptz not null default now()
);

-- Bump updated_at on every write without the API having to remember to.
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['jobs', 'targets', 'outreach', 'playbook'] loop
    execute format('drop trigger if exists %I_touch on %I', t, t);
    execute format(
      'create trigger %I_touch before update on %I for each row execute function touch_updated_at()',
      t, t
    );
  end loop;
end $$;
