import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const metadata: Metadata = {
  title: "Cambia password",
};

export default async function ChangePasswordPage() {
  const session = await getSession();
  const forced = session?.mustChangePassword;

  return (
    <div className="mx-auto max-w-md">
      <PageHeader
        back={forced ? undefined : { href: "/admin", label: "Dashboard" }}
        title="Cambia password"
        description={
          forced
            ? "Per motivi di sicurezza devi impostare una nuova password prima di continuare."
            : "Aggiorna la password del tuo account."
        }
      />

      {forced && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-sand-300/70 bg-sand-50 px-4 py-3.5 text-sm text-sand-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Stai usando una password temporanea. Impostane una nuova per accedere al resto del pannello.</p>
        </div>
      )}

      <Card>
        <CardBody className="pt-5 sm:pt-6">
          <ChangePasswordForm />
        </CardBody>
      </Card>
    </div>
  );
}
