import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  ClipboardCheck,
  Compass,
  FlaskConical,
  Gauge,
  Globe,
  KeyRound,
  Puzzle,
  Swords,
  Target,
  Trophy,
  Users,
  Volleyball,
} from "lucide-react";
import { requireStaff, resolveActiveTeam, getOwnStaff } from "@/lib/auth/guard";
import { isPageAvailableForTeam, type AdminPage } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Guida",
};

interface Section {
  /** Assente per una sezione senza permesso dedicato (es. "Sito pubblico e
   * notifiche"): visibile a chiunque raggiunga questa pagina, senza filtro. */
  page?: AdminPage;
  icon: typeof CalendarClock;
  title: string;
  intro: string;
  points: string[];
}

const SECTIONS: Section[] = [
  {
    page: "allenamenti",
    icon: CalendarClock,
    title: "Allenamenti",
    intro: "Regole ricorrenti che generano automaticamente il calendario pubblico.",
    points: [
      "Ogni regola definisce giorni della settimana, orario, luogo e un periodo di validità (con data di fine facoltativa).",
      "Le regole attive compaiono nel calendario pubblico della homepage per tutte le settimane comprese nel periodo.",
      "Modificare o eliminare una regola aggiorna subito la vista pubblica e invia una notifica push a chi ha attivato le notifiche.",
    ],
  },
  {
    page: "partite",
    icon: Swords,
    title: "Partite",
    intro: "Partite di campionato per categoria U14/U15.",
    points: [
      "Ogni partita ha categoria, avversario, casa/trasferta, data/ora e luogo.",
      "Compaiono nel calendario pubblico insieme agli allenamenti, filtrabili per categoria.",
      "Creare, modificare o eliminare una partita invia una notifica push agli iscritti.",
      "Nella scheda di una partita si scelgono le convocate, poi si costruiscono le formazioni per ciascuno dei 5 set su un campo interattivo (ruoli S/OH/MB/OP/L e capitana): sono riservate allo staff, mai visibili sul sito pubblico, ed esportabili in PDF.",
      "In cima all'elenco, sotto \"Calendario ufficiale\", compaiono le partite del campionato che il portale della federazione ha in calendario e nel sito mancano: spunta quelle giuste e premi \"Aggiungi\". Avversaria, data, ora e palestra arrivano dal portale; ritrovo e convocazioni li imposti dopo, partita per partita. Se nel sito c'è già una partita simile (data spostata?) la riga parte deselezionata, così non si duplica. Se il portale sposta una partita che hai già nel calendario, la dashboard e questa sezione te lo segnalano (\"ha cambiato data o ora\"): con \"Aggiorna\" porti il sito alla nuova data, oppure lasci com'è se quella giusta è la tua.",
      "In cima all'elenco, sotto \"Risultati ufficiali\", compaiono i risultati letti dal portale della federazione: con \"Conferma risultato\" il sito compila i set della partita, con \"Ignora\" la gara non viene più proposta. Se hai già scritto un risultato diverso resta il tuo e ti viene solo segnalata la differenza; \"Usa quello ufficiale\" lo sostituisce solo se lo scegli tu. \"Aggiorna ora\" rilegge subito il portale.",
      "La classifica del girone, con tutte le squadre e il loro logo (per la nostra c'è lo stemma del sito), compare in fondo alla homepage pubblica insieme alla data dell'ultimo aggiornamento.",
    ],
  },
  {
    page: "schede",
    icon: Puzzle,
    title: "Schede allenamento",
    intro: "Incolla il testo di un allenamento e viene diviso automaticamente in blocchi.",
    points: [
      "Sull'allenamento desiderato incolli il testo così come lo scrivi di solito (es. \"1. TITOLO – 10'\"): viene diviso automaticamente in blocchi, uno per intestazione.",
      "Il contenuto di ogni blocco resta esattamente come scritto, senza modifiche: si possono solo riordinare o rimuovere dalla scheda.",
      "Ogni volta che colleghi una scheda a un allenamento ti viene chiesto se renderla visibile alle atlete nel calendario pubblico: di default resta privata, allo staff. Puoi cambiare idea in qualsiasi momento dalla pagina di quell'allenamento.",
    ],
  },
  {
    page: "presenze",
    icon: ClipboardCheck,
    title: "Presenze",
    intro: "Registro presenze collegato agli allenamenti del calendario.",
    points: [
      "In \"Atlete\" si gestisce l'anagrafica: si possono aggiungere una alla volta o incollando un elenco insieme. Per U14/U15 c'è una categoria facoltativa (U14/U15, assegnabile anche dopo); per il Minivolley un gruppo facoltativo (CDA Lignano o CDA San Michele) — nell'elenco incollato il gruppo si scrive nella prima colonna di ogni riga, separata da una tabulazione da nome e cognome.",
      "Per U14/U15, dalla schermata principale si sceglie l'allenamento da registrare: ogni atleta è di default \"Presente\", con un tasto per segnarla \"Assente\" e, in quel caso, specificare se l'assenza è giustificata o no.",
      "Per il Minivolley invece si tocca solo chi era presente, raggruppate per CDA: nessuna assenza da segnare, chi non viene toccato resta semplicemente non registrato per quel giorno.",
      "Lo \"Storico\" mostra tutti i registri salvati (modificabili in ogni momento) e, per ogni atleta, la propria percentuale di presenza e la cronologia.",
      "Appena salvi un registro, l'elenco nominativo con lo stato di ciascuna atleta compare anche nel dettaglio di quell'allenamento sul calendario pubblico, visibile a chiunque senza bisogno di accedere. Per il Minivolley c'è anche una pagina pubblica dedicata (\"Presenze\" nell'header del sito Minivolley) con il conteggio delle presenze per atleta, raggruppato per CDA.",
    ],
  },
  {
    page: "livescore",
    icon: Volleyball,
    title: "Live score",
    intro: "Un tabellone punteggio dal vivo per allenamenti e partite.",
    points: [
      "Si dispongono le due squadre sul campo, indicando anche la libero: da lì il tabellone calcola da solo la rotazione a ogni cambio palla, gestendo pure gli ingressi e le uscite della libero.",
      "In modalità Partita si usano i numeri di maglia e si sceglie il nome e il colore dell'avversaria; in Allenamento si usano direttamente i nomi.",
      "Punteggio, set, formazioni e stato della libero si aggiornano in tempo reale e restano salvati finché non si preme \"Nuovo\".",
    ],
  },
  {
    page: "pronostici",
    icon: Target,
    title: "Pronostici",
    intro: "Pronostica il punteggio di ogni set insieme al resto dello staff.",
    points: [
      "Tutte le partite della stagione sono visibili fin da subito, ma si può pronosticare solo il giorno stesso in cui si gioca.",
      "Chi si avvicina di più al risultato reale di un set vince il set: i punti totalizzati compongono la classifica.",
      "Anche le partite dei tornei si pronosticano, una gara alla volta.",
    ],
  },
  {
    page: "staff",
    icon: Users,
    title: "Staff",
    intro: "Gestione degli account che accedono all'area tecnici.",
    points: [
      "Solo i Developer creano nuovi account Admin, con una password temporanea da cambiare al primo accesso.",
      "Un Developer può anche modificare il nome utente di un Admin o impostargli una nuova password temporanea.",
      "Solo un Developer può rimuovere l'accesso a un account Admin.",
    ],
  },
  {
    icon: Globe,
    title: "Sito pubblico e notifiche",
    intro: "Il calendario è visibile a chiunque, senza bisogno di un account.",
    points: [
      "Il pulsante \"Sito pubblico\" nell'header porta alla homepage pubblica; da lì \"Area tecnici\" torna al login.",
      "Chiunque visiti il sito (pubblico o area tecnici) può installare l'app sul proprio dispositivo e attivare le notifiche: viene chiesto una sola volta, la prima volta che si naviga il sito.",
      "Chi ha attivato le notifiche riceve un avviso ogni volta che un allenamento o una partita viene aggiunto, modificato o rimosso dal calendario.",
      "Le notifiche partono con priorità alta e restano sullo schermo finché non vengono aperte o chiuse. Il sito rinnova da solo l'iscrizione di chi le ha attivate se il browser la cancella (succede con il risparmio energia).",
      "Se un telefono Android non riceve le notifiche: Impostazioni > App > Chrome (o l'app \"Volley Lignano\" se installata) > Batteria > \"Senza restrizioni\"; poi in Chrome > Impostazioni > Impostazioni sito > Notifiche controlla che il sito sia tra quelli consentiti, e che \"Non disturbare\" non sia attivo. Con l'app installata sulla schermata Home le notifiche arrivano in modo molto più affidabile che dal solo sito aperto in Chrome.",
      "Su iPhone le notifiche funzionano solo se il sito è aggiunto alla schermata Home (Condividi > Aggiungi alla schermata Home) e si apre da lì; da Safari semplice non arrivano.",
      "Il Developer può far riapparire a tutti il messaggio \"Attiva le notifiche\" dal Centro di controllo (\"Chiedi a tutti di attivare le notifiche\"): lo vede chi apre il sito e non le ha ancora attivate, anche se l'aveva chiuso da poco. Chi le ha già attivate o le ha bloccate dal browser non vede niente.",
    ],
  },
];

export default async function GuidaPage() {
  const session = await requireStaff();
  const team = await resolveActiveTeam(session);

  let visibleSections = SECTIONS.filter(
    (section) => !section.page || isPageAvailableForTeam(section.page, team),
  );
  if (session.role !== "dev") {
    const staff = await getOwnStaff(session.sub);
    const allowedPages = staff?.allowedPages ?? [];
    visibleSections = visibleSections.filter((section) => !section.page || allowedPages.includes(section.page));
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Guida al sito"
        description="Come funzionano le sezioni dell'area tecnici. Questa pagina resta sempre consultabile dal menu."
        actions={
          <LinkButton href="/admin?tour=restart" variant="outline">
            <Compass className="h-4 w-4" />
            Rivedi il tour guidato
          </LinkButton>
        }
      />

      <div className="space-y-4">
        {visibleSections.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.title}>
              <CardHeader className="flex flex-row items-center gap-3.5">
                <span className="icon-chip shrink-0">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold text-foreground">
                    {section.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">{section.intro}</p>
                </div>
              </CardHeader>
              <CardBody className="pt-0">
                <ul className="space-y-2 text-sm leading-relaxed text-foreground/80 [&>li]:relative [&>li]:pl-5 [&>li]:before:absolute [&>li]:before:left-1 [&>li]:before:top-[0.6em] [&>li]:before:h-1.5 [&>li]:before:w-1.5 [&>li]:before:rounded-full [&>li]:before:bg-primary/45 [&>li]:before:content-['']">
                  {section.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          );
        })}

        {session.role === "dev" && (
          <Card>
            <CardHeader className="flex flex-row items-center gap-3.5">
              <span className="icon-chip shrink-0">
                <Gauge className="h-4 w-4" />
              </span>
              <div>
                <h2 className="font-display text-base font-bold text-foreground">
                  Manutenzione
                </h2>
                <p className="text-sm text-muted-foreground">Solo Developer.</p>
              </div>
            </CardHeader>
            <CardBody className="pt-0">
              <p className="text-sm text-foreground/80">
                La pagina{" "}
                <Link href="/admin/manutenzione" className="font-semibold text-primary hover:underline">
                  Manutenzione
                </Link>{" "}
                mostra righe e spazio occupato per ogni tabella su Supabase, e spiega la cache
                della homepage pubblica introdotta per restare entro i limiti mensili del piano.
              </p>
            </CardBody>
          </Card>
        )}

        {session.role === "dev" && (
          <Card>
            <CardHeader className="flex flex-row items-center gap-3.5">
              <span className="icon-chip shrink-0">
                <FlaskConical className="h-4 w-4" />
              </span>
              <div>
                <h2 className="font-display text-base font-bold text-foreground">
                  Modalità prova
                </h2>
                <p className="text-sm text-muted-foreground">Solo Developer.</p>
              </div>
            </CardHeader>
            <CardBody className="pt-0">
              <ul className="space-y-2 text-sm leading-relaxed text-foreground/80 [&>li]:relative [&>li]:pl-5 [&>li]:before:absolute [&>li]:before:left-1 [&>li]:before:top-[0.6em] [&>li]:before:h-1.5 [&>li]:before:w-1.5 [&>li]:before:rounded-full [&>li]:before:bg-primary/45 [&>li]:before:content-['']">
                <li>
                  La voce &quot;Modalità prova&quot; nel menu del tuo account (in alto a destra) apre una copia separata
                  dei dati (allenamenti, partite, formazioni, schede, presenze, atlete): puoi creare,
                  modificare o eliminare qualsiasi cosa per provare lo strumento senza rischi.
                </li>
                <li>
                  Mentre sei in modalità prova non viene inviata nessuna notifica push, e nessuno di
                  quei cambiamenti compare mai sul calendario pubblico.
                </li>
                <li>
                  Uscendo (dal banner in alto) tutte le modifiche fatte in prova spariscono e torni
                  ai dati reali esattamente come li avevi lasciati. Account staff e iscrizioni alle
                  notifiche non sono mai coinvolti dalla modalità prova.
                </li>
              </ul>
            </CardBody>
          </Card>
        )}

        {session.role === "dev" && (
          <Card>
            <CardHeader className="flex flex-row items-center gap-3.5">
              <span className="icon-chip shrink-0">
                <Trophy className="h-4 w-4" />
              </span>
              <div>
                <h2 className="font-display text-base font-bold text-foreground">
                  Classifiche e risultati ufficiali
                </h2>
                <p className="text-sm text-muted-foreground">Solo Developer.</p>
              </div>
            </CardHeader>
            <CardBody className="pt-0">
              <ul className="space-y-2 text-sm leading-relaxed text-foreground/80 [&>li]:relative [&>li]:pl-5 [&>li]:before:absolute [&>li]:before:left-1 [&>li]:before:top-[0.6em] [&>li]:before:h-1.5 [&>li]:before:w-1.5 [&>li]:before:rounded-full [&>li]:before:bg-primary/45 [&>li]:before:content-['']">
                <li>
                  Dal{" "}
                  <Link href="/admin/centro-controllo" className="font-semibold text-primary hover:underline">
                    Centro di controllo
                  </Link>{" "}
                  imposti, per ogni categoria, l&apos;indirizzo del girone sul portale della federazione e il nome con
                  cui la nostra squadra compare in classifica. Lascia l&apos;indirizzo vuoto finché il girone non è
                  pubblicato: la categoria resta nascosta.
                </li>
                <li>
                  Il sito rilegge il portale in secondo piano quando i dati hanno più di 30 minuti (e una volta al
                  giorno in automatico). Se il portale non risponde o cambia pagina, restano gli ultimi dati validi con
                  la loro data e l&apos;errore compare in{" "}
                  <Link href="/admin/manutenzione" className="font-semibold text-primary hover:underline">
                    Manutenzione
                  </Link>
                  .
                </li>
              </ul>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center gap-3.5">
            <span className="icon-chip shrink-0">
              <KeyRound className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-base font-bold text-foreground">Il tuo account</h2>
              <p className="text-sm text-muted-foreground">Password e accesso.</p>
            </div>
          </CardHeader>
          <CardBody className="pt-0">
            <p className="text-sm text-foreground/80">
              Puoi cambiare la tua password in qualsiasi momento dalla pagina{" "}
              <Link href="/admin/cambia-password" className="font-semibold text-primary hover:underline">
                Cambia password
              </Link>
              .
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
