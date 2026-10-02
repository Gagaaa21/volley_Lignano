import Image from "next/image";
import crestU14U15 from "@/assets/lignano-crest.png";
import crestMinivolley from "@/assets/minivolley-crest.png";
import type { TrainingTeam } from "@/lib/types";

export function PublicFooter({
  tagline = "Under 14 & Under 15 · Lignano Sabbiadoro",
  team = "u14u15",
}: { tagline?: string; team?: TrainingTeam } = {}) {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 text-center sm:flex-row sm:justify-between sm:px-6 sm:text-left lg:px-8">
        <div className="flex items-center gap-3">
          <Image
            src={team === "minivolley" ? crestMinivolley : crestU14U15}
            alt=""
            aria-hidden
            className="h-8 w-8 object-contain opacity-80 grayscale-[35%]"
          />
          <p className="text-sm font-semibold text-foreground/80">
            Volley Lignano · {team === "minivolley" ? "Minivolley" : "Settore giovanile femminile"}
          </p>
        </div>
        <p className="text-[13px] text-muted-foreground">
          {tagline} · © {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
}
