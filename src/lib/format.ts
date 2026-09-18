import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { WEEKDAY_LABELS_SHORT } from "@/lib/types";

const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function formatWeekdays(weekdays: number[]): string {
  return DISPLAY_ORDER.filter((d) => weekdays.includes(d))
    .map((d) => WEEKDAY_LABELS_SHORT[d])
    .join(", ");
}

export function formatDateLong(dateStr: string): string {
  return format(parseISO(dateStr), "d MMMM yyyy", { locale: it });
}

export function formatDateShort(dateStr: string): string {
  return format(parseISO(dateStr), "d MMM yyyy", { locale: it });
}
