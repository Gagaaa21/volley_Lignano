"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Save } from "lucide-react";
import { saveVehicleAction, type VehicleFormState } from "@/app/admin/trasferte/actions";
import { Button } from "@/components/ui/Button";
import { FieldHint, Input, Label, RadioSegment } from "@/components/ui/Field";
import { MAX_SEATS, VEHICLE_KINDS, VEHICLE_KIND_LABELS, type TripVehicle } from "@/lib/trips/types";

const initialState: VehicleFormState = {};

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} data-vehicle-submit>
      {editing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      {pending ? "Salvataggio…" : editing ? "Salva il mezzo" : "Aggiungi il mezzo"}
    </Button>
  );
}

/**
 * Un mezzo della trasferta: tipo, chi guida (con il suo numero), posti per le atlete, partenza e note. Serve sia per
 * aggiungerne uno sia per cambiarne uno già inserito (`vehicle`). Chi guida si suggerisce dalla rubrica dei genitori, e se il
 * numero resta vuoto lo mette il sito, quando quel nome è in rubrica una volta sola.
 */
export function VehicleForm({
  matchId,
  vehicle,
  driverNames,
  idPrefix,
  narrow = false,
}: {
  matchId: string;
  vehicle?: TripVehicle;
  /** Nomi in rubrica, per i suggerimenti mentre si scrive il nome di chi guida. */
  driverNames: string[];
  /** Per distinguere gli id dei campi quando nella pagina ci sono più moduli. */
  idPrefix: string;
  /** Il modulo sta in una colonna stretta (accanto all'elenco): i campi si impilano invece di affiancarsi. */
  narrow?: boolean;
}) {
  const [state, formAction] = useActionState(saveVehicleAction, initialState);
  // Dopo un errore i campi tornano com'erano stati scritti (React altrimenti li riporterebbe ai valori salvati).
  const values = state.values;
  const editing = Boolean(vehicle);

  const listId = `${idPrefix}-nomi`;
  return (
    <form action={formAction} noValidate className="space-y-4" data-vehicle-form={editing ? "edit" : "new"}>
      <input type="hidden" name="matchId" value={matchId} />
      {vehicle && <input type="hidden" name="vehicleId" value={vehicle.id} />}

      <div>
        <Label>Mezzo</Label>
        <RadioSegment
          name="kind"
          defaultValue={(values?.kind || vehicle?.kind || "auto") as (typeof VEHICLE_KINDS)[number]}
          options={VEHICLE_KINDS.map((kind) => ({ value: kind, label: kind === "altro" ? "Altro" : VEHICLE_KIND_LABELS[kind] }))}
        />
      </div>

      <div className={narrow ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"}>
        <div>
          <Label htmlFor={`${idPrefix}-autista`}>Chi guida</Label>
          <Input
            id={`${idPrefix}-autista`}
            name="driverName"
            list={listId}
            autoComplete="off"
            defaultValue={values?.driverName ?? vehicle?.driverName}
            placeholder="Nome e cognome"
            required
          />
          <datalist id={listId}>
            {driverNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-telefono`}>Numero di chi guida</Label>
          <Input
            id={`${idPrefix}-telefono`}
            name="driverPhone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            defaultValue={values?.driverPhone ?? vehicle?.driverPhone ?? ""}
            placeholder="333 1234567"
          />
          <FieldHint>Se lo lasci vuoto e il nome è in rubrica, lo metto io.</FieldHint>
        </div>
      </div>

      <div className={narrow ? "grid grid-cols-2 gap-4" : "grid gap-4 sm:grid-cols-3"}>
        <div>
          <Label htmlFor={`${idPrefix}-posti`}>Posti per le atlete</Label>
          <Input
            id={`${idPrefix}-posti`}
            name="seats"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_SEATS}
            defaultValue={values?.seats ?? vehicle?.seats ?? 4}
            required
          />
          <FieldHint>Chi guida non conta.</FieldHint>
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-ora`}>Partenza, ora</Label>
          <Input
            id={`${idPrefix}-ora`}
            name="departureTime"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            defaultValue={values?.departureTime ?? vehicle?.departureTime ?? ""}
            placeholder="17:30"
          />
        </div>
        <div className={narrow ? "col-span-2" : undefined}>
          <Label htmlFor={`${idPrefix}-luogo`}>Partenza, luogo</Label>
          <Input
            id={`${idPrefix}-luogo`}
            name="departurePlace"
            autoComplete="off"
            defaultValue={values?.departurePlace ?? vehicle?.departurePlace ?? ""}
            placeholder="Se diverso dal ritrovo"
          />
        </div>
      </div>

      <div>
        <Label htmlFor={`${idPrefix}-note`}>Note sul mezzo</Label>
        <Input
          id={`${idPrefix}-note`}
          name="notes"
          autoComplete="off"
          defaultValue={values?.notes ?? vehicle?.notes ?? ""}
          placeholder="Es. passa a prendere Anna alla stazione"
        />
      </div>

      {state.error && (
        <p role="alert" data-vehicle-error className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex justify-end">
        <SubmitButton editing={editing} />
      </div>
    </form>
  );
}
