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
    body: "Tocca una data per collegare o cambiare la scheda di quel giorno: vale solo per quella data, non per l'intera regola.",
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
    id: "section-partite-cards",
    path: "/admin/partite",
    target: "section-partite-cards",
    title: "Le tue partite",
    body: "Ogni scheda apre i dettagli della partita, dove imposti anche convocazioni, formazioni per set ed esportazione PDF.",
  },
  {
    id: "section-partite-new",
    path: "/admin/partite",
    target: "section-partite-new",
    title: "Nuova partita",
    body: "Categoria, avversaria, casa o trasferta, data e ora: da qui crei una nuova partita di campionato o un'amichevole.",
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
    body: "Premi qui e incolla il testo dell'allenamento così come lo scrivi di solito (es. \"1. TITOLO – 10'\"): viene diviso automaticamente in blocchi, uno per intestazione, senza modificare il contenuto.",
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
    title: "Allenamento o Partita",
    body: "In Allenamento inserisci i nomi delle atlete; in Partita i numeri di maglia, con il nome dell'avversaria e il suo colore.",
  },
  {
    id: "section-livescore-court",
    path: "/admin/livescore",
    target: "section-livescore-court",
    title: "Disponi le due squadre",
    body: "Tocca ogni posizione per assegnare chi gioca lì, seguendo la disposizione reale in campo.",
  },
  {
    id: "section-livescore-libero",
    path: "/admin/livescore",
    target: "section-livescore-libero",
    title: "Libero: entra ed esce da sola",
    body: "Scrivi qui il nome (o il numero) della libero e indica quale centrale sostituisce: da qui in poi il tabellone calcola da solo la rotazione a ogni cambio palla e la fa entrare/uscire al posto giusto, senza bisogno di toccare nulla a mano.",
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
    id: "section-livescore-score",
    path: "/admin/livescore",
    target: "section-livescore-score",
    title: "Segna un punto",
    body: "Un tocco sul pulsante della squadra che ha vinto lo scambio: punteggio e servizio si aggiornano da soli, rotazione compresa.",
  },
  {
    id: "section-livescore-toolbar",
    path: "/admin/livescore",
    target: "section-livescore-toolbar",
    title: "Le azioni della partita",
    body: "\"Chiudi set\" quando il punteggio lo consente, \"Annulla\" per tornare indietro di un'azione, \"Inverti\" per scambiare i lati, \"Nuovo\" per ricominciare da capo.",
  },
  {
    id: "section-livescore-formations",
    path: "/admin/livescore",
    target: "section-livescore-formations",
    title: "Cambia le formazioni",
    body: "Apri questo pannello in qualsiasi momento per correggere un nome, un numero o la libero senza fermare il punteggio.",
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
    body: "Vedi già tutte le partite della stagione, ma puoi pronosticarle solo il giorno stesso in cui si giocano: prima di allora la scheda resta bloccata.",
  },
  {
    id: "section-pronostici-results",
    path: "/admin/pronostici",
    target: "section-pronostici-results",
    title: "Risultati",
    body: "Per ogni set giocato, chi ha indovinato di più: qui trovi il confronto tra tutti i pronostici e il risultato reale.",
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
      body: "Tocca un'atleta per vedere tutte le sue sessioni e come cambiano salto, peso e misure nel tempo. Chi migliora mi fa sorridere, chi peggiora… altri dieci squat jump. Scherzo! Forse.",
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
