import type { ReactNode } from "react";
import { requireStaffPage } from "@/lib/auth/guard";

export default async function StaffLayout({ children }: { children: ReactNode }) {
  await requireStaffPage("staff");
  return children;
}
