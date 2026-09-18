import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Match, MatchInput, StaffMember, TrainingRule, TrainingRuleInput } from "@/lib/types";
import type { MatchFilter, NewStaffInput, Repo } from "@/lib/db/repo";

type TrainingRow = {
  id: string;
  title: string;
  location: string;
  weekdays: number[];
  start_time: string;
  end_time: string;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type MatchRow = {
  id: string;
  category: Match["category"];
  opponent: string;
  is_home: boolean;
  location: string;
  match_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type StaffRow = {
  id: string;
  username: string;
  password_hash: string;
  full_name: string;
  role: StaffMember["role"];
  must_change_password: boolean;
  created_by: string | null;
  created_at: string;
};

function trainingFromRow(row: TrainingRow): TrainingRule {
  return {
    id: row.id,
    title: row.title,
    location: row.location,
    weekdays: row.weekdays,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    startDate: row.start_date,
    endDate: row.end_date,
    notes: row.notes,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function trainingToRow(input: TrainingRuleInput) {
  return {
    title: input.title,
    location: input.location,
    weekdays: input.weekdays,
    start_time: input.startTime,
    end_time: input.endTime,
    start_date: input.startDate,
    end_date: input.endDate,
    notes: input.notes,
    is_active: input.isActive,
  };
}

function matchFromRow(row: MatchRow): Match {
  return {
    id: row.id,
    category: row.category,
    opponent: row.opponent,
    isHome: row.is_home,
    location: row.location,
    matchDate: row.match_date,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function matchToRow(input: MatchInput) {
  return {
    category: input.category,
    opponent: input.opponent,
    is_home: input.isHome,
    location: input.location,
    match_date: input.matchDate,
    notes: input.notes,
  };
}

function staffFromRow(row: StaffRow): StaffMember {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    fullName: row.full_name,
    role: row.role,
    mustChangePassword: row.must_change_password,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data == null) throw new Error("Nessun dato restituito da Supabase");
  return result.data;
}

export const supabaseRepo: Repo = {
  async listTrainings() {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("training_sessions")
      .select("*")
      .order("start_time", { ascending: true });
    if (error) throw new Error(error.message);
    return (data as TrainingRow[]).map(trainingFromRow);
  },
  async getTraining(id) {
    const db = getSupabaseAdmin();
    const { data, error } = await db.from("training_sessions").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? trainingFromRow(data as TrainingRow) : null;
  },
  async createTraining(input, createdBy) {
    const db = getSupabaseAdmin();
    const result = await db
      .from("training_sessions")
      .insert({ ...trainingToRow(input), created_by: createdBy })
      .select("*")
      .single();
    return trainingFromRow(unwrap(result) as TrainingRow);
  },
  async updateTraining(id, input) {
    const db = getSupabaseAdmin();
    const result = await db
      .from("training_sessions")
      .update({ ...trainingToRow(input), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    return trainingFromRow(unwrap(result) as TrainingRow);
  },
  async deleteTraining(id) {
    const db = getSupabaseAdmin();
    const { error } = await db.from("training_sessions").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  async listMatches(filter?: MatchFilter) {
    const db = getSupabaseAdmin();
    let query = db.from("matches").select("*").order("match_date", { ascending: true });
    if (filter?.category) query = query.eq("category", filter.category);
    if (filter?.from) query = query.gte("match_date", `${filter.from}T00:00:00`);
    if (filter?.to) query = query.lte("match_date", `${filter.to}T23:59:59`);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data as MatchRow[]).map(matchFromRow);
  },
  async getMatch(id) {
    const db = getSupabaseAdmin();
    const { data, error } = await db.from("matches").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? matchFromRow(data as MatchRow) : null;
  },
  async createMatch(input, createdBy) {
    const db = getSupabaseAdmin();
    const result = await db
      .from("matches")
      .insert({ ...matchToRow(input), created_by: createdBy })
      .select("*")
      .single();
    return matchFromRow(unwrap(result) as MatchRow);
  },
  async updateMatch(id, input) {
    const db = getSupabaseAdmin();
    const result = await db
      .from("matches")
      .update({ ...matchToRow(input), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    return matchFromRow(unwrap(result) as MatchRow);
  },
  async deleteMatch(id) {
    const db = getSupabaseAdmin();
    const { error } = await db.from("matches").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  async listStaff() {
    const db = getSupabaseAdmin();
    const { data, error } = await db.from("staff").select("*").order("username", { ascending: true });
    if (error) throw new Error(error.message);
    return (data as StaffRow[]).map(staffFromRow);
  },
  async getStaffById(id) {
    const db = getSupabaseAdmin();
    const { data, error } = await db.from("staff").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? staffFromRow(data as StaffRow) : null;
  },
  async getStaffByUsername(username) {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("staff")
      .select("*")
      .ilike("username", username)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? staffFromRow(data as StaffRow) : null;
  },
  async createStaff(input: NewStaffInput) {
    const db = getSupabaseAdmin();
    const result = await db
      .from("staff")
      .insert({
        username: input.username,
        password_hash: input.passwordHash,
        full_name: input.fullName,
        role: input.role,
        must_change_password: input.mustChangePassword,
        created_by: input.createdBy,
      })
      .select("*")
      .single();
    return staffFromRow(unwrap(result) as StaffRow);
  },
  async setStaffPassword(id, passwordHash, mustChangePassword) {
    const db = getSupabaseAdmin();
    const { error } = await db
      .from("staff")
      .update({ password_hash: passwordHash, must_change_password: mustChangePassword })
      .eq("id", id);
    if (error) throw new Error(error.message);
  },
  async deleteStaff(id) {
    const db = getSupabaseAdmin();
    const { error } = await db.from("staff").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};
