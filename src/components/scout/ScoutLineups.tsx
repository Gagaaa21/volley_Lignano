import { ArrowLeftRight } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { StartingLineupRow, SubstitutionRow } from "@/lib/scout/court";

/**
 * Le formazioni di partenza di ogni set (posizioni da 1 a 6, in scuro la libero)
 * e i cambi fatti, come nel referto: si vedono solo se in partita si è seguita la
 * formazione.
 */
export function ScoutLineups({
  starts,
  subs,
  opponent,
}: {
  starts: StartingLineupRow[];
  subs: SubstitutionRow[];
  opponent: string;
}) {
  if (starts.length === 0 && subs.length === 0) return null;
  return (
    <Card data-tour="scout-tab-lineups" data-scout-lineups-card>
      <CardHeader className="pb-3">
        <CardTitle>Formazioni e cambi</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Chi era in campo all&apos;inizio di ogni set, dalla posizione 1 (in battuta) alla 6, e i cambi fatti durante il set.
        </p>
      </CardHeader>
      <CardBody className="space-y-5">
        {starts.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="tabular w-full min-w-[26rem] border-collapse text-sm" data-scout-lineups-table>
              <thead className="bg-surface-muted text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left">Set</th>
                  <th className="px-2 py-1.5 text-left">Squadra</th>
                  {[1, 2, 3, 4, 5, 6].map((p) => (
                    <th key={p} className="px-2 py-1.5 text-center">
                      {p}
                    </th>
                  ))}
                  <th className="px-2 py-1.5 text-center">Libero</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {starts.map((row) => (
                  <tr key={`${row.set}-${row.side}`} data-scout-lineup-row={`${row.set}-${row.side}`}>
                    <td className="px-2 py-1.5 text-left font-semibold text-foreground">{row.set}°</td>
                    <td className={cn("px-2 py-1.5 text-left font-semibold", row.side === "us" ? "text-primary" : "text-accent-foreground")}>
                      {row.side === "us" ? "Volley Lignano" : opponent}
                    </td>
                    {row.positions.map((label, i) => (
                      <td key={i} className="px-2 py-1.5 text-center font-bold">
                        {label}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-center font-bold">{row.libero ?? <span className="text-muted-foreground/45">–</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {subs.length > 0 ? (
          <ul className="space-y-1.5 text-sm" aria-label="Cambi" data-scout-subs-list>
            {subs.map((sub, index) => (
              <li key={index} className="flex items-start gap-2 text-foreground">
                <ArrowLeftRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span>
                  <b>{sub.set}° set</b> · {sub.side === "us" ? "Volley Lignano" : opponent} · posizione {sub.position}: esce <b>{sub.out}</b>, entra <b>{sub.in}</b>{" "}
                  <span className="text-muted-foreground">(sul {sub.score.us}–{sub.score.opp})</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nessun cambio segnato.</p>
        )}
      </CardBody>
    </Card>
  );
}
