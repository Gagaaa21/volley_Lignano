import { NextResponse } from "next/server";
import { getNotifyPromptAt } from "@/lib/notifyPrompt";

// Deve riflettere subito (entro un minuto) una nuova richiesta del Developer.
export const dynamic = "force-dynamic";

/**
 * Istante dell'ultima «richiesta di attivazione delle notifiche». Pubblica:
 * contiene solo una data, nessun dato di persone. La chiede solo chi può
 * ancora attivare le notifiche (permesso del browser non ancora deciso),
 * quindi il traffico è minimo, e la rete di Vercel tiene la risposta un minuto.
 */
export async function GET() {
  const at = await getNotifyPromptAt();
  return NextResponse.json(
    { at },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" } },
  );
}
