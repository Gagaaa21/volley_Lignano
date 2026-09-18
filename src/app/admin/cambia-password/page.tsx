import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const metadata: Metadata = {
  title: "Cambia password",
};

export default async function ChangePasswordPage() {
  const session = await getSession();
  const forced = session?.mustChangePassword;

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-2xl font-bold text-foreground">Cambia password</h1>
      <p className="mt-1.5 text-sm text-foreground/60">
        {forced
          ? "Per motivi di sicurezza devi impostare una nuova password prima di continuare."
          : "Aggiorna la password del tuo account."}
      </p>

      {forced && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-sand-300 bg-sand-50 px-4 py-3 text-sm text-sand-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Stai usando una password temporanea. Impostane una nuova per accedere al resto del pannello.</p>
        </div>
      )}

      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-display text-base font-semibold text-foreground">Nuova password</h2>
        </CardHeader>
        <CardBody>
          <ChangePasswordForm />
        </CardBody>
      </Card>
    </div>
  );
}
