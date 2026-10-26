import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { AVAILABILITY_TABLE_SQL, setupSqlFor } from "@/lib/availability/setupSql";

/** L'SQL che il sito mostra al Developer quando manca una tabella delle assenze è lo stesso di supabase/schema.sql. */

const flat = (sql: string) => sql.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim();
const schema = flat(readFileSync(path.join(__dirname, "..", "supabase", "schema.sql"), "utf8"));

test("ogni blocco è identico a quello dello schema", () => {
  for (const [table, sql] of Object.entries(AVAILABILITY_TABLE_SQL)) {
    expect(schema, table).toContain(flat(sql));
  }
});

test("solo le tabelle che mancano, nell'ordine giusto, e la riga che le fa vedere subito al sito", () => {
  const sql = setupSqlFor(["app_settings", "match_availability"]);
  expect(sql.indexOf("create table if not exists match_availability")).toBeLessThan(sql.indexOf("create table if not exists app_settings"));
  expect(sql).not.toContain("athlete_family_links (");
  expect(sql.trim().endsWith("notify pgrst, 'reload schema';")).toBe(true);
});
