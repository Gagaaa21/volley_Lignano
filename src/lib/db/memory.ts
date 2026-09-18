import bcrypt from "bcryptjs";
import type { Match, MatchInput, StaffMember, TrainingRule, TrainingRuleInput } from "@/lib/types";
import type { MatchFilter, NewStaffInput, Repo } from "@/lib/db/repo";

/**
 * In-memory demo backend, used automatically when Supabase env vars are not
 * configured. Lets the site be previewed locally with realistic sample data
 * before a real Supabase project is wired up. Data resets on server restart.
 */

function uid() {
  return crypto.randomUUID();
}

function isoDate(daysFromToday: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

const trainings: TrainingRule[] = [
  {
    id: uid(),
    title: "Allenamento",
    location: "Palestra Comunale, Lignano Sabbiadoro",
    weekdays: [1, 3], // Monday, Wednesday
    startTime: "18:30",
    endTime: "20:30",
    startDate: isoDate(-60),
    endDate: null,
    notes: "Allenamento congiunto U14 e U15.",
    isActive: true,
    createdBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: uid(),
    title: "Allenamento",
    location: "Palestra Comunale, Lignano Sabbiadoro",
    weekdays: [5], // Friday
    startTime: "17:00",
    endTime: "19:00",
    startDate: isoDate(-60),
    endDate: null,
    notes: "Lavoro tecnico e partite di allenamento.",
    isActive: true,
    createdBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function nextDate(daysFromToday: number, hour: number, minute: number) {
  // Naive local datetime string "YYYY-MM-DDTHH:mm" (no timezone conversion),
  // matching the <input type="datetime-local"> format used in the admin forms.
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  const mi = String(minute).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

const matches: Match[] = [
  {
    id: uid(),
    category: "U15",
    opponent: "Pallavolo Udine",
    isHome: true,
    location: "Palestra Comunale, Lignano Sabbiadoro",
    matchDate: nextDate(3, 17, 0),
    notes: null,
    createdBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: uid(),
    category: "U14",
    opponent: "Volley Latisana",
    isHome: false,
    location: "Palestra Comunale, Latisana",
    matchDate: nextDate(9, 15, 30),
    notes: "Ritrovo un'ora prima della partenza.",
    createdBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: uid(),
    category: "U15",
    opponent: "San Vito Volley",
    isHome: true,
    location: "Palestra Comunale, Lignano Sabbiadoro",
    matchDate: nextDate(16, 18, 0),
    notes: null,
    createdBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const staff: StaffMember[] = [];
let staffSeeded = false;

async function ensureStaffSeeded() {
  if (staffSeeded) return;
  staffSeeded = true;
  const passwordHash = await bcrypt.hash("Gaga211", 10);
  staff.push({
    id: uid(),
    username: "Gaga",
    passwordHash,
    fullName: "Gaga",
    role: "dev",
    mustChangePassword: true,
    createdBy: null,
    createdAt: new Date().toISOString(),
  });
}

export const memoryRepo: Repo = {
  async listTrainings() {
    return [...trainings].sort((a, b) => a.startTime.localeCompare(b.startTime));
  },
  async getTraining(id) {
    return trainings.find((t) => t.id === id) ?? null;
  },
  async createTraining(input: TrainingRuleInput, createdBy) {
    const now = new Date().toISOString();
    const row: TrainingRule = { ...input, id: uid(), createdBy, createdAt: now, updatedAt: now };
    trainings.push(row);
    return row;
  },
  async updateTraining(id, input: TrainingRuleInput) {
    const idx = trainings.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error("Allenamento non trovato");
    trainings[idx] = { ...trainings[idx], ...input, updatedAt: new Date().toISOString() };
    return trainings[idx];
  },
  async deleteTraining(id) {
    const idx = trainings.findIndex((t) => t.id === id);
    if (idx !== -1) trainings.splice(idx, 1);
  },

  async listMatches(filter?: MatchFilter) {
    let result = [...matches];
    if (filter?.category) result = result.filter((m) => m.category === filter.category);
    if (filter?.from) result = result.filter((m) => m.matchDate.slice(0, 10) >= filter.from!);
    if (filter?.to) result = result.filter((m) => m.matchDate.slice(0, 10) <= filter.to!);
    return result.sort((a, b) => a.matchDate.localeCompare(b.matchDate));
  },
  async getMatch(id) {
    return matches.find((m) => m.id === id) ?? null;
  },
  async createMatch(input: MatchInput, createdBy) {
    const now = new Date().toISOString();
    const row: Match = { ...input, id: uid(), createdBy, createdAt: now, updatedAt: now };
    matches.push(row);
    return row;
  },
  async updateMatch(id, input: MatchInput) {
    const idx = matches.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error("Partita non trovata");
    matches[idx] = { ...matches[idx], ...input, updatedAt: new Date().toISOString() };
    return matches[idx];
  },
  async deleteMatch(id) {
    const idx = matches.findIndex((m) => m.id === id);
    if (idx !== -1) matches.splice(idx, 1);
  },

  async listStaff() {
    await ensureStaffSeeded();
    return [...staff].sort((a, b) => a.username.localeCompare(b.username));
  },
  async getStaffById(id) {
    await ensureStaffSeeded();
    return staff.find((s) => s.id === id) ?? null;
  },
  async getStaffByUsername(username) {
    await ensureStaffSeeded();
    return staff.find((s) => s.username.toLowerCase() === username.toLowerCase()) ?? null;
  },
  async createStaff(input: NewStaffInput) {
    await ensureStaffSeeded();
    const row: StaffMember = { ...input, id: uid(), createdAt: new Date().toISOString() };
    staff.push(row);
    return row;
  },
  async setStaffPassword(id, passwordHash, mustChangePassword) {
    await ensureStaffSeeded();
    const idx = staff.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error("Utente non trovato");
    staff[idx] = { ...staff[idx], passwordHash, mustChangePassword };
  },
  async deleteStaff(id) {
    await ensureStaffSeeded();
    const idx = staff.findIndex((s) => s.id === id);
    if (idx !== -1) staff.splice(idx, 1);
  },
};
