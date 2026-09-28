import type { TrainingTeam } from "@/lib/types";
import type { BaseTourStep } from "./engine/types";

/** Tour del sito pubblico: uguale per chiunque lo visiti (nessun permesso
 * da controllare), solo il contenuto cambia tra U14/U15 e Minivolley — due
 * siti distinti con pagine diverse. Solo elementi sempre presenti al
 * render: né InstallButton (spesso assente su desktop) né
 * SeasonRecordSection (assente prima del primo risultato stagionale) sono
 * usati come target, altrimenti il passo resterebbe bloccato per il
 * timeout di locateTarget e verrebbe saltato per la maggior parte dei primi
 * visitatori. */
const PUBLIC_TOUR_STEPS_U14U15: BaseTourStep[] = [
  {
    id: "welcome",
    path: "/",
    target: null,
    title: "Benvenuto/a sul sito di Volley Lignano!",
    body: "Ecco come trovare allenamenti e partite delle nostre Under 14 e Under 15. Premi \"Avanti\" per un giro veloce, o \"Salta il tour\" per esplorare da solo/a.",
  },
  {
    id: "public-calendar",
    path: "/",
    target: "public-calendar",
    title: "Calendario",
    body: "Tutti gli allenamenti e le partite del mese: tocca un giorno o un evento per vederne i dettagli.",
  },
  {
    id: "public-category-filter",
    path: "/",
    target: "public-category-filter",
    title: "Filtra per categoria",
    body: "Passa dalla vista di tutte le squadre a quella di una sola categoria, Under 14 o Under 15.",
  },
  {
    id: "public-ics-button",
    path: "/",
    target: "public-ics-button",
    title: "Aggiungi al tuo calendario",
    body: "Con un tocco, allenamenti e partite si aggiungono al calendario del telefono e restano sempre aggiornati.",
  },
  {
    id: "public-nav-area-tecnici",
    path: "/",
    target: "public-nav-area-tecnici",
    title: "Sei dello staff tecnico?",
    body: "Da qui accedi all'area riservata per gestire allenamenti, partite e presenze.",
  },
];

const PUBLIC_TOUR_STEPS_MINIVOLLEY: BaseTourStep[] = [
  {
    id: "welcome",
    path: "/minivolley",
    target: null,
    title: "Benvenuto/a sul sito Minivolley!",
    body: "Ecco come trovare allenamenti e tornei del Minivolley. Premi \"Avanti\" per un giro veloce, o \"Salta il tour\" per esplorare da solo/a.",
  },
  {
    id: "public-calendar",
    path: "/minivolley",
    target: "public-calendar",
    title: "Calendario",
    body: "Tutti gli allenamenti e i tornei del mese: tocca un giorno o un evento per vederne i dettagli.",
  },
  {
    id: "public-ics-button",
    path: "/minivolley",
    target: "public-ics-button",
    title: "Aggiungi al tuo calendario",
    body: "Con un tocco, allenamenti e tornei si aggiungono al calendario del telefono e restano sempre aggiornati.",
  },
  {
    id: "public-nav-presenze",
    path: "/minivolley",
    target: "public-nav-presenze",
    title: "Presenze",
    body: "Quante volte ciascuna bambina o bambino è stato presente agli allenamenti, sempre visibile qui.",
  },
  {
    id: "public-nav-area-tecnici",
    path: "/minivolley",
    target: "public-nav-area-tecnici",
    title: "Sei dello staff tecnico?",
    body: "Da qui accedi all'area riservata per gestire allenamenti e presenze.",
  },
];

export function getPublicTourSteps(team: TrainingTeam): BaseTourStep[] {
  return team === "minivolley" ? PUBLIC_TOUR_STEPS_MINIVOLLEY : PUBLIC_TOUR_STEPS_U14U15;
}
