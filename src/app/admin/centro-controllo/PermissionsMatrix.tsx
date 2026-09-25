"use client";

import { ADMIN_PAGES, ADMIN_PAGE_LABELS, TEAMS, TEAM_LABELS, type AdminPage, type TrainingTeam } from "@/lib/types";
import { updateStaffPermissionsAction } from "./actions";

interface AdminRow {
  id: string;
  fullName: string;
  username: string;
  allowedPages: AdminPage[];
  allowedTeams: TrainingTeam[];
}

function PermissionRow({ admin }: { admin: AdminRow }) {
  return (
    <form
      action={updateStaffPermissionsAction}
      className="rounded-xl border border-border-subtle px-3.5 py-3"
    >
      <input type="hidden" name="staffId" value={admin.id} />
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{admin.fullName}</p>
        <p className="truncate text-xs text-foreground/50">@{admin.username}</p>
      </div>
      <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/40">Pagine</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {ADMIN_PAGES.map((page) => (
          <label
            key={page}
            className="cursor-pointer rounded-full border border-border-subtle bg-surface px-2.5 py-1 text-xs font-semibold text-foreground/70 transition-colors has-[:checked]:border-sea-700 has-[:checked]:bg-sea-700 has-[:checked]:text-white"
          >
            <input
              type="checkbox"
              name="pages"
              value={page}
              defaultChecked={admin.allowedPages.includes(page)}
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
              className="sr-only"
            />
            {ADMIN_PAGE_LABELS[page]}
          </label>
        ))}
      </div>
      <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/40">Squadre</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {TEAMS.map((team) => (
          <label
            key={team}
            className="cursor-pointer rounded-full border border-border-subtle bg-surface px-2.5 py-1 text-xs font-semibold text-foreground/70 transition-colors has-[:checked]:border-sea-700 has-[:checked]:bg-sea-700 has-[:checked]:text-white"
          >
            <input
              type="checkbox"
              name="teams"
              value={team}
              defaultChecked={admin.allowedTeams.includes(team)}
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
              className="sr-only"
            />
            {TEAM_LABELS[team]}
          </label>
        ))}
      </div>
    </form>
  );
}

export function PermissionsMatrix({ admins }: { admins: AdminRow[] }) {
  if (admins.length === 0) {
    return <p className="text-sm text-foreground/50">Nessun account Admin da gestire al momento.</p>;
  }

  return (
    <div className="space-y-2.5">
      {admins.map((admin) => (
        <PermissionRow key={admin.id} admin={admin} />
      ))}
    </div>
  );
}
