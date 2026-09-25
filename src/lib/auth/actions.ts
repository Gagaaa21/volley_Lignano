"use server";

import { redirect } from "next/navigation";
import { clearActiveTeamCookie, clearSessionCookie } from "@/lib/auth/session";

export async function logoutAction() {
  await clearSessionCookie();
  await clearActiveTeamCookie();
  redirect("/login");
}
