import { cn } from "@/lib/cn";
import type { Side } from "@/lib/diretta/overlayEvents";
import type { PublicLiveScore, PublicSetRecap, PublicSetRecapTeam } from "@/lib/types";
import { accent, TeamMark } from "./TeamMark";

/**
 * Il resoconto di fine set della diretta video, come in Serie A: fascia con «Fine 1° set» e la durata, i due loghi con il
 * parziale grande, i parziali già giocati e i numeri di squadra del set (attacchi vincenti, muri, ace, errori
 * dell'avversaria, serie di punti, time-out) con una barra per squadra. Sono totali di squadra ricavati dallo Scout: mai nomi
 * né numeri di maglia. A fine partita diventa «Finale», con i set vinti e i numeri dell'ultimo set.
 */

const NAVY = "#06141f";

const ROWS: { key: keyof PublicSetRecapTeam; label: string }[] = [
  { key: "attack", label: "Attacco" },
  { key: "block", label: "Muri" },
  { key: "ace", label: "Ace" },
  { key: "gifts", label: "Errori avversari" },
  { key: "run", label: "Serie di punti" },
  { key: "timeouts", label: "Time-out" },
];

function StatRow({ name, label, home, away, homeColor, awayColor }: { name: string; label: string; home: number; away: number; homeColor: string; awayColor: string }) {
  const max = Math.max(home, away, 1);
  const homeDim = away > home;
  const awayDim = home > away;
  return (
    <div className="grid h-[2.5rem] grid-cols-[3.4rem_1fr_12rem_1fr_3.4rem] items-center gap-[0.8rem]" data-grafica-recap-row={name}>
      <span className={cn("text-right font-display text-[1.7rem] font-extrabold tabular-nums", homeDim && "text-white/55")} data-grafica-recap-value={`${name}-home`}>
        {home}
      </span>
      <span className="flex justify-end">
        <span className="h-[0.8rem] rounded-l-full" style={{ width: `${(home / max) * 100}%`, background: homeColor, opacity: homeDim ? 0.5 : 1 }} />
      </span>
      <span className="text-center text-[0.95rem] font-extrabold uppercase tracking-[0.12em] text-white/80">{label}</span>
      <span className="flex justify-start">
        <span className="h-[0.8rem] rounded-r-full" style={{ width: `${(away / max) * 100}%`, background: awayColor, opacity: awayDim ? 0.5 : 1 }} />
      </span>
      <span className={cn("font-display text-[1.7rem] font-extrabold tabular-nums", awayDim && "text-white/55")} data-grafica-recap-value={`${name}-away`}>
        {away}
      </span>
    </div>
  );
}

function TeamHead({ live, side, setsWon, dimmed }: { live: PublicLiveScore; side: Side; setsWon: number; dimmed: boolean }) {
  const team = side === "home" ? live.home : live.away;
  const logo = <TeamMark team={team} side={side} className={cn("h-[4.6rem] w-[4.6rem]", dimmed && "opacity-60")} />;
  const text = (
    <span className={cn("flex min-w-0 flex-col justify-center gap-[0.2rem]", side === "away" && "items-end text-right")}>
      <span className={cn("max-w-full truncate font-display text-[1.6rem] font-extrabold uppercase leading-none tracking-wide", dimmed && "text-white/60")} data-grafica-recap-name={side}>
        {team.name}
      </span>
      <span className="text-[0.9rem] font-extrabold uppercase tracking-[0.16em] text-white/60">Set vinti {setsWon}</span>
    </span>
  );
  return (
    <span className={cn("flex min-w-0 items-center gap-[1rem]", side === "away" && "justify-end")}>
      {side === "home" ? (
        <>
          {logo}
          {text}
        </>
      ) : (
        <>
          {text}
          {logo}
        </>
      )}
    </span>
  );
}

export function SetRecapPanel({
  live,
  recap,
  kind,
  score,
  leaving,
}: {
  live: PublicLiveScore;
  recap: PublicSetRecap;
  /** «set»: fine di un set; «final»: fine della partita (i numeri sono quelli dell'ultimo set). */
  kind: "set" | "final";
  /** Il parziale del set appena chiuso. */
  score: { home: number; away: number };
  /** Gli ultimi istanti: il pannello si dissolve, invece di sparire di colpo (come le altre schede). */
  leaving: boolean;
}) {
  const final = kind === "final";
  const homeColor = accent(live.home.color);
  const awayColor = accent(live.away.color);
  // Il vincitore del set (o della partita): l'altra squadra è più scura.
  const [homeBig, awayBig] = final ? [live.home.sets, live.away.sets] : [score.home, score.away];
  const homeWon = homeBig > awayBig;
  const awayWon = awayBig > homeBig;

  return (
    <div
      className={cn(
        "w-[72rem] max-w-[96%] animate-[grafica-card-in_350ms_ease-out] overflow-hidden rounded-[1rem] text-white shadow-[0_0.8rem_2rem_rgba(0,0,0,0.5)] transition-opacity duration-300",
        leaving && "opacity-0",
      )}
      style={{ backgroundColor: NAVY }}
      data-grafica-card={kind}
      data-grafica-recap={recap.n}
    >
      <div className="flex items-center justify-between gap-[1rem] bg-white/10 px-[1.4rem] py-[0.55rem] text-[1.05rem] font-extrabold uppercase tracking-[0.16em]">
        <p className="flex items-center gap-[0.7rem]">
          {live.category && <span className="rounded-[0.3rem] bg-white/15 px-[0.6rem]">{live.category}F</span>}
          <span data-grafica-recap-title>{final ? "Finale" : `Fine ${recap.n}° set`}</span>
        </p>
        {recap.minutes !== null && <span data-grafica-recap-minutes>{final ? `${recap.n}° set · ${recap.minutes}′` : `Durata ${recap.minutes}′`}</span>}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-[1.4rem] px-[1.4rem] py-[1.1rem]">
        <TeamHead live={live} side="home" setsWon={live.home.sets} dimmed={awayWon} />
        <span
          className="flex items-center gap-[0.9rem] font-display text-[4.4rem] font-extrabold leading-none tabular-nums"
          data-grafica-recap-score
          // Gli stessi segni della striscia semplice di fine set e del finale: le prove e chi li cerca li trovano anche qui.
          {...(final ? { "data-grafica-final-score": "" } : { "data-grafica-set-score": "" })}
        >
          <span className={cn(awayWon && "text-white/55")}>{homeBig}</span>
          <span className="text-white/35">–</span>
          <span className={cn(homeWon && "text-white/55")}>{awayBig}</span>
        </span>
        <TeamHead live={live} side="away" setsWon={live.away.sets} dimmed={homeWon} />
      </div>

      {live.sets.length > 1 || final ? (
        <div className="flex flex-wrap items-center justify-center gap-x-[1.2rem] gap-y-[0.2rem] border-t border-white/10 px-[1.4rem] py-[0.55rem] text-[1.1rem] font-bold tabular-nums" data-grafica-recap-sets>
          {live.sets.map((set, i) => (
            <span key={i} className="flex items-center gap-[0.4rem]">
              <span className="text-white/50">{i + 1}°</span>
              <span className={set.home > set.away ? "text-white" : "text-white/60"}>{set.home}</span>
              <span className="text-white/30">–</span>
              <span className={set.away > set.home ? "text-white" : "text-white/60"}>{set.away}</span>
            </span>
          ))}
        </div>
      ) : null}

      <div className="border-t border-white/10 px-[1.4rem] pb-[0.9rem] pt-[0.6rem]">
        {final && <p className="pb-[0.2rem] text-center text-[0.85rem] font-extrabold uppercase tracking-[0.16em] text-white/50">Ultimo set · {recap.n}°</p>}
        {ROWS.map(({ key, label }) => (
          <StatRow key={key} name={key} label={label} home={recap.home[key]} away={recap.away[key]} homeColor={homeColor} awayColor={awayColor} />
        ))}
      </div>
    </div>
  );
}
