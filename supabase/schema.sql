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
  -- Pagine dell'area riservata visibili a questo account (solo per role
  -- "admin", un Developer vede sempre tutto). Default: tutte, nessun
  -- account perde accesso finché il Developer non lo restringe.
  allowed_pages text[] not null default '{allenamenti,partite,schede,presenze,staff,guida}',
  -- Squadre gestibili da questo account tramite lo switcher nell'header
  -- (solo per role "admin", un Developer vede sempre entrambe). Default:
  -- entrambe, stessa logica di allowed_pages.
  allowed_teams text[] not null default '{u14u15,minivolley}',
  -- Se true, l'account non compare nell'elenco Staff visto da altri Admin
  -- (solo lì): il Developer lo vede comunque sempre. Impostabile solo dal
  -- Developer, mai dall'admin stesso.
  hidden_from_admins boolean not null default false,
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
  -- Squadra a cui appartiene: "u14u15" (gruppo agonistico, condiviso tra le
  -- due categorie) o "minivolley" (calendario e pagina pubblica separati).
  team text not null default 'u14u15' check (team in ('u14u15', 'minivolley')),
  -- Torneo/giornata multi-club (solo Minivolley): evento singolo senza
  -- avversario né risultato, badge "Torneo" invece di "Allenamento".
  is_tournament boolean not null default false,
  -- Colore sul calendario, per distinguere questa regola dalle altre.
  color text not null default 'amber'
    check (color in ('amber', 'blue', 'green', 'teal', 'violet', 'pink', 'orange', 'slate')),
  created_by uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists training_sessions_is_active_idx on training_sessions (is_active);
create index if not exists training_sessions_team_idx on training_sessions (team);

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
  -- Squadra a cui appartiene, come per training_sessions.
  team text not null default 'u14u15' check (team in ('u14u15', 'minivolley')),
  -- Null per il Minivolley, che non ha la distinzione U14/U15.
  category text check (category in ('U14', 'U15')),
  opponent text not null,
  is_home boolean not null default true,
  location text not null,
  match_date timestamp not null,
  is_friendly boolean not null default false,
  -- Torneo/triangolare con più squadre: "opponent" descrive l'evento
  -- invece di una singola avversaria (niente "vs" anteposto in visualizzazione,
  -- esclusa dal bilancio stagione).
  is_tournament boolean not null default false,
  meeting_time time,
  meeting_location text,
  notes text,
  called_up_athlete_ids uuid[] not null default '{}',
  -- Risultato finale (set), valorizzato solo a partita giocata. Sempre null
  -- per i tornei (is_tournament): vedi tournament_games sotto.
  -- set_scores: parziali dei singoli set, es. [{"us":25,"them":20}, ...].
  set_scores jsonb,
  result_sets_won smallint check (result_sets_won between 0 and 3),
  result_sets_lost smallint check (result_sets_lost between 0 and 3),
  -- Solo per is_tournament: le partite giocate nel torneo, una per
  -- avversaria affrontata, es. [{"id":"...","opponent":"Squadra A","setScores":[...]}, ...].
  tournament_games jsonb,
  created_by uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists matches_match_date_idx on matches (match_date);
create index if not exists matches_category_idx on matches (category);
create index if not exists matches_team_idx on matches (team);

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
-- match_predictions — pronostici sul punteggio di ogni set di una partita
-- non ancora giocata, uno per (match, membro dello staff). Vedi
-- src/lib/predictions.ts per come vengono giudicati una volta inseriti i
-- parziali reali su matches.set_scores.
-- =========================================================
create table if not exists match_predictions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  staff_id uuid not null references staff(id) on delete cascade,
  -- Uno solo dei due è valorizzato, a seconda di matches.is_tournament.
  set_scores jsonb,
  tournament_games jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists match_predictions_match_staff_idx on match_predictions (match_id, staff_id);
create index if not exists match_predictions_match_idx on match_predictions (match_id);

alter table match_predictions enable row level security;
-- Nessuna policy pubblica: pronostici riservati allo staff con accesso alla pagina "pronostici".

-- =========================================================
-- training_plans — schede allenamento, visibili solo a Developer e Admin.
-- "blocks" è un array JSON incorporato nella scheda stessa (niente più
-- libreria condivisa da riusare tra schede diverse): ogni elemento è
-- {"id", "title", "durationMinutes", "content"}, nell'ordine della scheda.
-- =========================================================
create table if not exists training_plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  blocks jsonb not null default '[]'::jsonb,
  -- Squadra a cui appartiene la scheda.
  team text not null default 'u14u15' check (team in ('u14u15', 'minivolley')),
  created_by uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists training_plans_team_idx on training_plans (team);

alter table training_plans enable row level security;
-- Nessuna policy pubblica: contenuto riservato allo staff, letto/scritto
-- solo tramite la service role key lato server.

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
  -- Squadra a cui appartiene. category si applica solo dentro "u14u15": per
  -- il Minivolley resta sempre null.
  team text not null default 'u14u15' check (team in ('u14u15', 'minivolley')),
  category text check (category in ('U14', 'U15')),
  -- Gruppo di appartenenza dentro il Minivolley (due sedi: Lignano
  -- Sabbiadoro e San Michele al Tagliamento), analogo di category ma un
  -- campo distinto: category ha già un vincolo CHECK limitato a
  -- 'U14'/'U15'. Sempre null per u14u15. "group" è parola riservata in
  -- SQL, da cui il nome colonna athlete_group.
  athlete_group text check (athlete_group in ('lignano', 'san_michele')),
  is_active boolean not null default true,
  notes text,
  created_by uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists athletes_category_idx on athletes (category);
create index if not exists athletes_group_idx on athletes (athlete_group);
create index if not exists athletes_team_idx on athletes (team);

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
  -- Squadra a cui appartiene: necessario anche quando training_rule_id è
  -- null, quindi non sempre derivabile dall'allenamento collegato.
  team text not null default 'u14u15' check (team in ('u14u15', 'minivolley')),
  session_date date not null,
  title text not null,
  location text not null,
  records jsonb not null default '{}',
  created_by uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists attendance_sessions_date_idx on attendance_sessions (session_date);
create index if not exists attendance_sessions_team_idx on attendance_sessions (team);

-- Evita doppie registrazioni per lo stesso allenamento nello stesso giorno.
create unique index if not exists attendance_sessions_occurrence_idx
  on attendance_sessions (training_rule_id, session_date)
  where training_rule_id is not null;

alter table attendance_sessions enable row level security;
-- Nessuna policy pubblica: stessa logica di athletes.

-- =========================================================
-- physical_tests — risultati dei test fisici per singola atleta
-- (es. altezza di salto). Predisposizione volutamente libera: non è
-- ancora definito quali test verranno effettuati, quindi sia il nome
-- del test (test_name) che il valore restano testo libero invece di un
-- elenco fisso o un numero con unità di misura imposta. athlete_id ha
-- cascade a differenza di attendance_sessions/training_rule_id: un test
-- fisico ha senso solo abbinato alla sua atleta, mentre una presenza
-- resta un dato dell'allenamento anche senza più un'atleta collegata.
-- =========================================================
create table if not exists physical_tests (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  team text not null default 'u14u15' check (team in ('u14u15', 'minivolley')),
  test_name text not null,
  value text not null,
  test_date date not null,
  notes text,
  created_by uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists physical_tests_athlete_idx on physical_tests (athlete_id);
create index if not exists physical_tests_team_idx on physical_tests (team);
create index if not exists physical_tests_date_idx on physical_tests (test_date);

alter table physical_tests enable row level security;
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
  -- Squadra scelta in base alla pagina da cui ci si è iscritti: scopa le
  -- notifiche calendario tra u14u15 e minivolley.
  team text not null default 'u14u15' check (team in ('u14u15', 'minivolley')),
  created_at timestamptz not null default now()
);

create unique index if not exists push_subscriptions_endpoint_idx on push_subscriptions (endpoint);
create index if not exists push_subscriptions_team_idx on push_subscriptions (team);

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
alter table staff add column if not exists allowed_pages text[] not null default '{allenamenti,minivolley,partite,schede,presenze,staff,guida}';
alter table staff add column if not exists hidden_from_admins boolean not null default false;
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
alter table matches add column if not exists is_tournament boolean not null default false;

-- Squadra Minivolley: allenamenti/tornei condividono la tabella
-- training_sessions con U14/U15, distinti dal campo "team".
alter table training_sessions add column if not exists team text not null default 'u14u15';
do $$ begin
  alter table training_sessions add constraint training_sessions_team_check check (team in ('u14u15', 'minivolley'));
exception when duplicate_object then null;
end $$;
alter table training_sessions add column if not exists is_tournament boolean not null default false;

alter table push_subscriptions add column if not exists team text not null default 'u14u15';
do $$ begin
  alter table push_subscriptions add constraint push_subscriptions_team_check check (team in ('u14u15', 'minivolley'));
exception when duplicate_object then null;
end $$;

alter table matches add column if not exists meeting_time time;
alter table matches add column if not exists meeting_location text;
alter table matches add column if not exists set_scores jsonb;
alter table matches add column if not exists result_sets_won smallint;
alter table matches add column if not exists result_sets_lost smallint;
alter table matches add column if not exists tournament_games jsonb;
alter table match_predictions add column if not exists tournament_games jsonb;
alter table match_predictions alter column set_scores drop not null;
do $$ begin
  alter table matches add constraint matches_result_sets_won_check check (result_sets_won between 0 and 3);
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table matches add constraint matches_result_sets_lost_check check (result_sets_lost between 0 and 3);
exception when duplicate_object then null;
end $$;

-- Il Minivolley non è più una sezione admin a sé: ogni pagina (Allenamenti,
-- Partite, Schede, Presenze) gestisce entrambe le squadre con lo switcher
-- nell'header. Partite, schede, atlete e registri presenze guadagnano un
-- campo "team", come già avveniva per training_sessions/push_subscriptions.
-- Le righe esistenti (create prima di questa modifica) sono tutte U14/U15,
-- da cui il default.
alter table matches add column if not exists team text not null default 'u14u15';
do $$ begin
  alter table matches add constraint matches_team_check check (team in ('u14u15', 'minivolley'));
exception when duplicate_object then null;
end $$;
alter table matches alter column category drop not null;

alter table training_plans add column if not exists team text not null default 'u14u15';
do $$ begin
  alter table training_plans add constraint training_plans_team_check check (team in ('u14u15', 'minivolley'));
exception when duplicate_object then null;
end $$;

alter table athletes add column if not exists team text not null default 'u14u15';
do $$ begin
  alter table athletes add constraint athletes_team_check check (team in ('u14u15', 'minivolley'));
exception when duplicate_object then null;
end $$;

-- Gruppo di appartenenza dentro il Minivolley (due sedi: Lignano
-- Sabbiadoro e San Michele al Tagliamento), analogo di "category" per
-- U14/U15 ma un campo distinto: category ha già un vincolo CHECK limitato
-- a 'U14'/'U15'. Sempre null per u14u15, e opzionale anche dentro
-- Minivolley (assegnabile anche in un secondo momento), come già avveniva
-- per category. Colonna chiamata athlete_group (non "group", parola
-- riservata in SQL).
alter table athletes add column if not exists athlete_group text;
do $$ begin
  alter table athletes add constraint athletes_group_check
    check (athlete_group in ('lignano', 'san_michele'));
exception when duplicate_object then null;
end $$;
create index if not exists athletes_group_idx on athletes (athlete_group);

alter table attendance_sessions add column if not exists team text not null default 'u14u15';
do $$ begin
  alter table attendance_sessions add constraint attendance_sessions_team_check check (team in ('u14u15', 'minivolley'));
exception when duplicate_object then null;
end $$;

-- Permette al Developer di scegliere, per singolo account Admin, quali
-- squadre può gestire tramite lo switcher nell'header (oltre a quali pagine
-- può vedere, già coperto da allowed_pages). Default entrambe, così nessun
-- account esistente perde accesso finché il Developer non lo restringe.
alter table staff add column if not exists allowed_teams text[] not null default '{u14u15,minivolley}';

-- I blocchi non sono più una libreria condivisa (training_blocks) riusata
-- per id da più schede (training_plans.block_ids): ogni scheda incorpora
-- direttamente i propri blocchi in una colonna JSON. Chi ha già la vecchia
-- tabella viene migrato qui sotto: si popola "blocks" risolvendo block_ids
-- contro training_blocks (nell'ordine della scheda), poi si eliminano la
-- vecchia colonna e la vecchia tabella.
alter table training_plans add column if not exists blocks jsonb not null default '[]'::jsonb;
do $$ begin
  if exists (
    select 1 from information_schema.tables where table_name = 'training_blocks'
  ) and exists (
    select 1 from information_schema.columns
    where table_name = 'training_plans' and column_name = 'block_ids'
  ) then
    update training_plans tp
    set blocks = coalesce(sub.blocks, '[]'::jsonb)
    from (
      select tp2.id as plan_id,
             jsonb_agg(
               jsonb_build_object(
                 'id', tb.id,
                 'title', tb.title,
                 'durationMinutes', tb.duration_minutes,
                 'content', tb.content
               ) order by ord.ordinality
             ) as blocks
      from training_plans tp2
      cross join lateral unnest(tp2.block_ids) with ordinality as ord(block_id, ordinality)
      join training_blocks tb on tb.id = ord.block_id
      group by tp2.id
    ) sub
    where sub.plan_id = tp.id;

    alter table training_plans drop column block_ids;
    drop table training_blocks;
  end if;
end $$;

-- Colore assegnato a ogni regola di allenamento, per distinguerla dalle
-- altre sul calendario (vedi TrainingColor in lib/types.ts). Le righe
-- esistenti prendono il colore di default ("amber"), lo stesso che il
-- calendario mostrava già per tutti gli allenamenti prima di questa
-- modifica: nessun cambiamento visivo per chi non ne assegna uno nuovo.
alter table training_sessions add column if not exists color text not null default 'amber';
do $$ begin
  alter table training_sessions add constraint training_sessions_color_check
    check (color in ('amber', 'blue', 'green', 'teal', 'violet', 'pink', 'orange', 'slate'));
exception when duplicate_object then null;
end $$;

-- Date (YYYY-MM-DD) saltate per una regola ricorrente, es. una festività:
-- expandTrainings() non genera un'occorrenza per queste date pur lasciando
-- intatta la regola per tutte le altre (vedi TrainingRule.excludedDates).
alter table training_sessions add column if not exists excluded_dates date[] not null default '{}';

-- Nuova sezione "Test fisici" (vedi tabella physical_tests sopra, già
-- creata da questo file): gli account Admin già esistenti e con pagine
-- ristrette non la vedono finché il Developer non spunta "Test fisici" per
-- loro dal Centro di controllo — stesso comportamento già visto quando
-- sono state aggiunte Live score/Pronostici, nessuna azione SQL richiesta
-- qui.

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

-- =========================================================
-- live_score_state — tabellone live (allenamento o partita, src/app/admin/livescore):
-- salvataggio automatico per non perdere tutto se la pagina si ricarica,
-- ma solo per qualche ora — oltre updated_at + 3h l'applicazione ignora la
-- riga come se non ci fosse (vedi LIVE_SCORE_TTL_MS). Stessa struttura a
-- riga singola di test_mode_store.
-- =========================================================
create table if not exists live_score_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table live_score_state enable row level security;
-- Nessuna policy pubblica: raggiungibile solo tramite la service role key.

-- =========================================================
-- Risultati e classifiche ufficiali dalla federazione (src/lib/federation).
-- Tutte riservate al server (service role): nessuna policy pubblica, la
-- classifica pubblica passa dalle pagine del sito.
--
-- federation_sources — dove leggere il girone di ogni categoria (una riga
-- per U14 e U15). url null = girone non ancora pubblicato: la categoria
-- resta semplicemente nascosta. team_aliases = nomi con cui la nostra
-- squadra compare nel girone. Modificabile dal Centro di controllo.
-- =========================================================
create table if not exists federation_sources (
  category text primary key check (category in ('U14', 'U15')),
  url text,
  team_aliases text[] not null default '{}',
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table federation_sources enable row level security;

-- Partenza: U14 e U15 girone A del Comitato di Udine, stagione 2026/27. Non
-- sovrascrive nulla se le righe esistono già (per un'installazione già
-- avviata l'indirizzo si cambia dal Centro di controllo).
insert into federation_sources (category, url, team_aliases, enabled) values
  ('U14',
   'https://udine.federvolley.it/risultati-classifiche.aspx?ComitatoId=48&StId=2428&DataDa=&StatoGara=&CId=92422&SId=&PId=15544&btFiltro=CERCA',
   array['CDA VOLLEY LIGNANO'], true),
  ('U15',
   'https://udine.federvolley.it/risultati-classifiche.aspx?ComitatoId=48&StId=2428&DataDa=&StatoGara=&CId=93676&SId=&PId=15544&btFiltro=CERCA',
   array['CDA VOLLEY LIGNANO'], true)
on conflict (category) do nothing;

-- federation_snapshots — ultimo contenuto letto con successo (gare e
-- classifica) per categoria, più l'ultimo errore di lettura. Una lettura
-- fallita non cancella mai il contenuto precedente.
create table if not exists federation_snapshots (
  category text primary key check (category in ('U14', 'U15')),
  girone jsonb,
  fetched_at timestamptz,
  last_error text,
  last_error_at timestamptz
);
alter table federation_snapshots enable row level security;

-- federation_decisions — cosa ha deciso un admin su una gara ufficiale:
-- 'linked' = abbinata a una partita del sito (match_id), 'dismissed' =
-- scartata, non va riproposta. Eliminando la partita sparisce l'abbinamento.
create table if not exists federation_decisions (
  category text not null check (category in ('U14', 'U15')),
  external_id text not null,
  decision text not null check (decision in ('linked', 'dismissed')),
  match_id uuid references matches(id) on delete cascade,
  decided_by uuid references staff(id) on delete set null,
  decided_at timestamptz not null default now(),
  primary key (category, external_id)
);
create index if not exists federation_decisions_match_idx on federation_decisions (match_id);
alter table federation_decisions enable row level security;

-- =========================================================
-- app_settings — impostazioni globali del sito (chiave → testo). Per ora
-- ci sta solo `notify_prompt_at`: l'istante dell'ultima «richiesta di
-- attivazione delle notifiche» inviata dal Centro di controllo. Chi apre il
-- sito e non ha ancora attivato le notifiche rivede il messaggio «Attiva le
-- notifiche» anche se l'aveva chiuso da poco.
-- =========================================================
create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;
