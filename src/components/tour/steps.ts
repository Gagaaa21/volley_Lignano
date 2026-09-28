import { isPageAvailableForTeam, type AdminPage, type StaffRole, type TrainingTeam } from "@/lib/types";

/** Un passo del tour guidato: `target` è l'id `data-tour` dell'elemento
 * reale da evidenziare sulla pagina `path` (null = scheda centrata, senza
 * evidenziare nulla — usato solo per benvenuto/chiusura). `page` filtra il
 * passo esattamente come AdminHeader filtra la voce di menu corrispondente
 * (isPageAvailableForTeam + allowedPages, Developer sempre incluso):
 * un passo per una pagina che l'account non può vedere non deve nemmeno
 * essere tentato, altrimenti Tour cercherebbe per sempre un link che
 * AdminHeader non ha mai disegnato. */
export interface TourStep {
  id: string;
  path: string;
  target: string | null;
  title: string;
  body: string;
  page?: AdminPage;
  devOnly?: boolean;
  minTeams?: number;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    path: "/admin",
    target: null,
    title: "Benvenuto/a in Volley Lignano!",
    body: "Facciamo un giro veloce dell'area riservata. Premi \"Avanti\" per iniziare, o \"Salta il tour\" se preferisci esplorare da solo/a.",
  },
  {
    id: "dashboard-stats",
    path: "/admin",
    target: "dashboard-stats",
    title: "I numeri principali",
    body: "A colpo d'occhio: allenamenti attivi, partite in calendario, atlete e presenze da registrare. Cliccando su una di queste vai dritto alla sezione.",
  },
  {
    id: "dashboard-upcoming",
    path: "/admin",
    target: "dashboard-upcoming",
    title: "Prossimi impegni",
    body: "Gli allenamenti e le partite più vicini nel tempo: un clic apre subito il dettaglio.",
  },
  {
    id: "team-switcher",
    path: "/admin",
    target: "team-switcher",
    minTeams: 2,
    title: "Cambia squadra",
    body: "Se segui sia U14/U15 sia Minivolley, da qui passi dall'una all'altra: il resto dell'area riservata mostra sempre i dati della squadra scelta.",
  },
  {
    id: "nav-allenamenti",
    path: "/admin/allenamenti",
    target: "nav-allenamenti",
    page: "allenamenti",
    title: "Allenamenti",
    body: "Regole ricorrenti (giorno, orario, luogo) che generano da sole il calendario pubblico. Da qui colleghi anche le schede allenamento a ogni data.",
  },
  {
    id: "nav-partite",
    path: "/admin/partite",
    target: "nav-partite",
    page: "partite",
    title: "Partite",
    body: "Partite di campionato: avversaria, casa/trasferta, risultato set per set e formazioni per ciascun set, esportabili in PDF.",
  },
  {
    id: "nav-schede",
    path: "/admin/schede",
    target: "nav-schede",
    page: "schede",
    title: "Schede allenamento",
    body: "Incolla il testo di un allenamento così come lo scrivi di solito: viene diviso automaticamente in blocchi, uno per intestazione.",
  },
  {
    id: "nav-presenze",
    path: "/admin/presenze",
    target: "nav-presenze",
    page: "presenze",
    title: "Presenze",
    body: "Registro presenze collegato al calendario allenamenti, con storico e percentuale di presenza per ogni atleta.",
  },
  {
    id: "nav-livescore",
    path: "/admin/livescore",
    target: "nav-livescore",
    page: "livescore",
    title: "Live score",
    body: "Un tabellone punteggio dal vivo per allenamenti o partite: calcola da solo la rotazione delle giocatrici a ogni cambio palla, gestendo anche gli ingressi e le uscite della libero.",
  },
  {
    id: "nav-pronostici",
    path: "/admin/pronostici",
    target: "nav-pronostici",
    page: "pronostici",
    title: "Pronostici",
    body: "Pronostica il punteggio delle partite (anche dei tornei) insieme al resto dello staff: chi si avvicina di più vince il set.",
  },
  {
    id: "nav-staff",
    path: "/admin/staff",
    target: "nav-staff",
    page: "staff",
    title: "Staff",
    body: "Da qui si creano nuovi account per lo staff e si gestisce chi ha accesso all'area riservata.",
  },
  {
    id: "nav-centro-controllo",
    path: "/admin/centro-controllo",
    target: "nav-centro-controllo",
    devOnly: true,
    title: "Centro di controllo",
    body: "Da qui decidi quali pagine e quali squadre può vedere ogni Admin, e puoi nascondere un account admin agli altri admin.",
  },
  {
    id: "nav-manutenzione",
    path: "/admin/manutenzione",
    target: "nav-manutenzione",
    devOnly: true,
    title: "Manutenzione",
    body: "Una panoramica di righe e spazio occupato su Supabase, utile per restare entro i limiti del piano gratuito.",
  },
  {
    id: "test-mode-toggle",
    path: "/admin",
    target: "test-mode-toggle",
    devOnly: true,
    title: "Modalità prova",
    body: "Apre una copia separata dei dati per provare lo strumento senza rischi: niente notifiche, nessuna modifica reale, tutto sparisce uscendo.",
  },
  {
    id: "nav-guida",
    path: "/admin/guida",
    target: "nav-guida",
    page: "guida",
    title: "Guida",
    body: "Questa pagina raccoglie tutto quello che ti abbiamo appena mostrato, sempre consultabile — e da qui puoi anche rifare questo tour quando vuoi.",
  },
  {
    id: "finish",
    path: "/admin/guida",
    target: null,
    title: "Tutto pronto!",
    body: "Questo è tutto per ora. Buon lavoro!",
  },
];

/** Riduce TOUR_STEPS a quelli che questo specifico account può davvero
 * vedere, con la stessa logica di AdminHeader.visibleNavItems e
 * admin/page.tsx.visibleSections — altrimenti un passo per una pagina non
 * permessa farebbe cercare a Tour un elemento che non esisterà mai. */
export function getVisibleSteps(
  role: StaffRole,
  allowedPages: AdminPage[],
  allowedTeams: TrainingTeam[],
  activeTeam: TrainingTeam,
): TourStep[] {
  return TOUR_STEPS.filter((step) => {
    if (step.devOnly && role !== "dev") return false;
    if (step.minTeams && allowedTeams.length < step.minTeams) return false;
    if (step.page) {
      if (!isPageAvailableForTeam(step.page, activeTeam)) return false;
      if (role !== "dev" && !allowedPages.includes(step.page)) return false;
    }
    return true;
  });
}
