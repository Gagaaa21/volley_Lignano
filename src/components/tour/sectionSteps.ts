import { TIMEOUT_SECONDS, TIMEOUTS_PER_SET } from "@/lib/volleyRules";
import type { BaseTourStep } from "./engine/types";

/** Passi dei mini-tour di sezione: attivati su richiesta dal pulsante
 * "Guida" di ciascuna pagina admin (vedi SectionTour.tsx), mai in
 * automatico e senza persistenza. Ogni sezione resta sulla propria singola
 * pagina — `path` è sempre lo stesso per tutti i passi di un array, quindi
 * l'effect di navigazione del motore condiviso non scatta mai qui. */

export const SECTION_ALLENAMENTI_STEPS: BaseTourStep[] = [
  {
    id: "section-allenamenti-toolbar",
    path: "/admin/allenamenti",
    target: "section-allenamenti-toolbar",
    title: "Regole ricorrenti",
    body: "\"Elenco regole\" mostra tutti gli allenamenti ricorrenti (giorno, orario, luogo); \"Nuovo allenamento\" ne crea uno, anche per un solo giorno.",
  },
  {
    id: "section-allenamenti-legend",
    path: "/admin/allenamenti",
    target: "section-allenamenti-legend",
    title: "Scheda collegata o da assegnare",
    body: "Ogni allenamento nel calendario sotto mostra se ha già una scheda collegata o se ne manca ancora una: questi due contatori riassumono il mese.",
  },
  {
    id: "section-allenamenti-calendar",
    path: "/admin/allenamenti",
    target: "section-allenamenti-calendar",
    title: "Calendario",
    body: "Tocca una data per collegare o cambiare la scheda di quel giorno, o per spostarne orario e luogo solo per quel giorno: vale solo per quella data, non per l'intera regola.",
  },
];

export const SECTION_PARTITE_STEPS: BaseTourStep[] = [
  {
    id: "section-partite-filter",
    path: "/admin/partite",
    target: "section-partite-filter",
    title: "Filtra per categoria",
    body: "Passa dalla vista di tutte le partite a quella di una sola categoria, Under 14 o Under 15.",
  },
  {
    id: "section-partite-new",
    path: "/admin/partite",
    target: "section-partite-new",
    title: "Nuova partita",
    body: "Categoria, avversaria, casa o trasferta, data e ora: da qui crei una nuova partita di campionato o un'amichevole.",
  },
  {
    id: "section-partite-cards",
    path: "/admin/partite",
    target: "section-partite-cards",
    title: "Partite registrate",
    body: "Sono le partite del calendario del sito. Ogni scheda apre i dettagli della partita, dove imposti anche convocazioni, formazioni per set ed esportazione PDF.",
  },
  {
    id: "section-partite-official",
    path: "/admin/partite",
    target: "section-partite-official",
    title: "Portale FIPAV",
    body: "Questo riquadro ti dice se il sito è allineato al portale della federazione e apre la pagina \"Portale FIPAV\": lì trovi, divise per tipo, solo le cose da sistemare (risultati da confermare, partite cambiate, casi da verificare) e le partite del calendario ufficiale da aggiungere. Nulla cambia senza un tuo clic, e un risultato che hai già scritto non viene mai cambiato da solo.",
  },
];

export const SECTION_SCHEDE_STEPS: BaseTourStep[] = [
  {
    id: "section-schede-search",
    path: "/admin/schede",
    target: "section-schede-search",
    title: "Cerca una scheda",
    body: "Compare quando ne hai già create diverse: cerca per titolo o note per ritrovarla subito.",
  },
  {
    id: "section-schede-cards",
    path: "/admin/schede",
    target: "section-schede-cards",
    title: "In programma e libreria",
    body: "Le schede collegate a una data futura compaiono in \"In programma\"; le altre restano in \"Libreria\", pronte per essere riusate quando vuoi.",
  },
  {
    id: "section-schede-new",
    path: "/admin/schede",
    target: "section-schede-new",
    title: "Crea una scheda incollando il testo",
    body: "Premi qui e incolla il testo dell'allenamento così come lo scrivi di solito: l'IA lo divide da sola in blocchi, con titolo e durata, senza modificare il contenuto.",
  },
];

export const SECTION_PRESENZE_STEPS: BaseTourStep[] = [
  {
    id: "section-presenze-toolbar",
    path: "/admin/presenze",
    target: "section-presenze-toolbar",
    title: "Atlete e storico",
    body: "\"Atlete\" gestisce l'anagrafica; \"Storico\" mostra tutti i registri già salvati, modificabili in ogni momento.",
  },
  {
    id: "section-presenze-calendar",
    path: "/admin/presenze",
    target: "section-presenze-calendar",
    title: "Calendario allenamenti",
    body: "Ogni pallino indica se le presenze di quel giorno sono già registrate, da registrare o ancora da svolgere.",
  },
  {
    id: "section-presenze-register",
    path: "/admin/presenze",
    target: "section-presenze-calendar",
    title: "Registra una giornata",
    body: "Seleziona un giorno passato per aprire il registro e segnare le presenze di quel giorno.",
  },
];

export const LIVESCORE_SETUP_TOUR_STEPS: BaseTourStep[] = [
  {
    id: "section-livescore-mode",
    path: "/admin/livescore",
    target: "section-livescore-mode",
    title: "Scegli il formato",
    body: "Allenamento (nomi) o Partita (numeri di maglia, nome e colore dell'avversaria). La formula dice come si vince: 3 set su 5, 2 su 3 o 3 fissi (il tabellone conosce i punti di ogni set, 25 e 15 nell'ultimo, che puoi cambiare da «Punti», e quando la partita finisce) oppure libera, senza limiti. Poi con formazione o solo punteggio, da 2 contro 2 a 6 contro 6, con o senza libero.",
  },
  {
    id: "section-livescore-court",
    path: "/admin/livescore",
    target: "section-livescore-court",
    title: "Disponi le due squadre",
    body: "Scrivi chi gioca in ogni posizione, come nel foglio di posizione: la 1 è chi batte, poi si ruota in senso orario. Scrivi un numero e premi Invio per passare alla posizione dopo. In Partita, se hai già preparato la formazione in «Partite», un pulsante la porta qui.",
  },
  {
    id: "section-livescore-libero",
    path: "/admin/livescore",
    target: "section-livescore-libero",
    title: "Libero: entra ed esce da sola",
    body: "Scrivi qui il nome (o il numero) della libero e indica le due giocatrici che sostituisce (di solito le centrali). Il tabellone la fa entrare quando una di loro va in seconda linea e uscire quando ruota a rete; la libero non batte mai: se in battuta c'è una centrale, batte lei e la libero entra quando la squadra riceve.",
  },
  {
    id: "section-livescore-public",
    path: "/admin/livescore",
    target: "section-livescore-public",
    title: "Diretta sul sito",
    body: "In Partita puoi mostrare il punteggio a tutti sul sito pubblico, come risultato non ufficiale: solo squadre, punti e set, mai nomi o formazioni.",
  },
  {
    id: "section-livescore-start",
    path: "/admin/livescore",
    target: "section-livescore-start",
    title: "Chi serve per prima e via",
    body: "Scelto chi serve per prima, premi \"Inizia\": il tabellone si apre pronto per il primo punto.",
  },
];

export const LIVESCORE_INGAME_TOUR_STEPS: BaseTourStep[] = [
  {
    id: "section-livescore-status",
    path: "/admin/livescore",
    target: "section-livescore-status",
    title: "Chi batte e a che punto siamo",
    body: "Qui vedi a che set sei e a quanti punti finisce, chi batte adesso (con la giocatrice in posizione 1), chi batterebbe se ricevesse e vincesse lo scambio, e quando una squadra ha il set point o il match point.",
  },
  {
    id: "section-livescore-score",
    path: "/admin/livescore",
    target: "section-livescore-score",
    title: "Segna un punto",
    body: "Un tocco sul pulsante della squadra che ha vinto lo scambio: punteggio e servizio si aggiornano da soli, rotazione compresa. Da computer puoi usare le frecce ← e → (squadra a sinistra o a destra) e Backspace per annullare.",
  },
  {
    id: "section-livescore-timeout",
    path: "/admin/livescore",
    target: "section-livescore-timeout",
    title: "Time-out con il conto alla rovescia",
    body: `Ogni squadra ha ${TIMEOUTS_PER_SET} time-out per set e ognuno dura ${TIMEOUT_SECONDS} secondi. Toccando «Time-out» lo segni e parte il conto alla rovescia, grande, sotto il tabellone: negli ultimi 10 secondi diventa arancione e a zero suona (l'altoparlante accanto al conto lo spegne). «Fine time-out» lo chiude prima, e si chiude da solo se segni un punto. Un terzo tocco azzera il conteggio della squadra, per correggere un errore, e non fa partire niente.`,
  },
  {
    id: "section-livescore-toolbar",
    path: "/admin/livescore",
    target: "section-livescore-toolbar",
    title: "Le azioni della partita",
    body: "A fine set (di norma 25 punti con due di scarto, il decisivo a 15) compare la scheda «Chiudi il set»: un tocco e il tabellone rimette le formazioni di partenza e passa la battuta all'altra squadra; i campi si cambiano ogni 2 set (dopo il 2°). Nel set decisivo campo e battuta si sorteggiano, e a 8 punti ti avvisa del cambio campo. \"Annulla\" torna indietro di un'azione, \"Inverti\" scambia i lati, \"Nuovo\" ricomincia da capo.",
  },
  {
    id: "section-livescore-substitution",
    path: "/admin/livescore",
    target: "section-livescore-substitution",
    title: "Sostituzioni",
    body: "Scegli chi esce e chi entra: il tabellone conta i cambi del set e chi entra prosegue la rotazione. Una titolare uscita rientra solo al posto di chi l'ha sostituita: scrivi il suo numero e «Esce» si sceglie da solo. Puoi anche toccare direttamente la giocatrice in campo.",
  },
  {
    id: "section-livescore-formations",
    path: "/admin/livescore",
    target: "section-livescore-formations",
    title: "Cambia le formazioni",
    body: "Apri questo pannello in qualsiasi momento per correggere un nome, un numero o la libero senza fermare il punteggio (senza contarlo come cambio). Se un numero compare due volte, le caselle diventano rosse finché non lo correggi.",
  },
  {
    id: "section-livescore-public-ingame",
    path: "/admin/livescore",
    target: "section-livescore-public",
    title: "Diretta",
    body: "Accende o spegne la diretta sul sito pubblico. Quando è rossa («In diretta») chi apre il sito vede il punteggio aggiornato ogni pochi secondi.",
  },
  {
    id: "section-livescore-fullscreen",
    path: "/admin/livescore",
    target: "section-livescore-fullscreen",
    title: "Schermo intero",
    body: "Ingrandisce il tabellone per leggerlo bene a bordo campo, da tablet o computer.",
  },
];

export const SECTION_PRONOSTICI_STEPS: BaseTourStep[] = [
  {
    id: "section-pronostici-leaderboard",
    path: "/admin/pronostici",
    target: "section-pronostici-leaderboard",
    title: "Classifica",
    body: "Un punto per ogni set in cui il tuo pronostico si è avvicinato di più al risultato reale: la classifica si aggiorna man mano che arrivano i risultati.",
  },
  {
    id: "section-pronostici-open",
    path: "/admin/pronostici",
    target: "section-pronostici-open",
    title: "Da pronosticare",
    body: "Vedi già tutte le partite della stagione, ma puoi pronosticarle dal giorno in cui si giocano fino a un'ora dopo l'inizio della partita (l'orario di chiusura è scritto accanto a ogni partita): prima di allora la scheda resta bloccata.",
  },
  {
    id: "section-pronostici-results",
    path: "/admin/pronostici",
    target: "section-pronostici-results",
    title: "Risultati",
    body: "Per ogni set giocato, chi ha indovinato di più: qui trovi il confronto tra tutti i pronostici e il risultato reale.",
  },
];

export const SECTION_TRASFERTE_STEPS: BaseTourStep[] = [
  {
    id: "section-trasferte-list",
    path: "/admin/trasferte",
    target: "section-trasferte-list",
    title: "Le partite fuori casa",
    body: "Ogni partita in trasferta ha la sua scheda: tocca «Organizza» per aggiungere i mezzi (con chi guida e i posti) e dire chi viaggia con chi. Accanto alla partita vedi a che punto sei: quante convocate hanno già un passaggio.",
  },
  {
    id: "section-trasferte-rubrica",
    path: "/admin/trasferte",
    target: "section-trasferte-rubrica",
    title: "Rubrica dei genitori",
    body: "I numeri di chi chiamare per ogni atleta si scrivono una volta sola, qui, e compaiono in ogni trasferta. Restano in questa sezione riservata: non si vedono altrove.",
  },
];

export const SECTION_STAFF_STEPS: BaseTourStep[] = [
  {
    id: "section-staff-form",
    path: "/admin/staff",
    target: "section-staff-form",
    title: "Nuovo account admin",
    body: "Basta nome utente e nome completo: viene generata una password temporanea da cambiare al primo accesso.",
  },
  {
    id: "section-staff-list",
    path: "/admin/staff",
    target: "section-staff-list",
    title: "Account esistenti",
    body: "Da qui modifichi nome utente, password o rimuovi l'accesso a un account. \"In attesa del primo accesso\" indica un account creato ma non ancora usato.",
  },
];

export const SECTION_CENTRO_CONTROLLO_STEPS: BaseTourStep[] = [
  {
    id: "section-cc-notification",
    path: "/admin/centro-controllo",
    target: "section-cc-notification",
    title: "Notifica manuale",
    body: "Per avvisi occasionali che non corrispondono a una modifica del calendario, scegliendo se inviarli a tutti gli iscritti o solo allo staff.",
  },
  {
    id: "section-cc-permissions",
    path: "/admin/centro-controllo",
    target: "section-cc-permissions",
    title: "Permessi pagine",
    body: "Per ogni account Admin scegli quali sezioni e quali squadre può gestire: la modifica ha effetto immediato.",
  },
  {
    id: "section-cc-federation",
    path: "/admin/centro-controllo",
    target: "section-cc-federation",
    title: "Classifiche e risultati ufficiali",
    body: "L'indirizzo del girone sul portale della federazione, per ogni categoria: da qui il sito prende la classifica pubblica e i risultati da confermare. Quando esce il girone dell'Under 14 basta incollare qui il suo link.",
  },
  {
    id: "section-cc-activity",
    path: "/admin/centro-controllo",
    target: "section-cc-activity",
    title: "Attività recenti",
    body: "Le creazioni e modifiche più recenti su tutto il sito, con chi le ha fatte quando è noto.",
  },
];

/** Passi di Test fisici, raccontati da Gem, il boia (vedi tour/clash/GemTour.tsx,
 * l'unico mini-tour che parte anche da solo alla prima visita). Un passo
 * esiste solo se il suo elemento è davvero in pagina — senza atlete non ci
 * sono né "Nuovo test" né l'elenco, la ricerca compare oltre 5 atlete —
 * così nessuno resta ad aspettare il timeout di locateTarget. */
export function getTestFisiciTourSteps({
  hasAthletes,
  hasSearch,
}: {
  hasAthletes: boolean;
  hasSearch: boolean;
}): BaseTourStep[] {
  const path = "/admin/test-fisici";
  const steps: (BaseTourStep | false)[] = [
    {
      id: "test-fisici-intro",
      path,
      target: null,
      title: "Ehilà, Capo!",
      body: "Sono Gem, il boia dei Test fisici. Niente paura: qui non salta nessuna testa, saltano solo le atlete… e io misuro quanto in alto. Ti faccio fare un giro veloce del mio regno.",
    },
    hasAthletes && {
      id: "test-fisici-new",
      path,
      target: "test-fisici-new",
      title: "Si comincia da qui",
      body: "Con «Nuovo test» scegli l'atleta e registri tutto in un colpo solo: misure corporee (già precompilate dall'ultima volta), i 3 Squat Jump e ogni altro test che ti inventi.",
    },
    hasAthletes && {
      id: "test-fisici-riepilogo",
      path,
      target: "test-fisici-riepilogo",
      title: "Tutti i fascicoli in un colpo",
      body: "«Riepilogo» mette tutte le atlete in un'unica tabella: ultimi risultati, un giorno di test o tutte le sessioni. Ordini con un clic, vedi chi salta più in alto e scarichi tutto in CSV. Niente più fascicoli da aprire uno a uno.",
    },
    hasSearch && {
      id: "test-fisici-search",
      path,
      target: "test-fisici-search",
      title: "Caccia all'atleta",
      body: "Scrivi un nome invece di scorrere tutto l'elenco: con tante atlete si fa prima. Nessuna sfugge a Gem.",
    },
    hasAthletes && {
      id: "test-fisici-athlete",
      path,
      target: "test-fisici-athlete",
      title: "Il fascicolo segreto",
      body: "Tocca un'atleta per vedere tutte le sue sessioni e come cambiano salto, peso e misure nel tempo. Hai sbagliato un numero? Ogni sessione si può correggere. Chi migliora mi fa sorridere, chi peggiora… altri dieci squat jump. Scherzo! Forse.",
    },
    {
      id: "test-fisici-help",
      path,
      target: "test-fisici-help",
      title: "Ci rivedremo",
      body: "Se ti manco, tocca il punto interrogativo accanto al titolo: torno subito, cappuccio compreso.",
    },
    {
      id: "test-fisici-outro",
      path,
      target: null,
      title: "Al lavoro, Capo!",
      body: "Più in alto saltano, più sono di buon umore. Buoni test e buoni salti!",
    },
  ];
  return steps.filter((step): step is BaseTourStep => Boolean(step));
}
