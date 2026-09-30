"use client";

import { useMemo, useState } from "react";
import { EyeOff, Pencil, Search, ShieldCheck } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/LinkButton";
import { ConfirmSubmitButton } from "@/components/forms/ConfirmSubmitButton";
import type { PublicStaffMember } from "@/lib/types";
import { deleteStaffAction } from "./actions";

/** Elenco staff con ricerca (mostrata solo oltre 5 account, stesso limite
 * già usato altrove) su nome e nome utente. Riceve PublicStaffMember, non
 * StaffMember: quest'ultimo porta passwordHash, che come "use client"
 * finirebbe altrimenti nel payload RSC inviato al browser. */
export function StaffMemberList({
  staff,
  currentUserId,
  isDev,
}: {
  staff: PublicStaffMember[];
  currentUserId: string;
  isDev: boolean;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(
      (m) => m.fullName.toLowerCase().includes(q) || m.username.toLowerCase().includes(q),
    );
  }, [staff, query]);

  return (
    <div data-tour="section-staff-list">
      {staff.length > 5 && (
        <div className="relative mb-4 max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per nome o utente…"
            className="w-full rounded-full border border-border-subtle bg-surface py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-foreground/35 focus:border-primary/40 focus:outline-none"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-subtle bg-surface px-6 py-12 text-center text-sm text-foreground/50">
          Nessun account trovato per &quot;{query}&quot;.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((member) => {
            const canManage = isDev && member.role !== "dev" && member.id !== currentUserId;
            return (
              <Card key={member.id}>
                <CardBody className="flex items-center justify-between gap-4 pt-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-foreground">{member.fullName}</p>
                      <Badge
                        className={
                          member.role === "dev"
                            ? "bg-sand-200 text-sand-800"
                            : "bg-sea-100 text-sea-700"
                        }
                      >
                        {member.role === "dev" ? (
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            Developer
                          </span>
                        ) : (
                          "Admin"
                        )}
                      </Badge>
                      {/* Visibile solo al Developer: gli altri admin non
                       * vedono nemmeno questo account, figuriamoci il badge. */}
                      {isDev && member.hiddenFromAdmins && (
                        <Badge className="bg-muted text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <EyeOff className="h-3 w-3" />
                            Nascosto
                          </span>
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-foreground/55">@{member.username}</p>
                    {member.mustChangePassword && (
                      <p className="mt-1 text-xs font-medium text-sand-700">
                        In attesa del primo accesso
                      </p>
                    )}
                  </div>

                  {canManage && (
                    <div className="flex shrink-0 items-center gap-1">
                      <LinkButton href={`/admin/staff/${member.id}`} variant="outline" size="sm" aria-label="Modifica">
                        <Pencil className="h-3.5 w-3.5" />
                      </LinkButton>
                      <form action={deleteStaffAction}>
                        <input type="hidden" name="id" value={member.id} />
                        <ConfirmSubmitButton
                          confirmMessage={`Rimuovere l'accesso di ${member.fullName} (@${member.username})?`}
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/8"
                        >
                          Rimuovi
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
