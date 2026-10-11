import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { PdfReport } from "@/lib/pdf/report";

/**
 * L'impaginazione dei documenti lunghi (il manuale dello Scout): un paragrafo
 * corto non si spezza tra due pagine, uno lungo non lascia una riga sola da una
 * parte, un titolo non resta solo in fondo, una schermata sta con la sua
 * legenda. Le misure sono quelle del PDF (punti): `remainingSpace` dice quanto
 * manca al fondo della pagina corrente.
 */

const IMAGE = readFileSync(path.join(process.cwd(), "src/assets/pdf/scout-manual/fine-set.png"));

/** Altezza di una riga di un paragrafo a 9,5 punti (come `richText`). */
const LINE = 9.5 * 1.28;

/** Un testo che occupa esattamente `lines` righe: ogni riga è una parola sola, separata dalle altre da un a-capo. */
function paragraphOfLines(lines: number): string {
  return Array.from({ length: lines }, () => "parola").join("\n");
}

async function newReport() {
  return PdfReport.create({ title: "Prova", footerLabel: "Prova", generatedAt: new Date("2026-10-11T12:00:00Z") });
}

/** Lascia nella pagina corrente solo `room` punti. */
function leaveRoom(report: PdfReport, room: number) {
  report.spacer(report.remainingSpace - room);
}

/** Quanto spazio c'è in una pagina di continuazione (sotto l'intestazione ripetuta). */
async function continuationCapacity() {
  const report = await newReport();
  report.pageBreak();
  return report.remainingSpace;
}

const imageCount = async (bytes: Uint8Array) => {
  const doc = await PDFDocument.load(bytes);
  let count = 0;
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (object instanceof PDFRawStream && object.dict.get(PDFName.of("Subtype")) === PDFName.of("Image")) count += 1;
  }
  return count;
};

test.describe("paragrafi", () => {
  test("un paragrafo corto sta tutto in una pagina: se non ci sta passa intero a quella dopo", async () => {
    const report = await newReport();
    leaveRoom(report, LINE * 2 + 1); // posto per due righe, ne servono tre
    expect(report.currentPageIndex).toBe(0);
    report.richText(paragraphOfLines(3));
    expect(report.currentPageIndex).toBe(1);
    // Sulla pagina nuova ha preso tre righe intere (e lo spazio sotto).
    const capacity = await continuationCapacity();
    expect(capacity - report.remainingSpace).toBeCloseTo(3 * LINE + 6, 1);
  });

  test("un paragrafo corto che ci sta resta dov'è", async () => {
    const report = await newReport();
    leaveRoom(report, LINE * 3 + 10);
    report.richText(paragraphOfLines(3));
    expect(report.currentPageIndex).toBe(0);
  });

  test("un paragrafo lungo si spezza, ma non lascia una riga sola in fondo né in cima", async () => {
    const capacity = await continuationCapacity();

    // Posto per sole 8 righe delle 9: ne resterebbe una sola, quindi due vanno alla pagina dopo.
    const widow = await newReport();
    leaveRoom(widow, LINE * 8 + 0.5);
    widow.richText(paragraphOfLines(9));
    expect(widow.currentPageIndex).toBe(1);
    expect(capacity - widow.remainingSpace).toBeCloseTo(2 * LINE + 6, 1);

    // Posto per una riga sola: da sola in fondo non resta, tutto passa alla pagina dopo.
    const orphan = await newReport();
    leaveRoom(orphan, LINE * 1 + 0.5);
    orphan.richText(paragraphOfLines(9));
    expect(orphan.currentPageIndex).toBe(1);
    expect(capacity - orphan.remainingSpace).toBeCloseTo(9 * LINE + 6, 1);

    // Posto per 5 righe delle 9: si spezza lì, con 4 righe sulla pagina dopo.
    const split = await newReport();
    leaveRoom(split, LINE * 5 + 0.5);
    split.richText(paragraphOfLines(9));
    expect(split.currentPageIndex).toBe(1);
    expect(capacity - split.remainingSpace).toBeCloseTo(4 * LINE + 6, 1);
  });

  test("keepWith tiene un paragrafo corto insieme a ciò che deve seguirlo", async () => {
    const report = await newReport();
    leaveRoom(report, LINE * 2 + 30);
    report.richText(paragraphOfLines(2), { keepWith: 100 }); // il paragrafo ci starebbe, con i 100 punti dopo no
    expect(report.currentPageIndex).toBe(1);
  });

  test("richTextHead: tutte le righe di un paragrafo corto, le prime tre di uno lungo", async () => {
    const report = await newReport();
    expect(report.richTextHead(paragraphOfLines(4))).toBeCloseTo(4 * LINE, 5);
    expect(report.richTextHead(paragraphOfLines(5))).toBeCloseTo(5 * LINE, 5);
    expect(report.richTextHead(paragraphOfLines(12))).toBeCloseTo(3 * LINE, 5);
  });
});

test.describe("titoli", () => {
  test("un sottotitolo non resta solo in fondo: se non c'è posto per ciò che segue passa alla pagina dopo", async () => {
    const report = await newReport();
    leaveRoom(report, 18 + 5 + 60); // posto per il titolo e per 60 punti sotto
    report.subheading("Titolo", { gapBefore: 5, keepWith: 100 });
    expect(report.currentPageIndex).toBe(1);

    const fits = await newReport();
    leaveRoom(fits, 18 + 5 + 120);
    fits.subheading("Titolo", { gapBefore: 5, keepWith: 100 });
    expect(fits.currentPageIndex).toBe(0);
  });

  test("in cima a una pagina nuova non si aggiunge l'aria sopra il titolo", async () => {
    const capacity = await continuationCapacity();
    const report = await newReport();
    leaveRoom(report, 10);
    report.subheading("Titolo", { gapBefore: 5, keepWith: 40 });
    expect(report.currentPageIndex).toBe(1);
    expect(capacity - report.remainingSpace).toBeCloseTo(18, 5);
  });

  test("senza opzioni il sottotitolo si comporta come prima (riserva 46 punti)", async () => {
    const report = await newReport();
    leaveRoom(report, 45);
    report.subheading("Titolo");
    expect(report.currentPageIndex).toBe(1);

    const fits = await newReport();
    leaveRoom(fits, 47);
    fits.subheading("Titolo");
    expect(fits.currentPageIndex).toBe(0);
  });
});

test.describe("schermate", () => {
  test("la legenda resta con la sua schermata: se non ci stanno insieme passano insieme", async () => {
    const legend = ["Primo punto", "Secondo punto", "Terzo punto"];
    const bare = await (await newReport()).measureImage(IMAGE, { maxHeight: 200, caption: "Prova" });
    const withLegend = await (await newReport()).measureImage(IMAGE, { maxHeight: 200, caption: "Prova", legend });
    expect(withLegend).toBeGreaterThan(bare + 20);

    // Ci sta la schermata, non la legenda: tutto alla pagina dopo.
    const tight = await newReport();
    leaveRoom(tight, (bare + withLegend) / 2);
    await tight.image(IMAGE, { maxHeight: 200, caption: "Prova", legend });
    expect(tight.currentPageIndex).toBe(1);

    // Ci sta tutto: resta dov'è.
    const roomy = await newReport();
    leaveRoom(roomy, withLegend + 20);
    await roomy.image(IMAGE, { maxHeight: 200, caption: "Prova", legend });
    expect(roomy.currentPageIndex).toBe(0);
  });

  test("più schermate affiancate: la legenda resta con la fila", async () => {
    const items = [
      { bytes: IMAGE, caption: "Una" },
      { bytes: IMAGE, caption: "Due" },
    ];
    const legend = ["Uno", "Due", "Tre", "Quattro", "Cinque"];
    const bare = await (await newReport()).measureImageRow(items, { maxHeight: 220 });
    const withLegend = await (await newReport()).measureImageRow(items, { maxHeight: 220, legend });
    expect(withLegend).toBeGreaterThan(bare + 20);

    const tight = await newReport();
    leaveRoom(tight, (bare + withLegend) / 2);
    await tight.imageRow(items, { maxHeight: 220, legend });
    expect(tight.currentPageIndex).toBe(1);
  });

  test("misurare una schermata prima di disegnarla non la incorpora due volte", async () => {
    const plain = await newReport();
    await plain.image(IMAGE, { maxHeight: 150 });
    const baseline = await imageCount(await plain.finish());

    const measured = await newReport();
    await measured.measureImage(IMAGE, { maxHeight: 150 });
    await measured.image(IMAGE, { maxHeight: 150 });
    expect(await imageCount(await measured.finish())).toBe(baseline);
  });
});

test("un riquadro si misura con lo spazio che occuperà", async () => {
  const report = await newReport();
  const height = report.calloutHeight("tip", "Testo del consiglio", { title: "Titolo" });
  leaveRoom(report, height + 5);
  const before = report.currentPageIndex;
  report.callout("tip", "Testo del consiglio", { title: "Titolo" });
  expect(report.currentPageIndex).toBe(before);
  // Meno dello spazio misurato: passa alla pagina dopo.
  const tight = await newReport();
  leaveRoom(tight, height - 15);
  tight.callout("tip", "Testo del consiglio", { title: "Titolo" });
  expect(tight.currentPageIndex).toBe(1);
});
