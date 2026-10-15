import { RULES_SEASON, SUBSTITUTIONS_PER_SET, TIMEOUT_SECONDS, TIMEOUTS_PER_SET } from "@/lib/volleyRules";
import { LEVEL_META, LEVEL_ORDER } from "./levels";
import { PHASE_STEPS } from "./phases";
import { TOUCH_SKILLS } from "./touches";
import type { ScoutLevel, ScoutTouchSkill } from "./types";

/**
 * Il manuale d'uso dello Scout (PDF scaricabile dall'area riservata). Il testo
 * sta qui, in una forma semplice da rileggere e correggere; src/lib/pdf/
 * scoutManualPdf.ts lo impagina. Le schermate stanno in src/assets/pdf/
 * scout-manual e sono quelle dell'app vera, con i punti numerati.
 *
 * Il PDF usa un font ridotto al Latin-1: niente trattini lunghi, puntini di
 * sospensione, apici curvi o frecce (un test controlla che il testo sia pulito).
 * Nel testo «**così**» è grassetto.
 *
 * I voti e le colonne dei tabellini non si scrivono qui: i blocchi «grades» e
 * «legend» li ricavano dalle stesse regole che usano l'app e il tabellino
 * (touches.ts, legend.ts), così il manuale non può dire cose diverse.
 */

export type ManualCalloutKind = "tip" | "warning" | "example" | "info";

export interface ManualColumn {
  header: string;
  weight: number;
  align?: "left" | "right" | "center";
}

export type ManualBlock =
  | { type: "p"; text: string }
  | { type: "sub"; title: string }
  | { type: "bullets"; items: string[] }
  | { type: "steps"; items: string[] }
  | { type: "callout"; kind: ManualCalloutKind; text: string; title?: string }
  /** Una schermata, con la legenda dei punti numerati. */
  | { type: "image"; file: string; caption: string; legend?: string[]; maxWidth?: number; maxHeight?: number }
  /** Più schermate del telefono affiancate. */
  | { type: "images"; items: { file: string; caption: string }[]; legend?: string[]; maxHeight?: number }
  | { type: "table"; columns: ManualColumn[]; rows: string[][]; keepTogether?: boolean }
  /** Le voci di errore e di fallo, ricavate da HOW_META così non possono andare fuori sincrono. */
  | { type: "hows" }
  /** I voti di un fondamentale, di tutti (con la spiegazione) o in riepilogo (una riga per fondamentale), ricavati da TOUCH_SKILLS. */
  | { type: "grades"; skill?: ScoutTouchSkill; summary?: boolean }
  /** Le colonne del tabellino di un livello, ricavate da legend.ts; con `onlyNew` solo quelle che nei livelli sotto non c'erano o erano diverse. */
  | { type: "legend"; level: ScoutLevel; onlyNew?: boolean }
  /** Una pagina nuova (per la scheda da stampare fronte e retro). */
  | { type: "pageBreak" }
  /** Il glossario, ordinato per termine. */
  | { type: "glossary" };

/**
 * L'ordine dei capitoli. I rimandi «capitolo N» nel testo si ricavano da qui
 * (vedi `cap`), così, spostando un capitolo, non restano numeri sbagliati.
 */
export const CHAPTER_ORDER = [
  "due-minuti",
  "livelli",
  "prima-di-cominciare",
  "preparare",
  "formazione",
  "segnare",
  "ricezioni",
  "fasi",
  "completo",
  "fine-set",
  "correggere",
  "imprevisti",
  "live",
  "tabellino",
  "stagione",
  "domande",
  "glossario",
  "scheda",
] as const;

export type ChapterId = (typeof CHAPTER_ORDER)[number];

/** Il numero con cui un capitolo compare nell'indice. */
export function chapterNumber(id: ChapterId): number {
  return CHAPTER_ORDER.indexOf(id) + 1;
}

function cap(id: ChapterId): string {
  return `capitolo ${chapterNumber(id)}`;
}

export interface ManualChapter {
  id: ChapterId;
  title: string;
  summary: string;
  blocks: ManualBlock[];
}

/** Tutte le schermate usate dal manuale: il test verifica che i file esistano. */
export function manualImageFiles(): string[] {
  const files = new Set<string>();
  for (const chapter of SCOUT_MANUAL) {
    for (const block of chapter.blocks) {
      if (block.type === "image") files.add(block.file);
      if (block.type === "images") for (const item of block.items) files.add(item.file);
    }
  }
  return [...files];
}

export const MANUAL_TITLE = "Scout - Manuale d'uso";
export const MANUAL_TAGLINE = "Segna ogni punto. Il resto lo fa lo Scout.";

export const GLOSSARY: { term: string; text: string }[] = [
  { term: "Ace", text: "Battuta vincente: la palla cade a terra nel campo avversario o non è giocabile." },
  {
    term: "Alzata",
    text: "Il secondo tocco, di solito, che prepara l'attacco. Nel livello Base si segna solo se è sbagliata (alzata fuori o in rete); nel Completo si segna sempre, con un voto.",
  },
  { term: "Attacco", text: "Il colpo con cui si cerca di mandare la palla a terra nel campo avversario. Punto se la palla cade a terra, errore se va fuori, in rete o sull'antenna." },
  { term: "Break point (BP)", text: "Punto fatto mentre la propria squadra batteva. La percentuale dice su 100 battute quante finiscono con un punto." },
  { term: "Cambio palla (side-out)", text: "Punto fatto da chi stava ricevendo: la squadra conquista la battuta. La percentuale dice su 100 ricezioni quante finiscono con un punto subito." },
  {
    term: "Difesa",
    text: "Il recupero di un attacco avversario. Nel livello Base si segna solo se è sbagliata (palla a terra o fuori); nel Completo si segna ogni difesa, con un voto.",
  },
  { term: "Doppia", text: "Fallo: la stessa giocatrice tocca la palla due volte di seguito." },
  {
    term: "Efficienza (Eff%)",
    text: "Per l'attacco: punti meno errori meno attacchi murati, diviso gli attacchi segnati. Può essere negativa. Si vede solo nel livello Completo.",
  },
  { term: "Errore", text: "Un'azione sbagliata che regala il punto all'altra squadra (battuta, ricezione, attacco, muro, alzata o difesa sbagliati)." },
  { term: "Fallo", text: "Un'infrazione fischiata dall'arbitro: tocco di rete, invasione, doppia, trattenuta, quattro tocchi, rotazione. Il punto va all'altra squadra." },
  { term: "Fondamentale", text: "Ognuno dei gesti del gioco: battuta, ricezione, alzata, attacco, muro, difesa." },
  {
    term: "Formazione",
    text: "Chi gioca in ognuna delle sei posizioni del campo (la 1 è chi batte, poi 2, 3, 4, 5, 6 in senso orario), più la libero. Nello Scout si può segnare all'inizio di ogni set: da lì rotazioni, libero e cambi si seguono da soli.",
  },
  {
    term: "Cambio (sostituzione)",
    text: `Una giocatrice entra al posto di un'altra. Nel 6 contro 6 se ne possono fare ${SUBSTITUTIONS_PER_SET} per set (dalla stagione ${RULES_SEASON}: prima erano 6); una titolare può uscire e rientrare una volta sola per set, ma solo al posto di chi l'ha sostituita, ovunque questa si trovi in campo in quel momento. La libero non conta: entra ed esce da sola.`,
  },
  { term: "Invasione", text: "Fallo: una giocatrice supera la linea centrale o passa sotto la rete e interferisce con il gioco." },
  { term: "Libero", text: "Giocatrice con la maglia di colore diverso, specializzata in difesa e ricezione. Non può murare né tentare di murare." },
  {
    term: "Livello",
    text: "Quanto si segna in una partita: Base (come finisce ogni scambio), Con ricezioni (in più la ricezione) o Completo (ogni tocco della palla). Si sceglie prima di ogni partita.",
  },
  { term: "Muro", text: "L'azione delle giocatrici davanti alla rete che cercano di fermare l'attacco avversario. Punto se la palla cade nel campo di chi attaccava." },
  { term: "Pos% e Prf%", text: "Ricezione positiva (voti # e +) e ricezione perfetta (solo #), in percentuale sulle ricezioni segnate." },
  { term: "Quattro tocchi", text: "Fallo: la squadra tocca la palla quattro volte prima di mandarla di là." },
  {
    term: "Ricezione",
    text: "Il primo tocco dopo la battuta avversaria. Nel livello Base si segna solo se è sbagliata (palla toccata che va fuori o a terra); dal livello Con ricezioni si segna sempre, con un voto.",
  },
  {
    term: "Rotazione",
    text: "Dopo aver recuperato la battuta, le giocatrici cambiano posizione in senso orario. Sbagliare l'ordine di battuta o la posizione è un fallo di squadra. Nel tabellino Completo la 1ª rotazione è quella con cui comincia il set e si passa alla successiva a ogni cambio palla; se segui la formazione, lo Scout ruota la squadra da solo.",
  },
  { term: "Sanzione", text: "Penalità dell'arbitro (cartellino) che assegna il punto all'avversaria." },
  { term: "Scambio", text: "Dalla battuta al punto assegnato: lo Scout ne registra uno alla volta. Si chiama anche azione o rally." },
  { term: "Set", text: "Una parte della partita: vince chi arriva per primo a 25 punti con almeno due di scarto (15 nel set decisivo)." },
  { term: "Tocco", text: "Ogni volta che una giocatrice (o il muro) tocca la palla. Nel livello Completo si segna ogni tocco, con chi l'ha fatto e con che voto." },
  { term: "Tocco di rete", text: "Fallo: una giocatrice tocca la rete mentre gioca la palla." },
  { term: "Trattenuta", text: "Fallo: la palla non rimbalza ma viene accompagnata o trattenuta." },
  { term: "V-P", text: "Punti fatti meno errori e attacchi murati: dice se una giocatrice ha dato più di quanto ha tolto." },
  {
    term: "Voto",
    text: "Quanto è riuscito un tocco, da # (perfetto) a = (errore): # perfetto, + positivo, ! neutro, - negativo, / scarso, = errore. Il nome del voto cambia un po' con il fondamentale.",
  },
  {
    term: "Zona",
    text: "Una delle sei parti del campo, numerate come in pallavolo: davanti 4, 3, 2 (vicino alla rete) e dietro 5, 6, 1. Si indica, se si vuole, per ricezione, difesa e attacco.",
  },
];


function phaseRows(): string[][] {
  const labels = (skill: ScoutTouchSkill) => TOUCH_SKILLS[skill].grades.map((g) => `${TOUCH_SKILLS[skill].gradeLabels[g]}`).join(", ");
  return [
    ["Battuta", "Chi ha la battuta", labels("serve"), "In campo: riceve l'altra squadra. Ace o errore: lo scambio finisce."],
    ["Ricezione", "La squadra che non batte", labels("reception"), "Alzata e attacco di chi ha ricevuto. Scarsa (/): la palla torna di là."],
    ["Alzata (facoltativa)", "Chi ha ricevuto o difeso", labels("set"), "L'attacco della stessa squadra."],
    ["Attacco", "Chi ha alzato", labels("attack"), "Punto o errore: finisce. Continua: difende l'altra. Murato: si segna il muro."],
    ["Muro", "La squadra che subisce l'attacco", labels("block"), "Punto: finisce. Tocco: difende chi ha murato."],
    ["Difesa", "Chi ha subito l'attacco o ha murato", labels("dig"), "Alzata e attacco di chi ha difeso. Di là (/): attacca l'altra squadra."],
  ];
}

export const SCOUT_MANUAL: ManualChapter[] = [
  {
    id: "due-minuti",
    title: "Lo Scout in due minuti",
    summary: "Che cos'è, cosa ti dà e cosa non fa.",
    blocks: [
      {
        type: "p",
        text: `Lo **Scout** serve a registrare una partita **scambio per scambio**. Prima di ogni partita scegli **quanto vuoi segnare** (${cap("livelli")}): soltanto **come finisce** ogni scambio (livello **Base**), anche la **ricezione** (livello **Con ricezioni**) oppure **ogni tocco** della palla (livello **Completo**). Tutto il resto lo ricava lo Scout da solo: il punteggio, i set, a chi tocca battere, i break point e, nel Completo, le rotazioni.`,
      },
      {
        type: "p",
        text: "È il lavoro che fanno gli scoutman dei campionati ufficiali con i programmi come Data Volley. Con il livello **Base** è ridotto all'essenziale: due tocchi per un punto normale, tre per un errore. Con il **Completo** si segue ogni tocco, come in Serie A.",
      },
      { type: "sub", title: "Cosa ottieni" },
      {
        type: "bullets",
        items: [
          `**Il tabellino della partita**: per ogni giocatrice i punti, gli ace, gli errori, gli attacchi e i muri; con i livelli più alti anche ricezioni, attacchi totali, difese e le percentuali (${cap("tabellino")}).`,
          "**Le statistiche di squadra**: punti in battuta (break point), cambio palla (side-out), serie di punti più lunga, errori commessi, sempre a confronto con le avversarie.",
          "**Il grafico dell'andamento** del punteggio, scambio dopo scambio.",
          "**Le analisi dei livelli più alti**: come riceve la squadra e quanto la ricezione fa vincere i punti; nel Completo anche le rotazioni e le mappe del campo (dove si riceve, si difende, si attacca).",
          "**Il PDF** del tabellino, da stampare o mandare.",
          `**I totali di stagione** della squadra e di ogni giocatrice (${cap("stagione")}).`,
          `**Il punteggio live** sul sito della squadra, se lo vuoi (${cap("live")}).`,
        ],
      },
      { type: "sub", title: "Cosa non fa" },
      {
        type: "bullets",
        items: [
          "Non sostituisce il **referto ufficiale** della gara: il risultato dello Scout è un riferimento della società e non è ufficiale.",
          "Non segue le formazioni né le sostituzioni: non servono. Le rotazioni del livello Completo si ricavano dall'ordine delle battute.",
          "Con il livello **Base** non registra ogni tocco, ma solo come finisce lo scambio: per questo mancano gli attacchi tentati e le percentuali di attacco e di ricezione che si vedono nei tabellini di Lega. Se le vuoi, scegli un livello più alto.",
          "I numeri sono quelli che segni: se in uno scambio salti la ricezione o un tocco, quel tocco non entra nelle statistiche.",
        ],
      },
      { type: "sub", title: "Chi lo può usare, e su quali partite" },
      {
        type: "p",
        text: "Lo Scout è nell'area riservata, alla voce **Scout** del menu. Lo vede chi ha il permesso «Scout»: se non compare, chiedi a un amministratore di abilitarlo (Centro di controllo, permessi delle pagine). Si usa per le partite di **campionato e le amichevoli di Under 14 e Under 15**; i tornei e il Minivolley non lo prevedono.",
      },
      {
        type: "callout",
        kind: "info",
        title: "La regola da ricordare",
        text: "Prima di ogni partita scegli il **livello**. Poi, per ogni scambio, dici **chi** ha fatto cosa e **come** è andata: nel Base solo l'ultimo tocco, nei livelli più alti anche gli altri. Tutto il resto è automatico.",
      },
    ],
  },
  {
    id: "livelli",
    title: "I tre livelli: quanto vuoi segnare",
    summary: "Base, Con ricezioni o Completo: cosa segni, cosa ottieni e come scegliere.",
    blocks: [
      {
        type: "p",
        text: "Prima di ogni partita scegli il **livello**: più sali, più cose segni e più numeri ottieni, ma serve anche più attenzione mentre si gioca. **Non c'è un livello giusto per tutti**: dipende da chi segna e da quello che vuoi sapere.",
      },
      {
        type: "table",
        columns: [
          { header: "", weight: 1.5 },
          ...LEVEL_ORDER.map((level) => ({ header: LEVEL_META[level].label, weight: 3 })),
        ],
        rows: [
          ["In breve", ...LEVEL_ORDER.map((level) => LEVEL_META[level].tagline)],
          ["Tocchi", ...LEVEL_ORDER.map((level) => LEVEL_META[level].taps)],
          [
            "Cosa segni",
            "Chi ha fatto punto e come (attacco, muro, ace, errore) e con quale giocatrice.",
            "Come il Base, più, quando riceviamo: chi ha ricevuto, con che voto e, se vuoi, in quale zona.",
            "Ogni tocco: battuta, ricezione, alzata, attacco, muro, difesa, con chi l'ha fatto, il voto e, se vuoi, la zona.",
          ],
          [
            "Cosa ottieni",
            "Punti, ace, errori e attacchi murati di ogni giocatrice; break point e cambio palla.",
            "In più: ricezione positiva e perfetta di ogni giocatrice, cambio palla in base alla ricezione, mappa delle zone di ricezione.",
            "In più: attacchi totali con punto % ed efficienza, battute e difese, break point e cambio palla per rotazione, mappe di difesa e di attacco.",
          ],
          ["Cosa serve", ...LEVEL_ORDER.map((level) => LEVEL_META[level].needs.join(". ") + ".")],
        ],
        keepTogether: true,
      },
      {
        type: "image",
        file: "livelli-scelta.png",
        caption: "La scelta del livello, in cima alla preparazione di ogni partita.",
        legend: [
          "**Base**: come finisce ogni scambio. È il livello di partenza, quello selezionato.",
          "**Con ricezioni**: in più la ricezione di ogni battuta avversaria.",
          "**Completo**: ogni tocco della palla, come in Serie A.",
        ],
        maxHeight: 250,
      },
      { type: "sub", title: "Come scegliere" },
      {
        type: "bullets",
        items: [
          "**Base**: se è la prima volta, se sei l'unica persona a segnare in panchina o se ti basta il tabellino con punti, ace ed errori. Si impara in pochi minuti.",
          "**Con ricezioni**: se vuoi capire come riceve la squadra. Costa solo due tocchi in più, e solo quando riceviamo, e dà i numeri più utili per allenare: ricezione positiva e perfetta di ogni giocatrice e quanto la ricezione fa vincere i punti.",
          "**Completo**: se c'è una persona dedicata solo allo Scout (meglio con un tablet) e vuoi il tabellino a colonne come quello di Lega, con attacchi totali, efficienza, difese, rotazioni e mappe del campo.",
        ],
      },
      {
        type: "callout",
        kind: "tip",
        text: "Parti dal **Base**, passa a **Con ricezioni** quando hai preso confidenza e prova il **Completo** su una partita in video prima di usarlo dal vivo. Il livello si sceglie partita per partita.",
      },
      { type: "sub", title: "Si può cambiare livello?" },
      {
        type: "p",
        text: "Sì, prima o durante la partita: tocca **«Squadre e regole»** (sotto i pulsanti) e cambia la scelta in **«Quanto vuoi segnare?»**. **Quello che hai già segnato resta**: se passi dal Completo al Base a metà set, i tocchi segnati fino a quel momento restano nel tabellino e da lì in poi segni solo come finisce lo scambio.",
      },
      {
        type: "p",
        text: "Il livello di ogni partita si vede nell'elenco (la targhetta accanto a «In corso» o «Concluso»), in cima alla pagina della partita e nel tabellino. Le partite segnate prima dei livelli valgono come Base.",
      },
      {
        type: "callout",
        kind: "info",
        title: "E nella stagione?",
        text: `I totali di stagione sommano tutte le partite. Le colonne che richiedono i tocchi (ricezione, attacchi totali, difesa) contano però solo le partite in cui li hai segnati: se alterni i livelli quei numeri sono parziali, e lo Scout te lo dice (${cap("stagione")}).`,
      },
    ],
  },
  {
    id: "prima-di-cominciare",
    title: "Prima di cominciare",
    summary: "Tre minuti di preparazione che ti fanno risparmiare tempo durante la partita.",
    blocks: [
      {
        type: "p",
        text: "Per segnare bene ti servono tre cose. Se le prepari prima, in partita dovrai solo toccare i pulsanti.",
      },
      { type: "sub", title: "1. Le atlete, con il numero di maglia" },
      {
        type: "p",
        text: "Lo Scout prende le giocatrici dall'**anagrafica atlete** (Presenze, Atlete). Il **numero di maglia** si scrive lì, **una volta sola**: ogni volta che segni una partita lo Scout lo ritrova da solo. Puoi scriverlo in tre modi:",
      },
      {
        type: "bullets",
        items: [
          "**Nuova atleta**: nella scheda c'è il campo «Numero di maglia». Se un'altra atleta ha già quel numero compare un avviso (non è un divieto: due atlete di categorie diverse possono averlo uguale).",
          "**Aggiungi in elenco**: incolli più nomi insieme e scrivi il numero prima o dopo il nome, per esempio «7 Giulia Bianchi» oppure «Giulia Bianchi 7». Prima di salvare vedi l'anteprima di come sono state lette le righe. Se incolli una atleta già presente con un numero diverso, il numero si aggiorna.",
          "**Direttamente nell'elenco atlete**: accanto a ogni nome c'è la casella «N°». Scrivi il numero e tocca fuori (o premi Invio): si salva da solo.",
        ],
      },
      {
        type: "image",
        file: "atlete-elenco.png",
        caption: "«Aggiungi in elenco»: le atlete con il numero di maglia, scritte tutte insieme.",
        legend: [
          "Una atleta per riga: il numero di maglia si scrive prima o dopo il nome.",
          "L'anteprima di come sono state lette le righe: il numero in blu, un trattino se manca.",
          "«Aggiungi elenco» salva tutte le atlete in una volta sola.",
        ],
        maxHeight: 300,
      },
      {
        type: "image",
        file: "atlete-numeri.png",
        caption: "L'elenco delle atlete: accanto a ogni nome la casella del numero di maglia.",
        legend: [
          "La casella del numero di maglia: si scrive e si salva da sola.",
          "Bordo colorato: un'altra atleta della stessa categoria ha lo stesso numero (è solo un avviso).",
          "«Aggiungi in elenco»: per scrivere molte atlete insieme, con i numeri.",
        ],
        maxHeight: 300,
      },
      {
        type: "callout",
        kind: "tip",
        text: "Il numero serve anche al **Live score** in modalità Partita: per le nostre giocatrici i numeri si scelgono da un elenco con numero e nome, invece di scriverli ogni volta.",
      },
      { type: "sub", title: "2. Le convocate" },
      {
        type: "p",
        text: "Se nella partita (Partite, modifica) hai indicato le **convocate**, lo Scout le propone già spuntate. Se non l'hai fatto, nessun problema: le spunti al momento della preparazione.",
      },
      { type: "sub", title: "3. Il dispositivo" },
      {
        type: "bullets",
        items: [
          "Va bene un **telefono** o un **tablet**. Il telefono in verticale è comodo per segnare con una mano sola; per il livello **Completo**, che ha più pulsanti, un tablet è più comodo.",
          "Carica la batteria: durante la partita lo schermo resta acceso da solo, dove il telefono lo permette.",
          `La **rete** non è indispensabile: se cade, continui a segnare e i punti partono appena torna (${cap("imprevisti")}). Meglio comunque aprire la partita quando c'è connessione.`,
        ],
      },
    ],
  },
  {
    id: "preparare",
    title: "Aprire e preparare la partita",
    summary: "Dall'elenco delle partite fino al primo punto.",
    blocks: [
      { type: "sub", title: "Aprire la partita" },
      {
        type: "p",
        text: "Entra nell'area riservata e tocca **Scout** nel menu. Vedi l'elenco delle partite: sopra «Oggi e prossime partite», sotto quelle già giocate. A ogni riga una targhetta dice a che punto sei: **Da segnare**, **In corso** (con il set e il punteggio) o **Concluso** (con il risultato in set); accanto, se non è il Base, compare il **livello** scelto per quella partita.",
      },
      {
        type: "image",
        file: "hub-partite.png",
        caption: "L'elenco delle partite dello Scout.",
        legend: [
          "«Manuale d'uso (PDF)»: scarica questo manuale.",
          "«Partite» e «Stagione»: le due viste dello Scout.",
          "La targhetta dice a che punto è la partita: Da segnare, In corso o Concluso.",
          "Accanto, il livello scelto per quella partita (Con ricezioni o Completo; il Base non ha targhetta).",
          "«Segna i punti» per cominciare. Sulle partite già avviate trovi «Continua» o «Rivedi», il «Tabellino» e il «PDF».",
        ],
        maxHeight: 330,
      },
      {
        type: "p",
        text: "Tocca **Segna i punti**. La prima volta si apre la **preparazione**, in più parti una sotto l'altra: il livello, le giocatrici, l'avversaria, la formazione in campo (facoltativa) e le regole. Non è obbligatorio compilare tutto, e puoi cambiare ogni cosa anche a partita iniziata.",
      },
      { type: "sub", title: "Il livello" },
      {
        type: "p",
        text: `In cima c'è **«Quanto vuoi segnare?»**: scegli **Base**, **Con ricezioni** o **Completo** (${cap("livelli")}). Di partenza è selezionato **Base**. Sul telefono, sotto ogni livello, **«Cosa segni e cosa ottieni»** si apre per leggere i dettagli.`,
      },
      { type: "sub", title: "Le nostre giocatrici" },
      {
        type: "p",
        text: "Spunta con il quadratino le atlete che giocano. Le **convocate** sono in cima, poi le altre atlete della categoria. Per ogni giocatrice spuntata compaiono due controlli:",
      },
      {
        type: "bullets",
        items: [
          "Il **numero di maglia**, già scritto se l'hai inserito nell'anagrafica. Puoi cambiarlo solo per questa partita. Se manca, compare il pulsante **«Usa il 7»** (prende il numero dell'anagrafica) e, se ne mancano più d'uno, **«Compila i numeri dall'anagrafica»**.",
          "Il quadratino **L**: accendilo per la **libero**. La libero non può murare, per questo non viene proposta quando segni un muro o un errore a muro.",
        ],
      },
      {
        type: "p",
        text: "Se una giocatrice non è in elenco (un'ospite, per esempio), scrivi nome e numero in **«Aggiungi a mano»** e tocca **Aggiungi**.",
      },
      {
        type: "image",
        file: "setup-giocatrici.png",
        caption: "La preparazione: chi gioca, con numero di maglia e libero.",
        legend: [
          "Il quadratino per scegliere chi gioca. Le convocate della partita sono in cima e già spuntate.",
          "Il numero di maglia, preso dall'anagrafica. Si può cambiare solo per questa partita.",
          "«L»: la giocatrice di oggi è la libero.",
        ],
        maxHeight: 330,
      },
      {
        type: "callout",
        kind: "tip",
        text: "Non conosci ancora la formazione? Spunta tutte le presenti. Non hai tempo per niente? Non spuntare nessuna: puoi segnare i punti senza dire chi li fa. Il tabellino delle singole giocatrici sarà vuoto, ma risultato e statistiche di squadra funzionano.",
      },
      { type: "sub", title: "L'avversaria" },
      {
        type: "p",
        text: "Di solito basta il **numero di maglia**. Scrivi i numeri separati da uno spazio (per esempio «1 4 7 9 12») e tocca **Aggiungi**: compaiono come bollini colorati, con una X per toglierli. Se non conosci i numeri, lasciali: quando segni un punto che riguarda una loro giocatrice puoi scrivere il numero al volo.",
      },
      { type: "sub", title: "La formazione in campo (facoltativa)" },
      {
        type: "p",
        text: `Sotto l'avversaria c'è la scheda **«Formazione in campo»**: ti serve se vuoi che lo Scout segua da solo le rotazioni, la libero e i cambi. Se non ti serve, saltala. Come si usa è nel ${cap("formazione")}.`,
      },
      { type: "sub", title: "Le regole della gara" },
      {
        type: "table",
        columns: [
          { header: "Voce", weight: 2 },
          { header: "Che cosa è", weight: 3 },
          { header: "Di solito", weight: 4 },
        ],
        rows: [
          ["Formula", "Quanti set si giocano.", "«3 set su 5» (vince chi ne vince 3), «2 set su 3», oppure «3 set fissi» (si giocano sempre tutti e tre)."],
          ["Punti per set", "A quanti punti si vince un set.", "25, con almeno 2 punti di scarto."],
          ["Ultimo set", "A quanti punti si vince il set decisivo.", "15, con almeno 2 punti di scarto."],
          ["Chi batte per primo", "Chi batte nel 1° set.", "Si sceglie dopo il sorteggio fatto dall'arbitro. Dal 2° set lo scegli a fine set."],
        ],
        keepTogether: true,
      },
      {
        type: "p",
        text: "Per le gare giovanili la formula e i punti sono scritti nel comunicato della gara; nel dubbio chiedi all'arbitro. Con i **3 set fissi** è il regolamento a stabilire se il terzo set va a 15 o a 25: scrivilo in «Ultimo set».",
      },
      {
        type: "image",
        file: "setup-regole.png",
        caption: "L'avversaria e le regole della gara.",
        legend: [
          "I numeri di maglia dell'avversaria: scrivili separati da uno spazio e tocca «Aggiungi».",
          "La formula della gara: 3 set su 5, 2 su 3 oppure 3 set fissi.",
          "I punti per vincere un set e l'ultimo set.",
          "Chi batte per primo nel 1° set.",
        ],
        maxHeight: 380,
      },
      { type: "sub", title: "Punteggio live (facoltativo)" },
      {
        type: "p",
        text: `In fondo alla preparazione c'è l'interruttore **«Mostra il punteggio sul sito pubblico»**: se lo accendi, chi apre il sito della squadra vede la partita in diretta (${cap("live")}). Lasciandolo spento non succede niente.`,
      },
      {
        type: "image",
        file: "live-attivazione.png",
        caption: "L'interruttore del punteggio live e il pulsante per cominciare.",
        legend: ["L'interruttore del punteggio live: di partenza è spento.", "«Comincia a segnare i punti»."],
        maxHeight: 190,
      },
      { type: "sub", title: "Si comincia" },
      {
        type: "p",
        text: "Tocca **«Comincia a segnare i punti»**: al posto della preparazione compaiono i pulsanti per segnare, quelli del livello che hai scelto. La preparazione resta sempre raggiungibile da **«Squadre e regole»**.",
      },
    ],
  },
  {
    id: "formazione",
    title: "La formazione in campo (facoltativa)",
    summary: "Chi gioca, la libero, le rotazioni e i cambi: come nel Live score.",
    blocks: [
      {
        type: "p",
        text: "Di solito lo Scout non sa **chi è in campo**: sei tu a dirgli, a ogni punto, chi ha agito. Se scrivi la **formazione** (chi gioca nelle sei posizioni, la libero e le due giocatrici che sostituisce) lo Scout diventa più preciso e più veloce. Funziona con tutti i livelli ed è **facoltativa**: puoi scriverla solo per la nostra squadra, per tutte e due o per nessuna.",
      },
      { type: "sub", title: "Cosa ottieni" },
      {
        type: "bullets",
        items: [
          "**Rotazioni da sole**: la squadra ruota quando conquista la battuta, come in campo. Sai sempre in che rotazione siete (la 1ª è quella di partenza) e chi batte.",
          "**Libero al posto giusto**: entra al posto della centrale in seconda linea e esce quando la centrale ruota a rete. Non batte mai: se in battuta c'è una centrale, batte lei e la libero entra quando la squadra riceve.",
          "**«Chi» dal campo**: la finestra «chi?» mostra il campo, con la rete in alto, davanti 4-3-2, dietro 5-6-1, la libero in scuro e il pallone verde su chi batte: tocchi la giocatrice dove sta. Chi è in panchina è sotto, più chiara. A muro la libero non si sceglie e la seconda linea è più chiara.",
          "**Cambi**: li registri con un pulsante, lo Scout conta quelli del set e ti avvisa se non sono regolari.",
          "**Tabellino e PDF**: in più trovi le formazioni di partenza di ogni set e i cambi.",
        ],
      },
      { type: "sub", title: "Come si scrive" },
      {
        type: "steps",
        items: [
          "Nella preparazione (o da **«Squadre e regole»** o dal pulsante **«Segui la formazione»** sotto i pannelli) trovi la scheda **«Formazione in campo»**.",
          "Nel campo **«Noi»** scegli chi gioca in ogni posizione, dalla **1** (chi batte) alla **6**, poi in senso orario. Nel campo **«Loro»** scrivi i numeri di maglia di seguito, premendo **Invio** per passare alla posizione dopo.",
          "Scegli la **libero** e le due **centrali** (le giocatrici che la libero sostituisce). Per le avversarie sono facoltative.",
          "Tocca **«Conferma la formazione»**. Se hai già preparato la formazione nella sezione **Partite**, **«Usa la formazione salvata del 1° set»** la riempie da sola, con libero e centrali.",
        ],
      },
      {
        type: "image",
        file: "formazione-editor.png",
        caption: "La scheda «Formazione in campo»: le due squadre, la libero e le centrali.",
        legend: [
          "Nostra squadra: per ogni posizione scegli la giocatrice (la 1 è chi batte).",
          "Avversaria: scrivi i numeri di maglia, con Invio vai alla posizione dopo.",
          "La libero di oggi, tra chi non è in campo.",
          "Le due centrali: sono le giocatrici che la libero sostituisce in seconda linea.",
          "Conferma: da qui lo Scout segue rotazioni e cambi.",
        ],
        maxHeight: 520,
      },
      { type: "sub", title: "In partita: la striscia «In campo»" },
      {
        type: "p",
        text: "Sopra i pulsanti per segnare compare **«In campo»** con le due squadre. Le sei posizioni sono disposte come in campo, con la rete in alto: davanti 4-3-2, dietro 5-6-1. Il **pallone verde** sta su chi batte; la **libero** è in scuro, al posto della centrale che sostituisce. Sotto il nome di ogni squadra vedi la **rotazione**: la 1ª è quella di partenza e si passa alla successiva ogni volta che la squadra recupera la battuta.",
      },
      {
        type: "image",
        file: "formazione-in-campo.png",
        caption: "La striscia «In campo»: nostra squadra, avversaria, rotazione e cambi.",
        legend: [
          "Le sei posizioni di una squadra, come in campo (rete in alto).",
          "Il pallone verde: chi batte.",
          "La libero, in scuro, al posto della centrale che sostituisce.",
          "«Cambio»: registra una sostituzione di quella squadra.",
          "«Formazione»: riapre la scheda per correggere o riscrivere chi è in campo.",
        ],
        maxHeight: 250,
      },
      { type: "sub", title: "I cambi" },
      {
        type: "p",
        text: `Tocca **«Cambio»** sotto la squadra: scegli **chi esce** (tra le sei in campo) e **chi entra** (dalla panchina; per le avversarie puoi scrivere un numero nuovo), poi **«Conferma cambio»**. Chi entra continua la rotazione al posto di chi è uscita e, se era una delle due sostituite dalla libero, ne prende il ruolo. Lo Scout conta i cambi del set (${SUBSTITUTIONS_PER_SET} al massimo nel 6 contro 6) e li mostra anche nel registro, dove si possono togliere.`,
      },
      {
        type: "image",
        file: "formazione-cambio.png",
        caption: "La finestra del cambio.",
        legend: [
          "Chi esce: le sei posizioni, con il numero di chi c'è (la libero compare dove sostituisce).",
          "Chi entra: la panchina.",
          "Conferma. Se il cambio non è regolare compare prima un avvertimento, ma puoi confermare lo stesso.",
        ],
        maxHeight: 300,
      },
      {
        type: "callout",
        kind: "info",
        title: "Quando un cambio non è regolare",
        text: `Lo Scout avvisa (senza vietare: un infortunio fa eccezione) se in un set si superano gli ${SUBSTITUTIONS_PER_SET} cambi, se una titolare rientra al posto di una giocatrice che non l'ha sostituita (o c'è già rientrata una volta), se una riserva già uscita rientra o se una riserva viene sostituita da chi non è la titolare per cui era entrata.`,
      },
      { type: "sub", title: "Set dopo set" },
      {
        type: "bullets",
        items: [
          "A ogni nuovo set ogni squadra **riparte dalla formazione con cui aveva cominciato** il set prima, con la libero ricalcolata: non devi riscrivere niente se non cambi.",
          "Per cambiare la formazione di partenza, scrivila dal pulsante **«Formazione»** **prima del primo punto** del set.",
          "Se la scrivi **a set cominciato** è una correzione: sistema chi è in campo adesso (le rotazioni fatte restano) senza cambiare la formazione di partenza.",
          "**«Annulla ultimo»** toglie anche una formazione o un cambio appena fatti.",
        ],
      },
      {
        type: "callout",
        kind: "tip",
        text: "Non vuoi più seguire una squadra? In «Formazione in campo» tocca **«Non seguire la formazione»**: da quel momento si torna a scegliere «chi» tra tutte le giocatrici, come prima.",
      },
    ],
  },
  {
    id: "segnare",
    title: "Segnare un punto (livello Base)",
    summary: "Il cuore dello Scout: come si segna uno scambio, con tutti i casi.",
    blocks: [
      {
        type: "callout",
        kind: "info",
        title: "Vale per tutti i livelli",
        text: `Questo capitolo spiega il modo di segnare del livello **Base**, che resta sempre disponibile: con **Con ricezioni** lo usi per il punto, dopo aver segnato la ricezione (${cap("ricezioni")}); nel **Completo** lo trovi sotto **«Falli, sanzioni o solo il punto»** (${cap("completo")}).`,
      },
      { type: "sub", title: "Il tabellone" },
      {
        type: "p",
        text: "In alto c'è il tabellone, sempre su sfondo scuro: il **set in corso** (per esempio «1° set a 25»), i **set vinti**, il **punteggio** e, sotto il nome di chi sta battendo, la scritta **«Batte»**. Il punteggio non lo scrivi mai: cresce da solo a ogni punto. Sotto il punteggio ogni squadra ha il suo pulsante **«Time-out»**, per segnare quelli chiesti (vedi «I time-out», in fondo a questo capitolo).",
      },
      {
        type: "image",
        file: "partita-pannelli.png",
        caption: "La pagina della partita: il tabellone e i due pannelli per segnare.",
        legend: [
          "Il set in corso e i set vinti.",
          "Il punteggio: «Noi» a sinistra, «Loro» a destra.",
          "I pulsanti «Time-out», uno per squadra.",
          `Da che parte è la palla (${cap("fasi")}).`,
          "«Punto nostro»: i punti di Volley Lignano.",
          "«Punto loro»: i punti delle avversarie.",
          "L'ultimo punto segnato e «Annulla ultimo».",
        ],
        maxHeight: 380,
      },
      { type: "sub", title: "Passo 1: il pannello e il modo" },
      {
        type: "p",
        text: "Scegli il pannello della squadra che **ha fatto punto**: «Punto nostro» a sinistra, «Punto loro» a destra. In ogni pannello ci sono quattro pulsanti:",
      },
      {
        type: "table",
        columns: [
          { header: "Pulsante", weight: 2 },
          { header: "Quando si usa", weight: 5 },
          { header: "Esempio", weight: 4 },
        ],
        rows: [
          ["Attacco", "Palla a terra nel campo avversario dopo un attacco (anche se tocca il muro e finisce fuori).", "La n. 9 schiaccia e la palla cade in campo."],
          ["Muro", "Muro vincente: la palla cade nel campo di chi attaccava.", "La n. 3 ferma l'attacco con un muro."],
          ["Ace", "Battuta vincente: la palla cade a terra o non è giocabile.", "La n. 7 batte e la ricezione non tocca la palla."],
          ["Errore loro / Errore nostro", "Il punto nasce da un errore o da un fallo dell'altra squadra.", "Loro battono fuori. Noi sbagliamo la ricezione."],
        ],
        keepTogether: true,
      },
      {
        type: "callout",
        kind: "warning",
        text: "Gli errori si scelgono nel pannello della squadra che **fa punto**. Se sbagliano **loro**, il punto è nostro: tocca «Errore loro» dentro «Punto nostro» (a sinistra). Se sbagliamo **noi**, il punto è loro: tocca «Errore nostro» dentro «Punto loro» (a destra). Il titolo della finestra che si apre ti dice sempre di chi è l'errore.",
      },
      { type: "sub", title: "Passo 2: chi ha fatto l'azione" },
      {
        type: "p",
        text: "Dopo il modo si apre un elenco con i **numeri di maglia** (per le nostre anche il nome). Tocca il numero giusto e il punto è registrato. Se hai scritto la formazione in campo, al posto dell'elenco vedi il **campo**: tocca la giocatrice dove sta (davanti 4-3-2, dietro 5-6-1, la panchina è sotto). Per l'avversaria puoi scrivere un numero che non c'è nella casella **«Altro numero di maglia»** e toccare Aggiungi.",
      },
      {
        type: "p",
        text: "Non hai visto chi è stato? Tocca **«Non so / non indicare»**: il punto conta lo stesso per la squadra, solo non entra nel tabellino di nessuna giocatrice.",
      },
      {
        type: "images",
        items: [
          { file: "scelta-giocatrice.png", caption: "Dopo «Attacco» o «Ace»: chi è stata?" },
          { file: "scelta-errore.png", caption: "Dopo «Errore loro»: cosa è successo?" },
        ],
        legend: [
          "Il titolo dice cosa stai segnando e a chi va il punto.",
          "I numeri di maglia, per le nostre anche il nome. La «L» indica la libero.",
          "«Non so / non indicare»: il punto conta lo stesso.",
          "Gli errori di gioco e, più in basso, i falli fischiati dall'arbitro.",
        ],
        maxHeight: 360,
      },
      {
        type: "callout",
        kind: "tip",
        text: "Meglio un punto senza «chi» che un «chi» sbagliato: se ti sfugge il numero, non indovinare.",
      },
      { type: "sub", title: "Il muro e «chi attaccava»" },
      {
        type: "p",
        text: "Dopo un muro lo Scout chiede anche **«Chi attaccava?»**: la giocatrice della squadra opposta il cui attacco è stato fermato. È facoltativo («Non so / salta») e serve a contare gli attacchi murati nel tabellino.",
      },
      { type: "sub", title: "Errori e falli" },
      {
        type: "p",
        text: "Toccando «Errore loro» o «Errore nostro» si apre l'elenco di cosa è successo. Sono due gruppi: gli **errori di gioco** (battuta, ricezione, attacco, muro, alzata, difesa) e i **falli fischiati dall'arbitro**. Per la rotazione e la sanzione non si sceglie la giocatrice: riguardano tutta la squadra.",
      },
      { type: "hows" },
      { type: "sub", title: "Esempi, tocco per tocco" },
      {
        type: "table",
        columns: [
          { header: "Cosa succede", weight: 5 },
          { header: "Cosa tocchi", weight: 6 },
        ],
        rows: [
          ["La n. 7 batte e la palla cade a terra.", "Punto nostro > Ace > n. 7"],
          ["La n. 9 schiaccia e fa punto.", "Punto nostro > Attacco > n. 9"],
          ["La n. 3 ferma l'attacco della loro n. 12.", "Punto nostro > Muro > n. 3 > n. 12 (chi attaccava)"],
          ["La loro n. 4 attacca fuori.", "Punto nostro > Errore loro > Attacco sbagliato > n. 4"],
          ["La loro battuta finisce in rete.", "Punto nostro > Errore loro > Battuta sbagliata > il loro numero (o «Non so»)"],
          ["Battiamo fuori.", "Punto loro > Errore nostro > Battuta sbagliata > la giocatrice che ha battuto"],
          ["L'arbitro fischia doppia a una nostra giocatrice.", "Punto loro > Errore nostro > Doppia > la giocatrice"],
          ["L'arbitro fischia rotazione sbagliata a loro.", "Punto nostro > Errore loro > Rotazione / posizione (nessuna giocatrice)"],
        ],
        keepTogether: true,
      },
      { type: "sub", title: "L'ultimo punto e «Annulla ultimo»" },
      {
        type: "p",
        text: "Sotto i pannelli una riga riassume l'ultimo punto, per esempio «Ultimo: 12-10 · punto nostro · Attacco · n. 7». Se hai toccato il pulsante sbagliato, **«Annulla ultimo»** toglie l'ultimo scambio e il punteggio torna indietro. Puoi premerlo più volte di seguito.",
      },
      {
        type: "callout",
        kind: "example",
        text: "Hai segnato «Punto nostro > Ace > n. 7» ma era un errore di battuta loro? Premi «Annulla ultimo» e rifai: «Punto nostro > Errore loro > Battuta sbagliata».",
      },
      { type: "sub", title: "I time-out" },
      {
        type: "p",
        text: `Quando una squadra chiede un **time-out**, tocca il pulsante **«Time-out»** della squadra, sotto il punteggio: quello di «Noi» a sinistra, quello di «Loro» a destra. Ogni squadra ne ha **${TIMEOUTS_PER_SET} per set** (${TIMEOUT_SECONDS} secondi l'uno, dalla stagione ${RULES_SEASON}): i due pallini del pulsante si riempiono a ogni time-out e, quando sono finiti, il pulsante si spegne fino al set dopo. Il time-out non cambia il punteggio e nemmeno chi batte.`,
      },
      {
        type: "p",
        text: "Lo Scout lo scrive nel **registro**, tra i cambi del set, con il punteggio del momento («Time-out nostro (sul 12-9)»). Se hai toccato per sbaglio, **«Annulla ultimo»** lo toglie (se è l'ultima cosa segnata) oppure lo togli dal registro con il **cestino**. I time-out usati nel set compaiono anche sul riquadro **«In diretta»** del sito, se il punteggio live è acceso.",
      },
    ],
  },
  {
    id: "ricezioni",
    title: "Segnare le ricezioni (livello Con ricezioni)",
    summary: "Il livello Base più la ricezione: chi ha ricevuto, con che voto e, se vuoi, dove.",
    blocks: [
      {
        type: "p",
        text: `Il livello **Con ricezioni** è il Base con **una cosa in più**: quando batte l'avversaria, segni anche la **nostra ricezione**. Sopra i pulsanti dei punti compare il riquadro **«Ricezione nostra»**; sotto, tutto come nel Base (${cap("segnare")}). Se segui la formazione in campo il riquadro è **in primo piano**: a sinistra il **campo**, dove tocchi chi ha ricevuto, a destra i **voti** grandi; i pulsanti dei punti si abbassano finché non hai segnato la ricezione.`,
      },
      { type: "sub", title: "Come si segna una ricezione" },
      {
        type: "steps",
        items: [
          "Tocca **chi ha ricevuto**: sul **campo** se segui la formazione (davanti 4-3-2, dietro 5-6-1, la libero in scuro, la panchina sotto), altrimenti sul numero di maglia (la libero ha la «L»). Se non hai visto chi è stata, tocca **«Non so»**.",
          "Se vuoi, apri **«Zona»** e tocca la zona del campo dove ha ricevuto: davanti 4, 3, 2 (vicino alla rete), dietro 5, 6, 1. Toccandola di nuovo la togli. È facoltativa: serve per la mappa delle zone nel tabellino.",
          "Tocca il **voto**: sei pulsanti colorati, dal verde della ricezione perfetta al rosso dell'errore.",
        ],
      },
      {
        type: "images",
        items: [
          { file: "ricezione-striscia.png", caption: "Il riquadro «Ricezione nostra», quando battono loro." },
          { file: "ricezione-segnata.png", caption: "Dopo il voto: la ricezione è segnata e il punto si segna come sempre." },
        ],
        legend: [
          "Chi ha ricevuto: il numero di maglia. «Non so» se non l'hai visto.",
          "La zona dove ha ricevuto (facoltativa).",
          "Il voto: da # perfetta a = errore.",
          "La ricezione appena segnata: chi, con che voto e la zona.",
          "«Cambia» toglie la ricezione, per rifarla.",
          "I pulsanti dei punti, come nel livello Base.",
        ],
        maxHeight: 380,
      },
      { type: "sub", title: "I voti della ricezione" },
      { type: "grades", skill: "reception" },
      {
        type: "p",
        text: "Pensa all'alzatrice: il voto dice **quante scelte ha** dopo la ricezione. Più importante della precisione è essere **sempre uguali**: scegli il voto con lo stesso criterio per tutta la stagione, così i confronti tra le partite hanno senso.",
      },
      { type: "sub", title: "Quando lo scambio si chiude da solo" },
      {
        type: "p",
        text: "Il voto **=** (errore) vuol dire che la ricezione è stata toccata e la palla è finita fuori o a terra: lo scambio **si chiude da solo** con il punto per loro, senza toccare altro. Con tutti gli altri voti lo scambio resta aperto e il riquadro diventa **«Ricezione segnata»**: ora segni il punto con i pulsanti qui sotto, come nel Base.",
      },
      {
        type: "callout",
        kind: "warning",
        title: "Ace o ricezione sbagliata?",
        text: "Se la palla cade a terra **senza che nessuna la tocchi**, è un **ace** di chi batte: non segnare la ricezione e tocca **Punto loro > Ace**. La ricezione sbagliata (**=**) è solo quando la palla viene toccata e poi va fuori o a terra.",
      },
      {
        type: "callout",
        kind: "tip",
        title: "Prima la ricezione, poi il punto",
        text: `Segna la ricezione **prima** del punto: appena tocchi un pulsante dei punti lo scambio si chiude e il riquadro passa allo scambio successivo. Se l'hai saltata, puoi aggiungerla dopo dal registro (${cap("correggere")}).`,
      },
      { type: "sub", title: "Quando batte la nostra squadra" },
      {
        type: "p",
        text: "Il riquadro resta chiuso e dice che batte la nostra squadra: la ricezione si segna solo quando battono loro, e solo la nostra. Per segnare anche la ricezione delle avversarie serve il livello Completo.",
      },
      { type: "sub", title: "Esempi, tocco per tocco" },
      {
        type: "table",
        columns: [
          { header: "Cosa succede", weight: 5 },
          { header: "Cosa tocchi", weight: 6 },
        ],
        rows: [
          ["Batte l'avversaria. La n. 9 riceve bene e poi segniamo con un attacco della n. 11.", "Ricezione > n. 9 > + Positiva; poi Punto nostro > Attacco > n. 11"],
          [
            "La libero n. 1 riceve alla perfezione in zona 6, poi sbagliano loro l'attacco.",
            "Ricezione > n. 1 > zona 6 > # Perfetta; poi Punto nostro > Errore loro > Attacco sbagliato > il loro numero",
          ],
          ["La n. 4 sbaglia la ricezione: la palla va fuori.", "Ricezione > n. 4 > = Errore. Il punto va a loro da solo"],
          ["La ricezione della n. 7 è scarsa, la palla torna di là e fanno punto loro.", "Ricezione > n. 7 > / Scarsa; poi Punto loro > Attacco > il loro numero"],
          ["La loro battuta cade a terra e nessuna la tocca.", "Niente ricezione: Punto loro > Ace > il numero di chi batte"],
        ],
        keepTogether: true,
      },
    ],
  },
  {
    id: "fasi",
    title: "Come si alternano le fasi",
    summary: "Battuta, ricezione, alzata, attacco, muro e difesa: di chi è il turno e cosa viene dopo.",
    blocks: [
      {
        type: "p",
        text: "Uno scambio è una **palla che va avanti e indietro sopra la rete**. A ogni passaggio c'è una **fase** (battuta, ricezione, alzata, attacco, muro, difesa) e il turno è di una delle due squadre. Se segui la palla tocco per tocco (livelli **Con ricezioni** e **Completo**) lo Scout ti dice sempre **di chi è il turno e quale fase viene adesso**, così non devi ricordare l'ordine.",
      },
      { type: "sub", title: "L'ordine delle fasi" },
      {
        type: "steps",
        items: PHASE_STEPS.map((step) => `**${step.title}.** ${step.text}`),
      },
      { type: "sub", title: "Chi fa cosa, fase per fase" },
      {
        type: "table",
        columns: [
          { header: "Fase", weight: 2.2 },
          { header: "Di chi è il turno", weight: 2.6 },
          { header: "I voti che segni", weight: 3.2 },
          { header: "E poi", weight: 4.6 },
        ],
        rows: phaseRows(),
        keepTogether: true,
      },
      { type: "sub", title: "Da che parte del campo è la palla" },
      {
        type: "p",
        text: "Sopra i pulsanti per segnare c'è una fascia che è il **campo visto dall'alto**: **Noi** a sinistra, **Loro** a destra, la rete in mezzo. La **palla** sta dalla parte di chi ha la battuta o, nel livello **Completo**, di chi tocca adesso, e passa la rete da sola a ogni cambio. Sotto **Palla nostra** o **Palla loro** c'è la fase (Battuta, Ricezione, Attacco…). La stessa palla si accende sul tabellone, accanto al nome della squadra, e la fascia resta in vista mentre scorri fino ai pulsanti. Se non sei sicuro di chi tocca, guarda dove sta la palla: è quella la squadra da scegliere.",
      },
      { type: "sub", title: "Cosa vedi nello Scout" },
      {
        type: "p",
        text: "Nel livello **Completo**, in cima a «Scambio in corso», c'è il **percorso della palla**: i tocchi già segnati (con la lettera del fondamentale, il numero di chi l'ha fatto e il voto), quello che **tocca adesso** (pieno e colorato: azzurro se tocca a noi, sabbia se tocca a loro) e le fasi che di solito seguono, **tratteggiate**. Quando la palla passa dall'altra parte tra due fasi compare la **rete** (il trattino verticale). Sotto, il riquadro **«Ora tocca a»** dice di chi è il turno, la fase e il perché.",
      },
      {
        type: "image",
        file: "completo-fasi.png",
        caption: "Il percorso della palla: dopo la battuta e la ricezione loro, tocca all'attacco loro.",
        legend: [
          "Il percorso: i tocchi segnati, quello di adesso e quelli che seguiranno (tratteggiati); il trattino tra due fasi è la rete.",
          "«Ora tocca a»: di chi è il turno, la fase e perché. Con la formazione, nella battuta compare anche chi batte.",
          "«Come si alternano le fasi»: lo stesso testo di questo capitolo, a portata di mano.",
        ],
        maxHeight: 250,
      },
      {
        type: "bullets",
        items: [
          "Dopo la ricezione o la difesa lo Scout propone l'**attacco**. Se in questa partita segni anche le **alzate**, propone prima l'alzata.",
          "Un voto «scarso» (/) su ricezione, alzata o difesa vuol dire che **la palla è tornata di là**: tocca all'attacco dell'altra squadra.",
          "Un attacco **«Continua»** vuol dire che è stato difeso: tocca alla difesa dell'altra squadra. Un attacco **«Murato»** apre la fase del muro dell'altra squadra.",
          "Se il percorso proposto non è quello che è successo, tocca la fase giusta: la scelta vale per quel tocco e poi lo Scout riparte dalla successiva.",
          "Nel livello **Con ricezioni** non segui ogni fase: una striscia a tre passi (battuta, ricezione, punto) ti dice a che punto sei. Nel **Base** segni solo come finisce lo scambio.",
        ],
      },
      { type: "sub", title: "Un esempio" },
      {
        type: "table",
        columns: [
          { header: "Cosa succede", weight: 5 },
          { header: "Cosa segni", weight: 4 },
          { header: "Cosa propone lo Scout dopo", weight: 4 },
        ],
        rows: [
          ["La nostra n. 7 batte e la palla è in campo.", "Battuta, Noi, n. 7, In campo", "Ricezione loro"],
          ["La loro n. 5 riceve bene.", "Ricezione, Loro, n. 5, Positiva (+)", "Attacco loro"],
          ["La loro n. 11 attacca e la nostra difesa la prende.", "Attacco, Loro, n. 11, Continua", "Difesa nostra"],
          ["La nostra n. 4 difende.", "Difesa, Noi, n. 4, Positiva (+)", "Attacco nostro"],
          ["La nostra n. 9 attacca e fa punto.", "Attacco, Noi, n. 9, Punto", "Scambio chiuso: punto a noi, nuovo scambio"],
        ],
        keepTogether: true,
      },
    ],
  },
  {
    id: "completo",
    title: "Segnare ogni tocco (livello Completo)",
    summary: "Come si segue la palla tocco per tocco, con voti, zone e tutti i casi.",
    blocks: [
      {
        type: "p",
        text: "Nel livello **Completo** segui la palla **tocco per tocco**, nell'ordine in cui accadono: battuta, ricezione, alzata, attacco, muro, difesa. Al posto dei pannelli «Punto nostro» e «Punto loro» trovi il riquadro **«Scambio in corso»**. Il punto lo assegna lo Scout, quando un voto chiude lo scambio.",
      },
      {
        type: "callout",
        kind: "warning",
        title: "Il livello più impegnativo",
        text: "In una partita vera si fanno 5-10 tocchi per scambio e la palla non aspetta. Se devi anche allenare, scegli **Con ricezioni**: il Completo funziona meglio con una persona dedicata, o su una partita in video.",
      },
      { type: "sub", title: "Per ogni tocco, tre scelte" },
      {
        type: "images",
        items: [
          { file: "completo-inizio.png", caption: "All'inizio dello scambio: tocca chi batte, poi il voto." },
          { file: "completo-scambio.png", caption: "Dopo battuta e ricezione: lo Scout propone l'attacco nostro." },
        ],
        legend: [
          "I tocchi già segnati nello scambio: la lettera del fondamentale, il numero di maglia e il voto.",
          "**Cosa è successo**: S battuta, R ricezione, E alzata, A attacco, B muro, D difesa. Quello più probabile è già scelto.",
          "**Chi**: «Noi» o «Loro» e il numero di maglia. «Non so» se non l'hai visto.",
          "**Voto**: toccandolo, il tocco è segnato e si passa al successivo.",
        ],
        maxHeight: 360,
      },
      { type: "p", text: "Per ogni tocco scegli, in quest'ordine, **cosa è successo**, **chi** e il **voto**. Qualche dettaglio utile:" },
      {
        type: "bullets",
        items: [
          `Lo Scout propone da solo il **tocco più probabile**: è già scelto e porta l'etichetta «prossimo» se non lo è. Se è un altro, tocca quello giusto. Come si alternano le fasi è nel ${cap("fasi")}.`,
          "Per la **battuta** propone chi batte (se segui la formazione, la giocatrice in posizione 1; altrimenti la stessa dell'ultima volta) e per l'**alzata** la stessa giocatrice dell'ultima volta. Per le avversarie puoi scrivere al volo un numero che non c'è, nella casella «Altro numero di maglia».",
          "La **zona** è facoltativa (per ricezione, difesa e attacco): si sceglie aprendo il riquadro che compare sotto i numeri di maglia.",
          "Se il voto chiude lo scambio (vedi più sotto) il punto è assegnato; altrimenti lo Scout passa al tocco successivo.",
        ],
      },
      { type: "sub", title: "I voti, fondamentale per fondamentale" },
      {
        type: "p",
        text: "I voti sono gli stessi sei simboli della ricezione: **#** perfetto, **+** positivo, **!** neutro, **-** negativo, **/** scarso, **=** errore. Ogni fondamentale usa solo quelli che hanno senso per lui, e ne cambia il nome.",
      },
      { type: "grades" },
      { type: "sub", title: "Cosa chiude lo scambio" },
      {
        type: "p",
        text: "Alcuni voti **chiudono da soli lo scambio** e assegnano il punto. Con tutti gli altri il gioco continua e lo Scout propone il tocco dopo.",
      },
      {
        type: "table",
        columns: [
          { header: "Tocco e voto", weight: 3 },
          { header: "Cosa è successo", weight: 6 },
          { header: "Il punto va a", weight: 2.4 },
        ],
        rows: [
          ["Battuta # Ace", "La battuta cade a terra o non è giocabile.", "Chi batte"],
          ["Attacco # Punto", "La palla cade a terra nel campo avversario.", "Chi attacca"],
          ["Muro # Punto", "Muro vincente: la palla cade nel campo di chi attaccava.", "Chi mura"],
          ["Qualsiasi tocco con =", "Errore di battuta, ricezione, alzata, attacco, muro o difesa.", "L'altra squadra"],
          ["Tutti gli altri voti", "Il gioco continua: si segna il tocco dopo.", "Nessuno, per ora"],
        ],
        keepTogether: true,
      },
      { type: "sub", title: "Cosa propone lo Scout dopo ogni tocco" },
      {
        type: "p",
        text: "Dopo ogni tocco lo Scout **preseleziona** il successivo: nella maggior parte dei casi basta toccare chi e il voto. Puoi sempre scegliere un altro fondamentale, per esempio per segnare l'alzata.",
      },
      {
        type: "table",
        columns: [
          { header: "Dopo questo tocco", weight: 5 },
          { header: "Lo Scout propone", weight: 6 },
        ],
        rows: [
          ["Battuta in campo (!)", "La ricezione dell'altra squadra."],
          ["Ricezione, alzata o difesa (# + ! -)", "L'attacco della stessa squadra."],
          ["Ricezione o difesa mandata di là (/)", "L'attacco dell'altra squadra: la palla è tornata di là."],
          ["Attacco che continua (+)", "La difesa dell'altra squadra."],
          ["Attacco murato (/)", "Il muro dell'altra squadra."],
          ["Muro che tocca la palla (+)", "La difesa di chi ha murato."],
        ],
        keepTogether: true,
      },
      {
        type: "callout",
        kind: "tip",
        text: "L'**alzata** è facoltativa: dopo la ricezione lo Scout propone direttamente l'attacco. Se ti interessa segnarla, tocca **E** prima dell'attacco.",
      },
      { type: "sub", title: "L'attacco murato e il muro" },
      {
        type: "p",
        text: "Se l'attacco viene fermato dal muro, dai all'attacco il voto **/ Murato**: lo Scout propone il **muro** dell'altra squadra. Con **# Punto** il muro è vincente e il punto è di chi ha murato: lo Scout ricava da solo **chi attaccava** (l'ultimo attacco avversario). Con **+ Tocco** il muro tocca la palla e il gioco continua; con **= Errore** (tocco di rete, invasione) il punto va all'altra squadra.",
      },
      {
        type: "p",
        text: "Se segni un muro vincente senza aver segnato l'attacco, lo Scout lo aggiunge da solo come attacco murato.",
      },
      { type: "sub", title: "Falli, sanzioni e quando perdi il filo" },
      {
        type: "p",
        text: `Sotto il riquadro c'è sempre **«Falli, sanzioni o solo il punto»**: toccalo e trovi i pulsanti del livello Base (${cap("segnare")}). Servono per i **falli fischiati** (tocco di rete, doppia, invasione, rotazione), per le **sanzioni** e per quando **hai perso il filo** dello scambio: lo chiudi dicendo solo come è finito. I tocchi già segnati restano nello scambio.`,
      },
      { type: "sub", title: "Esempi, tocco per tocco" },
      {
        type: "table",
        columns: [
          { header: "Cosa succede", weight: 5 },
          { header: "Cosa tocchi", weight: 6 },
        ],
        rows: [
          ["La loro n. 8 batte e la palla è in campo.", "Battuta > Loro > n. 8 > ! In campo"],
          ["La libero n. 1 riceve bene, in zona 6.", "Ricezione > Noi > n. 1 > zona 6 > + Positiva"],
          ["La n. 7 alza (facoltativo).", "Alzata > Noi > n. 7 > + Buona"],
          ["La n. 9 attacca e la palla cade a terra.", "Attacco > Noi > n. 9 > # Punto. Lo scambio finisce: punto nostro"],
          ["La n. 11 attacca, ma la loro n. 3 ferma l'attacco a muro.", "Attacco > Noi > n. 11 > / Murato; poi Muro > Loro > n. 3 > # Punto. Punto loro"],
          ["Battiamo fuori.", "Battuta > Noi > la giocatrice > = Errore. Punto loro"],
          ["L'arbitro fischia un tocco di rete a una nostra giocatrice.", "Falli, sanzioni o solo il punto > Punto loro > Errore nostro > Tocco di rete > la giocatrice"],
        ],
        keepTogether: true,
      },
      {
        type: "callout",
        kind: "tip",
        text: `Se ti sfugge il numero tocca **«Non so»**: il tocco conta lo stesso per la squadra, solo non entra nel tabellino di una giocatrice. Se sbagli, **«Annulla ultimo»** toglie l'ultimo tocco (non tutto lo scambio) e si può premere più volte; per un tocco più vecchio c'è il registro (${cap("correggere")}).`,
      },
    ],
  },
  {
    id: "fine-set",
    title: "Fine del set e della partita",
    summary: "Quando e come si chiude un set, e come finisce la partita (vale per tutti i livelli).",
    blocks: [
      {
        type: "p",
        text: "Lo Scout **non chiude mai un set da solo**: te lo propone e lo chiudi tu. Quando una squadra raggiunge i punti del set (25, oppure 15 nell'ultimo) con almeno due punti di scarto, sopra i pulsanti compare un riquadro, per esempio **«Il 3° set è finito 25-19: vinto da noi»**. Il numero è quello del set che si stava giocando.",
      },
      {
        type: "steps",
        items: [
          "Controlla il punteggio: deve coincidere con quello dell'arbitro.",
          "Scegli **chi batte per primo nel set successivo** («Chi batte per primo nel 4° set?»). Di norma si alternano; prima del set decisivo c'è un nuovo sorteggio.",
          "Tocca **«Chiudi il 3° set»** (il numero è quello del set appena finito).",
        ],
      },
      {
        type: "image",
        file: "fine-set.png",
        caption: "Il riquadro che compare a fine set.",
        legend: [
          "Il set è arrivato al limite: chi lo ha vinto e con che punteggio.",
          "Chi batte per primo nel set successivo.",
          "«Chiudi il 3° set»: chiude il set e apre il prossimo.",
        ],
        maxHeight: 280,
      },
      {
        type: "p",
        text: "Se con quel set la partita è decisa, il riquadro lo dice («Con questo set la partita è decisa»), non chiede più chi batte e il pulsante diventa **«Chiudi il set e la partita»**.",
      },
      {
        type: "p",
        text: "Se il set deve chiudersi **prima del limite** (per esempio per un errore di conteggio), usa **«Chiudi il set adesso»**, tra i pulsanti sotto il registro dell'ultimo punto. Compare la domanda «Chiudere il 2° set sul 14-12?»: se è quello che vuoi tocca **«Chiudi il 2° set»**, altrimenti **«Annulla»** lascia tutto com'è. Un set in parità non si può chiudere.",
      },
      {
        type: "p",
        text: "**La partita finisce da sola** quando una squadra vince i set necessari (3 su 5, 2 su 3; con 3 set fissi, dopo il terzo). Compare «Partita finita 3-1» e il pulsante **«Apri il tabellino»**; i pulsanti per segnare si spengono.",
      },
      {
        type: "p",
        text: "Se la partita si ferma prima (incontro interrotto, ritiro), usa **«Chiudi la partita»**: lo stato diventa «Partita chiusa a mano» e con **«Riapri»** puoi sempre tornare indietro.",
      },
      {
        type: "callout",
        kind: "tip",
        text: "Hai chiuso un set per sbaglio? **«Annulla ultimo»** toglie la chiusura e il set torna aperto, anche su una partita già finita.",
      },
    ],
  },
  {
    id: "correggere",
    title: "Correggere",
    summary: "Sbagliare è normale: tutto si può sistemare, e punteggio e battute si ricalcolano da soli.",
    blocks: [
      { type: "sub", title: "Il registro degli scambi" },
      {
        type: "p",
        text: "In fondo alla pagina c'è il **Registro**: tutti gli scambi dal più recente, raccolti per set (il set in corso è aperto, gli altri sono chiusi: toccali per aprirli). Ogni riga mostra il punteggio raggiunto, chi ha fatto punto, come e con chi.",
      },
      {
        type: "image",
        file: "registro.png",
        caption: "Il registro degli scambi.",
        legend: [
          "Il set con il suo punteggio. Tocca per aprirlo o chiuderlo.",
          "Il punteggio dopo lo scambio e la squadra che ha fatto punto.",
          "Come è finito lo scambio e con chi.",
          "La matita: corregge lo scambio.",
        ],
        maxHeight: 260,
      },
      {
        type: "p",
        text: "Con i livelli **Con ricezioni** e **Completo**, sotto ogni scambio compaiono anche i **tocchi** segnati, uno per pastiglia: la **lettera** del fondamentale (S battuta, R ricezione, E alzata, A attacco, B muro, D difesa), il **numero di maglia** e il **voto** colorato.",
      },
      {
        type: "image",
        file: "completo-registro.png",
        caption: "Il registro di una partita a livello Completo: sotto ogni scambio i suoi tocchi.",
        legend: [
          "I tocchi dello scambio, in ordine: fondamentale, numero di maglia e voto.",
          "La matita: corregge lo scambio e i suoi tocchi.",
        ],
        maxHeight: 200,
      },
      { type: "sub", title: "Correggere uno scambio" },
      {
        type: "p",
        text: "Tocca la **matita** a destra della riga: si apre «Correggi lo scambio». Puoi cambiare **chi ha agito** (noi o loro), **come** è finito, la **giocatrice** e, per un muro, **chi attaccava**. Il riquadro in basso ti dice a chi va il punto. **Salva** aggiorna lo scambio, **Togli** lo cancella dal registro.",
      },
      {
        type: "image",
        file: "correggi-scambio.png",
        caption: "La finestra «Correggi lo scambio».",
        maxHeight: 230,
      },
      {
        type: "p",
        text: "Il punteggio, i set e le battute di **tutti gli scambi successivi** si ricalcolano da soli: non devi sistemare nient'altro.",
      },
      { type: "sub", title: "Correggere i tocchi" },
      {
        type: "p",
        text: "Negli scambi con i tocchi la stessa finestra mostra **ogni tocco** con **chi** l'ha fatto, il **voto** e la **zona**: li cambi uno per uno. Il voto si cambia solo tra voti che hanno lo stesso effetto sullo scambio (un errore resta un errore, un tocco normale resta un tocco normale): per cambiare chi fa punto, togli lo scambio e segnalo di nuovo. Il cestino accanto a un tocco lo toglie, tranne quello che ha chiuso lo scambio.",
      },
      {
        type: "image",
        file: "completo-correggi.png",
        caption: "La finestra «Correggi lo scambio» con i tocchi.",
        legend: [
          "Un tocco dello scambio: il fondamentale e la squadra.",
          "Chi l'ha fatto: si può cambiare.",
          "Il voto: si può cambiare tra voti con lo stesso effetto sullo scambio.",
        ],
        maxHeight: 300,
      },
      {
        type: "p",
        text: "Se avevi saltato la **ricezione**, nella stessa finestra c'è **«Aggiungi la ricezione»**: scegli chi, il voto e la zona.",
      },
      {
        type: "callout",
        kind: "warning",
        text: "Se togli o cambi uno scambio vecchio, il punteggio di tutta la partita cambia. Quando il punteggio non torna con quello dell'arbitro, cerca nel registro lo scambio che manca o quello di troppo.",
      },
      { type: "sub", title: "Annulla ultimo, a ogni livello" },
      {
        type: "p",
        text: "**«Annulla ultimo»** toglie sempre l'ultima cosa che hai segnato: uno scambio, la chiusura di un set e, nei livelli più alti, anche un tocco (la ricezione appena segnata, o l'ultimo tocco del Completo). Puoi premerlo più volte di seguito.",
      },
      { type: "sub", title: "Cambiare squadre e regole in corsa" },
      {
        type: "p",
        text: "**«Squadre e regole»** (sotto i pulsanti) riapre la preparazione: puoi aggiungere una giocatrice entrata a partita iniziata, cambiare un numero, aggiungere un numero all'avversaria, cambiare il livello o correggere le regole. Una giocatrice che compare già in qualche scambio **non si può togliere** dalla rosa (se serve, prima correggi o togli quegli scambi); puoi invece cambiarle il numero.",
      },
      { type: "sub", title: "Ricominciare da capo" },
      {
        type: "p",
        text: "In fondo a «Squadre e regole» c'è **«Azzera lo scout»**: cancella giocatrici, numeri e tutti gli scambi di quella partita. Chiede conferma e non si può annullare.",
      },
    ],
  },
  {
    id: "imprevisti",
    title: "Se qualcosa va storto",
    summary: "Rete assente, due telefoni, pagina chiusa per sbaglio: non perdi niente.",
    blocks: [
      {
        type: "p",
        text: "Ogni punto che segni si salva da solo. In alto a destra una targhetta ti dice a che punto è il salvataggio:",
      },
      {
        type: "table",
        columns: [
          { header: "Targhetta", weight: 2 },
          { header: "Cosa significa", weight: 4 },
          { header: "Cosa fare", weight: 5 },
        ],
        rows: [
          ["Salvato", "Tutto è al sicuro sul server.", "Niente."],
          ["Salvataggio...", "Sta partendo l'ultimo punto.", "Aspetta un attimo."],
          ["Senza rete", "Internet non c'è: i punti restano sul dispositivo.", "Continua a segnare e non chiudere la scheda. Partono da soli quando torna la rete (o tocca «Riprova»)."],
          ["Da risolvere", "Un altro dispositivo ha salvato la stessa partita.", "Scegli quale versione tenere (vedi sotto)."],
          ["Non salvato", "La sessione è scaduta o l'accesso è stato tolto.", "Accedi di nuovo: le modifiche restano sul dispositivo."],
        ],
        keepTogether: true,
      },
      { type: "sub", title: "Se due dispositivi toccano la stessa partita" },
      {
        type: "p",
        text: "Lo Scout non sovrascrive mai in silenzio. Se un altro telefono (o un'altra scheda) ha salvato nel frattempo, compare la finestra **«Questa partita è stata modificata altrove»**, con il riepilogo delle due versioni. Scegli **«Usa quella salvata»** (si perde quella di questo dispositivo) oppure **«Tieni la mia»** (si perde l'altra).",
      },
      {
        type: "image",
        file: "conflitto.png",
        caption: "La finestra che compare quando due dispositivi hanno modificato la stessa partita.",
        maxHeight: 190,
      },
      {
        type: "callout",
        kind: "tip",
        text: "Il modo migliore per evitare il problema: **un solo dispositivo segna**. Un secondo telefono usalo solo per guardare il tabellino.",
      },
      { type: "sub", title: "Se la pagina si chiude o il telefono si spegne" },
      {
        type: "p",
        text: "Riapri lo Scout e tocca **«Continua»** sulla partita. Quello che era già salvato c'è; le modifiche rimaste a metà sono conservate nel telefono e vengono recuperate in automatico. Se non coincidono con quelle del server compare la stessa finestra di scelta. Mentre la partita è in corso lo schermo **resta acceso da solo** (dove il telefono lo permette), così non devi riattivarlo a ogni pausa.",
      },
    ],
  },
  {
    id: "live",
    title: "Punteggio live sul sito",
    summary: "La partita in diretta per chi non è in palestra.",
    blocks: [
      {
        type: "p",
        text: "Se lo accendi, chi apre il sito della squadra vede un riquadro **«In diretta»** con le due squadre, il punteggio del set, i set vinti, chi batte, i **time-out usati** e i set già chiusi. È il **punteggio**, niente di più, a qualunque livello: ricezioni e tocchi restano nello Scout.",
      },
      {
        type: "image",
        file: "live-banner.png",
        caption: "Il riquadro «In diretta» sul sito pubblico, come si vede dal telefono.",
        maxWidth: 340,
      },
      { type: "sub", title: "Cosa si vede e cosa no" },
      {
        type: "table",
        columns: [
          { header: "", weight: 2 },
          { header: "Cosa", weight: 8 },
        ],
        rows: [
          ["Si vede", "I nomi delle due squadre, il punteggio del set, i set vinti e quelli chiusi, chi batte, i time-out usati da ogni squadra nel set (due pallini, pieni quelli già chiamati) e la scritta «Risultato non ufficiale» (con l'ora dell'ultimo aggiornamento, se il punteggio si ferma da più di 3 minuti)."],
          ["Non si vede mai", "I nomi o i numeri di maglia delle giocatrici, chi ha fatto punto e come, gli errori, i voti, il tabellino, le formazioni."],
        ],
        keepTogether: true,
      },
      { type: "sub", title: "Come si accende e si spegne" },
      {
        type: "bullets",
        items: [
          "Nella **preparazione**, con l'interruttore «Mostra il punteggio sul sito pubblico».",
          "Durante la partita, con il pulsante **«Punteggio live sul sito»** sotto i pannelli (diventa «Spegni il live sul sito»).",
          "Quando è acceso, in alto compare la targhetta rossa **«Live sul sito»**.",
        ],
      },
      {
        type: "p",
        text: "Il riquadro compare **dal primo punto segnato**. Il sito si aggiorna ogni pochi secondi: il ritardo, di solito, è al massimo una decina di secondi. A partita finita il riquadro diventa «Partita finita» e resta visibile per qualche ora, poi sparisce da solo.",
      },
      {
        type: "callout",
        kind: "warning",
        text: "Il punteggio live lo vede **chiunque** apra il sito. Accendilo solo se vuoi la diretta pubblica, e spegnilo se la partita viene sospesa o se hai dubbi sul punteggio.",
      },
      { type: "sub", title: "E il Live score?" },
      {
        type: "p",
        text: "Esiste anche il **Live score**, il tabellone da bordo campo con le formazioni, che può mandare il punteggio sul sito. Se per distrazione sono accesi **tutti e due**, il sito mostra quello **aggiornato per ultimo**. Per sicurezza usa una sola cosa alla volta.",
      },
    ],
  },
  {
    id: "tabellino",
    title: "Il tabellino",
    summary: "I numeri della partita: risultato, statistiche di squadra e di ogni giocatrice.",
    blocks: [
      {
        type: "p",
        text: `Dall'elenco delle partite, o dal pulsante **Tabellino** in alto nella pagina della partita, apri il tabellino. Funziona anche **mentre si gioca**: fino alla fine i numeri sono provvisori. Quello che contiene dipende dal **livello** della partita (${cap("livelli")}).`,
      },
      {
        type: "image",
        file: "tabellino-alto.png",
        caption: "La parte alta del tabellino.",
        legend: [
          "Il risultato in set e i parziali, con la durata stimata di ogni set. Non è il risultato ufficiale.",
          "Il selettore: tutta la partita oppure un solo set.",
          "Il livello della partita: Base, Con ricezioni o Completo.",
          "I quattro numeri chiave: break point, cambio palla, serie di punti più lunga, errori commessi.",
        ],
        maxHeight: 270,
      },
      { type: "sub", title: "I numeri chiave" },
      {
        type: "table",
        columns: [
          { header: "Numero", weight: 3 },
          { header: "Cosa dice", weight: 5 },
          { header: "Esempio", weight: 3 },
        ],
        rows: [
          ["Punti in battuta (break point)", "Su 100 volte che la squadra batte, quante volte fa punto.", "40% = su 10 battute, 4 volte punto."],
          ["Cambio palla (side-out)", "Su 100 volte che la squadra riceve, quante volte fa subito punto e conquista la battuta.", "60% = su 10 ricezioni, 6 volte si prende la battuta."],
          ["Serie di punti più lunga", "I punti di fila più lunghi, nel set o nella partita.", "7 = sette punti consecutivi."],
          ["Errori commessi", "Errori e falli che hanno regalato un punto all'altra squadra.", ""],
        ],
        keepTogether: true,
      },
      {
        type: "p",
        text: "Sotto trovi **«Come si è fatto punto»** (i punti delle due squadre divisi per attacco, muro, ace e punti regalati dagli errori avversari), **«Errori e falli»** (tutti gli errori divisi per tipo) e **«Andamento del punteggio»**: il grafico scambio dopo scambio, dove una linea che sale in fretta è una serie di punti di quella squadra.",
      },
      { type: "sub", title: "La ricezione (livelli Con ricezioni e Completo)" },
      {
        type: "p",
        text: "Se hai segnato le ricezioni compare la scheda **«La ricezione»**: com'è andata ogni ricezione della squadra, con il voto che hai segnato. Se in una partita di questi livelli non ne hai segnata nessuna, al suo posto c'è un avviso.",
      },
      {
        type: "image",
        file: "tabellino-ricezione.png",
        caption: "La scheda «La ricezione»: i numeri, la barra della squadra e quelle delle giocatrici.",
        legend: [
          "I numeri da guardare per primi: ricezione **positiva** (# e +), **perfetta** (#), **errori** e **cambio palla dopo la ricezione**.",
          "La barra di tutta la squadra: ogni colore è un voto, dal verde scuro (perfetta) al rosso (errore). Sotto, la legenda dei colori.",
          "Una barra per ogni giocatrice che ha ricevuto, con quante ricezioni e le percentuali **pos** e **prf**.",
        ],
        maxHeight: 270,
      },
      {
        type: "image",
        file: "tabellino-ricezione-cambio.png",
        caption: "Sotto: quanto la ricezione fa vincere lo scambio, e dove si riceve.",
        legend: [
          "Per ogni voto, quante volte lo scambio è poi stato vinto: la prova che la ricezione si allena.",
          "La frase che riassume: dopo una ricezione perfetta, contro dopo una negativa o scarsa.",
          "La mappa delle zone dove si riceve: più scuro = più ricezioni positive.",
        ],
        maxHeight: 170,
      },
      { type: "sub", title: "Le mappe del campo e le rotazioni (livello Completo)" },
      {
        type: "p",
        text: "Il livello **Completo** aggiunge due schede. **«Le mappe del campo»** mostra, per ogni zona, la percentuale di difese positive e di attacchi a punto, e su quanti tocchi è calcolata: più scuro è il colore, più i tocchi sono riusciti. Contano solo i tocchi per cui hai scelto la zona.",
      },
      {
        type: "image",
        file: "tabellino-mappe.png",
        caption: "Le mappe del campo, viste dalla propria metà con la rete in alto.",
        legend: [
          "La mappa della **difesa**: la percentuale di difese positive (# e +) in ogni zona.",
          "La mappa dell'**attacco**: la percentuale di attacchi a punto, da ogni zona.",
          "In ogni zona: la percentuale e il numero di tocchi su cui è calcolata.",
        ],
        maxHeight: 160,
      },
      {
        type: "p",
        text: "**«Le rotazioni»** dicono dove si fanno punti in battuta e dove si fatica a recuperare la palla. Lo Scout non conosce la formazione: la **1ª rotazione** è quella con cui la squadra comincia ogni set, e si passa alla successiva ogni volta che la squadra **recupera la battuta**. Se parti sempre con la stessa formazione, i numeri sono confrontabili tra i set.",
      },
      {
        type: "image",
        file: "tabellino-rotazioni.png",
        caption: "Le rotazioni della nostra squadra e, a fianco, quelle dell'avversaria.",
        legend: [
          "Le rotazioni di una squadra, dalla 1ª alla 6ª.",
          "**BP**: quante volte, battendo in quella rotazione, si fa punto (break point).",
          "**Cambio**: quante volte, ricevendo in quella rotazione, si recupera la battuta (cambio palla).",
        ],
        maxHeight: 170,
      },
      { type: "sub", title: "La tabella delle giocatrici" },
      {
        type: "p",
        text: "Le colonne cambiano con il livello. Queste sono quelle del **Base**; **N°** è il numero di maglia. Ogni gruppo ha le sue colonne (Punti, Battuta, Ricezione, Attacco, Muro).",
      },
      {
        type: "image",
        file: "tabellino-giocatrici.png",
        caption: "La tabella di una squadra a livello Base: una riga per giocatrice.",
        maxHeight: 230,
      },
      { type: "legend", level: "base" },
      {
        type: "p",
        text: "Con **Con ricezioni** si aggiunge il gruppo **Ricezione**:",
      },
      { type: "legend", level: "ricezioni", onlyNew: true },
      {
        type: "p",
        text: "Con **Completo** la tabella ha più colonne (sul computer scorre di lato) e queste sono nuove o cambiano:",
      },
      { type: "legend", level: "completo", onlyNew: true },
      {
        type: "image",
        file: "tabellino-completo.png",
        caption: "La tabella a livello Completo: Punti, Battuta e Ricezione; scorrendo a destra Attacco, Muro, Difesa e Altri.",
        maxHeight: 200,
      },
      {
        type: "p",
        text: "In fondo alla tabella la riga **Squadra** somma tutte le giocatrici. Quelle senza nessuna azione segnata sono raccolte in una riga a parte («Senza azioni segnate»).",
      },
      { type: "sub", title: "Il PDF" },
      {
        type: "p",
        text: "**Scarica PDF** (in alto nel tabellino, e accanto a ogni partita nell'elenco) crea il tabellino da stampare, con le stesse schede del livello della partita: da quattro pagine a livello Base a sette a livello Completo. Se hai scelto un set, il PDF contiene solo quello.",
      },
      {
        type: "callout",
        kind: "info",
        title: "Parziali diversi da «Partite»",
        text: "Se hai già scritto i parziali in **Partite** e sono diversi da quelli dello Scout, il tabellino mostra un avviso: controlla quale dei due è giusto.",
      },
    ],
  },
  {
    id: "stagione",
    title: "La stagione",
    summary: "I totali di tutte le partite segnate.",
    blocks: [
      {
        type: "p",
        text: "Nell'elenco dello Scout tocca **Stagione**: vedi la somma di tutte le partite che hai segnato. In alto i totali (partite, scambi, punti fatti e subiti, break point e cambio palla a confronto con le avversarie); poi «Come facciamo punto, in stagione» e la tabella delle **nostre giocatrici**, con in più la colonna **Part.** (in quante partite ha fatto o subìto almeno un'azione).",
      },
      {
        type: "image",
        file: "stagione.png",
        caption: "La vista «Stagione».",
        legend: [
          "«Stagione»: la vista con i totali di tutte le partite segnate.",
          "I totali: partite, scambi, punti fatti e subiti, break point e cambio palla a confronto con le avversarie.",
          "«Come facciamo punto, in stagione»: la somma di tutte le partite.",
        ],
        maxHeight: 380,
      },
      {
        type: "p",
        text: "Se almeno una partita è a livello **Con ricezioni** o **Completo**, compare anche **«La ricezione, in stagione»** (ricezioni, barra della squadra e di ogni giocatrice, cambio palla per voto) e la tabella delle giocatrici ha le colonne di ricezione, attacco e difesa. Quelle colonne **contano solo le partite in cui hai segnato i tocchi**: una nota in fondo dice quante sono, perché punti ed errori invece sommano tutte le partite. Mappe e rotazioni restano nel tabellino di ogni partita.",
      },
      {
        type: "callout",
        kind: "info",
        text: "Il nome di una giocatrice è quello dell'ultima partita in cui compare. Le partite senza nessun punto segnato non contano.",
      },
    ],
  },
  {
    id: "domande",
    title: "Domande frequenti",
    summary: "Le cose che si chiedono più spesso la prima volta.",
    blocks: [
      { type: "sub", title: "Quale livello devo scegliere?" },
      {
        type: "p",
        text: `Se è la prima volta, il **Base**. Quando hai preso confidenza, **Con ricezioni**. Il **Completo** è per chi ha una persona dedicata allo Scout (${cap("livelli")}).`,
      },
      { type: "sub", title: "Posso cambiare livello a partita iniziata?" },
      {
        type: "p",
        text: "Sì: **«Squadre e regole»** e poi **«Quanto vuoi segnare?»**. Quello che hai già segnato resta, e da lì in poi segni al nuovo livello.",
      },
      { type: "sub", title: "Devo scrivere la formazione?" },
      {
        type: "p",
        text: `No, è facoltativa e vale anche solo per una squadra. Se la scrivi, lo Scout ruota da solo, sa chi batte, ti fa scegliere «chi» dal campo e tiene i cambi (${cap("formazione")}).`,
      },
      { type: "sub", title: "Posso usare lo Scout a schermo intero?" },
      {
        type: "p",
        text: "Sì: il pulsante **«Schermo intero»**, in alto, mette lo Scout a tutto schermo, senza il menu del sito. Su tablet e computer lo schermo si divide in due: a sinistra i pulsanti per segnare, a destra il tabellone (sempre in alto), chi è in campo e il registro, sempre sotto gli occhi. I pulsanti dei punti occupano tutta l'altezza che c'è, quindi sono grandi e facili da toccare; il registro scorre da solo e **«Annulla ultimo»** resta sempre in fondo. Si esce con **«Esci»** o con il tasto Esc.",
      },
      { type: "sub", title: "Da che parte è la palla?" },
      {
        type: "p",
        text: `Lo dice la fascia sopra i pulsanti, il campo visto dall'alto con «Noi» a sinistra e «Loro» a destra: la palla è dalla parte di **Palla nostra** o **Palla loro**. Si accende anche sul tabellone (${cap("fasi")}).`,
      },
      { type: "sub", title: "Non capisco di chi è il turno." },
      {
        type: "p",
        text: `Nel livello Completo guarda il riquadro **«Ora tocca a»**: dice di chi è il turno, quale fase è e perché; sopra c'è il percorso della palla con le fasi che seguono (${cap("fasi")}).`,
      },
      { type: "sub", title: "Ho segnato un punto alla squadra sbagliata." },
      { type: "p", text: "Se è l'ultimo, **«Annulla ultimo»**. Se è più indietro, trovi lo scambio nel **registro** e tocchi la matita: cambi squadra o modo, oppure lo togli." },
      { type: "sub", title: "Ho dimenticato di segnare una ricezione." },
      { type: "p", text: "Dal **registro**: tocca la matita sullo scambio e poi **«Aggiungi la ricezione»**. Se sei ancora nello stesso scambio, la segni dal riquadro «Ricezione nostra» prima del punto." },
      { type: "sub", title: "Nel Completo ho sbagliato un tocco." },
      { type: "p", text: "Se è l'ultimo, **«Annulla ultimo»**. Se è più indietro, **registro > matita**: cambi chi, voto o zona, oppure togli il tocco." },
      { type: "sub", title: "Nel Completo l'arbitro fischia un fallo, o non so come segnare." },
      { type: "p", text: "Apri **«Falli, sanzioni o solo il punto»** sotto il riquadro e chiudi lo scambio come nel Base: i tocchi già segnati restano." },
      { type: "sub", title: "Perché nel tabellino mancano alcune ricezioni o alcuni attacchi?" },
      {
        type: "p",
        text: "Perché lo Scout conta solo i tocchi che hai segnato: se in uno scambio hai saltato la ricezione, o hai segnato solo il punto, quel tocco non compare. A livello Base, poi, questi numeri non esistono.",
      },
      { type: "sub", title: "Le mappe e le rotazioni sono precise?" },
      {
        type: "p",
        text: "Le mappe contano solo i tocchi con la zona. Le rotazioni si ricavano dall'ordine delle battute: la 1ª è quella con cui comincia il set e si passa alla successiva ogni volta che la squadra recupera la battuta. Senza la formazione sono indicative (non sai chi c'è in ogni rotazione) e confrontabili se parti sempre con la stessa formazione; con la formazione sono esatte e il tabellino elenca anche chi c'era in campo.",
      },
      { type: "sub", title: "Il punteggio dello Scout non coincide con quello dell'arbitro." },
      { type: "p", text: "Significa che uno scambio è mancante o in più. Scorri il registro dall'ultimo scambio: di solito si trova guardando i punteggi riga per riga. Prima di correggere, controlla con l'arbitro quale dei due è giusto." },
      { type: "sub", title: "Non conosco i numeri dell'avversaria." },
      { type: "p", text: "Non li scrivere in anticipo: quando segni un punto o un tocco che riguarda una loro giocatrice, scrivi il numero nella casella «Altro numero di maglia». Se proprio non lo vedi, tocca «Non so»." },
      { type: "sub", title: "Posso segnare con due telefoni insieme?" },
      { type: "p", text: "È meglio di no: lo Scout si accorge del conflitto e ti chiede quale versione tenere, ma una delle due va persa. Segna con un solo dispositivo; gli altri guardano il tabellino." },
      { type: "sub", title: "Posso usare lo Scout e il Live score insieme?" },
      { type: "p", text: "Sì, sono strumenti indipendenti, ma conviene usarne uno alla volta per partita. Se hanno acceso tutti e due il punteggio sul sito, vale quello aggiornato per ultimo." },
      { type: "sub", title: "Chi vede il tabellino?" },
      { type: "p", text: "Solo chi ha accesso all'area riservata e il permesso «Scout». Sul sito pubblico, se acceso, si vede soltanto il punteggio live (mai nomi né numeri)." },
      { type: "sub", title: "Cosa succede se cancello la partita dal calendario?" },
      { type: "p", text: "Lo scout di quella partita viene cancellato insieme a lei. Se vuoi solo ricominciare lo scout, usa «Azzera lo scout» in «Squadre e regole»." },
      { type: "sub", title: "Posso fare lo Scout di un torneo o del Minivolley?" },
      { type: "p", text: "No: lo Scout è per le partite di campionato e le amichevoli di Under 14 e Under 15. I tornei hanno più squadre e più gare, e il Minivolley non ha partite nel calendario." },
      { type: "sub", title: "Posso segnare la partita dopo averla giocata?" },
      { type: "p", text: "Sì, se hai un video o degli appunti scambio per scambio: lo Scout registra una sequenza, quindi l'ordine degli scambi deve essere quello giusto. Le durate dei set, però, saranno sbagliate: si calcolano dall'ora in cui segni il primo e l'ultimo punto." },
    ],
  },
  {
    id: "glossario",
    title: "Glossario",
    summary: "Le parole della pallavolo che incontri nello Scout, in ordine alfabetico.",
    blocks: [{ type: "glossary" }],
  },
  {
    id: "scheda",
    title: "Scheda rapida",
    summary: "Da stampare e tenere a bordo campo.",
    blocks: [
      { type: "sub", title: "Livello Base: tre scelte per punto" },
      {
        type: "steps",
        items: [
          "Scegli il **pannello** di chi ha fatto punto: «Punto nostro» o «Punto loro».",
          "Scegli **come**: Attacco, Muro, Ace oppure Errore.",
          "Scegli **chi**: il numero di maglia (o «Non so»).",
        ],
      },
      {
        type: "table",
        columns: [
          { header: "Cosa succede", weight: 5 },
          { header: "Cosa tocchi", weight: 6 },
        ],
        rows: [
          ["Facciamo punto (attacco, muro o ace)", "Punto nostro > Attacco / Muro / Ace > numero (per il muro anche chi attaccava)"],
          ["Sbagliano loro (battuta, attacco, fallo...)", "Punto nostro > Errore loro > cosa > numero"],
          ["Fanno punto loro con un attacco, un muro o un ace", "Punto loro > Attacco / Muro / Ace > numero"],
          ["Sbagliamo noi (battuta, ricezione, fallo...)", "Punto loro > Errore nostro > cosa > numero"],
        ],
        keepTogether: true,
      },
      { type: "sub", title: "Con ricezioni: la ricezione prima del punto" },
      {
        type: "steps",
        items: [
          "Quando battono loro, nel riquadro **Ricezione nostra** tocca **chi** ha ricevuto (sul campo, se segui la formazione) e, se vuoi, la **zona**, poi il **voto**.",
          "Con **=** il punto va a loro da solo; con gli altri voti segna il punto come nel Base.",
        ],
      },
      // Retro della scheda: il livello Completo e le sigle.
      { type: "pageBreak" },
      { type: "sub", title: "Completo: tre scelte per tocco" },
      {
        type: "steps",
        items: [
          "**Cosa è successo**: S battuta, R ricezione, E alzata, A attacco, B muro, D difesa (lo Scout propone il più probabile).",
          "**Chi**: Noi o Loro e il numero di maglia (o «Non so»).",
          "**Voto**: il tocco è segnato. Un **=**, un ace, un attacco a punto o un muro vincente chiudono lo scambio.",
        ],
      },
      { type: "grades", summary: true },
      {
        type: "callout",
        kind: "tip",
        title: "Se sbagli",
        text: "**Annulla ultimo** toglie l'ultima cosa segnata (un punto, un tocco o un time-out). Per uno scambio più vecchio: **Registro > matita**.",
      },
      {
        type: "callout",
        kind: "warning",
        title: "Fine set e senza rete",
        text: "A fine set scegli chi batte per primo nel set dopo e tocca **Chiudi il set**. Senza rete continua a segnare e non chiudere la scheda: i punti partono da soli quando torna internet (la targhetta in alto torna a «Salvato»).",
      },
      {
        type: "table",
        columns: [
          { header: "Sigla", weight: 2 },
          { header: "Significa", weight: 7 },
        ],
        rows: [
          ["BP", "Punti fatti mentre si batteva (break point)."],
          ["Cambio palla", "Punto fatto da chi riceve: si conquista la battuta (side-out)."],
          ["V-P", "Punti fatti meno errori e attacchi murati."],
          ["Pos% / Prf% / Eff%", "Ricezioni positive (# e +) e perfette (#) sulle ricezioni segnate; efficienza dell'attacco (punti meno errori meno murati) sugli attacchi segnati."],
        ],
        keepTogether: true,
      },
    ],
  },
];
