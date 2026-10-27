"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ButtonSize, ButtonVariant } from "@/components/ui/button-variants";
import { detectAppleDevice, detectFileShare, fetchPdf, saveFile } from "@/lib/pdf/client";
import { usePdfSheet } from "./PdfSheet";

type Status = "idle" | "loading" | "ready" | "saved" | "error";

const subscribeNothing = () => () => {};

export type SharePdfButtonProps = {
  /** Da dove si prende il PDF: la stessa strada del pulsante «Scarica». */
  href: string;
  /** Titolo (e testo) del messaggio che accompagna il file. */
  title: string;
  text?: string;
  /** Nome del file mandato; se manca, quello che dà il server. */
  fileName?: string;
  /**
   * Il PDF si scarica da solo appena si apre la pagina (solo dove si può mandare un file): così basta un tocco. Per i PDF
   * pesanti, o tanti nella stessa pagina, meglio di no: il primo tocco lo prepara e il secondo apre il foglio di condivisione.
   */
  prefetch?: boolean;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Solo l'icona (il nome resta per chi usa un lettore di schermo): per le righe di un elenco. */
  iconOnly?: boolean;
  className?: string;
  /** Per i test e per chi deve riconoscere il pulsante: `data-…` qualunque. */
  [attribute: `data-${string}`]: string | boolean | undefined;
};

/**
 * «Condividi PDF»: manda un PDF del sito come **file**. Dal telefono o dal tablet apre il foglio di condivisione con il
 * PDF già allegato (WhatsApp, e-mail, «Salva su File»…); dove non è possibile (di solito il computer) lo scarica, come il
 * pulsante «Scarica». Il foglio di condivisione si può aprire solo subito dopo un tocco, senza attese in mezzo: per questo, dove
 * si può mandare un file, il PDF si prepara prima (da solo con `prefetch`, altrimenti al primo tocco, e il secondo lo manda).
 */
export function SharePdfButton({
  href,
  title,
  text,
  fileName,
  prefetch = false,
  label = "Condividi PDF",
  variant = "outline",
  size,
  iconOnly = false,
  className,
  ...rest
}: SharePdfButtonProps) {
  const canShareFiles = useSyncExternalStore(subscribeNothing, detectFileShare, () => false);
  // Su iPhone e iPad un PDF non si apre mai come pagina (e non si scarica con un link): si vede in un foglio dentro il sito.
  const apple = useSyncExternalStore(subscribeNothing, detectAppleDevice, () => false);
  const sheet = usePdfSheet(canShareFiles);
  // Il file preparato vale per l'indirizzo da cui viene: se l'indirizzo cambia (filtri di una tabella) non si manda quello vecchio.
  const [prepared, setPrepared] = useState<{ href: string; file: File } | null>(null);
  const file = prepared?.href === href ? prepared.file : null;
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!canShareFiles || !prefetch) return;
    let cancelled = false;
    // Un attimo di attesa: se l'indirizzo cambia di continuo (le convocate che si scelgono una dopo l'altra) non si prepara un PDF a
    // ogni tocco, ma solo quello dell'ultima scelta.
    const wait = setTimeout(() => {
      fetchPdf(href, fileName)
        .then((ready) => {
          if (!cancelled) setPrepared({ href, file: ready });
        })
        .catch(() => {
          // Non è un guaio: al tocco si riprova, e se manca ancora lo dice.
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(wait);
    };
  }, [canShareFiles, prefetch, href, fileName]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function flash(next: Status) {
    setStatus(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), 3500);
  }

  async function onClick() {
    if (status === "loading") return;

    // File già pronto sul telefono: il foglio di condivisione si apre subito, nello stesso tocco.
    if (file && canShareFiles) {
      try {
        await navigator.share({ files: [file], title, text });
        setStatus("idle");
      } catch (error) {
        // Foglio chiuso senza scegliere nessuno: non c'è altro da fare. Qualunque altro problema: su iPhone e iPad il file si vede in
        // un foglio dentro il sito (con «Condividi» e «Chiudi»), altrove si salva.
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (apple) {
          sheet.open(file, title);
          setStatus("idle");
        } else {
          saveFile(file);
          flash("saved");
        }
      }
      return;
    }

    // Non ancora pronto (rete lenta, o PDF che si prepara al tocco) o niente condivisione di file: si prepara il PDF.
    setStatus("loading");
    try {
      const ready = file ?? (await fetchPdf(href, fileName));
      setPrepared({ href, file: ready });
      if (canShareFiles) {
        // Per aprire il foglio serve un nuovo tocco: ormai è passato troppo tempo da quello di prima.
        setStatus("ready");
      } else if (apple) {
        // iPhone o iPad senza condivisione di file (sistema vecchio): niente download con un link, che lascerebbe sul PDF.
        sheet.open(ready, title);
        setStatus("idle");
      } else {
        saveFile(ready);
        flash("saved");
      }
    } catch {
      flash("error");
    }
  }

  const statusLabel =
    status === "loading"
      ? "Preparo il PDF…"
      : status === "ready"
        ? "Pronto: tocca per condividere"
        : status === "saved"
          ? "PDF scaricato"
          : status === "error"
            ? "Non riuscito: riprova"
            : label;
  const icon =
    status === "loading" ? (
      <Loader2 className="h-4 w-4 animate-spin" />
    ) : status === "saved" ? (
      <Check className="h-4 w-4" />
    ) : (
      <Share2 className="h-4 w-4" />
    );

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={iconOnly ? (size ?? "icon-sm") : size}
        className={className}
        onClick={onClick}
        disabled={status === "loading"}
        aria-live="polite"
        aria-label={iconOnly ? statusLabel : undefined}
        title={iconOnly ? statusLabel : undefined}
        data-share-status={status}
        data-share-ready={file ? "true" : "false"}
        data-share-href={href}
        {...rest}
      >
        {icon}
        {!iconOnly && statusLabel}
      </Button>
      {sheet.element}
    </>
  );
}
