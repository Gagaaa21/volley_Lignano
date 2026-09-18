import "server-only";
import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "@/lib/auth/session";

export async function requireStaff(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireDev(): Promise<SessionPayload> {
  const session = await requireStaff();
  if (session.role !== "dev") redirect("/admin");
  return session;
}
