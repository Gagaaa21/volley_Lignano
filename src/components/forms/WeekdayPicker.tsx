import { WEEKDAY_LABELS_SHORT } from "@/lib/types";

// Monday-first display order, while values stay 0=Sunday..6=Saturday
// to match JS Date#getDay() used throughout the recurrence logic.
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function WeekdayPicker({ selected = [] }: { selected?: number[] }) {
  return (
    <div className="grid grid-cols-7 gap-1 sm:flex sm:flex-wrap sm:gap-1.5">
      {DISPLAY_ORDER.map((day) => (
        <label
          key={day}
          className="flex h-10 min-w-0 cursor-pointer items-center justify-center rounded-xl border border-input bg-surface px-1 text-sm sm:min-w-12 sm:px-2 font-semibold text-muted-foreground shadow-xs transition-colors hover:border-border-strong hover:text-foreground has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40"
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
