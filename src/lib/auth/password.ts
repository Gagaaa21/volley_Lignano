import "server-only";
import bcrypt from "bcryptjs";
import { loginPasswordCandidates } from "./passwordInput";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** La password scritta all'accesso: com'è, oppure senza gli spazi ai lati (vedi loginPasswordCandidates). */
export async function verifyTypedPassword(typed: string, hash: string): Promise<boolean> {
  for (const candidate of loginPasswordCandidates(typed)) {
    if (await bcrypt.compare(candidate, hash)) return true;
  }
  return false;
}
