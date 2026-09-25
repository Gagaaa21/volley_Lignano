import type { ReactNode } from "react";
import { requireStaffPage } from "@/lib/auth/guard";

export default async function AdminMinivolleyLayout({ children }: { children: ReactNode }) {
  await requireStaffPage("minivolley");
  return children;
}
