"use server";

import { redirect } from "next/navigation";
import { requireDev } from "@/lib/auth/guard";
import { setSessionCookie } from "@/lib/auth/session";
import { getRepo } from "@/lib/db";
import { resetTestStore, seedTestStoreFromRepo } from "@/lib/db/testMode";

export async function enterTestModeAction(): Promise<void> {
  const session = await requireDev();
  if (!session.testMode) {
    const realRepo = await getRepo();
    await resetTestStore();
    await seedTestStoreFromRepo(realRepo);
    await setSessionCookie({ ...session, testMode: true });
  }
  redirect("/admin");
}

export async function exitTestModeAction(): Promise<void> {
  const session = await requireDev();
  await resetTestStore();
  await setSessionCookie({ ...session, testMode: false });
  redirect("/admin");
}
