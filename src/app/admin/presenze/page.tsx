import type { Metadata } from "next";
import { Construction } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Presenze",
};

export default function AttendancePage() {
  return (
    <div className="mx-auto max-w-xl py-10 text-center">
      <Card>
        <CardBody className="flex flex-col items-center gap-4 pt-10 pb-10">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-training-soft)] text-[var(--color-training-strong)]">
            <Construction className="h-8 w-8" strokeWidth={2} />
          </span>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">In costruzione</h1>
            <p className="mt-2 text-sm text-foreground/60">
              La gestione delle presenze agli allenamenti arriverà presto in questa sezione,
              riservata a Developer e Admin.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
