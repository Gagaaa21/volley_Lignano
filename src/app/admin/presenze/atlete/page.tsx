import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ListPlus, Pencil, Plus, Users } from "lucide-react";
import { getRepo } from "@/lib/db";
import { categoryLabel } from "@/lib/category";
import { Card, CardBody } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { Badge } from "@/components/ui/Badge";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import type { Athlete, Category } from "@/lib/types";
import { deleteAthleteAction } from "./actions";

export const metadata: Metadata = {
  title: "Atlete",
};

function AthleteGroup({ category, athletes }: { category: Category | null; athletes: Athlete[] }) {
  if (athletes.length === 0) return null;
  return (
    <div>
      <p className="eyebrow">{categoryLabel(category)}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {athletes.map((athlete) => (
          <Card key={athlete.id}>
            <CardBody className="flex items-center justify-between gap-3 pt-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/presenze/atleta/${athlete.id}`}
                    className="truncate font-semibold text-foreground hover:text-primary hover:underline"
                  >
                    {athlete.fullName}
                  </Link>
                  {!athlete.isActive && (
                    <Badge className="bg-foreground/10 text-foreground/50">Non attiva</Badge>
                  )}
                </div>
                {athlete.notes && (
                  <p className="mt-1 truncate text-sm text-muted-foreground">{athlete.notes}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <LinkButton
                  href={`/admin/presenze/atlete/${athlete.id}`}
                  variant="outline"
                  size="sm"
                  aria-label="Modifica"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </LinkButton>
                <form action={deleteAthleteAction}>
                  <input type="hidden" name="id" value={athlete.id} />
                  <ConfirmSubmitButton
                    confirmMessage={`Eliminare definitivamente ${athlete.fullName}? Le presenze registrate resteranno ma senza nome collegato.`}
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/8"
                  >
                    Elimina
                  </ConfirmSubmitButton>
                </form>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default async function AthletesPage() {
  const repo = await getRepo();
  const athletes = await repo.listAthletes();

  return (
    <div>
      <LinkButton href="/admin/presenze" variant="ghost" size="sm" className="mb-4 -ml-3.5">
        <ArrowLeft className="h-4 w-4" />
        Torna alle presenze
      </LinkButton>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-foreground">
            <Users className="h-6 w-6 text-primary" />
            Atlete
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            L&apos;anagrafica usata per registrare le presenze agli allenamenti.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LinkButton href="/admin/presenze/atlete/elenco" variant="outline">
            <ListPlus className="h-4 w-4" />
            Aggiungi in elenco
          </LinkButton>
          <LinkButton href="/admin/presenze/atlete/nuova">
            <Plus className="h-4 w-4" />
            Nuova atleta
          </LinkButton>
        </div>
      </div>

      {athletes.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center text-sm text-muted-foreground">
          Nessuna atleta ancora. Aggiungi la prima per iniziare a registrare le presenze.
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          <AthleteGroup category="U14" athletes={athletes.filter((a) => a.category === "U14")} />
          <AthleteGroup category="U15" athletes={athletes.filter((a) => a.category === "U15")} />
          <AthleteGroup category={null} athletes={athletes.filter((a) => a.category === null)} />
        </div>
      )}
    </div>
  );
}
