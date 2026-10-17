"use client";

import { useEffect, useRef, useState } from "react";
import { CloudOff, Download, History, TriangleAlert, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { ARCHIVE_REASON_LABELS, type ArchiveEntry } from "@/lib/scout/archive";
import { buildExport, exportFileName, parseImport } from "@/lib/scout/backupFile";
import { summarizeScout } from "@/lib/scout/match";
import type { ScoutData } from "@/lib/scout/types";
import type { SyncStatus } from "./useScoutSession";

/**
 * Tutto quello che protegge i punti segnati: l'avviso ben visibile quando non arrivano al server e la scheda «Copia di
 * sicurezza» (scaricare lo scout come file, rimetterlo da file o da una delle copie che il dispositivo tiene da solo).
 */

/** Dopo quanto tempo senza risposta del server compare l'avviso anche se non c'è un errore. */
const SLOW_AFTER_MS = 20_000;

/** «12 scambi · set 1–1 (25–20, 18–25)», o «nessun punto segnato». */
export function summaryLine(scout: ScoutData | null): string {
  const s = summarizeScout(scout);
  if (s.state === "none") return "nessun punto segnato";
  const sets = s.sets.map((score) => `${score.us}–${score.opp}`).join(", ");
  return `${s.rallies} scambi · set ${s.setsWon.us}–${s.setsWon.opp} (${sets})`;
}

/** Scarica lo scout come file: una copia che sta fuori dal sito e dal dispositivo. */
export function downloadScoutCopy(matchId: string, title: string, data: ScoutData) {
  const now = new Date();
  const blob = new Blob([JSON.stringify(buildExport(matchId, data, now), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFileName(title, now);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * L'avviso che i punti non sono arrivati al server: compare quando il salvataggio ha un problema (senza rete, sessione
 * scaduta, dati rifiutati) e anche quando il server non risponde da più di 20 secondi. Dice quanti scambi sono solo su
 * questo dispositivo e offre «Riprova adesso» e «Scarica una copia».
 */
export function UnsavedBanner({
  status,
  dirty,
  message,
  unsavedRallies,
  onRetry,
  onDownload,
}: {
  status: SyncStatus;
  dirty: boolean;
  message: string | null;
  /** Quanti scambi ci sono qui e non ancora sul server. */
  unsavedRallies: number;
  onRetry: () => void;
  onDownload: () => void;
}) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [dirty]);

  const problem = status === "offline" || status === "denied" || status === "error";
  if (!problem && !(dirty && slow)) return null;

  const text =
    status === "offline"
      ? "Non riesco a collegarmi. Continua pure a segnare: i punti restano su questo dispositivo e partono da soli appena torna la rete."
      : problem
        ? message
        : "Il server non risponde: i punti restano su questo dispositivo e si salvano da soli appena risponde.";
  const Icon = status === "offline" || !problem ? CloudOff : TriangleAlert;

  return (
    <div
      role="status"
      className="flex flex-col gap-2.5 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-foreground sm:flex-row sm:items-center"
      data-scout-sync-message
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div className="min-w-0 space-y-0.5">
          <p>{text}</p>
          <p className="text-[13px] font-semibold" data-scout-unsaved>
            {unsavedRallies > 0
              ? `${unsavedRallies} ${unsavedRallies === 1 ? "scambio non è" : "scambi non sono"} ancora sul server: non chiudere la pagina e non azzerare lo scout.`
              : "Non chiudere la pagina finché non torna «Salvato»."}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onRetry} data-scout-retry>
          Riprova adesso
        </Button>
        <Button size="sm" variant="outline" onClick={onDownload} data-scout-download-copy>
          <Download className="h-4 w-4" />
          Scarica una copia
        </Button>
      </div>
    </div>
  );
}

/**
 * «Copia di sicurezza»: scaricare lo scout come file, rimetterlo da un file e tornare a una copia che il dispositivo ha
 * messo da parte da solo (a ogni set chiuso e ogni volta che una versione è stata sostituita o scartata). Ripristinare
 * non butta via niente: lo scout di adesso resta a sua volta tra le copie.
 */
export function ScoutBackups({
  matchId,
  archive,
  locked,
  onDownload,
  onRestore,
}: {
  matchId: string;
  archive: ArchiveEntry[];
  /** C'è una scelta da fare (conflitto): finché non si sceglie non si ripristina. */
  locked: boolean;
  onDownload: () => void;
  onRestore: (data: ScoutData) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function restore(data: ScoutData) {
    if (!window.confirm("Sostituire lo scout di adesso con questa copia? Quello di adesso resta nelle copie e si può ripristinare.")) return;
    onRestore(data);
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    const result = parseImport(await file.text());
    if (!result.ok) {
      setError(result.error);
    } else if (result.matchId && result.matchId !== matchId) {
      setError("Questa copia è di un'altra partita: non la rimetto qui.");
    } else {
      restore(result.data);
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <Card data-scout-backups>
      <CardHeader className="pb-3">
        <CardTitle>Copia di sicurezza</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Lo Scout salva da solo sul server. In più questo dispositivo tiene una copia di ogni set chiuso e di ogni versione
          sostituita o scartata: se qualcosa va storto si torna a una di queste.
        </p>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onDownload} data-scout-download-copy>
            <Download className="h-4 w-4" />
            Scarica una copia
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={locked} data-scout-import>
            <Upload className="h-4 w-4" />
            Ripristina da file
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-label="Scegli il file della copia dello Scout"
            data-scout-import-input
            onChange={(e) => void importFile(e.target.files?.[0])}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm font-semibold text-destructive" data-scout-import-error>
            {error}
          </p>
        )}
        {archive.length === 0 ? (
          <p className="rounded-xl bg-surface-muted px-3.5 py-3 text-sm text-muted-foreground" data-scout-backups-empty>
            Nessuna copia ancora: ne compare una a ogni set chiuso.
          </p>
        ) : (
          <ul className="space-y-1.5" aria-label="Copie di sicurezza di questo dispositivo">
            {archive.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-border-subtle bg-surface px-3.5 py-2.5"
                data-scout-backup={entry.reason}
              >
                <History className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold text-foreground">
                    {ARCHIVE_REASON_LABELS[entry.reason]} ·{" "}
                    {new Date(entry.at).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" })}
                  </p>
                  <p className="text-[13px] text-muted-foreground">{summaryLine(entry.data)}</p>
                </div>
                <Button variant="outline" size="xs" disabled={locked} onClick={() => restore(entry.data)} data-scout-restore={entry.id}>
                  Ripristina
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
