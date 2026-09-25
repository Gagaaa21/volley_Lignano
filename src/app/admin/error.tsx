"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";

// Rete di sicurezza per l'area riservata: senza questo file un'eccezione
// non gestita (es. Supabase lento/irraggiungibile durante un salvataggio)
// mostrerebbe la pagina di errore generica di Next al posto dell'intera
// area riservata. Qui resta visibile l'header (allo stesso livello di
// admin/layout.tsx) e si sostituisce solo il contenuto con un invito a
// riprovare, senza perdere la sessione né la navigazione.
export default function AdminErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="mx-auto max-w-md py-10">
      <Card>
        <CardBody className="flex flex-col items-center gap-3 pt-8 text-center">
          <span className="icon-chip bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <h1 className="font-display text-lg font-bold text-foreground">Qualcosa è andato storto</h1>
          <p className="text-sm text-muted-foreground">
            Probabilmente un problema di connessione temporaneo. I dati inseriti in questa pagina
            non sono stati persi: riprova.
          </p>
          <div className="mt-3 flex w-full flex-col gap-2.5">
            <Button type="button" onClick={() => retry()} className="w-full justify-center">
              <RotateCcw className="h-4 w-4" />
              Riprova
            </Button>
            <LinkButton href="/admin" variant="ghost" className="w-full justify-center">
              Torna alla dashboard
            </LinkButton>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
