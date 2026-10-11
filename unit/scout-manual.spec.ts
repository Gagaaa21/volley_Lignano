import { expect, test } from "@playwright/test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { getScoutHubTourSteps, getScoutMatchTourSteps, getScoutTabellinoTourSteps, type ScoutMatchTourContext } from "@/components/tour/scoutSteps";
import { PdfReport } from "@/lib/pdf/report";
import { buildScoutManualPdf } from "@/lib/pdf/scoutManualPdf";
import {
  GLOSSARY,
  MANUAL_TAGLINE,
  MANUAL_TITLE,
  SCOUT_MANUAL,
  manualImageFiles,
  type ManualBlock,
} from "@/lib/scout/manual";
import { ERROR_HOWS, HOW_META } from "@/lib/scout/rules";

/**
 * Il manuale d'uso dello Scout (PDF) e la guida passo passo: il testo è pulito
 * per il font del PDF, ogni schermata esiste, il documento si genera davvero e
 * ogni passo della guida punta a un elemento che c'è in pagina.
 */

const IMAGE_DIR = path.join(process.cwd(), "src/assets/pdf/scout-manual");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Tutti i testi che finiscono nel PDF, con un'etichetta per capire dove sta un eventuale errore. */
function manualStrings(): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [
    { where: "titolo", text: MANUAL_TITLE },
    { where: "frase di copertina", text: MANUAL_TAGLINE },
  ];
  const push = (where: string, text: string | undefined) => {
    if (text) out.push({ where, text });
  };
  for (const entry of GLOSSARY) {
    push(`glossario/${entry.term}`, entry.term);
    push(`glossario/${entry.term}`, entry.text);
  }
  for (const chapter of SCOUT_MANUAL) {
    push(`${chapter.id}/titolo`, chapter.title);
    push(`${chapter.id}/sommario`, chapter.summary);
    chapter.blocks.forEach((block, i) => {
      const where = `${chapter.id}/#${i + 1} ${block.type}`;
      switch (block.type) {
        case "p":
          push(where, block.text);
          break;
        case "sub":
          push(where, block.title);
          break;
        case "bullets":
        case "steps":
          block.items.forEach((item) => push(where, item));
          break;
        case "callout":
          push(where, block.title);
          push(where, block.text);
          break;
        case "image":
          push(where, block.caption);
          block.legend?.forEach((item) => push(where, item));
          break;
        case "images":
          block.items.forEach((item) => push(where, item.caption));
          block.legend?.forEach((item) => push(where, item));
          break;
        case "table":
          block.columns.forEach((column) => push(where, column.header));
          block.rows.forEach((row) => row.forEach((cell) => push(where, cell)));
          break;
        case "hows":
        case "glossary":
          break;
      }
    });
  }
  for (const how of ERROR_HOWS) {
    push(`errori/${how}`, HOW_META[how].label);
    push(`errori/${how}`, HOW_META[how].hint);
  }
  return out;
}

test.describe("testo del manuale", () => {
  test("ha tutti i capitoli, con identificativi e titoli unici e pieni", () => {
    expect(SCOUT_MANUAL.length).toBeGreaterThanOrEqual(12);
    const ids = SCOUT_MANUAL.map((chapter) => chapter.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const chapter of SCOUT_MANUAL) {
      expect(chapter.title.trim(), chapter.id).not.toBe("");
      expect(chapter.summary.trim(), chapter.id).not.toBe("");
      expect(chapter.blocks.length, chapter.id).toBeGreaterThan(0);
    }
    // L'ultimo capitolo è la scheda da stampare, il penultimo il glossario.
    expect(ids.at(-1)).toBe("scheda");
    expect(ids.at(-2)).toBe("glossario");
  });

  test("usa solo caratteri che il font del PDF ha: niente trattini lunghi, puntini, apici curvi, frecce", async () => {
    const report = await PdfReport.create({ title: "Prova" });
    let unsafe: { where: string; text: string }[] = [];
    report.canvas(10, (canvas) => {
      unsafe = manualStrings().filter(({ text }) => canvas.safe(text) !== text);
    });
    expect(unsafe.map((item) => `${item.where}: ${item.text.slice(0, 60)}`)).toEqual([]);
  });

  test("i grassetti sono a coppie e non restano asterischi nel testo", () => {
    const broken = manualStrings().filter(({ text }) => {
      const pairs = text.split("**").length - 1;
      return pairs % 2 !== 0 || text.replace(/\*\*/g, "").includes("*");
    });
    expect(broken.map((item) => `${item.where}: ${item.text.slice(0, 60)}`)).toEqual([]);
  });

  test("le tabelle hanno una cella per ogni colonna, e le legende non sono vuote", () => {
    for (const chapter of SCOUT_MANUAL) {
      for (const block of chapter.blocks) {
        if (block.type === "table") {
          for (const row of block.rows) expect(row.length, `${chapter.id}: ${row[0]}`).toBe(block.columns.length);
        }
        if (block.type === "image" || block.type === "images") {
          if (block.legend) {
            expect(block.legend.length, chapter.id).toBeGreaterThan(0);
            expect(block.legend.length, chapter.id).toBeLessThanOrEqual(8);
          }
        }
      }
    }
  });

  test("gli errori e i falli del manuale vengono dallo Scout: ognuno ha nome e spiegazione", () => {
    expect(ERROR_HOWS.length).toBeGreaterThanOrEqual(10);
    for (const how of ERROR_HOWS) {
      expect(HOW_META[how].label.trim(), how).not.toBe("");
      expect(HOW_META[how].hint.trim(), how).not.toBe("");
    }
    // Il manuale ha la tabella con tutte le voci (ricavata da HOW_META, non scritta a mano).
    const hows = SCOUT_MANUAL.flatMap((chapter) => chapter.blocks).filter((block: ManualBlock) => block.type === "hows");
    expect(hows).toHaveLength(1);
  });

  test("il glossario spiega le parole che il manuale usa", () => {
    const terms = GLOSSARY.map((entry) => entry.term.toLowerCase());
    for (const word of ["ace", "break point", "set", "libero", "muro", "v-p"]) {
      expect(terms.some((term) => term.includes(word)), word).toBe(true);
    }
    expect(new Set(terms).size).toBe(terms.length);
  });
});

test.describe("schermate del manuale", () => {
  test("ogni schermata usata esiste ed è un PNG", () => {
    const files = manualImageFiles();
    expect(files.length).toBeGreaterThanOrEqual(15);
    for (const file of files) {
      const full = path.join(IMAGE_DIR, file);
      expect(existsSync(full), file).toBe(true);
      expect(readFileSync(full).subarray(0, 8).equals(PNG_SIGNATURE), file).toBe(true);
    }
  });

  test("nella cartella non restano schermate che il manuale non usa", () => {
    const used = new Set(manualImageFiles());
    const stray = readdirSync(IMAGE_DIR).filter((file) => !used.has(file));
    expect(stray).toEqual([]);
  });

  test("le schermate non sono pesanti: il manuale resta leggero da scaricare", () => {
    for (const file of manualImageFiles()) {
      expect(readFileSync(path.join(IMAGE_DIR, file)).length / 1024, file).toBeLessThan(150);
    }
  });
});

test.describe("il PDF del manuale", () => {
  test("si genera: copertina, indice, un capitolo per argomento e il piè di pagina", async () => {
    const bytes = await buildScoutManualPdf({ generatedAt: new Date("2026-10-11T12:00:00Z") });
    expect(Buffer.from(bytes.slice(0, 5)).toString("latin1")).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toContain("manuale");
    // Copertina + indice + almeno una pagina per capitolo.
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(SCOUT_MANUAL.length + 2);
    expect(doc.getPageCount()).toBeLessThan(40);
    // Verticale, A4.
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeCloseTo(595.28, 1);
    expect(height).toBeCloseTo(841.89, 1);
    // Con le schermate dentro pesa qualche centinaio di KB, ma non è enorme.
    expect(bytes.length).toBeGreaterThan(200_000);
    expect(bytes.length).toBeLessThan(4_000_000);
  });

  test("lo stesso manuale esce uguale a ogni richiesta (stesso numero di pagine)", async () => {
    const generatedAt = new Date("2026-10-11T12:00:00Z");
    const [a, b] = await Promise.all([buildScoutManualPdf({ generatedAt }), buildScoutManualPdf({ generatedAt })]);
    expect((await PDFDocument.load(a)).getPageCount()).toBe((await PDFDocument.load(b)).getPageCount());
  });
});

test.describe("guida passo passo dello Scout", () => {
  const MATCH = "match-123";

  /** Tutte le combinazioni di stato della pagina di una partita. */
  function allContexts(): ScoutMatchTourContext[] {
    const flags = [false, true];
    const out: ScoutMatchTourContext[] = [];
    for (const setup of flags)
      for (const setEnding of flags)
        for (const decided of flags)
          for (const closed of flags)
            for (const canCloseSet of flags)
              for (const canFinish of flags) out.push({ setup, setEnding, decided, closed, canCloseSet, canFinish });
    return out;
  }

  const tours = () => [
    ...[false, true].flatMap((showMatches) => [false, true].map((season) => ({ name: `elenco matches=${showMatches} stagione=${season}`, steps: getScoutHubTourSteps({ showMatches, season }) }))),
    ...allContexts().map((context) => ({ name: `partita ${JSON.stringify(context)}`, steps: getScoutMatchTourSteps(MATCH, context) })),
    { name: "tabellino", steps: getScoutTabellinoTourSteps(MATCH) },
  ];

  test("ogni passo ha titolo e testo, e gli identificativi non si ripetono", () => {
    for (const { name, steps } of tours()) {
      expect(steps.length, name).toBeGreaterThanOrEqual(3);
      const ids = steps.map((step) => step.id);
      expect(new Set(ids).size, `${name}: id doppi ${ids.join(",")}`).toBe(ids.length);
      for (const step of steps) {
        expect(step.title.trim(), `${name}/${step.id}`).not.toBe("");
        expect(step.body.trim(), `${name}/${step.id}`).not.toBe("");
        expect(step.title.length, `${name}/${step.id}`).toBeLessThan(60);
      }
    }
  });

  test("tutti i passi di una guida stanno sulla stessa pagina, quella giusta", () => {
    for (const { name, steps } of tours()) {
      const paths = new Set(steps.map((step) => step.path));
      expect(paths.size, name).toBe(1);
    }
    expect(getScoutHubTourSteps({ showMatches: true })[0].path).toBe("/admin/scout");
    expect(getScoutMatchTourSteps(MATCH, allContexts()[0])[0].path).toBe(`/admin/scout/${MATCH}`);
    expect(getScoutTabellinoTourSteps(MATCH)[0].path).toBe(`/admin/scout/${MATCH}/tabellino`);
  });

  test("ogni passo con un elemento evidenziato punta a un data-tour che esiste nelle pagine dello Scout", () => {
    const roots = ["src/app/admin/scout", "src/components/scout"].map((dir) => path.join(process.cwd(), dir));
    const sources: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name)) sources.push(readFileSync(full, "utf8"));
      }
    };
    roots.forEach(walk);
    const code = sources.join("\n");

    // Un elemento può avere il suo data-tour fisso (data-tour="x"), in un ramo (data-tour={first ? "x" : undefined})
    // o costruito (data-tour={`scout-entry-${lato}`}): in tutti e tre i casi il nome compare nel codice.
    const templates = [...code.matchAll(/data-tour=\{`([^`$]*)\$\{[^}]*\}([^`]*)`\}/g)].map((m) => ({ prefix: m[1], suffix: m[2] }));
    const present = (target: string) =>
      code.includes(`data-tour="${target}"`) ||
      code.includes(`? "${target}"`) ||
      templates.some(({ prefix, suffix }) => target.startsWith(prefix) && target.endsWith(suffix) && target.length > prefix.length + suffix.length);

    const missing = new Set<string>();
    for (const { steps } of tours()) {
      for (const step of steps) {
        if (step.target && !present(step.target)) missing.add(step.target);
      }
    }
    expect([...missing]).toEqual([]);
  });

  test("la guida di una partita nuova spiega la preparazione, quella di una partita avviata come si segna", () => {
    const ctx: ScoutMatchTourContext = { setup: false, setEnding: false, decided: false, closed: false, canCloseSet: false, canFinish: false };
    const setup = getScoutMatchTourSteps(MATCH, { ...ctx, setup: true }).map((step) => step.id);
    expect(setup).toEqual(expect.arrayContaining(["scout-setup-roster", "scout-setup-number", "scout-setup-opp", "scout-setup-rules", "section-scout-live", "scout-start"]));
    expect(setup).not.toContain("scout-entry-us");

    const play = getScoutMatchTourSteps(MATCH, ctx).map((step) => step.id);
    expect(play).toEqual(expect.arrayContaining(["scout-play-intro", "scout-entry-us", "scout-entry-error", "scout-last", "scout-live-toggle", "section-scout-log"]));
    expect(play).not.toContain("scout-set-end");

    // A fine set compare il passo del riquadro; a partita finita quello della revisione, senza i pulsanti per segnare.
    expect(getScoutMatchTourSteps(MATCH, { ...ctx, setEnding: true }).map((step) => step.id)).toContain("scout-set-end");
    const over = getScoutMatchTourSteps(MATCH, { ...ctx, decided: true }).map((step) => step.id);
    expect(over).toContain("scout-over");
    expect(over).not.toContain("scout-entry-us");
    expect(over).not.toContain("scout-play-intro");
  });

  test("i pulsanti «Chiudi il set adesso» e «Chiudi la partita» si spiegano solo quando ci sono", () => {
    const base: ScoutMatchTourContext = { setup: false, setEnding: false, decided: false, closed: false, canCloseSet: false, canFinish: false };
    const tools = (context: ScoutMatchTourContext) => getScoutMatchTourSteps(MATCH, context).find((step) => step.id === "section-scout-tools")!.body;
    expect(tools(base)).not.toContain("Chiudi il set adesso");
    expect(tools(base)).not.toContain("Chiudi la partita");
    expect(tools({ ...base, canCloseSet: true })).toContain("Chiudi il set adesso");
    expect(tools({ ...base, canFinish: true })).toContain("Chiudi la partita");
  });

  test("la guida più lunga è davvero dettagliata: molti passi, con esempi, consigli e attenzioni", () => {
    const steps = getScoutMatchTourSteps(MATCH, { setup: true, setEnding: false, decided: false, closed: false, canCloseSet: false, canFinish: false });
    expect(steps.length).toBeGreaterThanOrEqual(10);
    expect(steps.some((step) => step.example)).toBe(true);
    expect(steps.some((step) => step.tip)).toBe(true);
    expect(steps.some((step) => step.warning)).toBe(true);
    // Le guide lunghe hanno i capitoli, così chi la segue sa a che punto è.
    expect(new Set(steps.map((step) => step.chapter)).size).toBeGreaterThanOrEqual(2);
    expect(getScoutTabellinoTourSteps(MATCH).length).toBeGreaterThanOrEqual(8);
  });
});
