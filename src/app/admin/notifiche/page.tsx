import type { Metadata } from "next";
import { Bell, Gauge } from "lucide-react";
import { requireDev } from "@/lib/auth/guard";
import { getRepo } from "@/lib/db";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { NotificationForm } from "./NotificationForm";

export const metadata: Metadata = {
  title: "Notifiche",
};

export default async function NotifichePage() {
  await requireDev();
  const repo = await getRepo();
  const subscriberCount = (await repo.listPushSubscriptions()).length;

  return (
    <div className="mx-auto max-w-2xl">
      <p className="eyebrow">
        <Gauge className="h-3 w-3" />
        Solo Developer
      </p>
      <h1 className="mt-1.5 font-display text-2xl font-bold text-foreground">Notifiche</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Invia una notifica push a tutti gli iscritti al calendario pubblico (non solo allo staff),
        per avvisi occasionali che non corrispondono a una modifica automatica del calendario —
        es. &quot;le convocazioni sono disponibili&quot;.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
            <Bell className="h-4 w-4 text-sea-700" />
            Invia notifica manuale
          </h2>
          <p className="mt-1 text-sm text-foreground/60">
            {subscriberCount > 0
              ? `${subscriberCount} dispositivi iscritti al momento.`
              : "Nessun dispositivo è iscritto alle notifiche al momento."}
          </p>
        </CardHeader>
        <CardBody>
          <NotificationForm />
        </CardBody>
      </Card>
    </div>
  );
}
