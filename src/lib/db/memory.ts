import bcrypt from "bcryptjs";
import type {
  Match,
  MatchInput,
  StaffMember,
  TrainingBlock,
  TrainingBlockInput,
  TrainingPlan,
  TrainingPlanInput,
  TrainingRule,
  TrainingRuleInput,
} from "@/lib/types";
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

const blockSeeds: Array<Omit<TrainingBlock, "id" | "createdBy" | "createdAt" | "updatedAt">> = [
  {
    title: "Foam roll + elastici",
    durationMinutes: 10,
    content: "Solito lavoro di preparazione con foam roll, elastici e attivazione.",
  },
  {
    title: "Riscaldamento a coppie con palla",
    durationMinutes: 15,
    content: `Lavoro a coppie con:

* Palleggio
* Bagher frontale
* Bagher laterale con spostamento

Progressione dell'intensità mantenendo attenzione alla tecnica e alla qualità del gesto.`,
  },
  {
    title: "Progressione analitica ricezione",
    durationMinutes: 30,
    content: `Esercizio "Pippo", con progressione:

1. Lancio
2. Palleggio
3. Palleggio spinto
4. Battuta controllata

La battuta viene eseguita prima centrale e poi esterna, lavorando sulla capacità di leggere la traiettoria e adattare lo spostamento.`,
  },
  {
    title: "Battuta + ricezione + attacco",
    durationMinutes: 30,
    content: `Tre giocatrici in ricezione, con un palleggiatore in zona 2.

Dall'altra parte le altre ragazze in battuta, con un tecnico che interviene per rinforzare le battute sbagliate e mantenere continuità nel lavoro.

Dopo un giro di ricezioni viene inserito il centrale: battuta, ricezione, palleggio, attacco.

Successivamente, se il livello del gruppo lo permette, viene inserito anche il muro.`,
  },
  {
    title: "P3 + P4",
    durationMinutes: 45,
    content: `Studio e gioco nei sistemi P3 e P4, con battuta effettuata dalle ragazze.

Applicazione del lavoro svolto durante l'allenamento: battuta, ricezione, costruzione, attacco, gioco.`,
  },
];

const trainingBlocks: TrainingBlock[] = blockSeeds.map((seed) => ({
  ...seed,
  id: uid(),
  createdBy: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}));

const trainingPlans: TrainingPlan[] = [
  {
    id: uid(),
    title: "Ricezione e sistema P3/P4",
    planDate: isoDate(2),
    notes: "Durata complessiva: 130 minuti.",
    blockIds: trainingBlocks.map((b) => b.id),
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

  async listTrainingBlocks() {
    return [...trainingBlocks].sort((a, b) => a.title.localeCompare(b.title));
  },
  async getTrainingBlock(id) {
    return trainingBlocks.find((b) => b.id === id) ?? null;
  },
  async createTrainingBlock(input: TrainingBlockInput, createdBy) {
    const now = new Date().toISOString();
    const row: TrainingBlock = { ...input, id: uid(), createdBy, createdAt: now, updatedAt: now };
    trainingBlocks.push(row);
    return row;
  },
  async updateTrainingBlock(id, input: TrainingBlockInput) {
    const idx = trainingBlocks.findIndex((b) => b.id === id);
    if (idx === -1) throw new Error("Blocco non trovato");
    trainingBlocks[idx] = { ...trainingBlocks[idx], ...input, updatedAt: new Date().toISOString() };
    return trainingBlocks[idx];
  },
  async deleteTrainingBlock(id) {
    const idx = trainingBlocks.findIndex((b) => b.id === id);
    if (idx !== -1) trainingBlocks.splice(idx, 1);
    for (const plan of trainingPlans) {
      const pos = plan.blockIds.indexOf(id);
      if (pos !== -1) {
        plan.blockIds.splice(pos, 1);
        plan.updatedAt = new Date().toISOString();
      }
    }
  },

  async listTrainingPlans() {
    return [...trainingPlans].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async getTrainingPlan(id) {
    return trainingPlans.find((p) => p.id === id) ?? null;
  },
  async createTrainingPlan(input: TrainingPlanInput, createdBy) {
    const now = new Date().toISOString();
    const row: TrainingPlan = { ...input, id: uid(), createdBy, createdAt: now, updatedAt: now };
    trainingPlans.push(row);
    return row;
  },
  async updateTrainingPlan(id, input: TrainingPlanInput) {
    const idx = trainingPlans.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Scheda non trovata");
    trainingPlans[idx] = { ...trainingPlans[idx], ...input, updatedAt: new Date().toISOString() };
    return trainingPlans[idx];
  },
  async deleteTrainingPlan(id) {
    const idx = trainingPlans.findIndex((p) => p.id === id);
    if (idx !== -1) trainingPlans.splice(idx, 1);
  },
};
