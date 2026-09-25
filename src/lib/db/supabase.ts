import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { LIVE_SCORE_TTL_MS, TEAMS } from "@/lib/types";
import type {
  Athlete,
  AthleteInput,
  AttendanceSession,
  AttendanceSessionInput,
  LiveScoreState,
  Match,
  MatchInput,
  MatchLineup,
  MatchLineupInput,
  PlanBlock,
  PushSubscriptionRecord,
  SetLineup,
  StaffMember,
  TrainingOccurrencePlan,
  TrainingPlan,
  TrainingPlanInput,
  TrainingRule,
  TrainingRuleInput,
} from "@/lib/types";
import type { MatchFilter, NewStaffInput, Repo, TeamFilter, TrainingFilter } from "@/lib/db/repo";

type TrainingRow = {
  id: string;
  title: string;
  location: string;
  repeat: TrainingRule["repeat"];
  weekdays: number[];
  start_time: string;
  end_time: string;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  is_active: boolean;
  team: TrainingRule["team"];
  is_tournament: boolean;
  color: TrainingRule["color"];
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type MatchRow = {
  id: string;
  team: Match["team"];
  category: Match["category"];
  opponent: string;
  is_home: boolean;
  location: string;
  match_date: string;
  is_friendly: boolean;
  is_tournament: boolean;
  meeting_time: string | null;
  meeting_location: string | null;
  notes: string | null;
  called_up_athlete_ids: string[] | null;
  set_scores: { us: number; them: number }[] | null;
  result_sets_won: number | null;
  result_sets_lost: number | null;
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
  has_seen_guide: boolean;
  allowed_pages: StaffMember["allowedPages"];
  allowed_teams: StaffMember["allowedTeams"];
  created_by: string | null;
  created_at: string;
};

function trainingFromRow(row: TrainingRow): TrainingRule {
  return {
    id: row.id,
    title: row.title,
    location: row.location,
    repeat: row.repeat,
    weekdays: row.weekdays,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    startDate: row.start_date,
    endDate: row.end_date,
    notes: row.notes,
    isActive: row.is_active,
    team: row.team,
    isTournament: row.is_tournament,
    color: row.color,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function trainingToRow(input: TrainingRuleInput) {
  return {
    title: input.title,
    location: input.location,
    repeat: input.repeat,
    weekdays: input.weekdays,
    start_time: input.startTime,
    end_time: input.endTime,
    start_date: input.startDate,
    end_date: input.endDate,
    notes: input.notes,
    is_active: input.isActive,
    team: input.team,
    is_tournament: input.isTournament,
    color: input.color,
  };
}

function matchFromRow(row: MatchRow): Match {
  return {
    id: row.id,
    team: row.team,
    category: row.category,
    opponent: row.opponent,
    isHome: row.is_home,
    location: row.location,
    matchDate: row.match_date,
    isFriendly: row.is_friendly,
    isTournament: row.is_tournament,
    meetingTime: row.meeting_time ? row.meeting_time.slice(0, 5) : null,
    meetingLocation: row.meeting_location,
    notes: row.notes,
    calledUpAthleteIds: row.called_up_athlete_ids ?? [],
    setScores: row.set_scores,
    resultSetsWon: row.result_sets_won,
    resultSetsLost: row.result_sets_lost,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function matchToRow(input: MatchInput) {
  return {
    team: input.team,
    category: input.category,
    opponent: input.opponent,
    is_home: input.isHome,
    location: input.location,
    match_date: input.matchDate,
    is_friendly: input.isFriendly,
    is_tournament: input.isTournament,
    meeting_time: input.meetingTime,
    meeting_location: input.meetingLocation,
    notes: input.notes,
    called_up_athlete_ids: input.calledUpAthleteIds,
    set_scores: input.setScores,
    result_sets_won: input.resultSetsWon,
    result_sets_lost: input.resultSetsLost,
  };
}

type MatchLineupRow = {
  match_id: string;
  sets: SetLineup[] | null;
  updated_by: string | null;
  updated_at: string;
};

function matchLineupFromRow(row: MatchLineupRow): MatchLineup {
  return {
    matchId: row.match_id,
    sets: row.sets ?? [],
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
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
    hasSeenGuide: row.has_seen_guide,
    allowedPages: row.allowed_pages,
    // Fallback per chi non ha ancora eseguito la migrazione che aggiunge la
    // colonna allowed_teams: senza, Supabase la restituisce undefined e il
    // Centro di controllo va in errore (.includes su undefined).
    allowedTeams: row.allowed_teams ?? TEAMS,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

type TrainingPlanRow = {
  id: string;
  title: string;
  notes: string | null;
  blocks: PlanBlock[];
  team: TrainingPlan["team"];
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function trainingPlanFromRow(row: TrainingPlanRow): TrainingPlan {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    blocks: row.blocks ?? [],
    team: row.team,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function trainingPlanToRow(input: TrainingPlanInput) {
  return {
    title: input.title,
    notes: input.notes,
    blocks: input.blocks,
    team: input.team,
  };
}

type TrainingOccurrencePlanRow = {
  id: string;
  training_rule_id: string;
  occurrence_date: string;
  plan_id: string;
  is_public: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function occurrencePlanFromRow(row: TrainingOccurrencePlanRow): TrainingOccurrencePlan {
  return {
    id: row.id,
    trainingRuleId: row.training_rule_id,
    occurrenceDate: row.occurrence_date,
    planId: row.plan_id,
    isPublic: row.is_public,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type AthleteRow = {
  id: string;
  full_name: string;
  team: Athlete["team"];
  category: Athlete["category"];
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type AttendanceSessionRow = {
  id: string;
  training_rule_id: string | null;
  team: AttendanceSession["team"];
  session_date: string;
  title: string;
  location: string;
  records: Record<string, AttendanceSession["records"][string]>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function athleteFromRow(row: AthleteRow): Athlete {
  return {
    id: row.id,
    fullName: row.full_name,
    team: row.team,
    category: row.category,
    isActive: row.is_active,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function athleteToRow(input: AthleteInput) {
  return {
    full_name: input.fullName,
    team: input.team,
    category: input.category,
    is_active: input.isActive,
    notes: input.notes,
  };
}

function attendanceSessionFromRow(row: AttendanceSessionRow): AttendanceSession {
  return {
    id: row.id,
    trainingRuleId: row.training_rule_id,
    team: row.team,
    sessionDate: row.session_date,
    title: row.title,
    location: row.location,
    records: row.records ?? {},
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function attendanceSessionToRow(input: AttendanceSessionInput) {
  return {
    training_rule_id: input.trainingRuleId,
    team: input.team,
    session_date: input.sessionDate,
    title: input.title,
    location: input.location,
    records: input.records,
  };
}

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  staff_id: string | null;
  team: PushSubscriptionRecord["team"];
  created_at: string;
};

function pushSubscriptionFromRow(row: PushSubscriptionRow): PushSubscriptionRecord {
  return {
    id: row.id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    staffId: row.staff_id,
    team: row.team,
    createdAt: row.created_at,
  };
}

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data == null) throw new Error("Nessun dato restituito da Supabase");
  return result.data;
}

// Tabellone live (allenamento): un'unica riga fissa, come test_mode_store.
const LIVE_SCORE_ROW_ID = "current";

export const supabaseRepo: Repo = {
  async listTrainings(filter?: TrainingFilter) {
    const db = getSupabaseAdmin();
    let query = db.from("training_sessions").select("*").order("start_time", { ascending: true });
    if (filter?.team) query = query.eq("team", filter.team);
    const { data, error } = await query;
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
    if (filter?.team) query = query.eq("team", filter.team);
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

  async listMatchLineups() {
    const db = getSupabaseAdmin();
    const { data, error } = await db.from("match_lineups").select("*");
    if (error) throw new Error(error.message);
    return (data as MatchLineupRow[]).map(matchLineupFromRow);
  },
  async getMatchLineup(matchId) {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("match_lineups")
      .select("*")
      .eq("match_id", matchId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? matchLineupFromRow(data as MatchLineupRow) : null;
  },
  async saveMatchLineup(matchId, input: MatchLineupInput, updatedBy) {
    const db = getSupabaseAdmin();
    const result = await db
      .from("match_lineups")
      .upsert(
        { match_id: matchId, sets: input.sets, updated_by: updatedBy, updated_at: new Date().toISOString() },
        { onConflict: "match_id" },
      )
      .select("*")
      .single();
    return matchLineupFromRow(unwrap(result) as MatchLineupRow);
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
        allowed_pages: input.allowedPages,
        allowed_teams: input.allowedTeams,
        created_by: input.createdBy,
      })
      .select("*")
      .single();
    return staffFromRow(unwrap(result) as StaffRow);
  },
  async updateStaffProfile(id, input) {
    const db = getSupabaseAdmin();
    const result = await db
      .from("staff")
      .update({ username: input.username, full_name: input.fullName })
      .eq("id", id)
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
  async updateStaffPermissions(id, input) {
    const db = getSupabaseAdmin();
    const { error } = await db
      .from("staff")
      .update({ allowed_pages: input.allowedPages, allowed_teams: input.allowedTeams })
      .eq("id", id);
    if (error) throw new Error(error.message);
  },
  async markGuideSeen(id) {
    const db = getSupabaseAdmin();
    const { error } = await db.from("staff").update({ has_seen_guide: true }).eq("id", id);
    if (error) throw new Error(error.message);
  },
  async deleteStaff(id) {
    const db = getSupabaseAdmin();
    const { error } = await db.from("staff").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  async listTrainingPlans(filter?: TeamFilter) {
    const db = getSupabaseAdmin();
    let query = db.from("training_plans").select("*").order("created_at", { ascending: false });
    if (filter?.team) query = query.eq("team", filter.team);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data as TrainingPlanRow[]).map(trainingPlanFromRow);
  },
  async getTrainingPlan(id) {
    const db = getSupabaseAdmin();
    const { data, error } = await db.from("training_plans").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? trainingPlanFromRow(data as TrainingPlanRow) : null;
  },
  async createTrainingPlan(input, createdBy) {
    const db = getSupabaseAdmin();
    const result = await db
      .from("training_plans")
      .insert({ ...trainingPlanToRow(input), created_by: createdBy })
      .select("*")
      .single();
    return trainingPlanFromRow(unwrap(result) as TrainingPlanRow);
  },
  async updateTrainingPlan(id, input) {
    const db = getSupabaseAdmin();
    const result = await db
      .from("training_plans")
      .update({ ...trainingPlanToRow(input), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    return trainingPlanFromRow(unwrap(result) as TrainingPlanRow);
  },
  async deleteTrainingPlan(id) {
    const db = getSupabaseAdmin();
    const { error } = await db.from("training_plans").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  async listTrainingOccurrencePlans() {
    const db = getSupabaseAdmin();
    const { data, error } = await db.from("training_occurrence_plans").select("*");
    if (error) throw new Error(error.message);
    return (data as TrainingOccurrencePlanRow[]).map(occurrencePlanFromRow);
  },
  async getTrainingOccurrencePlan(trainingRuleId, occurrenceDate) {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("training_occurrence_plans")
      .select("*")
      .eq("training_rule_id", trainingRuleId)
      .eq("occurrence_date", occurrenceDate)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? occurrencePlanFromRow(data as TrainingOccurrencePlanRow) : null;
  },
  async setTrainingOccurrencePlan(trainingRuleId, occurrenceDate, planId, isPublic, createdBy) {
    const db = getSupabaseAdmin();
    const result = await db
      .from("training_occurrence_plans")
      .upsert(
        {
          training_rule_id: trainingRuleId,
          occurrence_date: occurrenceDate,
          plan_id: planId,
          is_public: isPublic,
          created_by: createdBy,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "training_rule_id,occurrence_date" },
      )
      .select("*")
      .single();
    return occurrencePlanFromRow(unwrap(result) as TrainingOccurrencePlanRow);
  },
  async removeTrainingOccurrencePlan(trainingRuleId, occurrenceDate) {
    const db = getSupabaseAdmin();
    const { error } = await db
      .from("training_occurrence_plans")
      .delete()
      .eq("training_rule_id", trainingRuleId)
      .eq("occurrence_date", occurrenceDate);
    if (error) throw new Error(error.message);
  },

  async listAthletes(filter?: TeamFilter) {
    const db = getSupabaseAdmin();
    let query = db.from("athletes").select("*").order("full_name", { ascending: true });
    if (filter?.team) query = query.eq("team", filter.team);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data as AthleteRow[]).map(athleteFromRow);
  },
  async getAthlete(id) {
    const db = getSupabaseAdmin();
    const { data, error } = await db.from("athletes").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? athleteFromRow(data as AthleteRow) : null;
  },
  async createAthlete(input, createdBy) {
    const db = getSupabaseAdmin();
    const result = await db
      .from("athletes")
      .insert({ ...athleteToRow(input), created_by: createdBy })
      .select("*")
      .single();
    return athleteFromRow(unwrap(result) as AthleteRow);
  },
  async createAthletesBulk(inputs, createdBy) {
    if (inputs.length === 0) return [];
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("athletes")
      .insert(inputs.map((input) => ({ ...athleteToRow(input), created_by: createdBy })))
      .select("*");
    if (error) throw new Error(error.message);
    return (data as AthleteRow[]).map(athleteFromRow);
  },
  async updateAthlete(id, input) {
    const db = getSupabaseAdmin();
    const result = await db
      .from("athletes")
      .update({ ...athleteToRow(input), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    return athleteFromRow(unwrap(result) as AthleteRow);
  },
  async deleteAthlete(id) {
    const db = getSupabaseAdmin();
    const { error } = await db.from("athletes").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  async listAttendanceSessions(filter?: TeamFilter) {
    const db = getSupabaseAdmin();
    let query = db.from("attendance_sessions").select("*").order("session_date", { ascending: false });
    if (filter?.team) query = query.eq("team", filter.team);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data as AttendanceSessionRow[]).map(attendanceSessionFromRow);
  },
  async getAttendanceSession(id) {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("attendance_sessions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? attendanceSessionFromRow(data as AttendanceSessionRow) : null;
  },
  async getAttendanceSessionByOccurrence(trainingRuleId, sessionDate) {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("attendance_sessions")
      .select("*")
      .eq("training_rule_id", trainingRuleId)
      .eq("session_date", sessionDate)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? attendanceSessionFromRow(data as AttendanceSessionRow) : null;
  },
  async createAttendanceSession(input, createdBy) {
    const db = getSupabaseAdmin();
    const result = await db
      .from("attendance_sessions")
      .insert({ ...attendanceSessionToRow(input), created_by: createdBy })
      .select("*")
      .single();
    return attendanceSessionFromRow(unwrap(result) as AttendanceSessionRow);
  },
  async updateAttendanceSession(id, input) {
    const db = getSupabaseAdmin();
    const result = await db
      .from("attendance_sessions")
      .update({ ...attendanceSessionToRow(input), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    return attendanceSessionFromRow(unwrap(result) as AttendanceSessionRow);
  },
  async deleteAttendanceSession(id) {
    const db = getSupabaseAdmin();
    const { error } = await db.from("attendance_sessions").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  async listPushSubscriptions() {
    const db = getSupabaseAdmin();
    const { data, error } = await db.from("push_subscriptions").select("*");
    if (error) throw new Error(error.message);
    return (data as PushSubscriptionRow[]).map(pushSubscriptionFromRow);
  },
  async upsertPushSubscription(input) {
    const db = getSupabaseAdmin();
    const { error } = await db.from("push_subscriptions").upsert(
      {
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        team: input.team,
        ...(input.staffId !== undefined ? { staff_id: input.staffId } : {}),
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);
  },
  async deletePushSubscriptionByEndpoint(endpoint) {
    const db = getSupabaseAdmin();
    const { error } = await db.from("push_subscriptions").delete().eq("endpoint", endpoint);
    if (error) throw new Error(error.message);
  },

  async getLiveScoreState() {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("live_score_state")
      .select("data, updated_at")
      .eq("id", LIVE_SCORE_ROW_ID)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const age = Date.now() - new Date(data.updated_at as string).getTime();
    if (age > LIVE_SCORE_TTL_MS) {
      // Oltre le 3 ore non va solo ignorato: la riga va cancellata subito,
      // altrimenti resterebbe a occupare spazio su Supabase finché
      // qualcuno non riapre lo strumento (vedi LIVE_SCORE_TTL_MS).
      await db.from("live_score_state").delete().eq("id", LIVE_SCORE_ROW_ID);
      return null;
    }
    return data.data as LiveScoreState;
  },
  async saveLiveScoreState(state: LiveScoreState) {
    const db = getSupabaseAdmin();
    const { error } = await db
      .from("live_score_state")
      .upsert({ id: LIVE_SCORE_ROW_ID, data: state, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
  },
  async clearLiveScoreState() {
    const db = getSupabaseAdmin();
    const { error } = await db.from("live_score_state").delete().eq("id", LIVE_SCORE_ROW_ID);
    if (error) throw new Error(error.message);
  },

  async getStorageOverview() {
    const db = getSupabaseAdmin();
    const { data, error } = await db.rpc("table_sizes");
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { table_name: string; row_estimate: number; total_bytes: number }[];
    return {
      tables: rows.map((row) => ({
        table: row.table_name,
        rowCount: row.row_estimate,
        sizeBytes: row.total_bytes,
      })),
      generatedAt: new Date().toISOString(),
    };
  },
};
