"use client";

import { useState } from "react";
import { CalendarClock, CalendarPlus, Camera, CheckCircle2, ImageIcon, PencilLine, ShieldAlert, ShieldCheck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CertificateSaveResult, CertificateStatus, StatusLabel } from "@/lib/medical/certificate";
import { Button } from "@/components/ui/Button";
import { CertificateForm } from "./CertificateForm";
import { ValidityBar } from "./ValidityBar";

const LOOK: Record<CertificateStatus["kind"], { icon: LucideIcon; band: string; badge: string; title: string; border: string }> = {
  valid: {
    icon: ShieldCheck,
    band: "bg-success-soft/55",
    badge: "bg-success text-success-foreground",
    title: "text-foreground",
    border: "border-border",
  },
  expiring: {
    icon: CalendarClock,
    band: "bg-destructive/[0.07]",
    badge: "bg-destructive text-destructive-foreground",
    title: "text-destructive",
    border: "border-destructive/45",
  },
  expired: {
    icon: ShieldAlert,
    band: "bg-destructive/[0.07]",
    badge: "bg-destructive text-destructive-foreground",
    title: "text-destructive",
    border: "border-destructive/45",
  },
  missing: {
    icon: CalendarPlus,
    band: "bg-warning-soft/70",
    badge: "bg-warning text-warning-foreground",
    title: "text-foreground",
    border: "border-warning/40",
  },
};

/**
 * Il certificato medico sulla pagina del genitore, sempre in cima: lo stato in grande, fino a quando vale con la barra della
 * validità, chi ha scritto la data e se c'è la foto. Se manca, scade entro un mese (in rosso) o è scaduto, il modulo è già aperto e
 * parte da zero (è la visita nuova, con la sua foto); se è in regola si cambia a richiesta, e se manca la foto lo dice. Salvato, il
 * riquadro si aggiorna da solo. La foto il genitore non la rivede qui: la vede solo lo staff.
 */
export function FamilyCertificateCard({
  status,
  label,
  issuedOn,
  validUntil,
  author,
  photo,
  today,
  save,
}: {
  status: CertificateStatus;
  label: StatusLabel;
  issuedOn: string | null;
  validUntil: string | null;
  /** «Data scritta da voi · 13 mar, 10:02» / «… da Gaga · …»; null senza data. */
  author: string | null;
  /** La foto caricata, con quando («27 ott, 12:50»). */
  photo: { uploadedAt: string; when: string } | null;
  today: string;
  save: (formData: FormData) => Promise<CertificateSaveResult>;
}) {
  const look = LOOK[status.kind];
  const Icon = look.icon;
  const [open, setOpen] = useState(status.kind !== "valid");
  const [saved, setSaved] = useState(false);

  return (
    <section
      id="certificato"
      className={cn("scroll-mt-6 overflow-hidden rounded-2xl border bg-card shadow-card", look.border)}
      data-family-certificate={label.tone}
    >
      <div className={cn("flex items-start gap-3.5 px-4 py-4 sm:gap-4 sm:px-5 sm:py-5", look.band)}>
        <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl shadow-[0_1px_2px_rgba(15,30,50,0.12)]", look.badge)}>
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-muted-foreground">Certificato medico</p>
          <p className={cn("mt-0.5 font-display text-[1.375rem] font-extrabold leading-tight", look.title)} data-family-certificate-badge>
            {label.badge}
          </p>
          <p className={cn("mt-1 text-sm leading-snug", status.kind === "valid" ? "text-foreground/75" : "font-semibold " + look.title)} data-family-certificate-detail>
            {label.detail}
          </p>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
        {issuedOn && validUntil && status.kind !== "missing" && (
          <div>
            <ValidityBar issuedOn={issuedOn} validUntil={validUntil} today={today} kind={status.kind} />
            {author && <p className="mt-2.5 text-[12px] text-muted-foreground">{author}</p>}
          </div>
        )}

        {issuedOn && status.kind !== "missing" && !open && (
          photo ? (
            <p className="flex items-center gap-2 text-[13px] font-semibold text-success" data-family-certificate-photo="yes">
              <ImageIcon className="h-4 w-4 shrink-0" aria-hidden />
              Foto del certificato caricata · {photo.when}
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-warning/35 bg-warning-soft/60 px-3.5 py-2.5" data-family-certificate-photo="no">
              <Camera className="h-4 w-4 shrink-0 text-warning" aria-hidden />
              <p className="min-w-0 flex-1 text-[13px] font-semibold text-foreground">Manca la foto del certificato.</p>
              <Button type="button" size="xs" variant="soft" onClick={() => setOpen(true)} data-family-certificate-add-photo>
                Aggiungi la foto
              </Button>
            </div>
          )
        )}

        {saved && !open && (
          <p className="flex items-center gap-1.5 rounded-xl bg-success-soft px-3 py-2 text-sm font-semibold text-success" role="status" data-family-certificate-saved>
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            Grazie, salvato: lo staff lo vede subito.
          </p>
        )}

        {open ? (
          <div className={cn(issuedOn && status.kind !== "missing" && "border-t border-border pt-4")}>
            <p className="mb-3 text-sm leading-relaxed text-foreground/80">
              {status.kind === "valid"
                ? "Correggete il giorno della visita o aggiungete la foto del certificato."
                : "Quando avete fatto la visita, scegliete qui il giorno e aggiungete la foto del certificato."}
            </p>
            {/* Da rinnovare o da inserire si parte da zero: è il giorno della visita nuova, con la sua foto. */}
            <CertificateForm
              issuedOn={status.kind === "valid" ? issuedOn : null}
              photo={status.kind === "valid" ? photo : null}
              today={today}
              save={save}
              onSaved={() => {
                setSaved(true);
                setOpen(false);
              }}
              submitLabel="Salva"
            />
          </div>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)} data-family-certificate-change>
            <PencilLine className="h-4 w-4" />
            {status.kind === "valid" ? "Cambia data o foto" : "Scrivi la visita nuova"}
          </Button>
        )}
      </div>
    </section>
  );
}
