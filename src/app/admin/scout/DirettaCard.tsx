"use client";

import { useActionState, useState } from "react";
import { Check, ChevronDown, Copy, ExternalLink, Video } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/Field";
import { MAX_CAMERA_NAME, MAX_CAMERAS, MAX_DELAY_SECONDS, DEFAULT_DELAY_SECONDS, type StreamSettings } from "@/lib/diretta/streams";
import { saveLiveStreamAction, type DirettaState } from "./diretta-actions";

const initialState: DirettaState = {};
const NAME_HINTS = ["Campo", "Dietro", "Panchina"];

/** Copia negli appunti un indirizzo di questo sito: la pagina dei genitori o la grafica da mettere in Streamlabs / OBS. */
function CopyAddressButton({ path, label, kind }: { path: string; label: string; kind: "parents" | "graphic" | "verify" }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Appunti non disponibili: l'indirizzo si legge nella guida.
    }
  }
  return (
    <Button
      type="button"
      variant="outline"
      onClick={copy}
      {...(kind === "parents" ? { "data-diretta-copy": true } : kind === "graphic" ? { "data-diretta-copy-graphic": true } : { "data-diretta-copy-verify": true })}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copiato" : label}
    </Button>
  );
}

/**
 * «Diretta video». Prima la grafica per Streamlabs / OBS (la diretta dal computer, quella che si usa): l'indirizzo da copiare
 * e i passi, in ordine. Sotto, facoltativi, i link delle dirette YouTube (una per camera, fino a 3) per la pagina /diretta
 * del sito, con il punteggio dello Scout sopra; «Svuota» a fine partita (i link scadono da soli dopo 12 ore).
 */
export function DirettaCard({ initial }: { initial: StreamSettings | null }) {
  const [state, formAction, pending] = useActionState(saveLiveStreamAction, initialState);
  const count = initial?.cameras.length ?? 0;

  return (
    <details open={count > 0} className="group mb-6 rounded-2xl border border-border bg-card shadow-card" data-diretta-card>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="icon-chip shrink-0">
          <Video className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          {/* Lo stato sta accanto al titolo (e va a capo sul telefono): così la descrizione usa tutta la larghezza. */}
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-display text-base font-bold text-foreground">Diretta video</span>
            <Badge tone={count > 0 ? "success" : "neutral"} data-diretta-status={count > 0 ? "attiva" : "vuota"}>
              {count > 0 ? `/diretta · ${count === 1 ? "1 camera" : `${count} camere`}` : "Streamlabs"}
            </Badge>
          </span>
          <span className="mt-0.5 block text-sm text-muted-foreground">
            La grafica per Streamlabs (punteggio, cambi, formazione, fine set): l&apos;indirizzo da copiare e i passi.
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>

      <form action={formAction} key={initial?.savedAt ?? "vuota"} className="space-y-4 border-t border-border px-4 py-4 sm:px-5">
        <section className="space-y-3 rounded-xl bg-muted/60 px-3.5 py-3" data-diretta-computer>
          <h3 className="text-sm font-semibold text-foreground">Grafica per Streamlabs, dal computer</h3>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground marker:font-semibold marker:text-foreground">
            <li>
              In Streamlabs Desktop (o OBS) aggiungi una «Browser Source» con l&apos;indirizzo della grafica,{" "}
              <b className="font-semibold text-foreground">larghezza 1920 e altezza 1080</b>, in cima all&apos;elenco delle fonti (sopra la camera).
            </li>
            <li>
              Tasto destro sulla fonte → Trasforma → <b className="font-semibold text-foreground">Adatta allo schermo</b>: con la misura di partenza (800×600) la
              grafica si sgrana o finisce spostata.
            </li>
            <li>A casa, prima della partita, prova l&apos;indirizzo di verifica: nell&apos;anteprima deve essere tutto verde. Poi rimetti quello della grafica.</li>
            <li>
              Alla partita, nello Scout: «Accendi la diretta» (in video la copertina, la telecamera non si vede), poi «Inizia il riscaldamento» quando le squadre
              entrano in campo. Riscaldamento ufficiale, presentazione e punteggio seguono l&apos;orario della partita.
            </li>
          </ol>
          <div className="flex flex-wrap items-center gap-2">
            <CopyAddressButton path="/diretta/grafica" label="Copia l'indirizzo della grafica" kind="graphic" />
            <CopyAddressButton path="/diretta/grafica?verifica=1" label="Copia l'indirizzo di verifica" kind="verify" />
            <a
              href="/diretta/grafica?prova=1"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-primary hover:underline"
              data-diretta-try
            >
              <ExternalLink className="h-4 w-4" />
              Guarda la partita finta
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            Il punteggio entra nel video circa un secondo dopo il tocco nello Scout, qualunque sia il ritardo di YouTube: ai genitori mandi direttamente il link di
            YouTube. I passi completi sono nella Guida.
          </p>
          <p className="rounded-lg bg-surface px-3 py-2 text-xs text-muted-foreground" data-diretta-hotspot>
            <b className="font-semibold text-foreground">Con l&apos;hotspot del telefono:</b> in Streamlabs uscita 1280×720 a 30 fps, bitrate video 2500 kbps
            (1500–2000 se si blocca) con il bitrate dinamico acceso; su YouTube latenza «Normale»; telefono collegato al computer con il cavo USB e messo dove
            prende meglio. La grafica e lo Scout pesano pochissimo: è il video a riempire la connessione. Dettagli nella Guida.
          </p>
        </section>

        <section className="space-y-4 border-t border-border pt-4" data-diretta-site>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Pagina /diretta del sito (facoltativa)</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Solo se trasmetti dai telefoni, senza Streamlabs: su ogni telefono YouTube → «Vai in diretta» (meglio «Non in elenco»), poi incolla qui il link, una
              riga per camera. I genitori la guardano da <b className="font-semibold">/diretta</b>, con il punteggio sopra.
            </p>
          </div>
          {Array.from({ length: MAX_CAMERAS }, (_, index) => {
            const camera = initial?.cameras[index];
            return (
              <div key={index} className="grid gap-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
                <div>
                  <Label htmlFor={`diretta-name-${index}`}>Camera {index + 1}</Label>
                  <Input
                    id={`diretta-name-${index}`}
                    name={`name${index}`}
                    placeholder={NAME_HINTS[index]}
                    maxLength={MAX_CAMERA_NAME}
                    defaultValue={camera?.name ?? ""}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <Label htmlFor={`diretta-link-${index}`}>Link della diretta YouTube</Label>
                  <Input
                    id={`diretta-link-${index}`}
                    name={`link${index}`}
                    type="text"
                    inputMode="url"
                    placeholder="https://youtube.com/live/…"
                    defaultValue={camera ? `https://youtu.be/${camera.id}` : ""}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </div>
              </div>
            );
          })}
          {/* Il campo è stretto (bastano due cifre), la spiegazione sotto no: in una colonna da 16rem andava a capo a ogni parola. */}
          <div>
            <Label htmlFor="diretta-delay">Ritardo del punteggio (secondi)</Label>
            <Input
              id="diretta-delay"
              name="delay"
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_DELAY_SECONDS}
              defaultValue={initial?.delaySeconds ?? DEFAULT_DELAY_SECONDS}
              className="max-w-[10rem]"
            />
            <FieldHint>
              YouTube mostra il video con 10–20 secondi di ritardo: ogni punto compare altrettanto dopo essere stato segnato nello Scout, sempre lo stesso tempo. Se
              arriva prima della palla a terra, aumentalo (i genitori possono anche regolarlo da soli).
            </FieldHint>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" name="intent" value="save" disabled={pending} data-diretta-save>
              {pending ? "Salvo…" : "Salva"}
            </Button>
            <Button type="submit" name="intent" value="clear" variant="outline" disabled={pending} data-diretta-clear>
              Svuota
            </Button>
            <CopyAddressButton path="/diretta" label="Copia il link per i genitori" kind="parents" />
            <a
              href="/diretta"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-primary hover:underline"
              data-diretta-open
            >
              <ExternalLink className="h-4 w-4" />
              Apri la pagina dei genitori
            </a>
          </div>
        </section>
        {state.error && (
          <div className="rounded-xl bg-destructive/8 px-3.5 py-2.5" data-diretta-error>
            <FieldError>{state.error}</FieldError>
          </div>
        )}
        {state.success && (
          <p className="text-sm font-medium text-success" role="status" data-diretta-ok>
            {state.success}
          </p>
        )}
      </form>
    </details>
  );
}
