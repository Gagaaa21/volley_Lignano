import { expect, test } from "@playwright/test";
import { createEmptyStore, createMemoryRepo } from "@/lib/db/memory";
import {
  isJerseyColumnMissing,
  jerseyText,
  nameKey,
  orderRegistryNumbers,
  parseAthleteBulkLine,
  parseJerseyNumber,
  sharedJerseyNumbers,
  type RegistryNumber,
} from "@/lib/jersey";
import type { AthleteInput } from "@/lib/types";

/** Il numero di maglia nell'anagrafica: lettura dei campi e delle righe incollate, numeri uguali, archivio in memoria. */

test.describe("numero di maglia: campo", () => {
  test("accetta da 0 a 99, vuoto = nessun numero, il resto non vale", () => {
    expect(parseJerseyNumber("7")).toBe(7);
    expect(parseJerseyNumber("07")).toBe(7);
    expect(parseJerseyNumber(" 12 ")).toBe(12);
    expect(parseJerseyNumber("0")).toBe(0);
    expect(parseJerseyNumber("99")).toBe(99);
    expect(parseJerseyNumber("")).toBeNull();
    expect(parseJerseyNumber("   ")).toBeNull();
    expect(parseJerseyNumber(null)).toBeNull();
    expect(parseJerseyNumber(undefined)).toBeNull();
    expect(parseJerseyNumber("100")).toBeUndefined();
    expect(parseJerseyNumber("-3")).toBeUndefined();
    expect(parseJerseyNumber("7.5")).toBeUndefined();
    expect(parseJerseyNumber("sette")).toBeUndefined();
    expect(parseJerseyNumber("1 2")).toBeUndefined();
  });

  test("il testo mostrato è vuoto se manca il numero", () => {
    expect(jerseyText(null)).toBe("");
    expect(jerseyText(undefined)).toBe("");
    expect(jerseyText(0)).toBe("0");
    expect(jerseyText(12)).toBe("12");
  });
});

test.describe("numero di maglia: righe dell'elenco incollato", () => {
  const cases: [string, string, number | null][] = [
    ["Giulia Bianchi", "Giulia Bianchi", null],
    ["7 Giulia Bianchi", "Giulia Bianchi", 7],
    ["07 Giulia Bianchi", "Giulia Bianchi", 7],
    ["7. Giulia Bianchi", "Giulia Bianchi", 7],
    ["7 - Giulia Bianchi", "Giulia Bianchi", 7],
    ["7) Giulia Bianchi", "Giulia Bianchi", 7],
    ["#7 Giulia Bianchi", "Giulia Bianchi", 7],
    ["N° 7 Giulia Bianchi", "Giulia Bianchi", 7],
    ["n. 7 Giulia Bianchi", "Giulia Bianchi", 7],
    ["Giulia Bianchi 7", "Giulia Bianchi", 7],
    ["Giulia Bianchi - 7", "Giulia Bianchi", 7],
    ["Giulia Bianchi, 7", "Giulia Bianchi", 7],
    ["Giulia Bianchi (7)", "Giulia Bianchi", 7],
    ["Giulia Bianchi n° 7", "Giulia Bianchi", 7],
    ["Giulia Bianchi #7", "Giulia Bianchi", 7],
    ["Giulia   Bianchi    12", "Giulia Bianchi", 12],
    // da un foglio di calcolo: celle separate da tabulazioni
    ["7\tGiulia\tBianchi", "Giulia Bianchi", 7],
    ["Giulia\tBianchi\t7", "Giulia Bianchi", 7],
    // più parole nel nome
    ["Anna Maria De Luca 10", "Anna Maria De Luca", 10],
    ["10 Anna Maria De Luca", "Anna Maria De Luca", 10],
  ];
  for (const [line, name, number] of cases) {
    test(`«${line.replace(/\t/g, "⇥")}»`, () => {
      expect(parseAthleteBulkLine(line)).toEqual({ fullName: name, jerseyNumber: number });
    });
  }

  test("un numero a tre o più cifre non è un numero di maglia", () => {
    expect(parseAthleteBulkLine("Giulia Bianchi 2011")).toEqual({ fullName: "Giulia Bianchi 2011", jerseyNumber: null });
    expect(parseAthleteBulkLine("123 Giulia")).toEqual({ fullName: "123 Giulia", jerseyNumber: null });
  });

  test("un numero senza nome non crea un nome", () => {
    expect(parseAthleteBulkLine("7")).toEqual({ fullName: "7", jerseyNumber: null });
  });

  test("le cifre dentro una parola restano nel nome", () => {
    expect(parseAthleteBulkLine("Giulia7")).toEqual({ fullName: "Giulia7", jerseyNumber: null });
  });
});

test.describe("numero di maglia: confronti", () => {
  test("lo stesso nome scritto in modo diverso conta come uno", () => {
    expect(nameKey("  Giulia   Bianchi ")).toBe(nameKey("giulia bianchi"));
    expect(nameKey("Giulia Bianchi")).not.toBe(nameKey("Giulia Bianchini"));
  });

  test("trova chi condivide il numero", () => {
    const shared = sharedJerseyNumbers([
      { name: "A", jerseyNumber: 7 },
      { name: "B", jerseyNumber: 7 },
      { name: "C", jerseyNumber: 9 },
      { name: "D", jerseyNumber: null },
      { name: "E", jerseyNumber: null },
    ]);
    expect([...shared.keys()]).toEqual([7]);
    expect(shared.get(7)?.map((a) => a.name)).toEqual(["A", "B"]);
  });

  test("riconosce l'errore della colonna non ancora creata, e solo quello", () => {
    expect(isJerseyColumnMissing(new Error('column "jersey_number" of relation "athletes" does not exist'))).toBe(true);
    expect(isJerseyColumnMissing(new Error("Could not find the 'jersey_number' column of 'athletes' in the schema cache"))).toBe(true);
    expect(isJerseyColumnMissing("42703: jersey_number")).toBe(true);
    expect(isJerseyColumnMissing(new Error("duplicate key value violates unique constraint"))).toBe(false);
    expect(isJerseyColumnMissing(new Error('column "notes" does not exist'))).toBe(false);
    expect(isJerseyColumnMissing(null)).toBe(false);
  });
});

test.describe("numero di maglia: numeri proposti nel Live score", () => {
  const list: RegistryNumber[] = [
    { id: "1", number: "12", name: "Anna Rossi", category: "U15" },
    { id: "2", number: "7", name: "Bea Verdi", category: "U14" },
    { id: "3", number: "3", name: "Chiara Neri", category: "U15" },
    { id: "4", number: "9", name: "Dora Gialli", category: "U14" },
  ];

  test("senza partita collegata: tutti, in ordine di numero", () => {
    const { calledUp, others } = orderRegistryNumbers(list, [], null);
    expect(calledUp).toEqual([]);
    expect(others.map((r) => r.number)).toEqual(["3", "7", "9", "12"]);
  });

  test("con la categoria della partita, quelle della stessa categoria vengono prima", () => {
    const { others } = orderRegistryNumbers(list, [], "U14");
    expect(others.map((r) => r.number)).toEqual(["7", "9", "3", "12"]);
  });

  test("le convocate vanno in un gruppo a parte, davanti", () => {
    const { calledUp, others } = orderRegistryNumbers(list, ["1", "3"], "U15");
    expect(calledUp.map((r) => r.number)).toEqual(["3", "12"]);
    expect(others.map((r) => r.number)).toEqual(["7", "9"]);
  });
});

test.describe("numero di maglia: archivio in memoria", () => {
  const input = (fullName: string, jerseyNumber: number | null): AthleteInput => ({
    fullName,
    team: "u14u15",
    category: "U15",
    group: null,
    jerseyNumber,
    isActive: true,
    notes: null,
  });

  test("si salva, si legge e si cambia", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const created = await repo.createAthlete(input("Giulia Bianchi", 7), null);
    expect(created.jerseyNumber).toBe(7);
    expect((await repo.getAthlete(created.id))?.jerseyNumber).toBe(7);

    const changed = await repo.updateAthlete(created.id, { ...input("Giulia Bianchi", 9) });
    expect(changed.jerseyNumber).toBe(9);

    const cleared = await repo.updateAthlete(created.id, { ...input("Giulia Bianchi", null) });
    expect(cleared.jerseyNumber).toBeNull();
  });

  test("anche l'aggiunta in blocco tiene i numeri, e chi non l'ha scritto resta senza", async () => {
    const repo = createMemoryRepo(createEmptyStore());
    const rows = await repo.createAthletesBulk([input("Anna Rossi", 12), input("Bea Verdi", null)], null);
    expect(rows.map((r) => r.jerseyNumber)).toEqual([12, null]);
    expect((await repo.listAthletes({ team: "u14u15" })).map((a) => [a.fullName, a.jerseyNumber])).toEqual([
      ["Anna Rossi", 12],
      ["Bea Verdi", null],
    ]);
  });
});
