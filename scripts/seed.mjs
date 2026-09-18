// Crea l'account DEVELOPER iniziale ("Gaga") nel database Supabase.
// Uso: npm run seed
// Richiede SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (in .env.local o nell'ambiente).

import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    "Imposta SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (es. in .env.local) prima di eseguire il seed.",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const username = "Gaga";
const temporaryPassword = "Gaga211";

const { data: existing, error: lookupError } = await supabase
  .from("staff")
  .select("id")
  .ilike("username", username)
  .maybeSingle();

if (lookupError) {
  console.error("Errore durante la verifica dell'account esistente:", lookupError.message);
  process.exit(1);
}

if (existing) {
  console.log(`L'account "${username}" esiste già (id: ${existing.id}). Nessuna modifica effettuata.`);
  process.exit(0);
}

const passwordHash = await bcrypt.hash(temporaryPassword, 10);

const { error: insertError } = await supabase.from("staff").insert({
  username,
  password_hash: passwordHash,
  full_name: "Gaga",
  role: "dev",
  must_change_password: true,
  created_by: null,
});

if (insertError) {
  console.error("Errore durante la creazione dell'account:", insertError.message);
  process.exit(1);
}

console.log(`Account DEVELOPER creato: utente "${username}", password temporanea "${temporaryPassword}".`);
console.log("Verrà richiesto il cambio password al primo accesso.");
