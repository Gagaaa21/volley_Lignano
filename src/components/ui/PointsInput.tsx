"use client";

import { useState } from "react";
import { Input, Label } from "@/components/ui/Field";

/**
 * Punti di un set: si può scrivere liberamente (anche cancellare e riscrivere),
 * il valore vale solo se è tra `min` e `max` (di norma 10 e 50).
 */
export function PointsInput({
  id,
  label,
  value,
  onCommit,
  min = 10,
  max = 50,
}: {
  id: string;
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
}) {
  const [text, setText] = useState(String(value));
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, "").slice(0, 2);
          setText(next);
          const parsed = Number(next);
          if (next !== "" && parsed >= min && parsed <= max) onCommit(parsed);
        }}
        onBlur={() => setText(String(value))}
        aria-invalid={text !== "" && (Number(text) < min || Number(text) > max)}
      />
    </div>
  );
}
