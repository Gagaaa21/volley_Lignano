-- Volley Lignano — schema Supabase
--
-- Come eseguirlo:
-- 1. Apri il progetto Supabase -> SQL Editor -> New query
-- 2. Incolla questo intero file ed esegui (RUN)
-- 3. Imposta le variabili d'ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
--    (Project Settings -> API) nel progetto Next.js / Vercel
-- 4. Esegui `npm run seed` per creare l'account DEV "Gaga"

create extension if not exists pgcrypto;

-- =========================================================
-- staff — account Developer e Admin (nessun accesso pubblico)
-- =========================================================
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  password_hash text not null,
  full_name text not null,
  role text not null check (role in ('dev', 'admin')),
  must_change_password boolean not null default true,
  has_seen_guide boolean not null default false,
  created_by uuid references staff(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists staff_username_lower_idx on staff (lower(username));

alter table staff enable row level security;
-- Nessuna policy: la tabella staff è raggiungibile solo tramite la
-- service role key, usata esclusivamente lato server.

-- =========================================================
-- training_sessions — regole di allenamento ricorrente
-- =========================================================
create table if not exists training_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Allenamento',
  location text not null,
  weekdays smallint[] not null,
  start_time time not null,
  end_time time not null,
  start_date date not null,
  end_date date,
  notes text,
  is_active boolean not null default true,
  created_by uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists training_sessions_is_active_idx on training_sessions (is_active);

alter table training_sessions enable row level security;

create policy "Allenamenti attivi visibili a tutti"
  on training_sessions for select
  to anon, authenticated
  using (is_active = true);

-- =========================================================
-- matches — partite di campionato per categoria
-- =========================================================
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('U14', 'U15')),
  opponent text not null,
  is_home boolean not null default true,
  location text not null,
  match_date timestamp not null,
  notes text,
  created_by uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists matches_match_date_idx on matches (match_date);
create index if not exists matches_category_idx on matches (category);

alter table matches enable row level security;

create policy "Partite visibili a tutti"
  on matches for select
  to anon, authenticated
  using (true);

-- =========================================================
-- training_blocks — blocchi di allenamento riutilizzabili
-- (libreria "puzzle", visibile solo a Developer e Admin)
-- =========================================================
create table if not exists training_blocks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  content text not null default '',
  created_by uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table training_blocks enable row level security;
-- Nessuna policy pubblica: contenuto riservato allo staff, letto/scritto
-- solo tramite la service role key lato server.

-- =========================================================
-- training_plans — schede allenamento (composizione ordinata
-- di blocchi), visibili solo a Developer e Admin
-- =========================================================
create table if not exists training_plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  plan_date date,
  notes text,
  block_ids uuid[] not null default '{}',
  created_by uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table training_plans enable row level security;
-- Nessuna policy pubblica: stessa logica di training_blocks.

-- =========================================================
-- athletes — anagrafica atlete (dati minori, nessun accesso
-- pubblico: solo Developer e Admin)
-- =========================================================
create table if not exists athletes (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  category text check (category in ('U14', 'U15')),
  is_active boolean not null default true,
  notes text,
  created_by uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists athletes_category_idx on athletes (category);

alter table athletes enable row level security;
-- Nessuna policy pubblica: dati personali di minori, accesso solo staff
-- tramite la service role key lato server.

-- =========================================================
-- attendance_sessions — registro presenze per allenamento
-- (una riga per ogni allenamento registrato; "records" è una
-- mappa athlete_id -> 'present' | 'excused' | 'unexcused')
-- =========================================================
create table if not exists attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  training_rule_id uuid references training_sessions(id) on delete set null,
  session_date date not null,
  title text not null,
  location text not null,
  records jsonb not null default '{}',
  created_by uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists attendance_sessions_date_idx on attendance_sessions (session_date);

-- Evita doppie registrazioni per lo stesso allenamento nello stesso giorno.
create unique index if not exists attendance_sessions_occurrence_idx
  on attendance_sessions (training_rule_id, session_date)
  where training_rule_id is not null;

alter table attendance_sessions enable row level security;
-- Nessuna policy pubblica: stessa logica di athletes.

-- =========================================================
-- push_subscriptions — iscrizioni alle notifiche push della PWA
-- (un dispositivo/browser per riga, nessun account collegato:
-- il calendario è pubblico e chiunque installi l'app può iscriversi)
-- =========================================================
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists push_subscriptions_endpoint_idx on push_subscriptions (endpoint);

alter table push_subscriptions enable row level security;
-- Nessuna policy pubblica: la sottoscrizione/cancellazione avviene tramite
-- le API route del server (service role key), mai direttamente dal browser.

-- Nota: l'applicazione Next.js legge e scrive sempre tramite la service
-- role key lato server, che ignora la Row Level Security. Le policy sopra
-- sono una protezione aggiuntiva nel caso in futuro venga usata la chiave
-- pubblica (anon) direttamente dal browser.

-- =========================================================
-- Migrazioni per installazioni Supabase già esistenti
-- (chi ha eseguito questo file prima delle atlete/presenze o del
-- campo categoria opzionale può rilanciare in sicurezza i comandi
-- qui sotto: create table/index "if not exists" non toccano dati
-- già presenti, e l'ALTER è idempotente anche se già applicato)
-- =========================================================
alter table athletes alter column category drop not null;
alter table staff add column if not exists has_seen_guide boolean not null default false;
