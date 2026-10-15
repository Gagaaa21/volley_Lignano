"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ButtonSize, ButtonVariant } from "@/components/ui/button-variants";

type Status = "idle" | "loading" | "ready" | "saved" | "error";

const subscribeNothing = () => () => {};

/** Il telefono (o il browser) sa mandare un file con il foglio di condivisione? Sul server e sul computer di solito no. */
function detectFileShare(): boolean {
  try {
    if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
    return navigator.canShare({ files: [new File(["%PDF-"], "prova.pdf", { type: "application/pdf" })] });
  } catch {
    return false;
  }
}

/** Il nome del file come lo dà il server (`Content-Disposition: attachment; filename="…"`), se c'è. */
function nameFromResponse(response: Response): string | null {
  const header = response.headers.get("content-disposition") ?? "";
  const found = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  if (!found) return null;
  try {
    return decodeURIComponent(found[1]);
  } catch {
    return found[1];
  }
}

async function fetchPdf(href: string, fileName: string | undefined): Promise<File> {
  const response = await fetch(href);
  if (!response.ok) throw new Error(`PDF non disponibile (${response.status})`);
  const name = fileName ?? nameFromResponse(response) ?? "documento.pdf";
  return new File([await response.blob()], name.endsWith(".pdf") ? name : `${name}.pdf`, { type: "application/pdf" });
}

/** Salva il file sul dispositivo come un normale download. */
function saveFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

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
  // Il file preparato vale per l'indirizzo da cui viene: se l'indirizzo cambia (filtri di una tabella) non si manda quello vecchio.
  const [prepared, setPrepared] = useState<{ href: string; file: File } | null>(null);
  const file = prepared?.href === href ? prepared.file : null;
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!canShareFiles || !prefetch) return;
    let cancelled = false;
    fetchPdf(href, fileName)
      .then((ready) => {
        if (!cancelled) setPrepared({ href, file: ready });
      })
      .catch(() => {
        // Non è un guaio: al tocco si riprova, e se manca ancora lo dice.
      });
    return () => {
      cancelled = true;
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
        // Foglio chiuso senza scegliere nessuno: non c'è altro da fare. Qualunque altro problema: si salva il file.
        if (error instanceof DOMException && error.name === "AbortError") return;
        saveFile(file);
        flash("saved");
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
  );
}
