import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarClock, Info, MapPin, Pencil, StickyNote, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import type { Match } from "@/lib/types";

function Row({ icon, label, children, dataKey }: { icon: ReactNode; label: string; children: ReactNode; dataKey: string }) {
  return (
    <div className="flex gap-3" data-match-detail={dataKey}>
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 text-sm leading-snug text-foreground">{children}</dd>
      </div>
    </div>
  );
}

/**
 * I dettagli di una partita in breve, in cima alla sua scheda: quando, dove, il ritrovo, che partita è e la nota. Si
 * cambiano con «Modifica», che apre il modulo in una pagina a parte (con l'eliminazione in fondo).
 */
export function MatchDetailsCard({ match }: { match: Match }) {
  const day = format(parseISO(match.matchDate.slice(0, 10)), "EEEE d MMMM yyyy", { locale: it });
  const meeting = [match.meetingTime && `alle ${match.meetingTime}`, match.meetingLocation && `a ${match.meetingLocation}`].filter(Boolean).join(" ");
  const kind = [match.isHome ? "In casa" : "In trasferta", match.isTournament ? "torneo" : match.isFriendly ? "amichevole" : "campionato"].join(" · ");

  return (
    <Card className="mb-6" data-match-details>
      <CardBody className="pt-5 sm:pt-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="font-display text-base font-bold text-foreground">Dettagli</p>
          <LinkButton href={`/admin/partite/${match.id}/modifica`} variant="outline" size="sm" data-match-edit-link>
            <Pencil className="h-4 w-4" />
            Modifica
          </LinkButton>
        </div>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <Row icon={<CalendarClock className="h-4 w-4" />} label="Quando" dataKey="quando">
            {day} · <b className="tabular">{match.matchDate.slice(11, 16)}</b>
          </Row>
          <Row icon={<MapPin className="h-4 w-4" />} label="Dove" dataKey="dove">
            {match.location}
          </Row>
          <Row icon={<Users className="h-4 w-4" />} label="Ritrovo" dataKey="ritrovo">
            {meeting || <span className="text-muted-foreground">Come la partita</span>}
          </Row>
          <Row icon={<Info className="h-4 w-4" />} label="Partita" dataKey="tipo">
            {kind}
          </Row>
          {match.notes && (
            <div className="sm:col-span-2">
              <Row icon={<StickyNote className="h-4 w-4" />} label="Nota" dataKey="nota">
                <span className="whitespace-pre-line">{match.notes}</span>
              </Row>
            </div>
          )}
        </dl>
      </CardBody>
    </Card>
  );
}
