import { WEEKDAY_LABELS_SHORT } from "@/lib/types";

// Monday-first display order, while values stay 0=Sunday..6=Saturday
// to match JS Date#getDay() used throughout the recurrence logic.
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function WeekdayPicker({ selected = [] }: { selected?: number[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {DISPLAY_ORDER.map((day) => (
        <label
          key={day}
          className="flex h-11 w-13 cursor-pointer items-center justify-center rounded-xl border border-border-subtle bg-surface text-sm font-semibold text-foreground/70 transition-colors has-[:checked]:border-sea-700 has-[:checked]:bg-sea-700 has-[:checked]:text-white"
        >
          <input
            type="checkbox"
            name="weekdays"
            value={day}
            defaultChecked={selected.includes(day)}
            className="sr-only"
          />
          {WEEKDAY_LABELS_SHORT[day]}
        </label>
      ))}
    </div>
  );
}
