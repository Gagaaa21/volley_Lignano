/**
 * Il manuale d'uso dello Scout (PDF scaricabile dall'area riservata). Il testo
 * sta qui, in una forma semplice da rileggere e correggere; src/lib/pdf/
 * scoutManualPdf.ts lo impagina. Le schermate stanno in src/assets/pdf/
 * scout-manual e sono quelle dell'app vera, con i punti numerati.
 *
 * Il PDF usa un font ridotto al Latin-1: niente trattini lunghi, puntini di
 * sospensione, apici curvi o frecce (un test controlla che il testo sia pulito).
 * Nel testo «**così**» è grassetto.
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
  /** Il glossario, ordinato per termine. */
  | { type: "glossary" };

export interface ManualChapter {
  id: string;
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
  { term: "Alzata", text: "Il secondo tocco, di solito, che prepara l'attacco. Si segna solo se è sbagliata (alzata fuori o in rete)." },
  { term: "Attacco", text: "Il colpo con cui si cerca di mandare la palla a terra nel campo avversario. Punto se la palla cade a terra, errore se va fuori, in rete o sull'antenna." },
  { term: "Break point (BP)", text: "Punto fatto mentre la propria squadra batteva. La percentuale dice su 100 battute quante finiscono con un punto." },
  { term: "Cambio palla (side-out)", text: "Punto fatto da chi stava ricevendo: la squadra conquista la battuta. La percentuale dice su 100 ricezioni quante finiscono con un punto subito." },
  { term: "Difesa", text: "Il recupero di un attacco avversario. Si segna solo se è sbagliata (palla a terra o fuori)." },
  { term: "Doppia", text: "Fallo: la stessa giocatrice tocca la palla due volte di seguito." },
  { term: "Errore", text: "Un'azione sbagliata che regala il punto all'altra squadra (battuta, ricezione, attacco, muro, alzata o difesa sbagliati)." },
  { term: "Fallo", text: "Un'infrazione fischiata dall'arbitro: tocco di rete, invasione, doppia, trattenuta, quattro tocchi, rotazione. Il punto va all'altra squadra." },
  { term: "Invasione", text: "Fallo: una giocatrice supera la linea centrale o passa sotto la rete e interferisce con il gioco." },
  { term: "Libero", text: "Giocatrice con la maglia di colore diverso, specializzata in difesa e ricezione. Non può murare né tentare di murare." },
  { term: "Muro", text: "L'azione delle giocatrici davanti alla rete che cercano di fermare l'attacco avversario. Punto se la palla cade nel campo di chi attaccava." },
  { term: "Quattro tocchi", text: "Fallo: la squadra tocca la palla quattro volte prima di mandarla di là." },
  { term: "Ricezione", text: "Il primo tocco dopo la battuta avversaria. Si segna solo se è sbagliata (palla toccata che va fuori o a terra)." },
  { term: "Rotazione", text: "Dopo aver recuperato la battuta, le giocatrici cambiano posizione in senso orario. Sbagliare l'ordine di battuta o la posizione è un fallo di squadra." },
  { term: "Sanzione", text: "Penalità dell'arbitro (cartellino) che assegna il punto all'avversaria." },
  { term: "Scambio", text: "Dalla battuta al punto assegnato: lo Scout ne registra uno alla volta. Si chiama anche azione o rally." },
  { term: "Set", text: "Una parte della partita: vince chi arriva per primo a 25 punti con almeno due di scarto (15 nel set decisivo)." },
  { term: "Tocco di rete", text: "Fallo: una giocatrice tocca la rete mentre gioca la palla." },
  { term: "Trattenuta", text: "Fallo: la palla non rimbalza ma viene accompagnata o trattenuta." },
  { term: "V-P", text: "Punti fatti meno errori e attacchi murati: dice se una giocatrice ha dato più di quanto ha tolto." },
];

export const SCOUT_MANUAL: ManualChapter[] = [
  {
    id: "due-minuti",
    title: "Lo Scout in due minuti",
    summary: "Che cos'è, cosa ti dà e cosa non fa.",
    blocks: [
      {
        type: "p",
        text: "Lo **Scout** serve a registrare una partita **punto per punto**. Per ogni scambio tu dici due cose: **come è finito** (un attacco, un muro, un ace, oppure un errore dell'altra squadra) e **chi** ha compiuto l'azione. Tutto il resto lo ricava lo Scout da solo: il punteggio, i set, a chi tocca battere, i break point.",
      },
      {
        type: "p",
        text: "È il lavoro che fanno gli scoutman dei campionati ufficiali con i programmi come Data Volley, ridotto all'essenziale: due tocchi per un punto normale, tre per un errore.",
      },
      { type: "sub", title: "Cosa ottieni" },
      {
        type: "bullets",
        items: [
          "**Il tabellino della partita**: per ogni giocatrice i punti, gli ace, gli errori, gli attacchi e i muri (capitolo 9).",
          "**Le statistiche di squadra**: punti in battuta (break point), cambio palla (side-out), serie di punti più lunga, errori commessi, sempre a confronto con le avversarie.",
          "**Il grafico dell'andamento** del punteggio, scambio dopo scambio.",
          "**Il PDF** del tabellino, da stampare o mandare.",
          "**I totali di stagione** della squadra e di ogni giocatrice (capitolo 10).",
          "**Il punteggio live** sul sito della squadra, se lo vuoi (capitolo 8).",
        ],
      },
      { type: "sub", title: "Cosa non fa" },
      {
        type: "bullets",
        items: [
          "Non registra ogni tocco della palla, ma solo **come finisce lo scambio**. Per questo nei tabellini mancano gli attacchi tentati, le ricezioni totali e le percentuali di attacco e di ricezione che si vedono nei tabellini di Lega.",
          "Non sostituisce il **referto ufficiale** della gara: il risultato dello Scout è un riferimento della società e non è ufficiale.",
          "Non segue le rotazioni né le sostituzioni: non servono per ricavare queste statistiche.",
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
        text: "Due scelte per ogni scambio. **1)** Chi ha fatto punto, e come. **2)** Chi ha compiuto l'azione. Tutto il resto è automatico.",
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
          "Va bene un **telefono** o un **tablet**. Il telefono in verticale è comodo per segnare con una mano sola.",
          "Carica la batteria: durante la partita lo schermo resta acceso da solo, dove il telefono lo permette.",
          "La **rete** non è indispensabile: se cade, continui a segnare e i punti partono appena torna (capitolo 7). Meglio comunque aprire la partita quando c'è connessione.",
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
        text: "Entra nell'area riservata e tocca **Scout** nel menu. Vedi l'elenco delle partite: sopra «Oggi e prossime partite», sotto quelle già giocate. A ogni riga una targhetta dice a che punto sei: **Da segnare**, **In corso** (con il set e il punteggio) o **Concluso** (con il risultato in set).",
      },
      {
        type: "image",
        file: "hub-partite.png",
        caption: "L'elenco delle partite dello Scout.",
        legend: [
          "«Manuale d'uso (PDF)»: scarica questo manuale.",
          "«Partite» e «Stagione»: le due viste dello Scout.",
          "La targhetta dice a che punto è la partita: Da segnare, In corso o Concluso.",
          "«Segna i punti» per cominciare. Sulle partite già avviate trovi «Continua» o «Rivedi», il «Tabellino» e il «PDF».",
        ],
        maxHeight: 330,
      },
      {
        type: "p",
        text: "Tocca **Segna i punti**. La prima volta si apre la **preparazione**, in tre parti una sotto l'altra. Non è obbligatorio compilare tutto, e puoi cambiare ogni cosa anche a partita iniziata.",
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
        text: "In fondo alla preparazione c'è l'interruttore **«Mostra il punteggio sul sito pubblico»**: se lo accendi, chi apre il sito della squadra vede la partita in diretta (capitolo 8). Lasciandolo spento non succede niente.",
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
        text: "Tocca **«Comincia a segnare i punti»**: al posto della preparazione compaiono i pulsanti per segnare. La preparazione resta sempre raggiungibile da **«Squadre e regole»**.",
      },
    ],
  },
  {
    id: "segnare",
    title: "Segnare un punto",
    summary: "Il cuore dello Scout: come si segna uno scambio, con tutti i casi.",
    blocks: [
      { type: "sub", title: "Il tabellone" },
      {
        type: "p",
        text: "In alto c'è il tabellone, sempre su sfondo scuro: il **set in corso** (per esempio «1° set a 25»), i **set vinti**, il **punteggio** e, sotto il nome di chi sta battendo, la scritta **«Batte»**. Il punteggio non lo scrivi mai: cresce da solo a ogni punto.",
      },
      {
        type: "image",
        file: "partita-pannelli.png",
        caption: "La pagina della partita: il tabellone e i due pannelli per segnare.",
        legend: [
          "Il set in corso e i set vinti.",
          "Il punteggio: «Noi» a sinistra, «Loro» a destra. Sotto, «Batte» indica chi serve.",
          "«Punto nostro»: i punti fatti da Volley Lignano.",
          "«Punto loro»: i punti delle avversarie.",
          "L'ultimo punto segnato e «Annulla ultimo».",
        ],
        maxHeight: 400,
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
        text: "Dopo il modo si apre un elenco con i **numeri di maglia** (per le nostre anche il nome). Tocca il numero giusto e il punto è registrato. Per l'avversaria puoi scrivere un numero che non c'è nella casella **«Altro numero di maglia»** e toccare Aggiungi.",
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
    ],
  },
  {
    id: "fine-set",
    title: "Fine del set e della partita",
    summary: "Quando e come si chiude un set, e come finisce la partita.",
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
        maxHeight: 330,
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
        maxHeight: 300,
      },
      {
        type: "p",
        text: "Il punteggio, i set e le battute di **tutti gli scambi successivi** si ricalcolano da soli: non devi sistemare nient'altro.",
      },
      {
        type: "callout",
        kind: "warning",
        text: "Se togli o cambi uno scambio vecchio, il punteggio di tutta la partita cambia. Quando il punteggio non torna con quello dell'arbitro, cerca nel registro lo scambio che manca o quello di troppo.",
      },
      { type: "sub", title: "Cambiare squadre e regole in corsa" },
      {
        type: "p",
        text: "**«Squadre e regole»** (sotto i pulsanti) riapre la preparazione: puoi aggiungere una giocatrice entrata a partita iniziata, cambiare un numero, aggiungere un numero all'avversaria o correggere le regole. Una giocatrice che compare già in qualche scambio **non si può togliere** dalla rosa (se serve, prima correggi o togli quegli scambi); puoi invece cambiarle il numero.",
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
        text: "Se lo accendi, chi apre il sito della squadra vede un riquadro **«In diretta»** con le due squadre, il punteggio del set, i set vinti, chi batte e i set già chiusi. È il **punteggio**, niente di più.",
      },
      {
        type: "image",
        file: "live-banner.png",
        caption: "Il riquadro «In diretta» sul sito pubblico, come si vede dal telefono.",
        maxWidth: 380,
      },
      { type: "sub", title: "Cosa si vede e cosa no" },
      {
        type: "table",
        columns: [
          { header: "", weight: 2 },
          { header: "Cosa", weight: 8 },
        ],
        rows: [
          ["Si vede", "I nomi delle due squadre, il punteggio del set, i set vinti e quelli chiusi, chi batte e la scritta «Risultato non ufficiale» (con l'ora dell'ultimo aggiornamento, se il punteggio si ferma da più di 3 minuti)."],
          ["Non si vede mai", "I nomi o i numeri di maglia delle giocatrici, chi ha fatto punto e come, gli errori, il tabellino, le formazioni."],
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
        text: "Dall'elenco delle partite, o dal pulsante **Tabellino** in alto nella pagina della partita, apri il tabellino. Funziona anche **mentre si gioca**: fino alla fine i numeri sono provvisori.",
      },
      {
        type: "image",
        file: "tabellino-alto.png",
        caption: "La parte alta del tabellino.",
        legend: [
          "Il risultato in set e i parziali, con la durata stimata di ogni set. Non è il risultato ufficiale.",
          "Il selettore: tutta la partita oppure un solo set.",
          "I quattro numeri chiave: break point, cambio palla, serie di punti più lunga, errori commessi.",
        ],
        maxHeight: 380,
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
      { type: "sub", title: "La tabella delle giocatrici" },
      {
        type: "image",
        file: "tabellino-giocatrici.png",
        caption: "La tabella di una squadra: una riga per giocatrice.",
        maxHeight: 300,
      },
      {
        type: "table",
        columns: [
          { header: "Sigla", weight: 2 },
          { header: "Cosa significa", weight: 8 },
        ],
        rows: [
          ["N°", "Numero di maglia."],
          ["Tot", "Punti fatti: attacchi vincenti, muri e ace."],
          ["BP", "Di quei punti, quelli fatti mentre la propria squadra batteva (break point)."],
          ["V-P", "Punti fatti meno gli errori e gli attacchi murati."],
          ["Ace / Err (battuta)", "Battute vincenti e battute sbagliate."],
          ["Ricez. Err", "Ricezioni sbagliate: la palla è toccata e finisce fuori o a terra. Se cade senza essere toccata è un ace di chi batte."],
          ["Attacco Pt / Err / Mur", "Attacchi vincenti, attacchi sbagliati e attacchi fermati dal muro avversario."],
          ["Muro Pt / Err", "Muri vincenti ed errori a muro."],
          ["Altri", "Alzate e difese sbagliate e falli fischiati attribuiti a una giocatrice."],
        ],
        keepTogether: true,
      },
      {
        type: "p",
        text: "In fondo alla tabella la riga **Squadra** somma tutte le giocatrici. Quelle senza nessuna azione segnata sono raccolte in una riga a parte («Senza azioni segnate»).",
      },
      { type: "sub", title: "Il PDF" },
      {
        type: "p",
        text: "**Scarica PDF** (in alto nel tabellino, e accanto a ogni partita nell'elenco) crea il tabellino da stampare, con tutte le tabelle. Se hai scelto un set, il PDF contiene solo quello.",
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
      { type: "sub", title: "Ho segnato un punto alla squadra sbagliata." },
      { type: "p", text: "Se è l'ultimo, **«Annulla ultimo»**. Se è più indietro, trovi lo scambio nel **registro** e tocchi la matita: cambi squadra o modo, oppure lo togli." },
      { type: "sub", title: "Il punteggio dello Scout non coincide con quello dell'arbitro." },
      { type: "p", text: "Significa che uno scambio è mancante o in più. Scorri il registro dall'ultimo scambio: di solito si trova guardando i punteggi riga per riga. Prima di correggere, controlla con l'arbitro quale dei due è giusto." },
      { type: "sub", title: "Non conosco i numeri dell'avversaria." },
      { type: "p", text: "Non li scrivere in anticipo: quando segni un punto che riguarda una loro giocatrice, scrivi il numero nella casella «Altro numero di maglia». Se proprio non lo vedi, tocca «Non so / non indicare»." },
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
          ["Facciamo punto con un attacco", "Punto nostro > Attacco > numero"],
          ["Facciamo punto con un muro", "Punto nostro > Muro > numero > (chi attaccava)"],
          ["Facciamo un ace", "Punto nostro > Ace > numero"],
          ["Sbagliano loro (battuta, attacco, fallo...)", "Punto nostro > Errore loro > cosa > numero"],
          ["Fanno punto loro con un attacco, un muro o un ace", "Punto loro > Attacco / Muro / Ace > numero"],
          ["Sbagliamo noi (battuta, ricezione, fallo...)", "Punto loro > Errore nostro > cosa > numero"],
        ],
        keepTogether: true,
      },
      {
        type: "callout",
        kind: "tip",
        title: "Se sbagli",
        text: "**Annulla ultimo** toglie l'ultimo punto. Per uno scambio più vecchio: **Registro > matita**.",
      },
      {
        type: "callout",
        kind: "example",
        title: "Fine set",
        text: "Compare il riquadro «Il set è finito»: scegli chi batte per primo nel set dopo e tocca **Chiudi il set**. La partita si chiude da sola ai set vinti.",
      },
      {
        type: "callout",
        kind: "warning",
        title: "Senza rete",
        text: "Continua a segnare e non chiudere la scheda: i punti partono da soli quando torna internet. Aspetta che la targhetta in alto torni a «Salvato».",
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
        ],
        keepTogether: true,
      },
    ],
  },
];
