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
  repeat text not null default 'weekly' check (repeat in ('weekly', 'once')),
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

drop policy if exists "Allenamenti attivi visibili a tutti" on training_sessions;
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
  is_friendly boolean not null default false,
  meeting_time time,
  meeting_location text,
  notes text,
  called_up_athlete_ids uuid[] not null default '{}',
  -- Risultato finale (set), valorizzato solo a partita giocata.
  -- set_scores: parziali dei singoli set, es. [{"us":25,"them":20}, ...].
  set_scores jsonb,
  result_sets_won smallint check (result_sets_won between 0 and 3),
  result_sets_lost smallint check (result_sets_lost between 0 and 3),
  created_by uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists matches_match_date_idx on matches (match_date);
create index if not exists matches_category_idx on matches (category);

alter table matches enable row level security;

drop policy if exists "Partite visibili a tutti" on matches;
create policy "Partite visibili a tutti"
  on matches for select
  to anon, authenticated
  using (true);

-- =========================================================
-- match_lineups — formazioni per set di ogni partita
-- (una riga per partita; "sets" è un array di 5 elementi, uno per set,
-- ciascuno con le 6 posizioni in campo: atleta, ruolo, capitano.
-- Riservate allo staff: nessuna policy pubblica, stessa logica di
-- athletes/attendance_sessions — mai esposte sul sito pubblico)
-- =========================================================
create table if not exists match_lineups (
  match_id uuid primary key references matches(id) on delete cascade,
  sets jsonb not null default '[]',
  updated_by uuid references staff(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table match_lineups enable row level security;
-- Nessuna policy pubblica: le formazioni sono riservate allo staff.

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
-- training_occurrence_plans — scheda collegata a un singolo giorno di
-- allenamento: anche se la regola (training_sessions) è ricorrente, questo
-- collegamento vale solo per quella data, non per l'intera serie.
-- =========================================================
create table if not exists training_occurrence_plans (
  id uuid primary key default gen_random_uuid(),
  training_rule_id uuid not null references training_sessions(id) on delete cascade,
  occurrence_date date not null,
  plan_id uuid not null references training_plans(id) on delete cascade,
  -- Scelta esplicita fatta ogni volta che si collega una scheda: se true, il
  -- contenuto compare nel dettaglio dell'allenamento sul calendario pubblico.
  is_public boolean not null default false,
  created_by uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists training_occurrence_plans_occurrence_idx
  on training_occurrence_plans (training_rule_id, occurrence_date);

alter table training_occurrence_plans enable row level security;
-- Nessuna policy pubblica: scritture solo da staff, lette lato server (anche
-- dalla home page pubblica) sempre tramite la service role key.

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
-- (un dispositivo/browser per riga; il calendario è pubblico e
-- chiunque installi l'app può iscriversi. staff_id è valorizzato solo
-- se l'iscrizione è avvenuta da autenticati, e serve per le notifiche
-- riservate come "nuova scheda creata/assegnata")
-- =========================================================
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  staff_id uuid references staff(id) on delete set null,
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
alter table training_sessions add column if not exists repeat text not null default 'weekly';
do $$ begin
  alter table training_sessions add constraint training_sessions_repeat_check check (repeat in ('weekly', 'once'));
exception when duplicate_object then null;
end $$;

-- La scheda collegata a un allenamento è passata da un campo sulla regola
-- (training_sessions.plan_id, valido per ogni occorrenza) a un collegamento
-- per singola data (training_occurrence_plans). Chi ha già applicato la
-- vecchia colonna la vede migrata automaticamente qui sotto (solo per gli
-- allenamenti a giorno singolo, dove la data è una sola) e poi rimossa.
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'training_sessions' and column_name = 'plan_id'
  ) then
    insert into training_occurrence_plans (training_rule_id, occurrence_date, plan_id, created_by)
    select id, start_date, plan_id, created_by
    from training_sessions
    where plan_id is not null and repeat = 'once'
    on conflict (training_rule_id, occurrence_date) do nothing;

    alter table training_sessions drop column plan_id;
  end if;
end $$;

alter table push_subscriptions add column if not exists staff_id uuid references staff(id) on delete set null;

alter table matches add column if not exists called_up_athlete_ids uuid[] not null default '{}';

alter table training_occurrence_plans add column if not exists is_public boolean not null default false;

alter table matches add column if not exists is_friendly boolean not null default false;
alter table matches add column if not exists meeting_time time;
alter table matches add column if not exists meeting_location text;
alter table matches add column if not exists set_scores jsonb;
alter table matches add column if not exists result_sets_won smallint;
alter table matches add column if not exists result_sets_lost smallint;
do $$ begin
  alter table matches add constraint matches_result_sets_won_check check (result_sets_won between 0 and 3);
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table matches add constraint matches_result_sets_lost_check check (result_sets_lost between 0 and 3);
exception when duplicate_object then null;
end $$;

-- =========================================================
-- table_sizes() — usata dalla pagina Manutenzione (solo dev) per mostrare
-- righe e spazio occupato da ogni tabella, così da capire dove intervenire
-- se ci si avvicina ai limiti del piano Supabase. Stima veloce (statistiche
-- del planner), nessuna scansione delle tabelle.
-- =========================================================
create or replace function table_sizes()
returns table (
  table_name text,
  row_estimate bigint,
  total_bytes bigint
)
language sql
stable
as $$
  select
    relname::text as table_name,
    n_live_tup as row_estimate,
    pg_total_relation_size(relid) as total_bytes
  from pg_stat_user_tables
  order by pg_total_relation_size(relid) desc;
$$;

create table if not exists match_lineups (
  match_id uuid primary key references matches(id) on delete cascade,
  sets jsonb not null default '[]',
  updated_by uuid references staff(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table match_lineups enable row level security;

-- =========================================================
-- test_mode_store — archivio della "modalità prova" (solo dev): una singola
-- riga con l'intero archivio sandbox come blob JSON. Necessaria perché su
-- Vercel richieste diverse possono finire su istanze serverless diverse, che
-- non condividono la memoria del processo Node: un archivio solo in memoria
-- (come quello della modalità demo) apparirebbe quindi vuoto o incompleto a
-- seconda dell'istanza, con dati che "spariscono" e pagine 404. Persistendo
-- qui invece, tutte le istanze leggono e scrivono lo stesso stato.
-- =========================================================
create table if not exists test_mode_store (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table test_mode_store enable row level security;
-- Nessuna policy pubblica: raggiungibile solo tramite la service role key.
