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
 * «Diretta video»: i link delle dirette YouTube (una per camera, fino a 3) che i genitori guardano dalla pagina /diretta con il
 * punteggio dello Scout sopra. Si incollano prima della partita; «Svuota» a fine partita (i link scadono da soli dopo 12 ore).
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
              {count > 0 ? `Attiva · ${count === 1 ? "1 camera" : `${count} camere`}` : "Nessuna diretta"}
            </Badge>
          </span>
          <span className="mt-0.5 block text-sm text-muted-foreground">
            Incolla i link delle dirette YouTube: i genitori le guardano da <b className="font-semibold">/diretta</b>, con il punteggio sopra.
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>

      <form action={formAction} key={initial?.savedAt ?? "vuota"} className="space-y-4 border-t border-border px-4 py-4 sm:px-5">
        <p className="text-sm text-muted-foreground">
          Su ogni telefono: YouTube → «Vai in diretta» (meglio «Non in elenco»). Poi copia il link della diretta e incollalo qui, una riga per camera.
        </p>
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
            YouTube mostra il video con 10–20 secondi di ritardo: il punteggio compare dopo altrettanto. Se arriva prima della palla a terra, aumentalo (i genitori
            possono anche regolarlo da soli).
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
        <div className="space-y-2.5 rounded-xl bg-muted/60 px-3.5 py-3" data-diretta-computer>
          <p className="text-sm text-muted-foreground">
            Dal computer con Streamlabs Desktop (o OBS) la grafica entra nel video, come in Serie A: barra del punteggio, time-out, cambi, presentazione,
            formazione, fine set e finale. Aggiungi una «Browser Source» con questo indirizzo, <b className="font-semibold text-foreground">larghezza 1920 e altezza 1080</b>,
            poi tasto destro → Trasforma → <b className="font-semibold text-foreground">Adatta allo schermo</b>: con la misura di partenza (800×600) la grafica si sgrana
            o finisce spostata. Ai genitori mandi direttamente il link di YouTube. I passi sono nella Guida.
          </p>
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
            L&apos;indirizzo di verifica mostra nell&apos;anteprima la misura vera della fonte e cosa correggere (verde = a posto). Usalo per controllare, poi metti quello
            della grafica.
          </p>
        </div>
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
