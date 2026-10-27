"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { detectAppleDevice, detectFileShare, detectSheetMode, fetchPdf } from "@/lib/pdf/client";
import { usePdfSheet } from "./PdfSheet";

const subscribeNothing = () => () => {};

export type PdfLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
  title?: string;
  "aria-label"?: string;
  /** Sul computer: in una scheda nuova (`_blank`), oppure nella pagina. `download` salva il file. */
  target?: "_blank";
  download?: boolean;
  /** Il titolo del foglio che si apre su telefono e tablet (di serie, il nome del file). */
  sheetTitle?: string;
  fileName?: string;
  [attribute: `data-${string}`]: string | boolean | undefined;
};

/**
 * L'unico pulsante di un PDF del sito («PDF», «Scarica PDF», «Esporta PDF»…): si guarda e si manda da qui, non ci sono due pulsanti.
 * - Sul computer è un normale link: il PDF si apre in una scheda (o si scarica), con il visualizzatore del browser.
 * - Su telefono e tablet è un pulsante che apre il PDF in un foglio dentro la pagina, con «Condividi» (WhatsApp, «Salva su File»,
 *   e-mail…), «Scarica» (su Android) e «Chiudi». Su iPhone e iPad è l'unico modo: con il sito sulla schermata Home un link a un PDF
 *   lo apre nella stessa finestra dell'app, senza «indietro» e senza un modo per salvarlo o mandarlo, e non si torna più al sito.
 * Il PDF si scarica al tocco (con quello che c'è a schermo in quel momento, per esempio le convocate scelte): quando il foglio si
 * apre il file è già pronto, quindi «Condividi» parte al primo tocco.
 */
export function PdfLink({ href, className, children, target, download, sheetTitle, fileName, title, "aria-label": ariaLabel, ...rest }: PdfLinkProps) {
  const inSheet = useSyncExternalStore(subscribeNothing, detectSheetMode, () => false);
  const apple = useSyncExternalStore(subscribeNothing, detectAppleDevice, () => false);
  const canShareFiles = useSyncExternalStore(subscribeNothing, detectFileShare, () => false);
  const sheet = usePdfSheet({ canShare: canShareFiles, apple });
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  if (!inSheet) {
    return (
      <a
        href={href}
        className={className}
        title={title}
        aria-label={ariaLabel}
        target={target}
        rel={target === "_blank" ? "noopener noreferrer" : undefined}
        download={download ? "" : undefined}
        {...rest}
      >
        {children}
      </a>
    );
  }

  async function open() {
    if (state === "loading") return;
    setState("loading");
    try {
      const file = await fetchPdf(href, fileName);
      sheet.open(file, sheetTitle ?? file.name.replace(/\.pdf$/i, ""));
      setState("idle");
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 4000);
    }
  }

  return (
    <>
      <button
        type="button"
        className={className}
        title={title}
        aria-label={ariaLabel}
        aria-busy={state === "loading"}
        disabled={state === "loading"}
        onClick={open}
        data-pdf-open
        data-pdf-href={href}
        {...rest}
      >
        {state === "loading" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {children}
      </button>
      {state === "error" && (
        <span className="text-[13px] font-semibold text-destructive" role="alert" data-pdf-error>
          PDF non disponibile: riprova
        </span>
      )}
      {sheet.element}
    </>
  );
}
