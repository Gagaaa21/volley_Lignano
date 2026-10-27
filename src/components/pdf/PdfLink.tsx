"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { detectAppleDevice, detectFileShare, fetchPdf } from "@/lib/pdf/client";
import { usePdfSheet } from "./PdfSheet";

const subscribeNothing = () => () => {};

export type PdfLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
  title?: string;
  "aria-label"?: string;
  /** Come un normale link: nella pagina o in una scheda nuova (`_blank`); `download` salva il file (solo fuori da iPhone e iPad). */
  target?: "_blank";
  download?: boolean;
  /** Il titolo del foglio che si apre su iPhone e iPad (di serie, il nome del file). */
  sheetTitle?: string;
  fileName?: string;
  [attribute: `data-${string}`]: string | boolean | undefined;
};

/**
 * Il link a un PDF del sito («Scarica PDF», «Esporta PDF»…). Dal computer e da Android è un normale link, come prima. Su iPhone e
 * iPad no: lì un link a un PDF lo apre dentro la stessa finestra dell'app, senza «indietro» e senza un modo per salvarlo o mandarlo
 * su WhatsApp, e non si torna più al sito. Quindi diventa un pulsante che apre il PDF in un foglio dentro la pagina, con «Chiudi» e
 * «Condividi / Salva su File» (vedi PdfSheet): la pagina di prima resta lì sotto, com'era.
 */
export function PdfLink({ href, className, children, target, download, sheetTitle, fileName, title, "aria-label": ariaLabel, ...rest }: PdfLinkProps) {
  const apple = useSyncExternalStore(subscribeNothing, detectAppleDevice, () => false);
  const canShareFiles = useSyncExternalStore(subscribeNothing, detectFileShare, () => false);
  const sheet = usePdfSheet(canShareFiles);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  if (!apple) {
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
