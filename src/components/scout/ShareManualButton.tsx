"use client";

import { SharePdfButton } from "@/components/pdf/SharePdfButton";
import type { ButtonSize, ButtonVariant } from "@/components/ui/button-variants";

const MANUAL_URL = "/api/scout/manuale";
const FILE_NAME = "volley-lignano-scout-manuale-d-uso.pdf";

/**
 * «Condividi PDF» del manuale d'uso dello Scout: lo manda come **file** (dal telefono si apre il foglio di condivisione
 * con il PDF già allegato; dal computer il file si scarica). Il pulsante è lo stesso di tutti gli altri PDF del sito
 * (`SharePdfButton`); il manuale si prepara appena si apre la pagina, così basta un tocco.
 */
export function ShareManualButton({ variant = "outline", size }: { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <SharePdfButton
      href={MANUAL_URL}
      fileName={FILE_NAME}
      title="Scout · Manuale d'uso"
      text="Il manuale d'uso dello Scout di Volley Lignano."
      prefetch
      variant={variant}
      size={size}
      data-scout-share-manual
    />
  );
}
