import { SUBSTITUTIONS_PER_SET, TIMEOUTS_PER_SET } from "@/lib/volleyRules";
import type { ScoutLevel } from "@/lib/scout/types";
import type { BaseTourStep } from "./engine/types";

/**
 * La guida passo passo dello Scout. È pensata per chi non l'ha mai usato: ogni
 * pagina ha la sua guida (elenco partite, preparazione, partita, tabellino) e
 * ogni passo spiega una cosa sola, con un esempio quando serve. Un passo esiste
 * solo se il suo elemento è davvero in pagina in quel momento, per questo i passi
 * si costruiscono dallo stato della pagina. Gli stessi concetti, con le
 * schermate, sono nel manuale PDF (src/lib/scout/manual.ts).
 */

const HUB = "/admin/scout";

const C_WELCOME = "Benvenuta/o nello Scout";
const C_LIST = "L'elenco delle partite";
const C_SEASON = "La stagione";
const C_SETUP = "1 · Preparare la partita";
const C_PLAY = "2 · Segnare i punti";
const C_SET = "3 · Fine set e fine partita";
const C_FIX = "4 · Correggere e controllare";
const C_TAB = "Il tabellino";

/** Elenco delle partite dello Scout (vista «Partite») o totali di stagione (vista «Stagione»). */
export function getScoutHubTourSteps({ showMatches, season = false }: { showMatches: boolean; season?: boolean }): BaseTourStep[] {
  const steps: BaseTourStep[] = [
    {
      id: "scout-hub-intro",
      path: HUB,
      target: null,
      chapter: C_WELCOME,
      title: "A cosa serve lo Scout",
      body: "Lo Scout registra una partita punto per punto: per ogni scambio segni come è finito (attacco, muro, ace o errore) e chi l'ha fatto. Da questo lavoro escono da soli il tabellino di ogni giocatrice, le statistiche di squadra e il PDF da stampare.\n\nNon devi fare calcoli: punteggio, set e chi batte li ricava lo Scout. Questa guida ti accompagna dall'elenco delle partite fino al tabellino.",
      tip: "Puoi fermarti quando vuoi e riprendere dal punto interrogativo in alto: ogni pagina dello Scout ha la sua guida.",
    },
    {
      id: "scout-hub-tabs",
      path: HUB,
      target: "section-scout-tabs",
      chapter: C_WELCOME,
      title: "Partite e Stagione",
      body: "«Partite» è l'elenco delle partite del calendario da segnare o già segnate. «Stagione» somma tutte le partite già scoutizzate e mostra i totali della squadra e quelli di ogni giocatrice.",
      tip: "Lo Scout c'è per le partite di campionato e le amichevoli di Under 14 e Under 15. I tornei e il Minivolley non lo prevedono.",
    },
  ];

  if (season) {
    steps.push(
      {
        id: "scout-season-totals",
        path: HUB,
        target: "scout-season-totals",
        chapter: C_SEASON,
        title: "I totali della stagione",
        body: "Qui sono sommate tutte le partite che hai segnato: quante, quanti scambi, i punti fatti e quelli subiti. Poi due percentuali che i tecnici guardano sempre: i punti fatti mentre si batte (break point) e i cambi palla riusciti (side-out), con a fianco quelle delle avversarie.",
        example: "Un cambio palla del 60% vuol dire che, su 10 volte che la squadra riceve, 6 volte fa subito punto e si prende la battuta.",
      },
      {
        id: "scout-season-how",
        path: HUB,
        target: "scout-season-how",
        chapter: C_SEASON,
        title: "Come facciamo punto",
        body: "Per ogni modo di fare punto (attacco, muro, ace) e per ogni errore vedi le barre della nostra squadra e delle avversarie, una accanto all'altra. È il modo più rapido per capire dove si vince e dove si regala.",
      },
      {
        id: "scout-season-players",
        path: HUB,
        target: "scout-season-players",
        chapter: C_SEASON,
        title: "Le giocatrici",
        body: "Una riga per ogni giocatrice, con i punti, gli ace, gli errori e il resto, sommati su tutte le partite. Le sigle sono spiegate nel tabellino di ogni partita («Come leggere il tabellino»).",
        tip: "Il nome di una giocatrice è quello dell'ultima partita in cui compare.",
      },
    );
  }

  if (showMatches) {
    steps.push(
      {
        id: "section-scout-matches",
        path: HUB,
        target: "section-scout-matches",
        chapter: C_LIST,
        title: "Le partite",
        body: "In alto «Oggi e prossime partite», sotto quelle già giocate. Ogni partita ha una targhetta che dice a che punto sei: «Da segnare» (non hai ancora segnato nulla), «In corso» (hai segnato dei punti ma la partita non è finita: vedi set e punteggio) e «Concluso» (partita decisa, con il risultato in set).",
      },
      {
        id: "scout-hub-action",
        path: HUB,
        target: "scout-hub-action",
        chapter: C_LIST,
        title: "Il pulsante giusto per ogni momento",
        body: "«Segna i punti» apre la partita per la prima volta. Se hai già cominciato trovi «Continua» (riprendi da dove eri) oppure «Rivedi» (partita finita, per controllare o correggere). «Tabellino» apre i numeri della partita e «PDF» li scarica da stampare.",
      },
    );
  }

  steps.push(
    {
      id: "scout-hub-manual",
      path: HUB,
      target: "scout-manual",
      chapter: C_WELCOME,
      title: "Il manuale in PDF",
      body: "Se preferisci leggere con calma, o stampare, c'è il manuale d'uso completo: schermate commentate, tutti i casi particolari, il significato di ogni sigla e uno schema da tenere a bordo campo.\n\nCon «Condividi PDF» lo mandi come file a chi vuoi (dal telefono si apre WhatsApp, e-mail e simili; dal computer il file si scarica).",
    },
    {
      id: "scout-hub-before",
      path: HUB,
      target: null,
      chapter: C_WELCOME,
      title: "Prima di segnare una partita",
      body: "Ti servono tre cose, tutte facili:\n\n1. le atlete nell'anagrafica (Presenze, Atlete) con il loro numero di maglia: lo Scout lo ritrova da solo;\n2. le convocate indicate nella partita (Partite, modifica): compariranno già spuntate;\n3. un telefono o un tablet con la batteria carica.",
      tip: "Se la rete cade non perdi nulla: i punti restano sul dispositivo e partono da soli appena torna internet.",
    },
    {
      id: "scout-hub-go",
      path: HUB,
      target: null,
      chapter: C_WELCOME,
      title: "Adesso apri una partita",
      body: "Scegli «Segna i punti» su una partita: dentro troverai di nuovo il punto interrogativo, con la guida passo passo della preparazione e di come si segna ogni punto.",
    },
  );
  return steps;
}

/** Cosa c'è in pagina nella partita: i passi della guida seguono lo stato. */
export interface ScoutMatchTourContext {
  /** Prima del primo punto la pagina mostra la preparazione al posto dei pulsanti. */
  setup: boolean;
  /** Il set è arrivato al limite e compare il riquadro «Il set è finito». */
  setEnding: boolean;
  /** Partita decisa dai set (compare «Partita finita»). */
  decided: boolean;
  /** Partita chiusa a mano (compare «Partita chiusa a mano»). */
  closed: boolean;
  /** Compare il pulsante «Chiudi il set adesso». */
  canCloseSet: boolean;
  /** Compare il pulsante «Chiudi la partita». */
  canFinish: boolean;
  /** Il livello della partita: cambiano i pulsanti per segnare e quindi i passi. */
  level: ScoutLevel;
  /** Si segue la formazione in campo: compare la striscia «In campo». */
  followsLineup?: boolean;
}

/**
 * Pagina di una partita dello Scout: il percorso contiene l'id, quindi i passi
 * si costruiscono per partita.
 */
export function getScoutMatchTourSteps(matchId: string, context: ScoutMatchTourContext): BaseTourStep[] {
  const path = `${HUB}/${matchId}`;
  const board = (chapter: string): BaseTourStep => ({
    id: "section-scout-board",
    path,
    target: "section-scout-board",
    chapter,
    title: "Il tabellone",
    body:
      "In alto vedi il set in corso («1° set a 25») e i set vinti. Al centro il punteggio: «Noi» a sinistra (Volley Lignano), «Loro» a destra. Sotto il nome di chi sta battendo compare «Batte».\n\nIl punteggio non lo scrivi mai: cresce da solo a ogni punto che segni." +
      // A partita chiusa i pulsanti dei time-out non ci sono più.
      (chapter === C_FIX
        ? ""
        : `\n\nSotto il punteggio ogni squadra ha il suo pulsante «Time-out»: toccalo quando ne viene chiesto uno (${TIMEOUTS_PER_SET} per set, i pallini si riempiono). Finisce nel registro e, se il punteggio live è acceso, lo vede anche chi guarda il sito.`),
    tip: "Ogni tanto guarda il segnapunti dell'arbitro: se i punteggi non coincidono, nel registro in fondo trovi lo scambio da correggere.",
  });
  const sync: BaseTourStep = {
    id: "scout-sync",
    path,
    target: "scout-sync",
    chapter: C_FIX,
    title: "Il salvataggio",
    body: "Ogni punto si salva da solo. «Salvato» vuol dire che è tutto al sicuro sul server; «Salvataggio…» che sta partendo; «Senza rete» che internet manca.\n\nCon «Senza rete» continua pure a segnare: i punti restano sul dispositivo e partono da soli appena torna la connessione. Se due dispositivi modificano la stessa partita, lo Scout non sovrascrive in silenzio: ti chiede quale versione tenere.",
    warning: "Se vedi «Senza rete» non chiudere la scheda e non spegnere il telefono finché non torna «Salvato».",
  };
  const tabellino: BaseTourStep = {
    id: "scout-tabellino",
    path,
    target: "scout-tabellino",
    chapter: C_FIX,
    title: "Il tabellino",
    body: "«Tabellino» apre i numeri della partita, anche mentre si gioca: punti, ace, errori, break point e il resto, per le due squadre e per ogni giocatrice. Da lì si scarica anche il PDF.",
  };
  const manual: BaseTourStep = {
    id: "scout-manual",
    path,
    target: "scout-manual",
    chapter: C_FIX,
    title: "Il manuale in PDF",
    body: "Questo pulsante scarica il manuale d'uso dello Scout, con le schermate commentate e uno schema da tenere a bordo campo.",
  };

  const fullscreen: BaseTourStep = {
    id: "scout-fullscreen",
    path,
    target: "scout-fullscreen",
    chapter: C_FIX,
    title: "Schermo intero",
    body: "Mette lo Scout a tutto schermo, senza il menu del sito. Su tablet e computer lo schermo si divide in due: a sinistra i pulsanti per segnare, a destra il tabellone (sempre in alto), chi è in campo e il registro, sempre sotto gli occhi. I pulsanti dei punti sono grandi e occupano tutta l'altezza, il registro scorre da solo e «Annulla ultimo» resta sempre in fondo.\n\nSi esce con «Esci» o con il tasto Esc.",
    tip: "Comodo a bordo campo con il tablet in orizzontale: non devi più scorrere la pagina per vedere gli ultimi punti.",
  };

  if (context.setup) {
    return [
      {
        id: "scout-setup-intro",
        path,
        target: null,
        chapter: C_SETUP,
        title: "Si comincia dalla preparazione",
        body: "Prima del primo punto la pagina mostra la preparazione: chi gioca, i numeri dell'avversaria e le regole della gara. Sono tre mosse veloci e nessuna è obbligatoria; tutto si può cambiare anche a partita iniziata.\n\nTi faccio vedere ogni parte, poi ti spiego come si segna un punto.",
      },
      board(C_SETUP),
      {
        id: "section-scout-setup",
        path,
        target: "section-scout-setup",
        chapter: C_SETUP,
        title: "Prima di cominciare",
        body: "Questa è la schermata di preparazione. Scorri verso il basso: in ordine trovi le nostre giocatrici, l'avversaria, le regole della gara e il punteggio live sul sito. In fondo c'è il pulsante per cominciare.",
      },
      {
        id: "scout-setup-level",
        path,
        target: "scout-setup-level",
        chapter: C_SETUP,
        title: "Quanto vuoi segnare?",
        body: "Per prima cosa scegli il livello di questa partita. Sono due:\n\n«Base»: segni come finisce ogni scambio (chi fa punto e come). Due o tre tocchi a punto, nessuna esperienza.\n\n«Con ricezioni»: in più, quando batte l'avversaria, segni chi ha ricevuto e con che voto. Sono due tocchi in più solo quando riceviamo.",
        example: "Prima partita con lo Scout? Parti da «Base». Quando ti senti sicura/o, prova «Con ricezioni».",
        tip: "Il livello si sceglie prima di ogni partita ma si può cambiare anche dopo: quello che hai già segnato resta, e il tabellino mostra le colonne del livello usato.",
      },
      {
        id: "scout-setup-roster",
        path,
        target: "scout-setup-roster",
        chapter: C_SETUP,
        title: "Le nostre giocatrici",
        body: "Spunta con il quadratino le atlete che giocano oggi. In cima ci sono le convocate della partita, sotto le altre atlete. Se oggi non conosci la formazione, spunta tutte quelle presenti: potrai aggiungere o togliere in qualsiasi momento da «Squadre e regole».\n\nSe manca qualcuna usa «Aggiungi a mano» in fondo all'elenco: basta il nome e, se vuoi, il numero.",
        tip: "Non hai voglia di spuntare nessuno? Puoi segnare i punti anche senza dire chi li fa: poi però il tabellino non avrà i numeri delle singole giocatrici.",
      },
      {
        id: "scout-setup-number",
        path,
        target: "scout-setup-roster",
        chapter: C_SETUP,
        title: "Numero di maglia e libero",
        body: "Vicino a ogni giocatrice spuntata c'è il numero di maglia: lo Scout lo prende dall'anagrafica atlete, dove lo scrivi una volta sola. Qui lo puoi cambiare solo per questa partita. Se il numero manca compare il pulsante «Usa il 7» (o «Compila i numeri dall'anagrafica» per tutte insieme).\n\nIl quadratino «L» si accende per la libero di oggi: la libero non può murare, quindi non viene proposta quando segni un muro.",
        warning: "Due maglie con lo stesso numero fanno diventare rosso il campo: in una partita ogni numero è di una sola giocatrice.",
      },
      {
        id: "scout-setup-lineup",
        path,
        target: "scout-setup-lineup",
        chapter: C_SETUP,
        title: "La formazione in campo",
        body: "Come nel Live score: scegli chi gioca nelle posizioni da 1 a 6 (la 1 è chi batte, poi si ruota in senso orario), la libero e le due giocatrici che sostituisce (di solito le centrali). Per l'avversaria scrivi i numeri di seguito e premi Invio.\n\nSe in «Partite» hai già preparato la formazione, la trovi già scritta: controlla e vai avanti, «Comincia» la applica da sola. Da quel momento lo Scout segue le rotazioni e i cambi, propone chi batte e, per ogni punto, ti fa scegliere tra le sei in campo, con numero e nome.",
        tip: "Non ti serve? Lasciala vuota: la puoi attivare anche a partita iniziata con «Segui la formazione». A ogni set nuovo lo Scout ti chiede la formazione di quel set, già scritta come quella del set prima.",
      },
      {
        id: "scout-setup-opp",
        path,
        target: "scout-setup-opp",
        chapter: C_SETUP,
        title: "L'avversaria",
        body: "Di solito basta il numero di maglia. Scrivili separati da uno spazio (per esempio 1 4 7 9 12) e premi «Aggiungi»: compaiono come bollini, con una X per toglierli.\n\nNon conosci i numeri? Nessun problema: quando segni un punto che riguarda una loro giocatrice puoi scrivere un numero nuovo al volo.",
      },
      {
        id: "scout-setup-rules",
        path,
        target: "scout-setup-rules",
        chapter: C_SETUP,
        title: "Le regole della gara",
        body: "«Formula»: 3 set su 5 (la più usata nelle gare giovanili importanti), 2 su 3, oppure 3 set fissi. «Punti per set» è di norma 25 e «Ultimo set» 15, sempre con almeno due punti di scarto. Infine scegli chi batte per primo nel primo set: lo stabilisce il sorteggio fatto dall'arbitro.",
        example: "Gara al meglio dei 5 set: lasci tutto com'è e scegli solo chi batte per primo.",
        tip: "Nel dubbio guarda il regolamento della gara: nei campionati giovanili regionali la formula e i punti sono scritti nel comunicato.",
      },
      {
        id: "section-scout-live",
        path,
        target: "section-scout-live",
        chapter: C_SETUP,
        title: "Punteggio live sul sito",
        body: "Se lo accendi, chi apre il sito della squadra vede la partita in diretta: solo le due squadre, i punti, i set e chi batte, con la dicitura «Risultato non ufficiale». Mai nomi, numeri di maglia o dettagli degli scambi.\n\nCompare dal primo punto segnato e lo puoi spegnere quando vuoi, anche durante la partita.",
        warning: "Lo vede chiunque apra il sito: accendilo solo se vuoi la diretta pubblica.",
      },
      {
        id: "scout-start",
        path,
        target: "scout-start",
        chapter: C_SETUP,
        title: "Si comincia",
        body: "Quando è tutto pronto premi «Comincia a segnare i punti»: al posto della preparazione compaiono i pulsanti per segnare. Se serve cambiare qualcosa dopo, c'è «Squadre e regole».\n\nSubito dopo tocca di nuovo il punto interrogativo in alto: la guida riparte con i passi per segnare il primo punto.",
      },
      sync,
      manual,
      fullscreen,
    ];
  }

  // Partita già cominciata. Se è decisa o chiusa a mano la guida è quella della revisione.
  const locked = context.decided || context.closed;
  const steps: BaseTourStep[] = [];

  if (!locked) {
    steps.push({
      id: "scout-play-intro",
      path,
      target: null,
      chapter: C_PLAY,
      title: "Come funziona",
      body: "Per ogni scambio fai al massimo tre tocchi:\n\n1. scegli il pannello della squadra che ha fatto punto e il modo (attacco, muro, ace oppure errore dell'altra squadra);\n2. scegli chi ha compiuto l'azione;\n3. solo dopo un muro: chi attaccava (facoltativo).\n\nIl resto lo calcola lo Scout: punteggio, set, chi batte, break point.",
      tip: "Segna lo scambio quando l'arbitro assegna il punto, non prima: se sbagli, «Annulla ultimo» rimedia subito.",
    });
  }

  steps.push(board(locked ? C_FIX : C_PLAY));

  if (!locked) {
    steps.push({
      id: "scout-ball",
      path,
      target: "scout-ball",
      chapter: C_PLAY,
      title: "Da che parte è la palla",
      body: "Il campo visto dall'alto: «Noi» a sinistra, «Loro» a destra, la rete in mezzo. All'inizio di ogni scambio la palla sta dalla parte di chi batte; con le ricezioni, quando segni la nostra ricezione, passa dalla nostra parte. Si accende anche sul tabellone, accanto al nome della squadra.\n\nResta in vista, sotto l'intestazione del sito, mentre scorri fino ai pulsanti.",
      tip: "Se non sei sicuro di chi tocca, guarda dove sta la palla: è quella la squadra da scegliere.",
    });
  }

  if (!locked && context.followsLineup) {
    steps.push({
      id: "scout-court-strip",
      path,
      target: "scout-court-strip",
      chapter: C_PLAY,
      title: "Chi è in campo",
      body: `Le due squadre con le sei posizioni, ognuna con numero e nome: davanti 4-3-2, dietro 5-6-1 (la rete è in alto). Il pallone verde segna chi batte; la libero compare in scuro al posto della centrale che sostituisce. Quando una squadra conquista la battuta ruota da sola (sotto il nome vedi la rotazione: la 1ª è quella di partenza).\n\nCon «Cambio» registri una sostituzione: tocchi chi esce direttamente sul campo (ogni giocatrice sta dove sta davvero, con numero e nome) e scegli chi entra; se non è regolare (per esempio più di ${SUBSTITUTIONS_PER_SET} cambi in un set) ti avvisa, ma puoi confermare lo stesso. Nello stesso Cambio c'è «Cambia la libero», che non è un cambio ufficiale e non conta tra quelli del set. «Formazione» riapre la formazione per correggerla: a ogni set nuovo si apre da sola.`,
      tip: "Quando scegli «chi» vedi il campo come qui: tocchi la giocatrice dove sta (davanti 4-3-2, dietro 5-6-1); la panchina è sotto, più chiara. Ace e battuta sbagliata non lo chiedono: vanno da soli a chi batte (se non era lei, «Cambia» sull'ultimo punto).",
    });
  }

  if (!locked && context.level === "ricezioni") {
    steps.push({
      id: "scout-reception",
      path,
      target: "scout-reception",
      chapter: C_PLAY,
      title: "La ricezione",
      body: "Quando batte l'avversaria si apre da sola la finestra «Ricezione nostra», come quelle dei punti (qui resta la riga per riaprirla). Tocca chi ha ricevuto (sul campo, se segui la formazione) e poi il voto: # perfetta (l'alzatrice ha tutte le opzioni), + positiva, ! neutra, − negativa (alzata obbligata), / scarsa (palla rimandata di là), = errore.\n\nSe vuoi puoi anche scegliere la zona del campo dove è stata ricevuta: serve alla mappa del tabellino. Con «=» il punto va a loro da solo; con gli altri voti lo scambio resta aperto e il punto lo segni con i pulsanti qui sotto, come sempre.",
      example: "Batte la loro n. 5, la n. 4 ricevuta bene: tocchi 4, poi «+ Positiva». Poi la nostra alzatrice mette giù l'attacco: «Punto nostro», «Attacco», la giocatrice.",
      tip: "Quando batte la nostra squadra la finestra non si apre: la ricezione è solo quella nostra. Se non vuoi segnarla, «Salta la ricezione». Se hai sbagliato, «Cambia» (o «Annulla ultimo») la toglie.",
    });
  }

  if (context.setEnding) {
    steps.push({
      id: "scout-set-end",
      path,
      target: "scout-set-end",
      chapter: C_SET,
      title: "Il set è finito",
      body: "Quando una squadra arriva al limite (di solito 25 con due punti di scarto) compare da solo questo riquadro. Scegli chi batte per primo nel set successivo (di norma si alternano; prima del set decisivo c'è un nuovo sorteggio) e premi «Chiudi il set». Con l'ultimo set compare «Chiudi il set e la partita».\n\nSe segui la formazione, subito dopo si apre «Formazione del 2° set» (o del set che viene): è già scritta come quella del set prima, o come l'hai preparata in «Partite». Se non cambia niente basta «Conferma e comincia»; se cambia, correggi le posizioni prima.",
      warning: "Finché non lo chiudi, i punti che segni continuano a contare nel set appena finito.",
    });
  }

  if (context.decided || context.closed) {
    steps.push({
      id: "scout-over",
      path,
      target: "scout-over",
      chapter: C_SET,
      title: context.decided ? "Partita finita" : "Partita chiusa a mano",
      body: context.decided
        ? "La partita si chiude da sola quando una squadra vince i set necessari. Da qui apri il tabellino con tutti i numeri. I pulsanti per segnare sono spenti: se hai chiuso il set per sbaglio, «Annulla ultimo» toglie l'ultimo evento e la partita si riapre."
        : "Hai chiuso la partita prima della fine (per esempio perché l'incontro è stato interrotto). Con «Riapri» puoi tornare a segnare i punti.",
    });
  }

  if (!locked) {
    steps.push(
      {
        id: "scout-entry-us",
        path,
        target: "scout-entry-us",
        chapter: C_PLAY,
        title: "Punto nostro: attacco, muro, ace",
        body: "Il pannello di sinistra è per i punti che fa Volley Lignano.\n\n«Attacco»: la palla cade a terra nel campo avversario dopo un nostro attacco (anche se tocca il muro e finisce fuori). «Muro»: punto di muro, la palla cade nel campo di chi attaccava. «Ace»: battuta vincente, la palla cade a terra o non è giocabile.",
        example: "La n. 7 batte e la palla cade a terra: tocca «Ace», poi la n. 7.",
      },
      {
        id: "scout-entry-error",
        path,
        target: "scout-entry-opp",
        chapter: C_PLAY,
        title: "Punto loro, ed errori",
        body: "Il pannello di destra è per i punti delle avversarie: una loro schiacciata a terra è «Attacco» e si segna subito, senza chiedere chi. Quando un punto arriva perché sbagliamo noi, tocca «Errore nostro» nel pannello di destra; quando sbagliano loro, «Errore loro» nel pannello di sinistra.\n\nSi apre l'elenco: battuta, ricezione, attacco, muro, alzata, difesa sbagliati, poi i falli fischiati (tocco di rete, invasione, doppia, trattenuta, quattro tocchi, rotazione, sanzione). Scegli quello che ha fischiato l'arbitro o che hai visto.",
        example: "La loro n. 4 attacca fuori: «Errore loro» (a sinistra), «Attacco sbagliato», poi la n. 4.",
        tip: "Falli di squadra come «Rotazione» o «Sanzione» non chiedono la giocatrice: riguardano tutta la squadra.",
      },
      {
        id: "scout-player",
        path,
        target: null,
        chapter: C_PLAY,
        title: "Chi ha fatto l'azione?",
        body: "Dopo il modo si apre l'elenco con i numeri di maglia (e il nome, per le nostre). Tocca il numero giusto e il punto è segnato. Unica eccezione: «Attacco» nel pannello «Punto loro» si segna subito, con un tocco solo, senza chiedere chi.\n\nPer l'avversaria, se il numero non c'è, scrivilo nella casella «Altro numero di maglia» e premi «Aggiungi». Non l'hai visto? Tocca «Non so / non indicare»: il punto conta lo stesso, solo non finisce nel tabellino di nessuna giocatrice.",
        tip: "Un punto senza il «chi» è meglio di un «chi» sbagliato.",
      },
      {
        id: "scout-block",
        path,
        target: null,
        chapter: C_PLAY,
        title: "Dopo un muro",
        body: "Per un muro lo Scout chiede anche «Chi attaccava?» (facoltativo): serve a contare gli attacchi fermati dal muro nel tabellino. Se non lo sai, tocca «Non so / salta».\n\nLa libero non può murare: non viene proposta tra chi può fare un muro o un errore a muro.",
      },
      {
        id: "scout-last",
        path,
        target: "scout-last",
        chapter: C_PLAY,
        title: "L'ultimo punto e «Annulla ultimo»",
        body: "Sotto i pannelli leggi l'ultimo punto segnato (per esempio «Ultimo: 12–10 · punto nostro · Attacco · n. 7»). Se hai toccato il pulsante sbagliato, «Annulla ultimo» toglie l'ultimo scambio e il punteggio torna indietro; puoi premerlo più volte di seguito.\n\nSe segui la formazione, un ace o una battuta sbagliata vanno da soli a chi batte: se non era lei (per esempio la rotazione era sbagliata), «Cambia» accanto all'ultimo punto ti fa toccare chi è stata, senza toccare il punteggio.",
      },
    );
  } else if (!locked) {
    steps.push({
      id: "scout-last",
      path,
      target: "scout-last",
      chapter: C_PLAY,
      title: "«Annulla ultimo»",
      body: "Sotto i pulsanti leggi l'ultimo tocco o punto segnato. Se hai toccato quello sbagliato, «Annulla ultimo» toglie l'ultimo tocco: puoi premerlo più volte di seguito, anche per tornare a prima di un punto.",
    });
  } else {
    steps.push({
      id: "scout-last",
      path,
      target: "scout-last",
      chapter: C_FIX,
      title: "«Annulla ultimo»",
      body: "Toglie l'ultimo evento registrato. Su una partita finita serve a riaprirla: per esempio, se hai chiuso l'ultimo set troppo presto, premilo una volta e potrai ancora segnare i punti.",
    });
  }

  steps.push({
    id: "section-scout-tools",
    path,
    target: "section-scout-tools",
    chapter: locked ? C_FIX : C_SET,
    title: "Squadre, regole, set e partita",
    body: `«Squadre e regole» riapre la preparazione: cambi le giocatrici o i numeri, aggiungi un'avversaria, correggi le regole. Chi ha già un'azione nel registro non si può togliere dalla rosa (si può cambiare solo il numero).${
      context.canCloseSet
        ? "\n\n«Chiudi il set adesso» serve se il set è finito prima del limite (per esempio un errore di conteggio dell'arbitro): lo chiude sul punteggio attuale."
        : ""
    }${
      context.canFinish
        ? "\n\n«Chiudi la partita» ferma tutto prima della fine naturale (partita interrotta, ritiro): si può sempre riaprire con «Riapri»."
        : ""
    }`,
    tip: "Lo Scout non chiude mai un set da solo: te lo propone quando una squadra arriva al limite e lo chiudi tu.",
  });

  steps.push({
    id: "scout-live-toggle",
    path,
    target: "scout-live-toggle",
    chapter: C_SET,
    title: "Punteggio live sul sito",
    body: "Con questo pulsante accendi o spegni in un tocco il punteggio live sul sito pubblico: solo le due squadre, il punteggio, i set e chi batte, mai nomi né numeri di maglia. Quando è acceso, in alto compare «Live sul sito».",
  });

  steps.push({
    id: "section-scout-log",
    path,
    target: "section-scout-log",
    chapter: C_FIX,
    title: "Il registro degli scambi",
    body:
      context.level === "base"
        ? "Qui c'è ogni scambio, dal più recente, raccolto per set. Ogni riga dice a che punteggio si è arrivati, chi ha fatto punto, come e con chi.\n\nTocca la matita di una riga per correggerla: puoi cambiare squadra, modo, giocatrice o togliere lo scambio. Punteggio e battute si ricalcolano da soli per tutti gli scambi successivi."
        : "Qui c'è ogni scambio, dal più recente, raccolto per set. Ogni riga dice a che punteggio si è arrivati, chi ha fatto punto e come; sotto, la ricezione segnata (R, il numero di chi ha ricevuto e il voto).\n\nTocca la matita per correggere: puoi cambiare chi ha ricevuto, il voto e la zona, togliere la ricezione o aggiungere quella che avevi dimenticato, oppure togliere tutto lo scambio. Punteggio e battute si ricalcolano da soli.",
    example: "Hai segnato un ace della n. 7 ma era della n. 9: matita sulla riga, scegli «n. 9», «Salva».",
  });

  steps.push(sync, tabellino, manual, fullscreen);

  if (!locked) {
    steps.push({
      id: "scout-play-end",
      path,
      target: null,
      chapter: C_FIX,
      title: "Sei pronta/o",
      body: "Riassumendo: scegli il pannello, il modo, la giocatrice. Le prime volte rallenta pure: puoi sempre correggere dal registro. Quando la partita finisce, apri il tabellino.",
      tip: "Per rileggere tutto con calma, o stampare uno schema da tenere a bordo campo, scarica il manuale PDF.",
    });
  }
  return steps;
}

/** Cosa c'è nel tabellino: la sezione del livello «Con ricezioni» compare solo se ci sono dati. */
export interface ScoutTabellinoTourContext {
  /** Nel tabellino ci sono le formazioni di partenza e i cambi. */
  lineups?: boolean;
  level: ScoutLevel;
  /** C'è la sezione «La ricezione». */
  reception: boolean;
}

/** Tabellino di una partita: la guida a ogni blocco di numeri. */
export function getScoutTabellinoTourSteps(matchId: string, context: ScoutTabellinoTourContext = { level: "base", reception: false }): BaseTourStep[] {
  const path = `${HUB}/${matchId}/tabellino`;
  const detail: BaseTourStep[] = [];
  if (context.reception) {
    detail.push({
      id: "scout-tab-reception",
      path,
      target: "scout-tab-reception",
      chapter: C_TAB,
      title: "La ricezione",
      body: "Com'è andata la ricezione della squadra: in alto la ricezione positiva (# e +), la perfetta (#) e gli errori; poi una barra a colori per tutta la squadra e una per ogni giocatrice; sotto, il cambio palla in base al voto della ricezione e la mappa delle zone.\n\nÈ la parte che mostra meglio se vale la pena allenare la ricezione: di solito dopo una ricezione perfetta si vince lo scambio molto più spesso che dopo una negativa.",
      tip: "Contano solo le ricezioni che hai segnato: se in uno scambio l'hai saltata, non compare.",
    });
  }
  return [
    {
      id: "scout-tab-result",
      path,
      target: "scout-tab-result",
      chapter: C_TAB,
      title: "Il tabellino",
      body: "È fatto come i tabellini delle leghe: in alto il campionato, le due squadre con i set vinti, i dati della partita e i set con la durata stimata, i parziali (il punteggio quando una delle due arriva a 8, 16 e 21) e il finale.\n\nÈ calcolato dai punti che hai segnato, non è il risultato ufficiale: quello lo inserisci in Partite. Se i parziali sono diversi compare un avviso, così controlli quale dei due è giusto.",
    },
    {
      id: "scout-tab-players",
      path,
      target: "scout-tab-players",
      chapter: C_TAB,
      title: "Le giocatrici",
      body:
        "Una tabella per squadra, con tutta la rosa. Nella colonna «Set» c'è da dove è partita in ogni set (il numero della posizione, 1 = in battuta) o un rettangolo se è entrata dopo; i set cerchiati sono quelli in cui la squadra ha battuto per prima. Poi punti (Tot, BP, V-P), battuta, ricezione, attacco e muro; sotto, i totali e i punti vinti set per set (Bat ace, Att attacco, Mu muro, Er.Av errori dell'avversaria)." +
        (context.level === "base"
          ? "\n\nA livello Base delle ricezioni si segnano solo quelle sbagliate: per il resto trovi «–»."
          : "\n\nA livello Con ricezioni si segnano le nostre ricezioni: quelle dell'avversaria sono «–»."),
      tip: "Lo zero è un punto « . », come nei tabellini ufficiali; le battute di ogni giocatrice si contano quando segui la formazione.",
    },
    {
      id: "scout-tab-summary",
      path,
      target: "scout-tab-summary",
      chapter: C_TAB,
      title: "Rotazioni, ricezioni e battute",
      body: "Per ogni squadra: i punti fatti meno quelli persi in ogni rotazione, quante ricezioni servono per un punto in cambio palla (CP) e quante battute per un break point (BP). In mezzo, a livello Con ricezioni, il cambio palla dopo una ricezione positiva o negativa.",
    },
    {
      id: "scout-tab-legend",
      path,
      target: "scout-tab-legend",
      chapter: C_TAB,
      title: "Come leggere le sigle",
      body: "In fondo al tabellino trovi il significato di ogni sigla (BP, V-P, Pos%, Prf%, Er.Av, CP…) e dei segni della colonna dei set, e cosa non si segna al livello di questa partita.",
    },
    {
      id: "scout-tab-sets",
      path,
      target: "scout-tab-sets",
      chapter: C_TAB,
      title: "Le analisi: tutta la partita o un set",
      body: "Sotto il tabellino ci sono le analisi. Scegli se guardare tutta la partita o un solo set: tutte le analisi sotto si ricalcolano. Utile per capire, per esempio, perché il terzo set è andato male.",
    },
    {
      id: "scout-tab-bp",
      path,
      target: "scout-tab-bp",
      chapter: C_TAB,
      title: "Break point e cambio palla",
      body: "«Punti in battuta» (break point): su 100 volte che la squadra batte, quante fa punto. «Cambio palla» (side-out): su 100 volte che riceve, quante fa subito punto e si prende la battuta. Poi la serie di punti di fila più lunga e gli errori commessi; a fianco, sempre il confronto con le avversarie.",
      example: "Break point 40%: su 10 battute, 4 volte la squadra fa punto mentre batte.",
    },
    {
      id: "scout-tab-how",
      path,
      target: "scout-tab-how",
      chapter: C_TAB,
      title: "Come si è fatto punto",
      body: "I punti delle due squadre divisi per come sono arrivati: attacco, muro, ace e punti regalati dagli errori avversari. È il modo più rapido per capire da dove arrivano i punti.",
    },
    {
      id: "scout-tab-errors",
      path,
      target: "scout-tab-errors",
      chapter: C_TAB,
      title: "Errori e falli",
      body: "Tutti gli errori e i falli, divisi per tipo: ognuno è un punto per l'altra squadra. Se una colonna è molto alta, è lì che conviene lavorare in allenamento.",
    },
    {
      id: "scout-tab-flow",
      path,
      target: "scout-tab-flow",
      chapter: C_TAB,
      title: "Andamento del punteggio",
      body: "Il grafico mostra come si è mosso il punteggio scambio dopo scambio: dove una linea sale in fretta c'è una serie di punti di quella squadra; dove le linee si incrociano la partita è cambiata.",
    },
    ...detail,
    ...(context.lineups
      ? [
          {
            id: "scout-tab-lineups",
            path,
            target: "scout-tab-lineups",
            chapter: C_TAB,
            title: "Formazioni e cambi",
            body: "Per ogni set, chi era in campo all'inizio (posizioni da 1 a 6, con la libero a parte) per noi e, se l'hai scritta, per l'avversaria; sotto, i cambi fatti, con il punteggio al momento del cambio. Compare solo se in partita hai seguito la formazione.",
          } satisfies BaseTourStep,
        ]
      : []),
    {
      id: "scout-tab-pdf",
      path,
      target: "scout-tab-pdf",
      chapter: C_TAB,
      title: "Il PDF",
      body: "Scarica il tabellino in PDF, da stampare o condividere: è il foglio come quello delle leghe, in A4 verticale, sempre su tutta la partita. Le analisi restano qui nella pagina.",
    },
  ];
}
