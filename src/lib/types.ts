export type StaffRole = "dev" | "admin";

export interface StaffMember {
  id: string;
  username: string;
  passwordHash: string;
  fullName: string;
  role: StaffRole;
  mustChangePassword: boolean;
  hasSeenGuide: boolean;
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

export type TrainingRepeat = "weekly" | "once";

export interface TrainingRule {
  id: string;
  title: string;
  location: string;
  repeat: TrainingRepeat;
  weekdays: number[]; // 0 = Sunday ... 6 = Saturday (ignorato se repeat = "once")
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  startDate: string; // ISO date "YYYY-MM-DD" (per "once" è la data dell'evento)
  endDate: string | null; // ISO date o null = indefinito (ignorato se repeat = "once")
  notes: string | null;
  isActive: boolean;
  planId: string | null; // scheda allenamento collegata (opzionale)
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

export interface TrainingBlock {
  id: string;
  title: string;
  durationMinutes: number;
  content: string; // testo libero, righe con "-"/"*" o "1." diventano liste
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TrainingBlockInput = Omit<
  TrainingBlock,
  "id" | "createdBy" | "createdAt" | "updatedAt"
>;

export interface TrainingPlan {
  id: string;
  title: string;
  planDate: string | null; // ISO date
  notes: string | null;
  blockIds: string[]; // ordine dei blocchi nella scheda
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TrainingPlanInput = Omit<
  TrainingPlan,
  "id" | "createdBy" | "createdAt" | "updatedAt"
>;

export interface Athlete {
  id: string;
  fullName: string;
  category: Category | null;
  isActive: boolean;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AthleteInput = Omit<Athlete, "id" | "createdBy" | "createdAt" | "updatedAt">;

export type AttendanceStatus = "present" | "excused" | "unexcused";

export interface AttendanceSession {
  id: string;
  trainingRuleId: string | null;
  sessionDate: string; // "YYYY-MM-DD"
  title: string; // istantanea del titolo dell'allenamento al momento della registrazione
  location: string; // istantanea del luogo
  records: Record<string, AttendanceStatus>; // athleteId -> stato
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AttendanceSessionInput = Omit<
  AttendanceSession,
  "id" | "createdBy" | "createdAt" | "updatedAt"
>;

export interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: string;
}

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
