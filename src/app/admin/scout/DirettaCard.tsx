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

function CopyLinkButton() {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL("/diretta", window.location.origin).href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Appunti non disponibili: il link resta leggibile qui accanto.
    }
  }
  return (
    <Button type="button" variant="outline" onClick={copy} data-diretta-copy>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copiato" : "Copia il link per i genitori"}
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
          <span className="block font-display text-base font-bold text-foreground">Diretta video</span>
          <span className="block text-sm text-muted-foreground">
            Incolla i link delle dirette YouTube: i genitori le guardano da <b className="font-semibold">/diretta</b>, con il punteggio sopra.
          </span>
        </span>
        <Badge tone={count > 0 ? "success" : "neutral"} data-diretta-status={count > 0 ? "attiva" : "vuota"}>
          {count > 0 ? `Attiva · ${count === 1 ? "1 camera" : `${count} camere`}` : "Nessuna diretta"}
        </Badge>
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
        <div className="max-w-[16rem]">
          <Label htmlFor="diretta-delay">Ritardo del punteggio (secondi)</Label>
          <Input id="diretta-delay" name="delay" type="number" inputMode="numeric" min={0} max={MAX_DELAY_SECONDS} defaultValue={initial?.delaySeconds ?? DEFAULT_DELAY_SECONDS} />
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
          <CopyLinkButton />
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
