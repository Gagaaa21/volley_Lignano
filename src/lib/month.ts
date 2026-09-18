import { addMonths, format, parse } from "date-fns";

export function parseMonthParam(value?: string): Date {
  if (value) {
    const parsed = parse(value, "yyyy-MM", new Date());
    if (!Number.isNaN(parsed.getTime())) {
      return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
    }
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function formatMonthParam(date: Date): string {
  return format(date, "yyyy-MM");
}

export function shiftMonth(date: Date, delta: number): Date {
  return addMonths(date, delta);
}
