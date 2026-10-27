"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FileText, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { buttonVariants } from "@/components/ui/button-variants";

/**
 * Un PDF visto dentro la pagina, a tutto schermo, per iPhone e iPad: con il sito sulla schermata Home, aprire un PDF come pagina
 * lascia sul file senza «indietro» e senza un modo per salvarlo o mandarlo. Qui invece c'è sempre «Chiudi» (e il tasto Esc), si
 * torna alla pagina di prima com'era, e «Condividi / Salva su File» apre il foglio di condivisione con il PDF già allegato
 * (WhatsApp, «Salva su File», e-mail…): il file è già pronto, quindi il tocco basta.
 */
function PdfSheet({
  file,
  url,
  title,
  canShare,
  onClose,
}: {
  file: File;
  url: string;
  title: string;
  canShare: boolean;
  onClose: () => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // La pagina sotto non scorre mentre il foglio è aperto.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  async function share() {
    setMessage(null);
    try {
      await navigator.share({ files: [file], title });
    } catch (error) {
      // Foglio chiuso senza scegliere nessuno: non c'è altro da dire.
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("Non riesco ad aprire la condivisione: riprova tra un attimo.");
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[100] flex flex-col bg-background"
      data-pdf-sheet
    >
      <header className="flex items-center gap-3 border-b border-border bg-surface px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <FileText className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-foreground">{title}</p>
          <p className="truncate text-[12px] text-muted-foreground">{file.name}</p>
        </div>
        <button ref={closeButton} type="button" className={buttonVariants({ variant: "outline", size: "md" })} onClick={onClose} data-pdf-sheet-close>
          <X className="h-4 w-4" />
          Chiudi
        </button>
      </header>

      <div className="min-h-0 flex-1 bg-muted">
        <iframe src={url} title={`Anteprima: ${title}`} className="h-full w-full border-0 bg-white" data-pdf-sheet-preview />
      </div>

      <footer className="space-y-2 border-t border-border bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        {message && (
          <p className="text-center text-[13px] font-semibold text-destructive" role="alert" data-pdf-sheet-message>
            {message}
          </p>
        )}
        {canShare ? (
          <Button type="button" size="lg" className="w-full" onClick={share} data-pdf-sheet-share>
            <Share2 className="h-[18px] w-[18px]" />
            Condividi / Salva su File
          </Button>
        ) : (
          <p className="text-center text-[13px] text-muted-foreground">Da qui il telefono non può mandare il file: usa il menu di condivisione del sistema.</p>
        )}
        <p className="text-center text-[12px] leading-snug text-muted-foreground">
          {canShare
            ? "Scegli WhatsApp per mandarlo, o «Salva su File» per tenerlo sul telefono. Se vedi solo la prima pagina, il file è comunque intero."
            : "Se vedi solo la prima pagina, il file è comunque intero."}
        </p>
        <Button type="button" variant="outline" size="md" className="w-full" onClick={onClose}>
          Torna al sito
        </Button>
      </footer>
    </div>,
    document.body,
  );
}

/**
 * Il foglio con il suo stato: `open(file, titolo)` lo mostra, `element` va messo nell'albero del componente che lo usa.
 * L'indirizzo temporaneo del file si libera alla chiusura (o quando se ne apre un altro).
 */
export function usePdfSheet(canShare: boolean): { open: (file: File, title: string) => void; element: ReactNode } {
  const [sheet, setSheet] = useState<{ file: File; url: string; title: string } | null>(null);
  const currentUrl = useRef<string | null>(null);

  const close = useCallback(() => {
    if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
    currentUrl.current = null;
    setSheet(null);
  }, []);

  const open = useCallback((file: File, title: string) => {
    if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
    const url = URL.createObjectURL(file);
    currentUrl.current = url;
    setSheet({ file, url, title });
  }, []);

  return {
    open,
    element: sheet ? <PdfSheet file={sheet.file} url={sheet.url} title={sheet.title} canShare={canShare} onClose={close} /> : null,
  };
}
