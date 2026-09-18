export type StaffRole = "dev" | "admin";

export interface StaffMember {
  id: string;
  username: string;
  passwordHash: string;
  fullName: string;
  role: StaffRole;
  mustChangePassword: boolean;
  createdBy: string | null;
  createdAt: string;
}

export type PublicStaffMember = Omit<StaffMember, "passwordHash">;

export type Category = "U14" | "U15";

export const CATEGORIES: Category[] = ["U14", "U15"];

export const WEEKDAY_LABELS = [
  "Domenica",
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
] as const;

export const WEEKDAY_LABELS_SHORT = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"] as const;

export interface TrainingRule {
  id: string;
  title: string;
  location: string;
  weekdays: number[]; // 0 = Sunday ... 6 = Saturday
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  startDate: string; // ISO date "YYYY-MM-DD"
  endDate: string | null; // ISO date or null = indefinite
  notes: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TrainingRuleInput = Omit<
  TrainingRule,
  "id" | "createdBy" | "createdAt" | "updatedAt"
>;

export interface Match {
  id: string;
  category: Category;
  opponent: string;
  isHome: boolean;
  location: string;
  matchDate: string; // ISO datetime
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MatchInput = Omit<Match, "id" | "createdBy" | "createdAt" | "updatedAt">;

export type CalendarEvent =
  | {
      kind: "training";
      id: string;
      ruleId: string;
      date: string; // "YYYY-MM-DD"
      startTime: string;
      endTime: string;
      title: string;
      location: string;
      notes: string | null;
    }
  | {
      kind: "match";
      id: string;
      date: string; // "YYYY-MM-DD"
      time: string;
      category: Category;
      opponent: string;
      isHome: boolean;
      location: string;
      notes: string | null;
    };
