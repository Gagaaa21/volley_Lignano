import Link from "next/link";
import type { ReactNode } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Activity, CheckCircle2, Database, ExternalLink, GitCommitHorizontal, Radio, Settings2, Users, Volleyball, XCircle } from "lucide-react";
import { getRepo, isDemoMode } from "@/lib/db";
import { matchTitle } from "@/lib/calendar";
import { CATEGORY_SHORT } from "@/lib/category";
import { cn } from "@/lib/cn";
import { LIVE_STREAM_KEY, NEXT_MATCH_GRACE_MS, parseStreamSettings, STREAM_TTL_MS } from "@/lib/diretta/streams";
import { toPublicLiveScore } from "@/lib/liveScore";
import { liveScoreStateSchema } from "@/lib/liveScoreSchema";
import { readPublicScoutSnapshot } from "@/lib/scout/publicSnapshot";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { Athlete, Match, PublicLiveScore } from "@/lib/types";

/** Ora italiana (il server può girare su un altro fuso). */
function timeIt(iso: string | number): string {
  return new Date(iso).toLocaleTimeString("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" });
}

/** «12–10 · 2° set» o «finita 3–1» per il punteggio pubblico. */
function scoreLine(live: PublicLiveScore): string {
  if (live.notStarted) return "acceso, in attesa del primo punto";
  if (live.finished) return `finita ${live.home.sets}–${live.away.sets}`;
  return `${live.home.score}–${live.away.score} · ${live.sets.length + 1}° set (set ${live.home.sets}–${live.away.sets})`;
}

function Tile({ icon: Icon, title, children, wide = false }: { icon: typeof Activity; title: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface px-3.5 py-3", wide && "sm:col-span-2")}>
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </p>
      <div className="mt-1.5 space-y-1 text-sm text-foreground/85">{children}</div>
    </div>
  );
}

function Check({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <li className="flex items-start gap-2" data-system-check={ok ? "ok" : "manca"}>
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />}
      <span>
        <span className="font-semibold text-foreground">{label}</span>
        <span className="text-muted-foreground"> · {hint}</span>
      </span>
    </li>
  );
}

const quickLink = "inline-flex items-center gap-1 rounded-lg bg-surface-muted px-2.5 py-1.5 text-[13px] font-semibold text-primary ring-1 ring-border hover:bg-primary-soft";

/**
 * «Stato del sito», in cima al Centro di controllo: tutto quello che serve sapere a colpo d'occhio prima di una partita o
 * quando qualcosa non va. Versione pubblicata, archivio (e quanto risponde), cosa è in diretta adesso, la prossima partita
 * con il suo Scout, i numeri e la configurazione: delle chiavi si dice solo se ci sono, mai il valore.
 */
/** Le letture dello stato (fuori dal componente: l'ora di adesso e il tempo di risposta non sono «puri»). */
async function readStatus(matches: Match[]) {
  const repo = await getRepo();
  const now = Date.now();
  // Il tempo di risposta dell'archivio, su una lettura che serve comunque (i link della diretta video).
  const started = performance.now();
  const streamRaw = await repo.getAppSetting(LIVE_STREAM_KEY).catch(() => null);
  const latencyMs = Math.round(performance.now() - started);
  const nextMatch = [...matches]
    .filter((m) => m.team === "u14u15" && new Date(m.matchDate).getTime() >= now - NEXT_MATCH_GRACE_MS)
    .sort((a, b) => a.matchDate.localeCompare(b.matchDate))[0];
  const [liveSnapshot, scoutLive, nextScout] = await Promise.all([
    repo.getLiveScoreSnapshot().catch(() => null),
    readPublicScoutSnapshot(repo).catch(() => undefined),
    nextMatch ? repo.getMatchScout(nextMatch.id).catch(() => null) : Promise.resolve(null),
  ]);
  const parsedLive = liveSnapshot ? liveScoreStateSchema.safeParse(liveSnapshot.state) : null;
  const liveScore = liveSnapshot && parsedLive?.success ? toPublicLiveScore(parsedLive.data, liveSnapshot.updatedAt) : null;
  return { now, latencyMs, nextMatch, scoutLive, nextScout, liveScore, stream: parseStreamSettings(streamRaw, now) };
}

export async function SystemStatus({ matches, athletes, staffCount, subscriptions }: { matches: Match[]; athletes: Athlete[]; staffCount: number; subscriptions: number }) {
  const { now, latencyMs, nextMatch, scoutLive, nextScout, liveScore, stream } = await readStatus(matches);

  const demo = isDemoMode();
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  const message = process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0];
  const repoSlug = process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG ? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}` : null;
  let supabaseRef: string | null = null;
  try {
    supabaseRef = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname.split(".")[0] : null;
  } catch {
    supabaseRef = null;
  }

  const today = format(new Date(now), "yyyy-MM-dd");
  const u14u15Athletes = athletes.filter((a) => a.team === "u14u15").length;
  const toPlay = matches.filter((m) => m.team === "u14u15" && m.matchDate.slice(0, 10) >= today).length;
  const played = matches.filter((m) => m.team === "u14u15" && m.matchDate.slice(0, 10) < today).length;

  const scoutRallies = nextScout?.events.filter((e) => e.type === "rally").length ?? 0;

  return (
    <Card id="stato" className="mb-5 scroll-mt-24" data-system-status>
      <CardHeader className="flex flex-row items-start gap-3.5">
        <span className="icon-chip shrink-0">
          <Activity className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-display text-base font-bold text-foreground">Stato del sito</h2>
          <p className="text-sm text-muted-foreground">A colpo d&apos;occhio, prima di una partita o quando qualcosa non va. Ricarica la pagina per aggiornarlo.</p>
        </div>
      </CardHeader>
      <CardBody className="grid gap-3 pt-0 sm:grid-cols-2">
        <Tile icon={GitCommitHorizontal} title="Versione pubblicata">
          {sha ? (
            <>
              <p className="font-mono text-[13px] font-semibold text-foreground" data-system-version>
                {sha.slice(0, 7)}
                {process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production" && <span className="ml-1.5 font-sans text-xs text-warning">({process.env.VERCEL_ENV})</span>}
              </p>
              {message && <p className="line-clamp-2 text-[13px] text-muted-foreground">{message}</p>}
              {repoSlug && (
                <a href={`https://github.com/${repoSlug}/commit/${sha}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Le modifiche su GitHub
                </a>
              )}
            </>
          ) : (
            <p data-system-version>Versione locale (non pubblicata su Vercel).</p>
          )}
        </Tile>

        <Tile icon={Database} title="Archivio">
          {demo ? (
            <p className="font-semibold text-warning" data-system-store="demo">Demo in memoria: i dati spariscono al riavvio.</p>
          ) : (
            <p data-system-store="supabase">
              <span className="font-semibold text-success">Supabase</span> · risponde in {latencyMs} ms
            </p>
          )}
          <p className="text-[13px] text-muted-foreground">
            {subscriptions} iscrizion{subscriptions === 1 ? "e" : "i"} alle notifiche · {staffCount} account staff
          </p>
        </Tile>

        <Tile icon={Radio} title="In diretta adesso" wide>
          <p data-system-live-scout>
            <span className="font-semibold text-foreground">Punteggio dallo Scout:</span>{" "}
            {scoutLive ? `${scoutLive.home.name} – ${scoutLive.away.name}, ${scoreLine(scoutLive)} · aggiornato alle ${timeIt(scoutLive.updatedAt)}` : "spento"}
          </p>
          <p data-system-live-score>
            <span className="font-semibold text-foreground">Punteggio dal Live score:</span>{" "}
            {liveScore ? `${liveScore.home.name} – ${liveScore.away.name}, ${scoreLine(liveScore)} · aggiornato alle ${timeIt(liveScore.updatedAt)}` : "spento"}
          </p>
          <p data-system-live-video>
            <span className="font-semibold text-foreground">Video sul sito:</span>{" "}
            {stream
              ? `${stream.cameras.length === 1 ? "1 camera" : `${stream.cameras.length} camere`}${stream.graphicInVideo ? " (Streamlabs, grafica nel video)" : " (punteggio disegnato dal sito)"} · la home mostra «Guarda la diretta video» fino alle ${timeIt(Date.parse(stream.savedAt) + STREAM_TTL_MS)}`
              : "nessun link salvato"}
          </p>
        </Tile>

        <Tile icon={Volleyball} title="Prossima partita" wide>
          {nextMatch ? (
            <>
              <p className="font-semibold text-foreground" data-system-next>
                <span className="first-letter:uppercase">{format(new Date(nextMatch.matchDate), "EEEE d MMMM 'alle' HH:mm", { locale: it })}</span> ·{" "}
                {nextMatch.category ? `${CATEGORY_SHORT[nextMatch.category]} · ` : ""}
                {matchTitle(nextMatch)}
              </p>
              <p className="text-[13px] text-muted-foreground" data-system-next-scout>
                Scout:{" "}
                {nextScout
                  ? `aperto${nextScout.settings.publicLive ? ", punteggio live acceso" : ", punteggio live spento"}${scoutRallies > 0 ? ` · ${scoutRallies} scambi segnati` : ""}`
                  : "non ancora aperto"}{" "}
                ·{" "}
                <Link href={`/admin/scout/${nextMatch.id}`} prefetch={false} className="font-semibold text-primary hover:underline">
                  Apri lo Scout
                </Link>
              </p>
            </>
          ) : (
            <p>Nessuna partita U14/U15 in programma.</p>
          )}
        </Tile>

        <Tile icon={Users} title="Numeri">
          <p>
            {u14u15Athletes} atlete U14/U15 · {athletes.length - u14u15Athletes} Minivolley
          </p>
          <p>
            {toPlay} partite da giocare · {played} giocate
          </p>
        </Tile>

        <Tile icon={Settings2} title="Configurazione">
          <ul className="space-y-1 text-[13px]">
            <Check ok={!demo} label="Archivio" hint={demo ? "manca Supabase: modalità demo" : "Supabase collegato"} />
            <Check ok={Boolean(process.env.SESSION_SECRET)} label="Accessi" hint={process.env.SESSION_SECRET ? "chiave delle sessioni impostata" : "manca SESSION_SECRET"} />
            <Check
              ok={Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)}
              label="Notifiche"
              hint={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY ? "chiavi impostate" : "mancano le chiavi VAPID"}
            />
            <Check ok={Boolean(process.env.CRON_SECRET)} label="Lettura classifiche" hint={process.env.CRON_SECRET ? "lettura notturna protetta" : "manca CRON_SECRET"} />
            <Check ok={Boolean(process.env.GEMINI_API_KEY)} label="IA delle schede" hint={process.env.GEMINI_API_KEY ? "chiave impostata" : "facoltativa, non impostata"} />
          </ul>
        </Tile>

        <div className="flex flex-wrap gap-2 sm:col-span-2" data-system-links>
          <a href="/diretta" target="_blank" rel="noopener" className={quickLink}>
            <ExternalLink className="h-3.5 w-3.5" />
            Pagina /diretta
          </a>
          <a href="/diretta/grafica?verifica=1" target="_blank" rel="noopener" className={quickLink}>
            <ExternalLink className="h-3.5 w-3.5" />
            Grafica: verifica
          </a>
          <a href="/diretta/grafica?prova=1" target="_blank" rel="noopener" className={quickLink}>
            <ExternalLink className="h-3.5 w-3.5" />
            Grafica: partita finta
          </a>
          <Link href="/admin/manutenzione" prefetch={false} className={quickLink}>
            Spazio e manutenzione
          </Link>
          {supabaseRef && (
            <a href={`https://supabase.com/dashboard/project/${supabaseRef}`} target="_blank" rel="noopener noreferrer" className={quickLink}>
              <ExternalLink className="h-3.5 w-3.5" />
              Supabase
            </a>
          )}
          {repoSlug && (
            <a href={`https://github.com/${repoSlug}`} target="_blank" rel="noopener noreferrer" className={quickLink}>
              <ExternalLink className="h-3.5 w-3.5" />
              GitHub
            </a>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
