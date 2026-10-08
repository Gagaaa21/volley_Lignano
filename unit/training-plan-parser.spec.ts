import { expect, test } from "@playwright/test";
import { parseBlockContent } from "@/lib/blockContent";
import {
  cleanTrainingText,
  parseTrainingPlanText,
  planBlocksToText,
  sameDivision,
  splitAtHeadings,
  titleFromHeadingLine,
  type BlockHeading,
} from "@/lib/trainingPlanParser";

// Il caso segnalato: "A – 45’ LAVORO ANALITICO SULL’ATTACCO" finiva dentro il blocco "Core".
const SECTION_A = `A – 45’ LAVORO ANALITICO SULL’ATTACCO

1. Attacchi a muro
* Focus sul colpire la palla nel punto più alto possibile.
* Apertura della spalla.

2. Attacchi da Z4 – entrambi i campi
* Lancio al palleggiatore, che alza.
* Attacco in parallela.`;

const TEXT = `Allenamento U14 – attacco

1. Riscaldamento – 15’
* Corsa leggera e mobilità

2. Core – 15’
* Addominali
* Plank

${SECTION_A}

B – 30’ GIOCO
6 contro 6 a tema.

Totale 105'`;

test.describe("divisione con regole fisse (ripiego senza IA)", () => {
  test("riconosce anche le sezioni con lettera e durata davanti", () => {
    const { preamble, blocks } = parseTrainingPlanText(TEXT);
    expect(preamble).toBe("Allenamento U14 – attacco");
    expect(blocks.map((b) => [b.title, b.durationMinutes])).toEqual([
      ["Riscaldamento", 15],
      ["Core", 15],
      ["LAVORO ANALITICO SULL’ATTACCO", 45],
      ["GIOCO", 30],
    ]);
    expect(blocks[1].content).toBe("* Addominali\n* Plank");
    expect(blocks[2].content).toContain("1. Attacchi a muro");
    expect(blocks[2].content).toContain("2. Attacchi da Z4 – entrambi i campi");
  });

  test("un esercizio breve con la durata davanti resta nel suo blocco", () => {
    const { blocks } = parseTrainingPlanText("3. RICEZIONE – 30’\n5' – Palleggio spinto da zona 1 → zona 5\n10' – Ricezione");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].content).toContain("5' – Palleggio spinto");
  });
});

test.describe("divisione alle righe scelte dall'IA", () => {
  const headings: BlockHeading[] = [
    { headingLine: "1. Riscaldamento – 15’", title: "Riscaldamento", durationMinutes: 15 },
    { headingLine: "2. Core – 15’", title: "Core", durationMinutes: 15 },
    { headingLine: "A – 45’ LAVORO ANALITICO SULL’ATTACCO", title: "LAVORO ANALITICO SULL’ATTACCO", durationMinutes: 45 },
    { headingLine: "B – 30’ GIOCO", title: "GIOCO", durationMinutes: 30 },
  ];

  test("il contenuto è ritagliato dal testo, gli esercizi numerati restano nella loro sezione", () => {
    const split = splitAtHeadings(cleanTrainingText(TEXT), headings)!;
    expect(split.preamble).toBe("Allenamento U14 – attacco");
    expect(split.blocks.map((b) => [b.title, b.durationMinutes])).toEqual([
      ["Riscaldamento", 15],
      ["Core", 15],
      ["LAVORO ANALITICO SULL’ATTACCO", 45],
      ["GIOCO", 30],
    ]);
    expect(split.blocks[2].content).toBe(SECTION_A.split("\n").slice(2).join("\n"));
    expect(split.blocks[3].content).toBe("6 contro 6 a tema.");
  });

  test("la riga si ritrova anche con apostrofi, trattini o spazi diversi", () => {
    const split = splitAtHeadings(cleanTrainingText(TEXT), [
      { headingLine: "A - 45' LAVORO  ANALITICO SULL'ATTACCO", title: "LAVORO ANALITICO SULL'ATTACCO", durationMinutes: 45 },
    ]);
    expect(split?.blocks).toHaveLength(1);
  });

  test("una riga che nel testo non c'è (l'IA l'ha inventata o riscritta): nessun risultato", () => {
    expect(
      splitAtHeadings(cleanTrainingText(TEXT), [
        { headingLine: "1. Riscaldamento – 15’", title: "Riscaldamento", durationMinutes: 15 },
        { headingLine: "3. Lavoro sull'attacco – 45'", title: "Lavoro sull'attacco", durationMinutes: 45 },
      ]),
    ).toBeNull();
    // Anche l'ordine conta: una riga già superata non si riprende.
    expect(splitAtHeadings(cleanTrainingText(TEXT), [headings[1], headings[0]])).toBeNull();
  });

  test("titolo con parole che non sono nell'intestazione: si usa quello della riga; durata strana: 0", () => {
    const split = splitAtHeadings(cleanTrainingText(TEXT), [
      { headingLine: "A – 45’ LAVORO ANALITICO SULL’ATTACCO", title: "Tecnica di attacco avanzata", durationMinutes: -5 },
    ])!;
    expect(split.blocks[0].title).toBe("LAVORO ANALITICO SULL’ATTACCO");
    expect(split.blocks[0].durationMinutes).toBe(0);
  });
});

test.describe("schede già salvate", () => {
  // Come la salvava il vecchio sistema: tutto ciò che segue "2. Core" stava nel blocco Core.
  const saved = [
    { title: "Riscaldamento", durationMinutes: 15, content: "* Corsa leggera e mobilità" },
    { title: "Core", durationMinutes: 15, content: `* Addominali\n* Plank\n\n${SECTION_A}` },
  ];

  test("ricostruite come testo, si ridividono senza perdere né cambiare nulla", () => {
    const text = planBlocksToText(saved);
    expect(text.split("\n")[0]).toBe("1. Riscaldamento – 15'");
    const split = splitAtHeadings(text, [
      { headingLine: "1. Riscaldamento – 15'", title: "Riscaldamento", durationMinutes: 15 },
      { headingLine: "2. Core – 15'", title: "Core", durationMinutes: 15 },
      { headingLine: "A – 45’ LAVORO ANALITICO SULL’ATTACCO", title: "LAVORO ANALITICO SULL’ATTACCO", durationMinutes: 45 },
    ])!;
    expect(split.preamble).toBe("");
    expect(split.blocks.map((b) => b.title)).toEqual(["Riscaldamento", "Core", "LAVORO ANALITICO SULL’ATTACCO"]);
    expect(split.blocks[1].content).toBe("* Addominali\n* Plank");
    expect(sameDivision(saved, split.blocks)).toBe(false);
    // Ridivisa nello stesso modo di prima: nessuna differenza da proporre.
    const same = splitAtHeadings(text, [
      { headingLine: "1. Riscaldamento – 15'", title: "Riscaldamento", durationMinutes: 15 },
      { headingLine: "2. Core – 15'", title: "Core", durationMinutes: 15 },
    ])!;
    expect(sameDivision(saved, same.blocks)).toBe(true);
  });

  test("un blocco senza durata si ricostruisce senza durata", () => {
    expect(planBlocksToText([{ title: "Stretching", durationMinutes: 0, content: "" }])).toBe("1. Stretching");
  });
});

test.describe("titolo ricavato dalla riga", () => {
  test("toglie numero, lettera e durata, non le parole", () => {
    expect(titleFromHeadingLine("A – 45’ LAVORO ANALITICO SULL’ATTACCO")).toBe("LAVORO ANALITICO SULL’ATTACCO");
    expect(titleFromHeadingLine("RISCALDAMENTO (15 min)")).toBe("RISCALDAMENTO");
    expect(titleFromHeadingLine("3) Situazione di gioco – 25'")).toBe("Situazione di gioco");
    expect(titleFromHeadingLine("FINALE")).toBe("FINALE");
    expect(titleFromHeadingLine("A coppie con palla – 15'")).toBe("A coppie con palla");
  });
});

test.describe("testo dei blocchi", () => {
  test("gli esercizi numerati tengono il loro numero anche se separati da altre righe", () => {
    const parts = parseBlockContent(
      "1. Attacchi a muro\n\n* Focus sul punto più alto\n* Chiusura del polso\n\n2. Attacchi da Z4\n\nNote finali\nsu due righe",
    );
    expect(parts).toEqual([
      { kind: "numbered", items: [{ number: 1, text: "Attacchi a muro" }] },
      { kind: "bullets", items: ["Focus sul punto più alto", "Chiusura del polso"] },
      { kind: "numbered", items: [{ number: 2, text: "Attacchi da Z4" }] },
      { kind: "text", lines: ["Note finali", "su due righe"] },
    ]);
  });
});
