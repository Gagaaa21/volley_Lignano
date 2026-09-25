import type { ReactNode } from "react";
import { requireStaffPage } from "@/lib/auth/guard";

export default async function PartiteLayout({ children }: { children: ReactNode }) {
  await requireStaffPage("partite");
  return children;
}
