"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRepo } from "@/lib/db";
import { requireStaff } from "@/lib/auth/guard";
import { notifyCalendarChange } from "@/lib/push";
import { CATEGORY_LABELS } from "@/lib/category";
import type { MatchInput } from "@/lib/types";

const schema = z.object({
  category: z.enum(["U14", "U15"], { message: "Seleziona una categoria." }),
  opponent: z.string().min(1, "Inserisci il nome della squadra avversaria."),
  isHome: z.boolean(),
  location: z.string().min(1, "Inserisci il luogo della partita."),
  matchDate: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Inserisci data e ora della partita."),
  notes: z.string().optional(),
});

export interface MatchFormState {
  error?: string;
}

function parseMatchForm(formData: FormData) {
  return schema.safeParse({
    category: formData.get("category")?.toString(),
    opponent: formData.get("opponent")?.toString().trim() ?? "",
    isHome: formData.get("isHome") === "home",
    location: formData.get("location")?.toString().trim() ?? "",
    matchDate: formData.get("matchDate")?.toString() ?? "",
    notes: formData.get("notes")?.toString().trim() || undefined,
  });
}

export async function saveMatchAction(
  _prevState: MatchFormState,
  formData: FormData,
): Promise<MatchFormState> {
  const session = await requireStaff();
  const parsed = parseMatchForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi." };
  }

  const id = formData.get("id")?.toString();
  const input: MatchInput = {
    category: parsed.data.category,
    opponent: parsed.data.opponent,
    isHome: parsed.data.isHome,
    location: parsed.data.location,
    matchDate: parsed.data.matchDate,
    notes: parsed.data.notes ?? null,
  };

  const repo = await getRepo();
  const matchup = `${CATEGORY_LABELS[input.category]} ${input.isHome ? "vs" : "@"} ${input.opponent}`;
  if (id) {
    await repo.updateMatch(id, input);
    await notifyCalendarChange({
      title: "Partita aggiornata",
      body: matchup,
      url: "/",
    });
  } else {
    await repo.createMatch(input, session.sub);
    await notifyCalendarChange({
      title: "Nuova partita in calendario",
      body: matchup,
      url: "/",
    });
  }

  revalidatePath("/admin/partite");
  revalidatePath("/");
  redirect("/admin/partite");
}

export async function deleteMatchAction(formData: FormData): Promise<void> {
  await requireStaff();
  const id = formData.get("id")?.toString();
  if (!id) return;
  const repo = await getRepo();
  const match = await repo.getMatch(id);
  await repo.deleteMatch(id);
  if (match) {
    await notifyCalendarChange({
      title: "Partita rimossa",
      body: `${CATEGORY_LABELS[match.category]} ${match.isHome ? "vs" : "@"} ${match.opponent} non è più in calendario.`,
      url: "/",
    });
  }
  revalidatePath("/admin/partite");
  revalidatePath("/");
}
