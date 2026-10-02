"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EyeOff, Pencil, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { SearchInput } from "@/components/ui/SearchInput";
import type { PublicStaffMember } from "@/lib/types";

/** Elenco staff con ricerca (mostrata solo oltre 5 account, stesso limite
 * già usato altrove) su nome e nome utente. Riceve PublicStaffMember, non
 * StaffMember: quest'ultimo porta passwordHash, che come "use client"
 * finirebbe altrimenti nel payload RSC inviato al browser. La rimozione di
 * un account si trova nella sua pagina di modifica. */
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
    return staff.filter((m) => m.fullName.toLowerCase().includes(q) || m.username.toLowerCase().includes(q));
  }, [staff, query]);

  return (
    <div data-tour="section-staff-list">
      {staff.length > 5 && (
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca per nome o utente…"
          aria-label="Cerca account"
          className="mb-4"
        />
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface/70 px-6 py-12 text-center text-sm text-muted-foreground">
          Nessun account trovato per &quot;{query}&quot;.
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          {filtered.map((member) => {
            const canManage = isDev && member.role !== "dev" && member.id !== currentUserId;
            const isMe = member.id === currentUserId;
            return (
              <div key={member.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                <Avatar name={member.fullName} tone={member.role === "dev" ? "gold" : "primary"} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate font-semibold text-foreground">{member.fullName}</p>
                    {member.role === "dev" ? (
                      <Badge tone="gold">
                        <ShieldCheck className="h-3 w-3" />
                        Developer
                      </Badge>
                    ) : (
                      <Badge tone="primary">Admin</Badge>
                    )}
                    {isMe && <Badge>Tu</Badge>}
                    {/* Visibile solo al Developer: gli altri admin non
                     * vedono nemmeno questo account, figuriamoci il badge. */}
                    {isDev && member.hiddenFromAdmins && (
                      <Badge>
                        <EyeOff className="h-3 w-3" />
                        Nascosto
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    @{member.username}
                    {member.mustChangePassword && (
                      <span className="font-semibold text-warning"> · In attesa del primo accesso</span>
                    )}
                  </p>
                </div>
                {canManage && (
                  <Link
                    href={`/admin/staff/${member.id}`}
                    aria-label={`Modifica ${member.fullName}`}
                    title="Modifica"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
