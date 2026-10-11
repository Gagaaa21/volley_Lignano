import type { ReactNode } from "react";
import { requireStaffPage } from "@/lib/auth/guard";

export default async function ScoutLayout({ children }: { children: ReactNode }) {
  await requireStaffPage("scout");
  return children;
}
