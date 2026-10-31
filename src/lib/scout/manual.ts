import { RULES_SEASON, SUBSTITUTIONS_PER_SET, TIMEOUT_SECONDS, TIMEOUTS_PER_SET } from "@/lib/volleyRules";
import { LEVEL_META, LEVEL_ORDER } from "./levels";
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
  /** I voti di un fondamentale, con la spiegazione, ricavati da TOUCH_SKILLS. */
  | { type: "grades"; skill: ScoutTouchSkill }
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
    text: "Il secondo tocco, di solito, che prepara l'attacco. Lo Scout la segna solo se è sbagliata (alzata fuori o in rete).",
  },
  { term: "Attacco", text: "Il colpo con cui si cerca di mandare la palla a terra nel campo avversario. Punto se la palla cade a terra, errore se va fuori, in rete o sull'antenna." },
  { term: "Break point (BP)", text: "Punto fatto mentre la propria squadra batteva. La percentuale dice su 100 battute quante finiscono con un punto." },
  { term: "Cambio palla (side-out)", text: "Punto fatto da chi stava ricevendo: la squadra conquista la battuta. La percentuale dice su 100 ricezioni quante finiscono con un punto subito." },
  {
    term: "Difesa",
    text: "Il recupero di un attacco avversario. Lo Scout la segna solo se è sbagliata (palla a terra o fuori).",
  },
  { term: "Doppia", text: "Fallo: la stessa giocatrice tocca la palla due volte di seguito." },
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
    text: "Quanto si segna in una partita: Base (come finisce ogni scambio) o Con ricezioni (in più la ricezione). Si sceglie prima di ogni partita.",
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
    text: "Dopo aver recuperato la battuta, le giocatrici cambiano posizione in senso orario. Sbagliare l'ordine di battuta o la posizione è un fallo di squadra. Nel tabellino la 1ª rotazione è quella con cui comincia il set e si passa alla successiva a ogni cambio palla; se segui la formazione, lo Scout ruota la squadra da solo.",
  },
  { term: "Sanzione", text: "Penalità dell'arbitro (cartellino) che assegna il punto all'avversaria." },
  { term: "Scambio", text: "Dalla battuta al punto assegnato: lo Scout ne registra uno alla volta. Si chiama anche azione o rally." },
  { term: "Set", text: "Una parte della partita: vince chi arriva per primo a 25 punti con almeno due di scarto (15 nel set decisivo)." },
  { term: "Tocco", text: "Ogni volta che una giocatrice (o il muro) tocca la palla. Lo Scout segna il tocco che chiude lo scambio e, nel livello Con ricezioni, la ricezione, con chi l'ha fatta e con che voto." },
  { term: "Tocco di rete", text: "Fallo: una giocatrice tocca la rete mentre gioca la palla." },
  { term: "Trattenuta", text: "Fallo: la palla non rimbalza ma viene accompagnata o trattenuta." },
  { term: "V-P", text: "Punti fatti meno errori e attacchi murati: dice se una giocatrice ha dato più di quanto ha tolto." },
  {
    term: "Voto",
    text: "Quanto è riuscito un tocco, da # (perfetto) a = (errore): # perfetto, + positivo, ! neutro, - negativo, / scarso, = errore. Il nome del voto cambia un po' con il fondamentale.",
  },
  {
    term: "Zona",
    text: "Una delle sei parti del campo, numerate come in pallavolo: davanti 4, 3, 2 (vicino alla rete) e dietro 5, 6, 1. Si indica, se si vuole, per la ricezione.",
  },
];


export const SCOUT_MANUAL: ManualChapter[] = [
  {
    id: "due-minuti",
    title: "Lo Scout in due minuti",
    summary: "Che cos'è, cosa ti dà e cosa non fa.",
    blocks: [
      {
        type: "p",
        text: `Lo **Scout** serve a registrare una partita **scambio per scambio**. Prima di ogni partita scegli **quanto vuoi segnare** (${cap("livelli")}): soltanto **come finisce** ogni scambio (livello **Base**) oppure anche la **ricezione** (livello **Con ricezioni**). Tutto il resto lo ricava lo Scout da solo: il punteggio, i set, a chi tocca battere, i break point e le rotazioni.`,
      },
      {
        type: "p",
        text: "È il lavoro che fanno gli scoutman dei campionati ufficiali con i programmi come Data Volley. Con il livello **Base** è ridotto all'essenziale: due tocchi per un punto normale, tre per un errore. **Con ricezioni** aggiunge due tocchi, solo quando riceviamo.",
      },
      { type: "sub", title: "Cosa ottieni" },
      {
        type: "bullets",
        items: [
          `**Il tabellino della partita**: per ogni giocatrice i punti, gli ace, gli errori, gli attacchi e i muri; con il livello Con ricezioni anche le ricezioni e le loro percentuali (${cap("tabellino")}).`,
          "**Le statistiche di squadra**: punti in battuta (break point), cambio palla (side-out), serie di punti più lunga, errori commessi, sempre a confronto con le avversarie.",
          "**Il grafico dell'andamento** del punteggio, scambio dopo scambio.",
          "**L'analisi della ricezione** (livello Con ricezioni): come riceve la squadra, quanto la ricezione fa vincere i punti e dove si riceve.",
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
          `Non ti obbliga a seguire formazioni e sostituzioni: sono facoltative (${cap("formazione")}). Senza formazione le rotazioni si ricavano dall'ordine delle battute.`,
          "Non registra ogni tocco, ma solo come finisce lo scambio (e, con le ricezioni, la ricezione): per questo mancano gli attacchi tentati e le percentuali di attacco che si vedono nei tabellini di Lega. Le percentuali di ricezione le dà il livello Con ricezioni.",
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
        text: "Prima di ogni partita scegli il **livello**. Poi, per ogni scambio, dici **chi** ha fatto cosa e **come** è andata: nel Base solo l'ultimo tocco, con le ricezioni anche la ricezione. Tutto il resto è automatico.",
      },
    ],
  },
  {
    id: "livelli",
    title: "I due livelli: quanto vuoi segnare",
    summary: "Base o Con ricezioni: cosa segni, cosa ottieni e come scegliere.",
    blocks: [
      {
        type: "p",
        text: "Prima di ogni partita scegli il **livello**: con **Con ricezioni** segni qualcosa in più e ottieni più numeri, ma serve anche più attenzione mentre si gioca. **Non c'è un livello giusto per tutti**: dipende da chi segna e da quello che vuoi sapere.",
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
          ],
          [
            "Cosa ottieni",
            "Punti, ace, errori e attacchi murati di ogni giocatrice; break point e cambio palla.",
            "In più: ricezione positiva e perfetta di ogni giocatrice, cambio palla in base alla ricezione, mappa delle zone di ricezione.",
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
        ],
        maxHeight: 250,
      },
      { type: "sub", title: "Come scegliere" },
      {
        type: "bullets",
        items: [
          "**Base**: se è la prima volta, se sei l'unica persona a segnare in panchina o se ti basta il tabellino con punti, ace ed errori. Si impara in pochi minuti.",
          "**Con ricezioni**: se vuoi capire come riceve la squadra. Costa solo due tocchi in più, e solo quando riceviamo, e dà i numeri più utili per allenare: ricezione positiva e perfetta di ogni giocatrice e quanto la ricezione fa vincere i punti.",
        ],
      },
      {
        type: "callout",
        kind: "tip",
        text: "Parti dal **Base** e passa a **Con ricezioni** quando hai preso confidenza. Il livello si sceglie partita per partita.",
      },
      { type: "sub", title: "Si può cambiare livello?" },
      {
        type: "p",
        text: "Sì, prima o durante la partita: tocca **«Squadre e regole»** (sotto i pulsanti) e cambia la scelta in **«Quanto vuoi segnare?»**. **Quello che hai già segnato resta**: se passi da Con ricezioni al Base a metà set, le ricezioni segnate fino a quel momento restano nel tabellino e da lì in poi segni solo come finisce lo scambio.",
      },
      {
        type: "p",
        text: "Il livello di ogni partita si vede nell'elenco (la targhetta accanto a «In corso» o «Concluso»), in cima alla pagina della partita e nel tabellino. Le partite segnate prima dei livelli valgono come Base; quelle segnate con il vecchio livello **Completo** (ogni tocco della palla, che non c'è più) si leggono come **Con ricezioni**, con tutti i loro punti.",
      },
      {
        type: "callout",
        kind: "info",
        title: "E nella stagione?",
        text: `I totali di stagione sommano tutte le partite. Le colonne della ricezione contano però solo le partite in cui l'hai segnata: se alterni i livelli quei numeri sono parziali, e lo Scout te lo dice (${cap("stagione")}).`,
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
          "Va bene un **telefono** o un **tablet**. Il telefono in verticale è comodo per segnare con una mano sola; sul tablet, a schermo intero, hai insieme i pulsanti e il registro.",
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
          "Accanto, il livello scelto per quella partita (Con ricezioni; il Base non ha targhetta).",
          "«Segna i punti» per cominciare. Sulle partite già avviate trovi «Continua» o «Rivedi», il «Tabellino» e il «PDF».",
        ],
        maxHeight: 330,
      },
      {
        type: "p",
        text: "Tocca **Segna i punti**. La prima volta si apre la **preparazione**, in più parti una sotto l'altra: il livello, le giocatrici, la formazione in campo (facoltativa), l'avversaria e le regole. Non è obbligatorio compilare tutto, e puoi cambiare ogni cosa anche a partita iniziata.",
      },
      { type: "sub", title: "Il livello" },
      {
        type: "p",
        text: `In cima c'è **«Quanto vuoi segnare?»**: scegli **Base** o **Con ricezioni** (${cap("livelli")}). Di partenza è selezionato **Base**. Sul telefono, sotto ogni livello, **«Cosa segni e cosa ottieni»** si apre per leggere i dettagli.`,
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
          "**Ace e battuta sbagliata da soli**: sono sempre di chi batte, quindi non si chiede «chi?»: vanno alla giocatrice in posizione 1 della squadra che batte. Se non era lei (per esempio la rotazione era sbagliata), tocca **«Cambia»** accanto all'ultimo punto e scegli chi è stata: il punteggio non cambia. Se tocchi «Ace» per la squadra che non batte, lo Scout chiede «chi?» come sempre.",
          "**«Chi» dal campo**: la finestra «chi?» mostra il campo, con la rete in alto, davanti 4-3-2, dietro 5-6-1, la libero in scuro e il pallone verde su chi batte: tocchi la giocatrice dove sta. Chi è in panchina è sotto, più chiara. A muro la libero non si sceglie e la seconda linea è più chiara.",
          "**Cambi**: li registri con un pulsante, lo Scout conta quelli del set e ti avvisa se non sono regolari.",
          "**Tabellino**: in più trovi le formazioni di partenza di ogni set e i cambi; nel foglio (anche in PDF) c'è da dove è partita ognuna in ogni set.",
        ],
      },
      { type: "sub", title: "Come si scrive" },
      {
        type: "steps",
        items: [
          "Nella preparazione (o da **«Squadre e regole»** o dal pulsante **«Segui la formazione»** sotto i pannelli) trovi la scheda **«Formazione in campo»**.",
          "Nel campo **«Noi»** scegli chi gioca in ogni posizione, dalla **1** (chi batte) alla **6**, poi in senso orario. Nel campo **«Loro»** scrivi i numeri di maglia di seguito, premendo **Invio** per passare alla posizione dopo.",
          "Scegli la **libero** e le due **centrali** (le giocatrici che la libero sostituisce). Per le avversarie sono facoltative.",
          "Tocca **«Conferma la formazione»** (o direttamente **«Comincia a segnare i punti»**: la applica da sola). Se hai già preparato la formazione nella sezione **Partite** la trovi già scritta, con libero e centrali: **niente da riscrivere**.",
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
        text: `Tocca **«Cambio»** sotto la squadra: scegli **chi esce** (toccandola sul campo, dove sta davvero, con numero e nome) e **chi entra** (dalla panchina; per le avversarie puoi scrivere un numero nuovo), poi leggi il cambio a parole e tocca **«Conferma cambio»**. Chi entra continua la rotazione al posto di chi è uscita e, se era una delle due sostituite dalla libero, ne prende il ruolo. Lo Scout conta i cambi del set (${SUBSTITUTIONS_PER_SET} al massimo nel 6 contro 6) e li mostra anche nel registro, dove si possono togliere. Per cambiare la **libero** c'è **«Cambia la libero»** nella stessa finestra: non è un cambio ufficiale, quindi non conta tra gli ${SUBSTITUTIONS_PER_SET}. Se l'allenatore fa **rientrare la giocatrice sostituita dalla libero**, nella stessa finestra tocca **«Rientra …»** (con il suo numero): la libero esce e resta fuori anche quando si ruota, e sotto il campo compare **«Libero fuori»**. Quando la libero torna in campo tocca lì **«Rientra»**: riprende il posto della centrale in seconda linea. Neanche questo conta tra i cambi, e il set dopo riparte con la libero.`,
      },
      {
        type: "image",
        file: "formazione-cambio.png",
        caption: "La finestra del cambio.",
        legend: [
          "Chi esce: il campo, con numero e nome di chi c'è in ogni posizione (la libero compare dove sostituisce).",
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
      { type: "sub", title: "Rotazione sbagliata?" },
      {
        type: "p",
        text: "Se una rotazione è saltata (o ne hai segnata una di troppo) la squadra in campo non è più quella vera. Tocca **«Rotazione»** sotto la squadra: con **«Indietro»** e **«Avanti»** scegli di quante posizioni girare (anche più di una), guardi nel disegno come starà la squadra e tocchi **«Applica»**. Cambia **solo chi sta in ogni posizione**: punteggio, chi batte, cambi e time-out restano come sono. Se in realtà manca uno scambio, il punteggio si corregge dal registro.",
      },
      {
        type: "bullets",
        items: [
          "Toccare più volte la stessa squadra somma i passi in una sola correzione; se si annullano (per esempio avanti di 2 e poi indietro di 2) spariscono.",
          "A set già cominciato la correzione compare nel registro, sopra gli scambi del set, con il cestino per toglierla; **«Annulla ultimo»** toglie l'ultima. Le rotazioni del tabellino la seguono.",
          "Prima del primo punto di un set vale come correzione della formazione di partenza.",
        ],
      },
      { type: "sub", title: "Set dopo set" },
      {
        type: "bullets",
        items: [
          "A ogni nuovo set si apre da sola la finestra **«Formazione del 2° set»** (e così via): è già scritta come l'hai preparata in **Partite** per quel set o, se manca, **come la formazione con cui aveva cominciato** il set prima, con la libero ricalcolata. Se non cambia niente tocca **«Conferma e comincia»**.",
          "Per cambiarla correggi le posizioni prima di confermare: **«Come nel set precedente»** e **«Usa la formazione salvata»** riportano indietro. Il pulsante **«Formazione»** della striscia «In campo» la riapre quando vuoi.",
          "Se la scrivi **a set cominciato** è una correzione: sistema chi è in campo adesso (le rotazioni fatte restano) senza cambiare la formazione di partenza.",
          "**«Annulla ultimo»** toglie un cambio appena fatto, ma **mai una formazione**: anche se lo premi per sbaglio subito dopo averle scritte, le formazioni restano. Si cambiano solo dalla loro scheda (o con «Non seguire la formazione»).",
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
        text: `Questo capitolo spiega il modo di segnare del livello **Base**, che resta sempre disponibile: con **Con ricezioni** lo usi per il punto, dopo aver segnato la ricezione (${cap("ricezioni")}).`,
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
          "Da che parte è la palla (vedi più sotto).",
          "«Punto nostro»: i punti di Volley Lignano.",
          "«Punto loro»: i punti delle avversarie.",
          "L'ultimo punto segnato e «Annulla ultimo».",
        ],
        maxHeight: 380,
      },
      { type: "sub", title: "Da che parte è la palla" },
      {
        type: "p",
        text: "Sopra i pulsanti per segnare c'è una fascia che è il **campo visto dall'alto**: **Noi** a sinistra, **Loro** a destra, la rete in mezzo. All'inizio di ogni scambio la **palla** sta dalla parte di chi ha la battuta; con le ricezioni, quando segni la nostra ricezione, passa dalla nostra parte. Sotto c'è scritto **Palla nostra** o **Palla loro**. La stessa palla si accende sul tabellone, accanto al nome della squadra, e la fascia resta in vista mentre scorri fino ai pulsanti.",
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
        text: "Dopo il modo si apre un elenco con i **numeri di maglia** (per le nostre anche il nome). Tocca il numero giusto e il punto è registrato. Se hai scritto la formazione in campo, al posto dell'elenco vedi il **campo**: tocca la giocatrice dove sta (davanti 4-3-2, dietro 5-6-1, la panchina è sotto). Si chiede solo per le nostre giocatrici.",
      },
      {
        type: "p",
        text: "**Per l'avversaria lo Scout non chiede mai chi.** I loro punti (attacco, muro, ace) e i loro errori si registrano subito, con un solo tocco: contano per la squadra. Dopo un loro muro, se vuoi, dici chi delle nostre attaccava (facoltativo, serve agli attacchi murati del tabellino). Se vuoi indicare una loro giocatrice lo stesso, correggi lo scambio dal Registro (la matita) e scegli il numero.",
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
          ["La n. 7 batte e la palla cade a terra.", "Punto nostro > Ace > n. 7 (se segui la formazione basta «Ace»: è di chi batte)"],
          ["La n. 9 schiaccia e fa punto.", "Punto nostro > Attacco > n. 9"],
          ["La loro n. 11 schiaccia e fa punto.", "Punto loro > Attacco (e basta: per loro non chiede chi)"],
          ["La n. 3 ferma l'attacco della loro n. 12.", "Punto nostro > Muro > n. 3"],
          ["La loro n. 5 mura la nostra n. 9.", "Punto loro > Muro > n. 9 (chi delle nostre attaccava, facoltativo)"],
          ["La loro n. 4 attacca fuori.", "Punto nostro > Errore loro > Attacco sbagliato (e basta)"],
          ["La loro battuta finisce in rete.", "Punto nostro > Errore loro > Battuta sbagliata (e basta)"],
          ["Battiamo fuori.", "Punto loro > Errore nostro > Battuta sbagliata > la giocatrice che ha battuto (con la formazione va da sola a chi batte)"],
          ["L'arbitro fischia doppia a una nostra giocatrice.", "Punto loro > Errore nostro > Doppia > la giocatrice"],
          ["L'arbitro fischia rotazione sbagliata a loro.", "Punto nostro > Errore loro > Rotazione / posizione (nessuna giocatrice)"],
        ],
        keepTogether: true,
      },
      { type: "sub", title: "L'ultimo punto e «Annulla ultimo»" },
      {
        type: "p",
        text: "Sotto i pannelli una riga riassume l'ultimo punto, per esempio «Ultimo: 12-10 · punto nostro · Attacco · n. 7». Se hai toccato il pulsante sbagliato, **«Annulla ultimo»** toglie l'ultimo scambio e il punteggio torna indietro. Puoi premerlo più volte di seguito. Se segui la formazione e l'ultimo punto è un ace o una battuta sbagliata assegnati da soli a chi batte, accanto c'è **«Cambia»**: se non era lei, tocchi chi è stata e il punteggio resta com'è.",
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
        text: `Il livello **Con ricezioni** è il Base con **una cosa in più**: quando batte l'avversaria, segni anche la **nostra ricezione**. Appena battono loro si apre da sola la finestra **«Ricezione nostra»**, come quelle dei pulsanti dei punti: se segui la formazione in campo a sinistra c'è il **campo**, dove tocchi chi ha ricevuto, a destra i **voti** grandi. Segnata la ricezione la finestra si chiude e il punto lo segni come nel Base (${cap("segnare")}). Se non vuoi segnarla tocca **«Salta la ricezione»** (o premi **Esc**): la finestra si chiude e in pagina resta la riga **«Ricezione nostra»**, con il pulsante **«Segna la ricezione»** per riaprirla.`,
      },
      {
        type: "images",
        items: [
          { file: "ricezione-striscia.png", caption: "La finestra «Ricezione nostra», quando battono loro." },
          { file: "ricezione-segnata.png", caption: "Dopo il voto: la finestra si chiude, la ricezione è segnata e il punto si segna come sempre." },
        ],
        legend: [
          "Chi ha ricevuto: tocca la giocatrice sul campo (o il numero di maglia). «Non so» e la panchina sono sotto.",
          "Il voto: da # perfetta a = errore.",
          "La zona dove ha ricevuto (facoltativa).",
          "«Salta la ricezione» chiude la finestra: segni solo il punto.",
          "La ricezione appena segnata: chi, con che voto e la zona.",
          "«Cambia» toglie la ricezione, per rifarla.",
          "I pulsanti dei punti, come nel livello Base.",
        ],
        maxHeight: 380,
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
      { type: "sub", title: "I voti della ricezione" },
      { type: "grades", skill: "reception" },
      {
        type: "p",
        text: "Pensa all'alzatrice: il voto dice **quante scelte ha** dopo la ricezione. Più importante della precisione è essere **sempre uguali**: scegli il voto con lo stesso criterio per tutta la stagione, così i confronti tra le partite hanno senso.",
      },
      { type: "sub", title: "Quando lo scambio si chiude da solo" },
      {
        type: "p",
        text: "Il voto **=** (errore) vuol dire che la ricezione è stata toccata e la palla è finita fuori o a terra: lo scambio **si chiude da solo** con il punto per loro, senza toccare altro. Con tutti gli altri voti lo scambio resta aperto, la finestra si chiude e in pagina compare **«Ricezione segnata»**: ora segni il punto con i pulsanti qui sotto, come nel Base.",
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
        text: `Segna la ricezione **prima** del punto: la finestra si apre da sola per questo. Appena tocchi un pulsante dei punti lo scambio si chiude e si passa al successivo. Se l'hai saltata, puoi aggiungerla dopo dal registro (${cap("correggere")}).`,
      },
      { type: "sub", title: "Quando batte la nostra squadra" },
      {
        type: "p",
        text: "La finestra non si apre e il riquadro in pagina dice che batte la nostra squadra: la ricezione si segna solo quando battono loro, e solo la nostra.",
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
          ["La loro battuta cade a terra e nessuna la tocca.", "Niente ricezione: Punto loro > Ace > il numero di chi batte (con la loro formazione basta «Ace»)"],
        ],
        keepTogether: true,
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
        text: "Con il livello **Con ricezioni**, sotto lo scambio compare anche la **ricezione** segnata, in una pastiglia: la lettera **R**, il **numero di maglia** di chi ha ricevuto e il **voto** colorato.",
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
      { type: "sub", title: "Correggere la ricezione" },
      {
        type: "p",
        text: "Negli scambi con la ricezione la stessa finestra mostra **chi** ha ricevuto, il **voto** e la **zona**: li puoi cambiare. Il voto si cambia solo tra voti che hanno lo stesso effetto sullo scambio (una ricezione sbagliata resta sbagliata, le altre restano in gioco): per cambiare chi fa punto, togli lo scambio e segnalo di nuovo. Il cestino accanto alla ricezione la toglie, tranne se è quella sbagliata che ha chiuso lo scambio.",
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
        text: "**«Annulla ultimo»** toglie sempre l'ultima cosa che hai segnato: uno scambio, la chiusura di un set, un time-out e, con le ricezioni, anche la ricezione appena segnata. Puoi premerlo più volte di seguito.",
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
    summary: "Rete assente, server che non risponde, due telefoni, pagina chiusa per sbaglio: non perdi niente.",
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
          ["Senza rete", "Internet non c'è: i punti restano sul dispositivo.", "Continua a segnare e non chiudere la scheda. Partono da soli quando torna la rete (o tocca «Riprova adesso»)."],
          ["Da risolvere", "Due dispositivi hanno segnato cose diverse negli stessi momenti.", "Scegli quale versione tenere (vedi sotto): l'altra resta nelle copie."],
          ["Non salvato", "La sessione è scaduta o l'accesso è stato tolto.", "Accedi di nuovo (anche da un'altra scheda): le modifiche restano sul dispositivo e partono da sole."],
        ],
        keepTogether: true,
      },
      {
        type: "p",
        text: "Se il salvataggio non va, sopra i pulsanti compare un **avviso giallo** che dice quanti scambi sono ancora **solo su questo dispositivo**. Compare anche quando il server non risponde da più di venti secondi, anche senza errori. Non chiudere la pagina e non azzerare lo scout finché non torna **«Salvato»**. Intanto puoi toccare **«Riprova adesso»** o **«Scarica una copia»**: è un file con tutta la partita, al sicuro fuori dal sito.",
      },
      {
        type: "p",
        text: "Se una richiesta resta appesa, lo Scout la interrompe da solo dopo una ventina di secondi e riprova. Se il server aveva già ricevuto i punti ma la risposta si è persa, non devi fare niente: al tentativo dopo lo Scout se ne accorge e va avanti.",
      },
      { type: "sub", title: "Se due dispositivi toccano la stessa partita" },
      {
        type: "p",
        text: "Se un altro telefono (o un'altra scheda) ha salvato nel frattempo, lo Scout guarda cosa è cambiato. Se uno dei due ha solo scambi **in più** dell'altro, o se hanno segnato in **momenti diversi** (uno dopo l'altro), le due versioni **si uniscono da sole** e non ti chiede niente. Solo se hanno segnato **cose diverse negli stessi momenti** compare la finestra **«Questa partita è stata modificata altrove»**, con il riepilogo delle due versioni: scegli **«Usa quella salvata»** oppure **«Tieni la mia»**. La versione che non scegli **non va persa**: resta nelle copie di questo dispositivo.",
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
      { type: "sub", title: "La copia di sicurezza" },
      {
        type: "p",
        text: "Il dispositivo mette da parte da solo una copia dello scout **a ogni set chiuso** e **ogni volta che una versione viene sostituita o scartata** (una scelta nella finestra «modificata altrove», un'unione, un ripristino, un azzeramento). Le trovi in **«Squadre e regole», poi «Copia di sicurezza»**, con data e riepilogo, e le rimetti con **«Ripristina»**: quello che c'era prima resta a sua volta tra le copie. Lì c'è anche **«Scarica una copia»** (un file) e **«Ripristina da file»** per rimetterlo, anche su un altro dispositivo.",
      },
      {
        type: "callout",
        kind: "tip",
        text: "Hai azzerato lo scout o scelto la versione sbagliata? Apri **«Squadre e regole», poi «Copia di sicurezza»** dallo **stesso dispositivo** e ripristina la copia. Non cancellare i dati del sito dal browser prima di averlo fatto.",
      },
      { type: "sub", title: "Se la pagina si chiude o il telefono si spegne" },
      {
        type: "p",
        text: "Riapri lo Scout e tocca **«Continua»** sulla partita. Quello che era già salvato c'è; le modifiche rimaste a metà sono conservate nel telefono e vengono recuperate in automatico, e se nel frattempo il server ha salvato qualcosa le due versioni si uniscono. Solo se hanno segnato cose diverse negli stessi momenti compare la finestra di scelta. Mentre la partita è in corso lo schermo **resta acceso da solo** (dove il telefono lo permette), così non devi riattivarlo a ogni pausa.",
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
      { type: "sub", title: "La diretta video prima del via" },
      {
        type: "p",
        text: "Se mandate la partita in video con la grafica del sito (Streamlabs, OBS o la pagina /diretta), prima del fischio d'inizio la grafica segue l'**orario della partita**. A te resta un tasto solo: **«Inizia il riscaldamento»**, nella preparazione (sotto l'interruttore del punteggio live) o tra i pulsanti sotto i pannelli. Si vede solo con il live acceso e prima del primo punto.",
      },
      {
        type: "table",
        columns: [
          { header: "Quando", weight: 4 },
          { header: "Cosa va in onda", weight: 7 },
        ],
        rows: [
          ["Live acceso, tasto non ancora premuto", "La **copertina** a schermo intero: Lignano contro l'avversaria. La telecamera non si vede."],
          ["Dal tasto a 15 minuti prima", "Il video, con in alto il banner **«Riscaldamento in corso»**, le squadre e l'ora d'inizio. Niente punteggio."],
          ["Da 15 a 5 minuti prima", "Il banner **«Inizio riscaldamento ufficiale»**. Niente punteggio."],
          ["Da 5 a 1 minuto prima", "La **presentazione** della partita e la **formazione** di partenza."],
          ["Da 1 minuto prima, o dal primo punto", "La barra con il **punteggio**, i time-out, i cambi: si gioca."],
        ],
        keepTogether: true,
      },
      {
        type: "p",
        text: "Premuto per sbaglio o troppo presto? **«Torna alla copertina»** accanto all'ora del riscaldamento. Se ti dimentichi il tasto, la barra arriva comunque da 1 minuto prima. Senza l'orario della partita, dopo il tasto resta il riscaldamento fino al primo punto.",
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
    summary: "Il tabellino come quelli delle leghe, poi le analisi della partita.",
    blocks: [
      {
        type: "p",
        text: `Dall'elenco delle partite, o dal pulsante **Tabellino** in alto nella pagina della partita, apri il tabellino. Funziona anche **mentre si gioca**: fino alla fine i numeri sono provvisori. Quello che contiene dipende dal **livello** della partita (${cap("livelli")}).`,
      },
      {
        type: "p",
        text: "In cima c'è **il tabellino**, fatto come quelli delle leghe: si legge allo stesso modo e si confronta con quelli ufficiali. Sotto ci sono **le analisi** della partita.",
      },
      {
        type: "image",
        file: "tabellino-foglio.png",
        caption: "La parte alta del tabellino.",
        legend: [
          "Il campionato, le due squadre e i set vinti. È il risultato calcolato con lo Scout, non quello ufficiale.",
          "Data, orario, impianto, gara (campionato, amichevole o torneo, in casa o in trasferta) e livello dello Scout.",
          "I set: durata stimata, **parziali** (il punteggio quando una delle due arriva a 8, 16 e 21) e finale; in fondo il totale.",
        ],
        maxHeight: 170,
      },
      { type: "sub", title: "Le giocatrici" },
      {
        type: "p",
        text: "Una tabella per squadra, con **tutta la rosa** in ordine di maglia (L = libero). Lo zero si scrive con un punto **.** come nei tabellini ufficiali; il trattino **-** vuol dire che a quel livello quella cosa non si segna.",
      },
      {
        type: "image",
        file: "tabellino-giocatrici.png",
        caption: "La tabella di una squadra (livello Base, seguendo la formazione).",
        legend: [
          "**Set**: da dove è partita in ogni set (1 = in battuta); il rettangolo: è entrata dopo, o è la libero.",
          "Punti, battuta, ricezione, attacco e muro di ogni giocatrice.",
          "**Totali giocatrici**: la somma della squadra.",
          "**Punti vinti** set per set: ace (Bat), attacco (Att), muro (Mu), errori dell'avversaria (Er.Av), e gli altri numeri del set.",
        ],
        maxHeight: 140,
      },
      { type: "legend", level: "base" },
      {
        type: "p",
        text: "Con **Con ricezioni** si riempiono anche le colonne della ricezione (le nostre):",
      },
      { type: "legend", level: "ricezioni", onlyNew: true },
      { type: "sub", title: "Rotazioni, ricezioni e battute" },
      {
        type: "image",
        file: "tabellino-riepilogo.png",
        caption: "In fondo al tabellino, per ogni squadra; in mezzo, con le ricezioni, il cambio palla dopo la ricezione.",
        legend: [
          "In ogni **rotazione** (la 1ª è quella con cui comincia il set) i punti fatti meno quelli persi.",
          "**Ricezioni** e punti in cambio palla (**CP**): quante ricezioni servono per un punto. **Battute** e **break point** (**BP**): quante battute servono per un punto in battuta.",
          "A livello Con ricezioni, il **cambio palla dopo la ricezione**: quante volte si vince lo scambio dopo una ricezione positiva (# e +) o negativa (!, - e /).",
        ],
        maxHeight: 135,
      },
      { type: "sub", title: "Le analisi" },
      {
        type: "image",
        file: "tabellino-alto.png",
        caption: "Sotto il tabellino cominciano le analisi.",
        legend: [
          "Il selettore: tutta la partita oppure un solo set. Le analisi sotto si ricalcolano.",
          "Il livello della partita: Base o Con ricezioni.",
          "I quattro numeri chiave: break point, cambio palla, serie di punti più lunga, errori commessi.",
        ],
        maxHeight: 120,
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
      { type: "sub", title: "La ricezione (livello Con ricezioni)" },
      {
        type: "p",
        text: "Se hai segnato le ricezioni compare la scheda **«La ricezione»**: com'è andata ogni ricezione della squadra, con il voto che hai segnato. Se in una partita di questo livello non ne hai segnata nessuna, al suo posto c'è un avviso.",
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
      {
        type: "callout",
        kind: "info",
        title: "Parziali diversi da «Partite»",
        text: "Se hai già scritto i parziali in **Partite** e sono diversi da quelli dello Scout, il tabellino mostra un avviso: controlla quale dei due è giusto.",
      },
      { type: "sub", title: "Il PDF" },
      {
        type: "p",
        text: "**Scarica PDF** (in alto nel tabellino, e accanto a ogni partita nell'elenco) crea il tabellino da stampare: il **foglio** come quelli delle leghe, in A4 verticale, sempre su tutta la partita (con rose molto lunghe continua su una seconda pagina). Le analisi restano nella pagina del tabellino. **Condividi PDF** (accanto) lo manda come file: dal telefono si apre il foglio di condivisione con il PDF già allegato, dal computer il file si scarica.",
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
        text: "Se almeno una partita è a livello **Con ricezioni**, compare anche **«La ricezione, in stagione»** (ricezioni, barra della squadra e di ogni giocatrice, cambio palla per voto) e la tabella delle giocatrici ha le colonne della ricezione. Quelle colonne **contano solo le partite in cui hai segnato le ricezioni**: una nota in fondo dice quante sono, perché punti ed errori invece sommano tutte le partite. La mappa della ricezione resta nel tabellino di ogni partita.",
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
        text: `Se è la prima volta, il **Base**. Quando hai preso confidenza, **Con ricezioni** (${cap("livelli")}).`,
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
        text: `Lo dice la fascia sopra i pulsanti, il campo visto dall'alto con «Noi» a sinistra e «Loro» a destra: la palla è dalla parte di **Palla nostra** o **Palla loro**. Si accende anche sul tabellone (${cap("segnare")}).`,
      },
      { type: "sub", title: "Ho segnato un punto alla squadra sbagliata." },
      { type: "p", text: "Se è l'ultimo, **«Annulla ultimo»**. Se è più indietro, trovi lo scambio nel **registro** e tocchi la matita: cambi squadra o modo, oppure lo togli." },
      { type: "sub", title: "Ho dimenticato di segnare una ricezione." },
      { type: "p", text: "Dal **registro**: tocca la matita sullo scambio e poi **«Aggiungi la ricezione»**. Se sei ancora nello stesso scambio, la segni dalla finestra «Ricezione nostra» (o dal pulsante «Segna la ricezione») prima del punto." },
      { type: "sub", title: "Perché nel tabellino mancano alcune ricezioni?" },
      {
        type: "p",
        text: "Perché lo Scout conta solo le ricezioni che hai segnato: se in uno scambio l'hai saltata, quella ricezione non compare. A livello Base, poi, si contano solo quelle sbagliate. Gli attacchi tentati (anche quelli difesi) non si segnano a nessun livello: contano solo quelli che chiudono lo scambio.",
      },
      { type: "sub", title: "La mappa e le rotazioni sono precise?" },
      {
        type: "p",
        text: "La mappa conta solo le ricezioni con la zona. Le rotazioni si ricavano dall'ordine delle battute: la 1ª è quella con cui comincia il set e si passa alla successiva ogni volta che la squadra recupera la battuta. Senza la formazione sono indicative (non sai chi c'è in ogni rotazione) e confrontabili se parti sempre con la stessa formazione; con la formazione sono esatte e il tabellino elenca anche chi c'era in campo.",
      },
      { type: "sub", title: "Il punteggio dello Scout non coincide con quello dell'arbitro." },
      { type: "p", text: "Significa che uno scambio è mancante o in più. Scorri il registro dall'ultimo scambio: di solito si trova guardando i punteggi riga per riga. Prima di correggere, controlla con l'arbitro quale dei due è giusto." },
      { type: "sub", title: "Non conosco i numeri dell'avversaria." },
      { type: "p", text: "Non servono: per l'avversaria lo Scout non chiede mai chi, né sui suoi punti né sui suoi errori. Si segnano con un tocco solo e contano per la squadra. Se segui la loro formazione, scrivi i numeri nella scheda «Formazione in campo»." },
      { type: "sub", title: "Posso segnare con due telefoni insieme?" },
      { type: "p", text: "È meglio di no. Se segnano in momenti diversi le due versioni si uniscono da sole; se segnano le stesse cose lo Scout ti chiede quale versione tenere (l'altra resta nelle copie di sicurezza, ma gli scambi doppi vanno puliti a mano). Segna con un solo dispositivo; gli altri guardano il tabellino." },
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
          "Scegli **chi**: il numero di maglia (o «Non so»). Con la formazione, ace e battuta sbagliata vanno da soli a chi batte (se non era lei: «Cambia» sull'ultimo punto).",
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
          "Quando battono loro si apre da sola la finestra **Ricezione nostra**: tocca **chi** ha ricevuto (sul campo, se segui la formazione) e, se vuoi, la **zona**, poi il **voto**.",
          "Con **=** il punto va a loro da solo; con gli altri voti segna il punto come nel Base.",
        ],
      },
      // Retro della scheda: i voti della ricezione e le sigle.
      { type: "pageBreak" },
      { type: "sub", title: "I voti della ricezione" },
      { type: "grades", skill: "reception" },
      {
        type: "callout",
        kind: "tip",
        title: "Se sbagli",
        text: "**Annulla ultimo** toglie l'ultima cosa segnata (un punto, una ricezione o un time-out). Per uno scambio più vecchio: **Registro > matita**.",
      },
      {
        type: "callout",
        kind: "warning",
        title: "Fine set e senza rete",
        text: "A fine set scegli chi batte per primo nel set dopo e tocca **Chiudi il set**. Senza rete continua a segnare e non chiudere la scheda: i punti partono da soli quando torna internet (la targhetta in alto torna a «Salvato»). Ogni set chiuso lascia una copia nel dispositivo («Squadre e regole», poi «Copia di sicurezza»).",
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
          ["Pos% / Prf%", "Ricezioni positive (# e +) e perfette (#) sulle ricezioni segnate."],
        ],
        keepTogether: true,
      },
    ],
  },
];
