import type { ReactNode } from "react";
import { requireStaffPage } from "@/lib/auth/guard";

export default async function LiveScoreLayout({ children }: { children: ReactNode }) {
  await requireStaffPage("livescore");
  return children;
}
