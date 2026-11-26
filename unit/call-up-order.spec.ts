import { expect, test } from "@playwright/test";
import { callUpGroup, canPlayInCategory, orderForCallUps } from "@/lib/category";
import type { Category } from "@/lib/types";

/** Le convocazioni: prima le atlete della categoria della partita; in Under 15 giocano anche le Under 14, in Under 14 le
 * Under 15 no (in fondo, oscurate, non convocabili). */

const athlete = (name: string, category: Category | null) => ({ id: name, fullName: name, category });
const roster = [athlete("Anna U14", "U14"), athlete("Bea U15", "U15"), athlete("Carla", null), athlete("Dora U15", "U15"), athlete("Elena U14", "U14")];
const names = (list: { fullName: string }[]) => list.map((a) => a.fullName);

test("chi può giocare: in Under 15 anche le Under 14, in Under 14 mai le Under 15", () => {
  expect(canPlayInCategory("U14", "U15")).toBe(true);
  expect(canPlayInCategory("U15", "U15")).toBe(true);
  expect(canPlayInCategory("U14", "U14")).toBe(true);
  expect(canPlayInCategory("U15", "U14")).toBe(false);
  // Senza categoria (dell'atleta o della partita) non si esclude nessuna.
  expect(canPlayInCategory(null, "U14")).toBe(true);
  expect(canPlayInCategory("U15", null)).toBe(true);
});

test("partita Under 15: prima le Under 15, poi le Under 14, poi senza categoria; nessuna esclusa", () => {
  expect(names(orderForCallUps(roster, "U15"))).toEqual(["Bea U15", "Dora U15", "Anna U14", "Elena U14", "Carla"]);
  expect(roster.map((a) => callUpGroup(a.category, "U15"))).toEqual([1, 0, 2, 0, 1]);
});

test("partita Under 14: prima le Under 14, le Under 15 in fondo e non convocabili", () => {
  expect(names(orderForCallUps(roster, "U14"))).toEqual(["Anna U14", "Elena U14", "Carla", "Bea U15", "Dora U15"]);
  expect(roster.filter((a) => callUpGroup(a.category, "U14") === 3).map((a) => a.fullName)).toEqual(["Bea U15", "Dora U15"]);
});

test("partita senza categoria: l'ordine resta quello di partenza, e la lista non si modifica", () => {
  const copy = [...roster];
  expect(names(orderForCallUps(roster, null))).toEqual(names(roster));
  orderForCallUps(roster, "U14");
  expect(roster).toEqual(copy);
});
