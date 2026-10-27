"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Check, Download, FileText, Image as ImageIcon, Share2, Table2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { buttonVariants } from "@/components/ui/button-variants";
import { canShareFile, fileKind, formatFileSize, saveFile } from "@/lib/files/client";

/** Quanto di un file di testo (CSV, calendario…) si mostra nell'anteprima: il resto c'è comunque nel file. */
const TEXT_PREVIEW_CHARS = 6_000;

function kindIcon(file: File): ReactNode {
  const className = "h-[18px] w-[18px]";
  if (file.type === "text/csv") return <Table2 className={className} aria-hidden />;
  if (file.type === "text/calendar") return <CalendarDays className={className} aria-hidden />;
  if (fileKind(file.type) === "image") return <ImageIcon className={className} aria-hidden />;
  return <FileText className={className} aria-hidden />;
}

/** Le prime righe di un file di testo, senza il segno d'ordine dei byte che i CSV per Excel portano in testa. */
function TextPreview({ file }: { file: File }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    file.text().then((content) => {
      if (!cancelled) setText(content.replace(/^﻿/, ""));
    });
    return () => {
      cancelled = true;
    };
  }, [file]);
  if (text === null) return <p className="p-4 text-[13px] text-muted-foreground">Carico l&apos;anteprima…</p>;
  const cut = text.length > TEXT_PREVIEW_CHARS;
  return (
    <pre className="h-full overflow-auto whitespace-pre p-4 font-mono text-[12px] leading-relaxed text-foreground" data-file-sheet-text>
      {cut ? `${text.slice(0, TEXT_PREVIEW_CHARS)}\n…` : text}
    </pre>
  );
}

function Preview({ file, url, title }: { file: File; url: string; title: string }) {
  const kind = fileKind(file.type);
  if (kind === "pdf") return <iframe src={url} title={`Anteprima: ${title}`} className="h-full w-full border-0 bg-white" data-file-sheet-preview />;
  if (kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element -- un file appena scaricato dal dispositivo: non c'è niente da ottimizzare.
    return <img src={url} alt={title} className="h-full w-full object-contain" data-file-sheet-preview />;
  }
  if (kind === "text") return <TextPreview file={file} />;
  return (
    <div className="grid h-full place-items-center p-6 text-center text-[13px] text-muted-foreground">
      <p>Il file è pronto: scegli sotto cosa farne.</p>
    </div>
  );
}

/**
 * Il file visto dentro la pagina, a tutto schermo, per telefoni e tablet: un solo pulsante («PDF», «Esporta CSV», «Aggiungi al
 * calendario»…) lo apre, e da qui si guarda e si manda («Condividi» apre il foglio del telefono con il file già allegato: WhatsApp,
 * «Salva su File», e-mail…; su Android c'è anche «Scarica»). C'è sempre «Chiudi» (e Esc): si torna alla pagina di prima com'era.
 * Su iPhone e iPad è l'unico modo giusto di aprire un file: con il sito sulla schermata Home, un file aperto come pagina lascia
 * senza «indietro» e senza un modo per salvarlo o mandarlo.
 *
 * Ogni sistema manda solo certi tipi di file (Chrome, per esempio, non i .ics): se questo non si può mandare, resta «Scarica».
 */
function FileSheet({ file, url, title, apple, onClose }: { file: File; url: string; title: string; apple: boolean; onClose: () => void }) {
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const canShare = useMemo(() => canShareFile(file), [file]);
  const isPdf = fileKind(file.type) === "pdf";
  // Su iPhone e iPad un PDF salvato con un download si aprirebbe come pagina (la trappola): lì lo si salva solo dal foglio di condivisione.
  const canDownload = !apple || (!canShare && !isPdf);
  const hint = canShare
    ? apple
      ? isPdf
        ? "Scegli WhatsApp per mandarlo, o «Salva su File» per tenerlo sul telefono. Se vedi solo la prima pagina, il file è comunque intero."
        : "Scegli l'app con cui mandarlo o aprirlo, oppure «Salva su File» per tenerlo sul telefono."
      : "Scegli l'app con cui mandarlo (WhatsApp, e-mail…), oppure «Scarica» per tenerlo sul telefono."
    : canDownload
      ? "Da questo telefono il file non si manda direttamente: scaricalo e aprilo da lì."
      : isPdf
        ? "Se vedi solo la prima pagina, il file è comunque intero."
        : "";

  useEffect(() => {
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Se il foglio è stato aperto da dentro un'altra finestra (i dettagli di un evento), Esc chiude solo il foglio.
      event.stopPropagation();
      onClose();
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
      setMessage({ kind: "error", text: "Non riesco ad aprire la condivisione: riprova tra un attimo." });
    }
  }

  function download() {
    saveFile(file);
    setMessage({ kind: "ok", text: "File scaricato." });
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[100] flex flex-col bg-background" data-file-sheet>
      <header className="flex items-center gap-3 border-b border-border bg-surface px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">{kindIcon(file)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-foreground">{title}</p>
          <p className="truncate text-[12px] text-muted-foreground">
            {file.name} · {formatFileSize(file.size)}
          </p>
        </div>
        <button ref={closeButton} type="button" className={buttonVariants({ variant: "outline", size: "md" })} onClick={onClose} data-file-sheet-close>
          <X className="h-4 w-4" />
          Chiudi
        </button>
      </header>

      <div className="min-h-0 flex-1 bg-muted">
        <Preview file={file} url={url} title={title} />
      </div>

      <footer className="space-y-2 border-t border-border bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        {message && (
          <p
            className={message.kind === "error" ? "text-center text-[13px] font-semibold text-destructive" : "flex items-center justify-center gap-1.5 text-center text-[13px] font-semibold text-success"}
            role={message.kind === "error" ? "alert" : "status"}
            data-file-sheet-message
          >
            {message.kind === "ok" && <Check className="h-4 w-4" aria-hidden />}
            {message.text}
          </p>
        )}
        {canShare || canDownload ? (
          <div className={canShare && canDownload && !apple ? "grid grid-cols-2 gap-2" : "grid"}>
            {canShare && (
              <Button type="button" size="lg" onClick={share} data-file-sheet-share>
                <Share2 className="h-[18px] w-[18px]" />
                {apple ? "Condividi / Salva su File" : "Condividi"}
              </Button>
            )}
            {canDownload && (
              <Button type="button" size="lg" variant={canShare ? "outline" : "primary"} onClick={download} data-file-sheet-download>
                <Download className="h-[18px] w-[18px]" />
                Scarica
              </Button>
            )}
          </div>
        ) : (
          <p className="text-center text-[13px] text-muted-foreground">Da qui il telefono non può mandare il file: usa il menu di condivisione del sistema.</p>
        )}
        {hint && <p className="text-center text-[12px] leading-snug text-muted-foreground">{hint}</p>}
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
export function useFileSheet(options: { apple: boolean }): { open: (file: File, title: string) => void; element: ReactNode } {
  const { apple } = options;
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
    element: sheet ? <FileSheet file={sheet.file} url={sheet.url} title={sheet.title} apple={apple} onClose={close} /> : null,
  };
}
