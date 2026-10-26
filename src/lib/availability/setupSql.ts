/**
 * Le tabelle che servono alle assenze alle partite, come in supabase/schema.sql (una prova controlla che siano uguali), da mostrare
 * al Developer quando ne manca qualcuna: le copia, le incolla nell'SQL Editor di Supabase e preme Run. Si possono rieseguire senza
 * danni; l'ultima riga fa vedere subito le tabelle nuove al sito.
 */

export type AvailabilityTable = "athlete_family_links" | "match_availability" | "app_settings";

export const AVAILABILITY_TABLE_SQL: Record<AvailabilityTable, string> = {
  athlete_family_links: `create table if not exists athlete_family_links (
  athlete_id uuid primary key references athletes(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);

alter table athlete_family_links enable row level security;`,

  match_availability: `create table if not exists match_availability (
  match_id uuid not null references matches(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  status text not null check (status in ('present', 'absent')),
  reason text,
  note text,
  answered_by text not null default 'parent',
  updated_by uuid references staff(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (match_id, athlete_id)
);

alter table match_availability enable row level security;

do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'match_unavailability') then
    insert into match_availability (match_id, athlete_id, status, reason, note, answered_by, updated_by, updated_at)
      select match_id, athlete_id, 'absent', reason, note, reported_by, updated_by, reported_at
      from match_unavailability
      on conflict (match_id, athlete_id) do nothing;
    drop table match_unavailability;
  end if;
end $$;`,

  app_settings: `create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;`,
};

export const AVAILABILITY_TABLE_PURPOSE: Record<AvailabilityTable, string> = {
  athlete_family_links: "i link personali dei genitori",
  match_availability: "le assenze segnalate («Non ci sarà»)",
  app_settings: "le regole e le chiusure decise a mano",
};

/** L'SQL da incollare per le tabelle che mancano, nell'ordine giusto, con la riga che le fa vedere subito al sito. */
export function setupSqlFor(missing: readonly AvailabilityTable[]): string {
  const order: AvailabilityTable[] = ["athlete_family_links", "match_availability", "app_settings"];
  const blocks = order.filter((table) => missing.includes(table)).map((table) => AVAILABILITY_TABLE_SQL[table]);
  return [...blocks, "notify pgrst, 'reload schema';"].join("\n\n");
}
