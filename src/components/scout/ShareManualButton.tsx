"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ButtonSize, ButtonVariant } from "@/components/ui/button-variants";

const MANUAL_URL = "/api/scout/manuale";
const FILE_NAME = "volley-lignano-scout-manuale-d-uso.pdf";

type Status = "idle" | "loading" | "ready" | "saved" | "error";

const subscribeNothing = () => () => {};

/** Il telefono (o il browser) sa mandare un file con il foglio di condivisione? Sul server e sul computer di solito no. */
function detectFileShare(): boolean {
  try {
    if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
    return navigator.canShare({ files: [new File(["%PDF-"], FILE_NAME, { type: "application/pdf" })] });
  } catch {
    return false;
  }
}

async function fetchManual(): Promise<File> {
  const response = await fetch(MANUAL_URL);
  if (!response.ok) throw new Error(`Manuale non disponibile (${response.status})`);
  return new File([await response.blob()], FILE_NAME, { type: "application/pdf" });
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

/**
 * «Condividi PDF»: manda il manuale d'uso dello Scout come **file**. Dal
 * telefono apre il foglio di condivisione con il PDF già allegato (WhatsApp,
 * e-mail, «Salva su File»…); dove non è possibile (di solito il computer) lo
 * scarica. Sul telefono il file si prepara appena si apre la pagina: il foglio
 * di condivisione si può aprire solo subito dopo un tocco, senza attese in mezzo.
 */
export function ShareManualButton({ variant = "outline", size }: { variant?: ButtonVariant; size?: ButtonSize }) {
  const canShareFiles = useSyncExternalStore(subscribeNothing, detectFileShare, () => false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dal telefono il PDF si scarica in anticipo, così il tocco può aprire subito il foglio di condivisione.
  useEffect(() => {
    if (!canShareFiles) return;
    let cancelled = false;
    fetchManual()
      .then((prepared) => {
        if (!cancelled) setFile(prepared);
      })
      .catch(() => {
        // Non è un guaio: al tocco si riprova, e se manca ancora lo dice.
      });
    return () => {
      cancelled = true;
    };
  }, [canShareFiles]);

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
        await navigator.share({ files: [file], title: "Scout · Manuale d'uso", text: "Il manuale d'uso dello Scout di Volley Lignano." });
        setStatus("idle");
      } catch (error) {
        // Foglio chiuso senza scegliere nessuno: non c'è altro da fare. Qualunque altro problema: si salva il file.
        if (error instanceof DOMException && error.name === "AbortError") return;
        saveFile(file);
        flash("saved");
      }
      return;
    }

    // Non ancora pronto (rete lenta) o niente condivisione di file: si prepara il PDF.
    setStatus("loading");
    try {
      const prepared = file ?? (await fetchManual());
      setFile(prepared);
      if (canShareFiles) {
        // Per aprire il foglio serve un nuovo tocco: ormai è passato troppo tempo da quello di prima.
        setStatus("ready");
      } else {
        saveFile(prepared);
        flash("saved");
      }
    } catch {
      flash("error");
    }
  }

  const label =
    status === "loading"
      ? "Preparo il PDF…"
      : status === "ready"
        ? "Pronto: tocca per condividere"
        : status === "saved"
          ? "PDF scaricato"
          : status === "error"
            ? "Non riuscito: riprova"
            : "Condividi PDF";

  return (
    <Button type="button" variant={variant} size={size} onClick={onClick} disabled={status === "loading"} aria-live="polite" data-scout-share-manual data-share-status={status} data-share-ready={file ? "true" : "false"}>
      {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : status === "saved" ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {label}
    </Button>
  );
}
