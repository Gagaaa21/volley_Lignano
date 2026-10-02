"use client";

import { ADMIN_PAGES, ADMIN_PAGE_LABELS, TEAMS, TEAM_LABELS, type AdminPage, type TrainingTeam } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
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
      className="rounded-xl border border-border bg-surface px-4 py-3.5"
    >
      <input type="hidden" name="staffId" value={admin.id} />
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={admin.fullName} size="sm" />
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{admin.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">@{admin.username}</p>
        </div>
      </div>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Pagine</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {ADMIN_PAGES.map((page) => (
          <label
            key={page}
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-input bg-surface px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40"
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
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Squadre</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {TEAMS.map((team) => (
          <label
            key={team}
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-input bg-surface px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40"
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
