"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { FileLink } from "@/components/files/FileLink";
import { buttonVariants } from "@/components/ui/button-variants";

/**
 * Il riepilogo della trasferta in PDF, da mandare alle famiglie: «Scarica» lo salva, «Condividi PDF» apre il foglio di
 * condivisione del telefono. Di norma non contiene nessun numero di telefono; con la casella spuntata ci sono quelli degli
 * autisti (mai quelli dei genitori delle atlete).
 */
export function TripPdfButtons({ matchId, title }: { matchId: string; title: string }) {
  const [withDriverNumbers, setWithDriverNumbers] = useState(false);
  const href = `/api/trasferte/${matchId}/pdf${withDriverNumbers ? "?numeri=autisti" : ""}`;
  return (
    <div className="flex flex-col items-start gap-2 sm:items-end" data-trip-pdf>
      <div className="flex flex-wrap items-center gap-2">
        <FileLink href={href} className={buttonVariants({ variant: "outline" })} sheetTitle={title} data-trip-pdf-download>
          <FileDown className="h-4 w-4" />
          Riepilogo PDF
        </FileLink>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
        <input
          type="checkbox"
          checked={withDriverNumbers}
          onChange={(event) => setWithDriverNumbers(event.target.checked)}
          className="h-4 w-4 accent-[var(--color-primary)]"
          data-trip-pdf-numbers
        />
        Con i numeri di telefono degli autisti
      </label>
    </div>
  );
}
