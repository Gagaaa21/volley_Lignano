import { LogIn, Volleyball } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { LinkButton } from "@/components/ui/LinkButton";
import { InstallButton } from "@/components/pwa/InstallButton";
import type { TrainingTeam } from "@/lib/types";

/** Header condiviso da entrambi i siti pubblici (U14/U15 e Minivolley):
 * mostra lo stemma della squadra corrente e un collegamento esplicito
 * verso il sito dell'altra squadra, così i due siti restano distinti ma
 * facilmente raggiungibili l'uno dall'altro. */
export function PublicHeader({
  subtitle,
  team = "u14u15",
}: { subtitle?: string; team?: TrainingTeam } = {}) {
  const isMinivolley = team === "minivolley";
  return (
    <header className="page-header">
      <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        <Logo subtitle={subtitle} team={team} href={isMinivolley ? "/minivolley" : "/"} />
        <div className="flex items-center gap-1">
          <LinkButton href={isMinivolley ? "/" : "/minivolley"} variant="ghost" size="sm">
            <Volleyball className="h-4 w-4" />
            <span className="hidden sm:inline">{isMinivolley ? "Under 14 & 15" : "Minivolley"}</span>
          </LinkButton>
          <InstallButton />
          <LinkButton href="/login" variant="ghost" size="sm">
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">Area riservata</span>
          </LinkButton>
        </div>
      </div>
    </header>
  );
}
