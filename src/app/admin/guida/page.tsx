import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  ClipboardCheck,
  FlaskConical,
  Gauge,
  Globe,
  KeyRound,
  Puzzle,
  Swords,
  Users,
} from "lucide-react";
import { getRepo } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Guida",
};

interface Section {
  icon: typeof CalendarClock;
  title: string;
  intro: string;
  points: string[];
}

const SECTIONS: Section[] = [
  {
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
    icon: Swords,
    title: "Partite",
    intro: "Partite di campionato per categoria U14/U15.",
    points: [
      "Ogni partita ha categoria, avversario, casa/trasferta, data/ora e luogo.",
      "Compaiono nel calendario pubblico insieme agli allenamenti, filtrabili per categoria.",
      "Creare, modificare o eliminare una partita invia una notifica push agli iscritti.",
      "Nella scheda di una partita si scelgono le convocate, poi si costruiscono le formazioni per ciascuno dei 5 set su un campo interattivo (ruoli S/OH/MB/OP/L e capitana): sono riservate allo staff, mai visibili sul sito pubblico, ed esportabili in PDF.",
    ],
  },
  {
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
    icon: ClipboardCheck,
    title: "Presenze",
    intro: "Registro presenze collegato agli allenamenti del calendario.",
    points: [
      "In \"Atlete\" si gestisce l'anagrafica: si possono aggiungere una alla volta o incollando un elenco di nominativi insieme (categoria U14/U15 facoltativa, assegnabile anche dopo).",
      "Dalla schermata principale si sceglie l'allenamento da registrare: ogni atleta è di default \"Presente\", con un tasto per segnarla \"Assente\" e, in quel caso, specificare se l'assenza è giustificata o no.",
      "Lo \"Storico\" mostra tutti i registri salvati (modificabili in ogni momento) e, per ogni atleta, la propria percentuale di presenza e la cronologia.",
      "Appena salvi un registro, l'elenco nominativo con lo stato di ciascuna atleta compare anche nel dettaglio di quell'allenamento sul calendario pubblico, visibile a chiunque senza bisogno di accedere.",
    ],
  },
  {
    icon: Users,
    title: "Staff",
    intro: "Gestione degli account che accedono all'area riservata.",
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
      "Il pulsante \"Sito pubblico\" nell'header porta alla homepage pubblica; da lì \"Area riservata\" torna al login.",
      "Chiunque visiti il sito (pubblico o area riservata) può installare l'app sul proprio dispositivo e attivare le notifiche: viene chiesto una sola volta, la prima volta che si naviga il sito.",
      "Chi ha attivato le notifiche riceve un avviso ogni volta che un allenamento o una partita viene aggiunto, modificato o rimosso dal calendario.",
    ],
  },
];

export default async function GuidaPage() {
  const session = await requireStaff();
  const repo = await getRepo();
  const staff = await repo.getStaffById(session.sub);
  if (staff && !staff.hasSeenGuide) {
    await repo.markGuideSeen(session.sub);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-bold text-foreground">Guida al sito</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Come funzionano le sezioni dell&apos;area riservata di Volley Lignano. Questa pagina resta
        sempre consultabile dal menu.
      </p>

      <div className="mt-6 space-y-4">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.title}>
              <CardHeader className="flex flex-row items-center gap-3">
                <span className="icon-chip shrink-0">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="font-display text-base font-semibold text-foreground">
                    {section.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">{section.intro}</p>
                </div>
              </CardHeader>
              <CardBody className="pt-0">
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground/80">
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
            <CardHeader className="flex flex-row items-center gap-3">
              <span className="icon-chip shrink-0">
                <Gauge className="h-4 w-4" />
              </span>
              <div>
                <h2 className="font-display text-base font-semibold text-foreground">
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
            <CardHeader className="flex flex-row items-center gap-3">
              <span className="icon-chip shrink-0">
                <FlaskConical className="h-4 w-4" />
              </span>
              <div>
                <h2 className="font-display text-base font-semibold text-foreground">
                  Modalità prova
                </h2>
                <p className="text-sm text-muted-foreground">Solo Developer.</p>
              </div>
            </CardHeader>
            <CardBody className="pt-0">
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground/80">
                <li>
                  Il pulsante &quot;Modalità prova&quot; accanto al tuo nome apre una copia separata
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

        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <span className="icon-chip shrink-0">
              <KeyRound className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-base font-semibold text-foreground">Il tuo account</h2>
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
